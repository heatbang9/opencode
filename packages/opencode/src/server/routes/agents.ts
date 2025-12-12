import { Hono } from "hono"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { AgentMessageService } from "../services/agent-message"

const app = new Hono()

// 메시지 전송
app.post("/message", zValidator("json", z.object({
  from: z.string(),
  to: z.string(),
  type: z.enum(["request", "response", "broadcast", "notification"]),
  channel: z.enum(["file", "task", "sync", "custom", "status", "error"]),
  payload: z.record(z.any()),
  priority: z.enum(["low", "normal", "high", "urgent"]).default("normal"),
  replyTo: z.string().optional(),
  expiresAt: z.string().datetime().optional(),
})), async (c) => {
  const input = c.req.valid("json")

  try {
    const message = await AgentMessageService.send({
      ...input,
      expiresAt: input.expiresAt ? new Date(input.expiresAt) : undefined,
    })

    return c.json({ success: true, data: message }, 201)
  } catch (error) {
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }, 500)
  }
})

// 브로드캐스트 메시지 전송
app.post("/broadcast", zValidator("json", z.object({
  from: z.string(),
  channel: z.enum(["file", "task", "sync", "custom", "status", "error"]),
  payload: z.record(z.any()),
  priority: z.enum(["low", "normal", "high", "urgent"]).default("normal"),
  excludeSessions: z.array(z.string()).optional(),
  workspaceId: z.string().optional(),
})), async (c) => {
  const input = c.req.valid("json")

  try {
    const messages = await AgentMessageService.broadcast(input)
    return c.json({ success: true, data: messages }, 201)
  } catch (error) {
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }, 500)
  }
})

// 메시지 수신 확인
app.post("/acknowledge", zValidator("json", z.object({
  messageId: z.string(),
  sessionId: z.string(),
  status: z.enum(["delivered", "read", "processed"]),
})), async (c) => {
  const input = c.req.valid("json")

  try {
    const updatedMessage = await AgentMessageService.acknowledge(input)
    return c.json({ success: true, data: updatedMessage })
  } catch (error) {
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }, 500)
  }
})

// 메시지 목록 조회
app.get("/messages", zValidator("query", z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  type: z.enum(["request", "response", "broadcast", "notification"]).optional(),
  channel: z.enum(["file", "task", "sync", "custom", "status", "error"]).optional(),
  status: z.enum(["pending", "delivered", "read", "processed"]).optional(),
  since: z.string().datetime().optional(),
  until: z.string().datetime().optional(),
  limit: z.number().optional(),
})), async (c) => {
  const query = c.req.valid("query")

  try {
    const messages = await AgentMessageService.list({
      filter: {
        from: query.from,
        to: query.to,
        type: query.type,
        channel: query.channel,
        status: query.status,
        since: query.since ? new Date(query.since) : undefined,
        until: query.until ? new Date(query.until) : undefined,
        limit: query.limit,
      },
    })

    return c.json({ success: true, data: messages })
  } catch (error) {
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }, 500)
  }
})

// 세션별 메시지 목록 조회
app.get("/:id/messages", zValidator("param", z.object({
  id: z.string(),
})), zValidator("query", z.object({
  type: z.enum(["sent", "received", "both"]).default("both"),
  limit: z.number().optional(),
})), async (c) => {
  const { id } = c.req.valid("param")
  const query = c.req.valid("query")

  try {
    const messages = await AgentMessageService.listForSession({
      sessionId: id,
      type: query.type,
      limit: query.limit,
    })

    return c.json({ success: true, data: messages })
  } catch (error) {
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }, 500)
  }
})

// 세션의 메시지 큐 조회
app.get("/:id/queue", zValidator("param", z.object({
  id: z.string(),
})), async (c) => {
  const { id } = c.req.valid("param")

  try {
    const queue = await AgentMessageService.getQueue(id)
    return c.json({ success: true, data: queue })
  } catch (error) {
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }, 500)
  }
})

// 메시지 통계 조회
app.get("/statistics", zValidator("query", z.object({
  sessionId: z.string().optional(),
  since: z.string().datetime().optional(),
})), async (c) => {
  const query = c.req.valid("query")

  try {
    const stats = await AgentMessageService.getStatistics({
      sessionId: query.sessionId,
      since: query.since ? new Date(query.since) : undefined,
    })

    return c.json({ success: true, data: stats })
  } catch (error) {
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }, 500)
  }
})

// 메시지 정리
app.post("/cleanup", zValidator("json", z.object({
  maxAge: z.number().optional(),
})), async (c) => {
  const input = c.req.valid("json")

  try {
    const result = await AgentMessageService.cleanup({
      maxAge: input.maxAge,
    })

    return c.json({ success: true, data: result })
  } catch (error) {
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }, 500)
  }
})

export default app