import { Env } from "../env"
import { Log } from "../util/log"

type ProviderModelShape = {
  id: string
  providerID: string
  name: string
  api: {
    id: string
    npm: string
    url: string
  }
  status: string
  capabilities: {
    temperature: boolean
    reasoning: boolean
    attachment: boolean
    toolcall: boolean
    input: {
      text: boolean
      audio: boolean
      image: boolean
      video: boolean
      pdf: boolean
    }
    output: {
      text: boolean
      audio: boolean
      image: boolean
      video: boolean
      pdf: boolean
    }
    interleaved: boolean
  }
  cost: {
    input: number
    output: number
    cache: {
      read: number
      write: number
    }
  }
  options: Record<string, unknown>
  limit: {
    context: number
    output: number
  }
  headers: Record<string, string>
}

type ProviderInfoShape = {
  id: string
  name: string
  source: string
  env: string[]
  options: Record<string, unknown>
  models: Record<string, ProviderModelShape>
}

type RateLimitConfig = {
  requestsPerInterval: number
  intervalMs: number
}

type RetryConfig = {
  maxRetries: number
  baseDelayMs: number
}

type FetchConfig = {
  baseFetch?: typeof fetch
  rateLimit?: RateLimitConfig
  retry?: RetryConfig
}

type ErrorPayload = {
  error: {
    message: string
    type: string
    code?: string | number
  }
}

const DEFAULT_BASE_URL = "https://open.bigmodel.cn/api/paas/v4"
const DEFAULT_TIMEOUT_MS = 5 * 60 * 1000
const DEFAULT_RATE_LIMIT: RateLimitConfig = {
  requestsPerInterval: 5,
  intervalMs: 1000,
}
const DEFAULT_RETRY: RetryConfig = {
  maxRetries: 3,
  baseDelayMs: 500,
}

const RETRYABLE_STATUSES = new Set([408, 409, 425, 429, 500, 502, 503, 504])

const log = Log.create({ service: "provider.glm" })

function createModel(id: string, context: number, display?: string): ProviderModelShape {
  return {
    id,
    providerID: "glm",
    name: display ?? id.toUpperCase(),
    api: {
      id,
      npm: "@ai-sdk/openai-compatible",
      url: DEFAULT_BASE_URL,
    },
    status: "active",
    capabilities: {
      temperature: true,
      reasoning: id.includes("plus"),
      attachment: false,
      toolcall: true,
      input: {
        text: true,
        audio: false,
        image: false,
        video: false,
        pdf: false,
      },
      output: {
        text: true,
        audio: false,
        image: false,
        video: false,
        pdf: false,
      },
      interleaved: false,
    },
    cost: {
      input: 0,
      output: 0,
      cache: {
        read: 0,
        write: 0,
      },
    },
    options: {},
    limit: {
      context,
      output: 4096,
    },
    headers: {},
  }
}

const MODEL_REGISTRY: Record<string, ProviderModelShape> = {
  "glm-4": createModel("glm-4", 128_000, "GLM-4"),
  "glm-4-plus": createModel("glm-4-plus", 200_000, "GLM-4-Plus"),
  "glm-4-air": createModel("glm-4-air", 64_000, "GLM-4-Air"),
}

function delay(ms: number) {
  return Bun.sleep(ms)
}

function shouldRetry(status: number) {
  return RETRYABLE_STATUSES.has(status)
}

function enhanceBody(payload: unknown) {
  if (!payload || typeof payload !== "object") return payload
  const next = { ...(payload as Record<string, unknown>) }
  if (next["stream"] && !next["stream_options"]) {
    next["stream_options"] = { include_usage: true }
  }
  if (!next["metadata"]) {
    next["metadata"] = { client: "opencode" }
  }
  return next
}

async function parseErrorBody(response: Response) {
  const cloned = response.clone()
  const text = await cloned.text().catch(() => "")
  if (!text) return undefined
  try {
    return JSON.parse(text) as Record<string, unknown>
  } catch (error) {
    log.warn("failed to parse GLM error payload", { error })
    return { raw: text }
  }
}

function mapErrorMessage(status: number, payload?: Record<string, unknown>): ErrorPayload {
  const baseMessage =
    (payload?.error as any)?.message ||
    (payload?.msg as string) ||
    (payload?.message as string) ||
    (payload?.raw as string) ||
    "GLM request failed"

  const messageLower = baseMessage.toLowerCase()

  if (status === 401 || status === 403) {
    return {
      error: {
        type: "invalid_api_key",
        code: payload?.error && (payload.error as any).code,
        message:
          "Invalid GLM API key. Set GLM_API_KEY or configure provider.glm.options.apiKey in your OpenCode config.",
      },
    }
  }

  if (status === 429) {
    return {
      error: {
        type: "rate_limit_exceeded",
        code: "rate_limit",
        message: "GLM rate limit exceeded. Please slow down or request a higher quota.",
      },
    }
  }

  const isTokenLimit = messageLower.includes("token") || messageLower.includes("context")

  if (isTokenLimit) {
    return {
      error: {
        type: "context_length_exceeded",
        code: "context_length",
        message:
          "GLM token limit exceeded. Reduce the prompt size or lower max_tokens to stay within the context window.",
      },
    }
  }

  return {
    error: {
      type: "glm_api_error",
      code: (payload?.error as any)?.code ?? (payload?.code as string) ?? status,
      message: baseMessage,
    },
  }
}

async function normalizeErrorResponse(response: Response) {
  const payload = await parseErrorBody(response)
  const normalized = mapErrorMessage(response.status, payload)
  return new Response(JSON.stringify(normalized), {
    status: response.status,
    headers: {
      "content-type": "application/json",
    },
  })
}

