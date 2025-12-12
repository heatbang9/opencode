import { Hono } from "hono"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { streamSSE } from "hono/streaming"
import { Bus } from "../../bus"
import { BusEvent } from "../../bus/bus-event"
import { Log } from "../../util/log"
import { EnhancedEvent } from "../../types/enhanced-event"

const app = new Hono()
const log = Log.create({ service: "events" })

// 확장된 이벤트 SSE 스트림
app.get("/stream", zValidator("query", z.object({
  types: z.string().optional(), // 콤마로 구분된 타입 목록
  sessionIds: z.string().optional(), // 콤마로 구분된 세션 ID 목록
  projectIds: z.string().optional(), // 콤마로 구분된 프로젝트 ID 목록
  workspaceIds: z.string().optional(), // 콤마로 구분된 워크스페이스 ID 목록
  priorities: z.string().optional(), // 콤마로 구분된 우선순위 목록
  severities: z.string().optional(), // 콤마로 구분된 심각도 목록
  since: z.string().datetime().optional(),
  until: z.string().datetime().optional(),
  tags: z.string().optional(), // 콤마로 구분된 태그 목록
  correlationId: z.string().optional(),
  traceId: z.string().optional(),
  limit: z.string().optional(),
  heartbeat: z.string().optional(), // true/false
  compression: z.string().optional(), // true/false
})), async (c) => {
  const query = c.req.valid("query")

  // 필터 설정
  const filter: EnhancedEvent.Filter = {
    types: query.types ? query.types.split(',') : undefined,
    sessionIds: query.sessionIds ? query.sessionIds.split(',') : undefined,
    projectIds: query.projectIds ? query.projectIds.split(',') : undefined,
    workspaceIds: query.workspaceIds ? query.workspaceIds.split(',') : undefined,
    priorities: query.priorities ? query.priorities.split(',') as any[] : undefined,
    severities: query.severities ? query.severities.split(',') as any[] : undefined,
    since: query.since ? new Date(query.since) : undefined,
    until: query.until ? new Date(query.until) : undefined,
    tags: query.tags ? query.tags.split(',') : undefined,
    correlationId: query.correlationId,
    traceId: query.traceId,
    limit: query.limit ? parseInt(query.limit) : undefined,
  }

  // 스트림 설정
  const config: EnhancedEvent.StreamConfig = {
    filter,
    heartbeat: query.heartbeat !== "false",
    compression: query.compression !== "false",
    batchSize: 100,
    maxBufferSize: 1000,
  }

  log.info("Event stream connected", { filter, config })

  return streamSSE(c, async (stream) => {
    // 초기 접속 이벤트
    await stream.writeSSE({
      id: "connection",
      event: "system.connected",
      data: JSON.stringify({
        type: "system",
        subType: "connected",
        timestamp: new Date().toISOString(),
        data: { message: "Event stream connected" },
      }),
    })

    let eventCount = 0
    let lastHeartbeat = Date.now()

    // 이벤트 구독
    const unsub = Bus.subscribeAll(async (event) => {
      try {
        // 이벤트 필터링
        if (!shouldSendEvent(event, filter, config)) {
          return
        }

        // 확장된 이벤트 포맷으로 변환
        const enhancedEvent = convertToEnhancedEvent(event)

        await stream.writeSSE({
          id: enhancedEvent.id,
          event: `${enhancedEvent.type}.${enhancedEvent.subType}`,
          data: JSON.stringify(enhancedEvent),
        })

        eventCount++

        // 하트비트 전송
        if (config.heartbeat && Date.now() - lastHeartbeat > 30000) {
          await stream.writeSSE({
            id: "heartbeat",
            event: "system.heartbeat",
            data: JSON.stringify({
              type: "system",
              subType: "heartbeat",
              timestamp: new Date().toISOString(),
              data: { eventCount },
            }),
          })
          lastHeartbeat = Date.now()
        }

        // 제한 확인
        if (filter.limit && eventCount >= filter.limit) {
          stream.close()
        }
      } catch (error) {
        log.error("Failed to send event", { error, event })
      }
    })

    // 스트림 종료 대기
    await new Promise<void>((resolve) => {
      stream.onAbort(() => {
        unsub()
        resolve()
        log.info("Event stream disconnected", { eventCount })
      })
    })
  })
})

// 이벤트 히스토리 조회
app.get("/history", zValidator("query", z.object({
  types: z.string().optional(),
  sessionIds: z.string().optional(),
  projectIds: z.string().optional(),
  workspaceIds: z.string().optional(),
  since: z.string().datetime().optional(),
  until: z.string().datetime().optional(),
  limit: z.number().optional(),
})), async (c) => {
  const query = c.req.valid("query")

  // TODO: 실제 이벤트 히스토리 저장소에서 조회
  // 현재는 구현된 이벤트 시스템이 히스토리를 저장하지 않으므로 빈 배열 반환
  return c.json({
    success: true,
    data: {
      events: [],
      total: 0,
      filter: {
        types: query.types?.split(','),
        sessionIds: query.sessionIds?.split(','),
        projectIds: query.projectIds?.split(','),
        workspaceIds: query.workspaceIds?.split(','),
        since: query.since,
        until: query.until,
        limit: query.limit,
      }
    }
  })
})

// 이벤트 통계 조회
app.get("/statistics", async (c) => {
  // TODO: 실제 이벤트 통계 계산
  return c.json({
    success: true,
    data: {
      totalEvents: 0,
      eventsByType: {},
      eventsBySubType: {},
      averageEventsPerSecond: 0,
      peakEventsPerSecond: 0,
      lastUpdated: new Date().toISOString(),
    }
  })
})

// 유틸리티 함수
function shouldSendEvent(
  event: any,
  filter: EnhancedEvent.Filter,
  config: EnhancedEvent.StreamConfig
): boolean {
  // 기본 타입 필터링
  if (filter.types && !filter.types.includes(event.type)) {
    return false
  }

  // 세션 필터링
  if (filter.sessionIds && event.sessionId && !filter.sessionIds.includes(event.sessionId)) {
    return false
  }

  // 프로젝트 필터링
  if (filter.projectIds && event.projectId && !filter.projectIds.includes(event.projectId)) {
    return false
  }

  // 시간 필터링
  const eventTime = event.timestamp || new Date()
  if (filter.since && eventTime < filter.since) {
    return false
  }
  if (filter.until && eventTime > filter.until) {
    return false
  }

  return true
}

function convertToEnhancedEvent(event: any): EnhancedEvent.Info {
  // 기존 이벤트를 확장된 형식으로 변환
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