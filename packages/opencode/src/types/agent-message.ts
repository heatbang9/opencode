import { z } from "zod"
import { Identifier } from "../id/id"

export namespace AgentMessage {
  // 에이전트 메시지 타입
  export const Info = z.object({
    id: Identifier.schema("agent_message"),
    from: z.string(),           // 보내는 세션 ID
    to: z.string(),             // 받는 세션 ID
    type: z.enum(["request", "response", "broadcast", "notification"]),
    channel: z.enum(["file", "task", "sync", "custom", "status", "error"]),
    payload: z.record(z.any()),
    timestamp: z.date().default(() => new Date()),

    // 상태 정보
    status: z.enum(["pending", "delivered", "read", "processed"]).default("pending"),

    // 우선순위
    priority: z.enum(["low", "normal", "high", "urgent"]).default("normal"),

    // 응답 ID (요청에 대한 응답일 경우)
    replyTo: z.string().optional(),

    // 만료 시간
    expiresAt: z.date().optional(),
  })

  export type Info = z.output<typeof Info>

  // 메시지 생성 입력
  export const CreateInput = z.object({
    from: z.string(),
    to: z.string(),
    type: z.enum(["request", "response", "broadcast", "notification"]),
    channel: z.enum(["file", "task", "sync", "custom", "status", "error"]),
    payload: z.record(z.any()),
    priority: z.enum(["low", "normal", "high", "urgent"]).default("normal"),
    replyTo: z.string().optional(),
    expiresAt: z.date().optional(),
  })

  export type CreateInput = z.output<typeof CreateInput>

  // 브로드캐스트 메시지 입력
  export const BroadcastInput = z.object({
    from: z.string(),
    channel: z.enum(["file", "task", "sync", "custom", "status", "error"]),
    payload: z.record(z.any()),
    priority: z.enum(["low", "normal", "high", "urgent"]).default("normal"),
    excludeSessions: z.array(z.string()).optional(),  // 제외할 세션 목록
    workspaceId: z.string().optional(),              // 특정 워크스페이스에만 브로드캐스트
  })

  export type BroadcastInput = z.output<typeof BroadcastInput>

  // 메시지 필터
  export const Filter = z.object({
    from: z.string().optional(),
    to: z.string().optional(),
    type: z.enum(["request", "response", "broadcast", "notification"]).optional(),
    channel: z.enum(["file", "task", "sync", "custom", "status", "error"]).optional(),
    status: z.enum(["pending", "delivered", "read", "processed"]).optional(),
    since: z.date().optional(),
    until: z.date().optional(),
    limit: z.number().optional(),
  })

  export type Filter = z.output<typeof Filter>

  // 미리 정의된 메시지 채널 페이로드
  export const ChannelPayloads = {
    // 파일 관련 메시지
    FILE_CHANGED: z.object({
      filePath: z.string(),
      changeType: z.enum(["created", "modified", "deleted"]),
      content: z.string().optional(),
      checksum: z.string().optional(),
    }),

    FILE_LOCK_REQUEST: z.object({
      filePath: z.string(),
      reason: z.string().optional(),
      duration: z.number().optional(),  // 잠금 유지 시간 (ms)
    }),

    FILE_LOCK_RELEASE: z.object({
      filePath: z.string(),
      lockId: z.string(),
    }),

    // 작업 관련 메시지
    TASK_UPDATE: z.object({
      taskId: z.string(),
      status: z.enum(["pending", "running", "completed", "failed"]),
      progress: z.number().optional(),
      result: z.any().optional(),
      error: z.string().optional(),
    }),

    TASK_REQUEST: z.object({
      taskType: z.string(),
      parameters: z.record(z.any()),
      priority: z.enum(["low", "normal", "high", "urgent"]).default("normal"),
    }),

    // 동기화 관련 메시지
    SYNC_REQUEST: z.object({
      syncType: z.enum(["full", "incremental"]),
      paths: z.array(z.string()),
      sessionId: z.string(),
    }),

    SYNC_RESPONSE: z.object({
      syncType: z.enum(["full", "incremental"]),
      changes: z.array(z.object({
        path: z.string(),
        type: z.enum(["created", "modified", "deleted"]),
        content: z.string().optional(),
      })),
      conflicts: z.array(z.string()).optional(),
    }),

    // 상태 관련 메시지
    STATUS_UPDATE: z.object({
      status: z.enum(["active", "idle", "busy", "error", "offline"]),
      currentTask: z.string().optional(),
      progress: z.number().optional(),
    }),

    // 오류 관련 메시지
    ERROR_OCCURRED: z.object({
      error: z.string(),
      stack: z.string().optional(),
      context: z.record(z.any()).optional(),
      severity: z.enum(["low", "medium", "high", "critical"]).default("medium"),
    }),
  } as const

  // 메시지 통계
  export const Statistics = z.object({
    totalMessages: z.number(),
    pendingMessages: z.number(),
    deliveredMessages: z.number(),
    processedMessages: z.number(),
    expiredMessages: z.number(),
    averageResponseTime: z.number().optional(),  // ms
    channelStats: z.record(z.object({
      count: z.number(),
      avgResponseTime: z.number().optional(),
    })),
  })

  export type Statistics = z.output<typeof Statistics>
}