function cloneInit(init?: RequestInit, bodyOverride?: string) {
  if (!init && !bodyOverride) return init
  return {
    ...init,
    body: bodyOverride ?? init?.body,
  }
}

export namespace GLMProvider {
  export const ENV = {
    API_KEY: "GLM_API_KEY",
    MODEL: "GLM_MODEL",
    BASE_URL: "GLM_BASE_URL",
  } as const

  export function ensureDatabaseEntry(database: Record<string, ProviderInfoShape | undefined>) {
    if (database["glm"]) return
    database["glm"] = {
      id: "glm",
      name: "GLM",
      source: "custom",
      env: [ENV.API_KEY],
      options: {
        baseURL: DEFAULT_BASE_URL,
        timeout: DEFAULT_TIMEOUT_MS,
      },
      models: { ...MODEL_REGISTRY },
    }
  }

  export function preferredModel() {
    return Env.get(ENV.MODEL)?.trim()
  }

  export function resolveBaseURL(existing?: string) {
    return Env.get(ENV.BASE_URL)?.trim() || existing || DEFAULT_BASE_URL
  }

  export function createRateLimitedFetch(config: FetchConfig = {}) {
    const baseFetch = config.baseFetch ?? fetch
    const rate = {
      ...DEFAULT_RATE_LIMIT,
      ...(config.rateLimit ?? {}),
    }
    const retry = {
      ...DEFAULT_RETRY,
      ...(config.retry ?? {}),
    }

    let available = Math.max(rate.requestsPerInterval, 1)
    const queue: Array<() => void> = []

    const drain = () => {
      if (!queue.length || available <= 0) return
      while (available > 0 && queue.length) {
        const job = queue.shift()
        if (!job) continue
        available -= 1
        job()
      }
    }

    const refill = () => {
      available = Math.max(rate.requestsPerInterval, 1)
      drain()
    }

    const timer = setInterval(refill, Math.max(rate.intervalMs, 100))
    ;(timer as any).unref?.()

    const schedule = async <T>(fn: () => Promise<T>) =>
      new Promise<T>((resolve, reject) => {
        const task = () => {
          fn()
            .then(resolve)
            .catch(reject)
        }
        queue.push(task)
        drain()
      })

    const doFetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const bodyString = typeof init?.body === "string" ? init.body : undefined
      const parsedBody = bodyString ? enhanceBody(JSON.parse(bodyString)) : undefined
      const serializedBody = parsedBody ? JSON.stringify(parsedBody) : bodyString

      const headers = new Headers(init?.headers ?? {})
      if (!headers.has("content-type")) {
        headers.set("content-type", "application/json")
      }
      headers.set("x-opencode-provider", "glm")

      const baseInit = {
        ...init,
        headers,
        body: serializedBody ?? init?.body,
      }

      let lastError: unknown
      for (let attempt = 0; attempt <= retry.maxRetries; attempt++) {
        try {
          const response = await baseFetch(input, cloneInit(baseInit, serializedBody))
          if (!response.ok) {
            if (shouldRetry(response.status) && attempt < retry.maxRetries) {
              response.body?.cancel?.()
              await delay(retry.baseDelayMs * Math.pow(2, attempt))
              continue
            }
            return await normalizeErrorResponse(response)
          }
          return response
        } catch (error) {
          lastError = error
          if (attempt >= retry.maxRetries) throw error
          await delay(retry.baseDelayMs * Math.pow(2, attempt))
        }
      }
      throw lastError ?? new Error("GLM request failed")
    }

    const wrappedFetch = async (input: RequestInfo | URL, init?: RequestInit) => schedule(() => doFetch(input, init))
    return wrappedFetch as typeof fetch
  }

  export function createLoaderOptions(provider?: ProviderInfoShape) {
    const envKey = Env.get(ENV.API_KEY)?.trim()
    const baseOptions = { ...(provider?.options ?? {}) }

    const configuredKey = typeof baseOptions["apiKey"] === "string" ? (baseOptions["apiKey"] as string).trim() : undefined
    const customHeaders = (baseOptions["headers"] as Record<string, string> | undefined) ?? {}
    const customFetch = baseOptions["fetch"] as typeof fetch | undefined
    const rateLimitOverrides = baseOptions["rateLimit"] as Partial<RateLimitConfig> | undefined
    const retryOverrides = baseOptions["retry"] as Partial<RetryConfig> | undefined
    const baseURL = resolveBaseURL(baseOptions["baseURL"] as string | undefined)

    delete baseOptions["fetch"]
    delete baseOptions["rateLimit"]
    delete baseOptions["retry"]
    delete baseOptions["headers"]
    delete baseOptions["baseURL"]
    delete baseOptions["apiKey"]

    const headers = {
      ...customHeaders,
      "x-opencode-provider": "glm",
    }

    const options: Record<string, unknown> = {
      ...baseOptions,
      baseURL,
      headers,
      timeout: baseOptions["timeout"] ?? DEFAULT_TIMEOUT_MS,
      fetch: createRateLimitedFetch({
        baseFetch: customFetch,
        rateLimit: rateLimitOverrides,
        retry: retryOverrides,
      }),
    }

    if (envKey) {
      options["apiKey"] = envKey
    } else if (configuredKey) {
      options["apiKey"] = configuredKey
    }

    const autoload = Boolean(options["apiKey"])
    if (!autoload) {
      log.debug("GLM provider skipped (missing API key)")
    }

    return {
      autoload,
      options,
    }
  }
}
