import { Hono } from "hono"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { streamSSE } from "hono/streaming"
import { Bus } from "../../bus"
import { BusEvent } from "../../bus/bus-event"
import { Log } from "../../util/log"
import { EnhancedEvent } from "../../types/enhanced-event"

const app = new Hono()
const log = Log.create({ service: "api-events" })

// 기존 /global/event 엔드포인트 확장
app.get("/event", zValidator("query", z.object({
  session: z.string().optional(),
  project: z.string().optional(),
  types: z.string().optional(), // 콤마로 구분된 타입 목록
})), async (c) => {
  const query = c.req.valid("query")

  log.info("event connected", { query })

  return streamSSE(c, async (stream) => {
    // 초기 연결 이벤트
    stream.writeSSE({
      data: JSON.stringify({
        type: "server.connected",
        properties: {},
      }),
    })

    // 이벤트 필터링
    const filterTypes = query.types ? query.types.split(',') : undefined

    const unsub = Bus.subscribeAll(async (event) => {
      try {
        // 필터링 적용
        if (query.session && event.sessionId !== query.session) {
          return
        }
        if (query.project && event.projectId !== query.project) {
          return
        }
        if (filterTypes && !filterTypes.includes(event.type)) {
          return
        }

        // 확장된 이벤트 포맷으로 변환
        const enhancedEvent = convertToEnhancedEvent(event)

        await stream.writeSSE({
          data: JSON.stringify(enhancedEvent),
        })

        // 인스턴스 폐기 시 연결 종료
        if (event.type === Bus.InstanceDisposed.type) {
          stream.close()
        }
      } catch (error) {
        log.error("Failed to send event", { error, event })
      }
    })

    // 연결 종료 대기
    await new Promise<void>((resolve) => {
      stream.onAbort(() => {
        unsub()
        resolve()
        log.info("event disconnected")
      })
    })
  })
})

// 전역 이벤트 처리 (기존 호환성)
app.get("/global/event", async (c) => {
  log.info("global event connected")

  return streamSSE(c, async (stream) => {
    stream.writeSSE({
      data: JSON.stringify({
        type: "server.connected",
        properties: {},
      }),
    })

    const unsub = Bus.subscribeAll(async (event) => {
      await stream.writeSSE({
        data: JSON.stringify(event),
      })
      if (event.type === Bus.InstanceDisposed.type) {
        stream.close()
      }
    })

    await new Promise<void>((resolve) => {
      stream.onAbort(() => {
        unsub()
        resolve()
        log.info("global event disconnected")
      })
    })
  })
})

// 유틸리티 함수
function convertToEnhancedEvent(event: any): EnhancedEvent.Info {
  const enhancedEvent: EnhancedEvent.Info = {
    id: event.id || `event-${Date.now()}-${Math.random()}`,
    type: event.type || "system",
    subType: event.properties?.type || "unknown",
    sessionId: event.sessionId,
    projectId: event.projectId,
    workspaceId: event.workspaceId,
    data: event.properties || event.payload || {},
    timestamp: event.timestamp || new Date(),
    source: {
      service: "opencode",
      version: "1.0.0",
    },
    priority: "normal",
    severity: "info",
    tags: [],
  }

  // 특정 이벤트 타입에 따른 추가 변환
  switch (event.type) {
    case "session":
      enhancedEvent.subType = event.properties?.type || "status_changed"
      break
    case "task":
      enhancedEvent.subType = event.properties?.status || "updated"
      break
    case "file":
      enhancedEvent.subType = event.properties?.action || "changed"
      break
    case "agent":
      enhancedEvent.subType = event.properties?.action || "message"
      break
  }

  return enhancedEvent
}

export default app