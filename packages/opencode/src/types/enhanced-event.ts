import { z } from "zod"
import { Identifier } from "../id/id"

export namespace EnhancedEvent {
  // 확장된 이벤트 타입
  export const Info = z.object({
    id: Identifier.schema("event"),
    type: z.enum([
      "session",
      "file",
      "task",
      "agent",
      "sync",
      "error",
      "workspace",
      "lock",
      "message",
      "system"
    ]),
    subType: z.string(),
    sessionId: z.string().optional(),
    projectId: z.string().optional(),
    workspaceId: z.string().optional(),

    // 이벤트 데이터
    data: z.record(z.any()),

    // 타임스탬프
    timestamp: z.date().default(() => new Date()),

    // 이벤트 소스
    source: z.object({
      service: z.string(),
      version: z.string().optional(),
      instance: z.string().optional(),
    }).optional(),

    // 이벤트 우선순위
    priority: z.enum(["low", "normal", "high", "critical"]).default("normal"),

    // 이벤트 심각도
    severity: z.enum(["info", "warning", "error", "fatal"]).default("info"),

    // 태그
    tags: z.array(z.string()).optional(),

    // 상관관계 ID (연관된 이벤트 그룹핑)
    correlationId: z.string().optional(),

    // 추적 정보
    traceId: z.string().optional(),
    spanId: z.string().optional(),
  })

  export type Info = z.output<typeof Info>

  // 세션 관련 이벤트 타입
  export const SessionEvents = {
    CREATED: "session.created",
    UPDATED: "session.updated",
    DELETED: "session.deleted",
    STATUS_CHANGED: "session.status_changed",
    MESSAGE_RECEIVED: "session.message_received",
    MESSAGE_COMPLETED: "session.message_completed",
    HEARTBEAT: "session.heartbeat",
    ERROR_OCCURRED: "session.error",
    PERMISSIONS_CHANGED: "session.permissions_changed",
  } as const

  // 파일 관련 이벤트 타입
  export const FileEvents = {
    CREATED: "file.created",
    MODIFIED: "file.modified",
    DELETED: "file.deleted",
    LOCKED: "file.locked",
    UNLOCKED: "file.unlocked",
    SHARED: "file.shared",
    SYNCED: "file.synced",
    CONFLICT: "file.conflict",
  } as const

  // 작업 관련 이벤트 타입
  export const TaskEvents = {
    CREATED: "task.created",
    STARTED: "task.started",
    UPDATED: "task.updated",
    COMPLETED: "task.completed",
    FAILED: "task.failed",
    CANCELLED: "task.cancelled",
    PROGRESS: "task.progress",
    DEPENDENCY_RESOLVED: "task.dependency_resolved",
  } as const

  // 에이전트 관련 이벤트 타입
  export const AgentEvents = {
    STARTED: "agent.started",
    STOPPED: "agent.stopped",
    STATUS_UPDATE: "agent.status_update",
    MESSAGE_SENT: "agent.message_sent",
    MESSAGE_RECEIVED: "agent.message_received",
    BROADCAST: "agent.broadcast",
    ERROR: "agent.error",
  } as const

  // 동기화 관련 이벤트 타입
  export const SyncEvents = {
    REQUIRED: "sync.required",
    STARTED: "sync.started",
    COMPLETED: "sync.completed",
    FAILED: "sync.failed",
    CONFLICT_DETECTED: "sync.conflict_detected",
    CONFLICT_RESOLVED: "sync.conflict_resolved",
  } as const

  // 워크스페이스 관련 이벤트 타입
  export const WorkspaceEvents = {
    CREATED: "workspace.created",
    UPDATED: "workspace.updated",
    DELETED: "workspace.deleted",
    SESSION_ADDED: "workspace.session_added",
    SESSION_REMOVED: "workspace.session_removed",
    FILE_SHARED: "workspace.file_shared",
    PERMISSIONS_CHANGED: "workspace.permissions_changed",
  } as const

  // 잠금 관련 이벤트 타입
  export const LockEvents = {
    ACQUIRED: "lock.acquired",
    RELEASED: "lock.released",
    EXPIRED: "lock.expired",
    CONFLICT: "lock.conflict",
    FORCE_RELEASED: "lock.force_released",
    DEADLOCK_DETECTED: "lock.deadlock_detected",
  } as const

  // 시스템 관련 이벤트 타입
  export const SystemEvents = {
    STARTUP: "system.startup",
    SHUTDOWN: "system.shutdown",
    CONFIG_CHANGED: "system.config_changed",
    RESOURCE_WARNING: "system.resource_warning",
    HEALTH_CHECK: "system.health_check",
  } as const

  // 이벤트 필터
  export const Filter = z.object({
    types: z.array(z.enum(["session", "file", "task", "agent", "sync", "error", "workspace", "lock", "message", "system"])).optional(),
    subTypes: z.array(z.string()).optional(),
    sessionIds: z.array(z.string()).optional(),
    projectIds: z.array(z.string()).optional(),
    workspaceIds: z.array(z.string()).optional(),
    priorities: z.array(z.enum(["low", "normal", "high", "critical"])).optional(),
    severities: z.array(z.enum(["info", "warning", "error", "fatal"])).optional(),
    since: z.date().optional(),
    until: z.date().optional(),
    tags: z.array(z.string()).optional(),
    correlationId: z.string().optional(),
    traceId: z.string().optional(),
    limit: z.number().optional(),
  })

  export type Filter = z.output<typeof Filter>

  // SSE 이벤트 스트림 설정
  export const StreamConfig = z.object({
    filter: Filter.optional(),
    heartbeat: z.object({
      enabled: z.boolean().default(true),
      interval: z.number().default(30000),  // 30초
    }),
    compression: z.boolean().default(true),
    batchSize: z.number().default(100),
    maxBufferSize: z.number().default(1000),
  })

  export type StreamConfig = z.output<typeof StreamConfig>

  // 이벤트 리스너 설정
  export const ListenerConfig = z.object({
    id: z.string(),
    filter: Filter,
    callback: z.custom<(event: Info) => void | Promise<void>>(),
    once: z.boolean().default(false),
    active: z.boolean().default(true),
    errorHandling: z.enum(["ignore", "log", "throw"]).default("log"),
  })

  export type ListenerConfig = z.output<typeof ListenerConfig>

  // 이벤트 통계
  export const Statistics = z.object({
    totalEvents: z.number(),
    eventsByType: z.record(z.number()),
    eventsBySubType: z.record(z.number()),
    eventsBySession: z.record(z.number()),
    eventsByProject: z.record(z.number()),
    averageEventsPerSecond: z.number(),
    peakEventsPerSecond: z.number(),
    eventProcessingLatency: z.object({
      average: z.number(),
      p50: z.number(),
      p95: z.number(),
      p99: z.number(),
    }),
    lastUpdated: z.date().default(() => new Date()),
  })

  export type Statistics = z.output<typeof Statistics>

  // 이벤트 배치
  export const Batch = z.object({
    id: Identifier.schema("event_batch"),
    events: z.array(Info),
    timestamp: z.date().default(() => new Date()),
    size: z.number(),
    compressed: z.boolean().default(false),
    checksum: z.string().optional(),
  })

  export type Batch = z.output<typeof Batch>

  // 이벤트 재생 설정
  export const ReplayConfig = z.object({
    startTime: z.date(),
    endTime: z.date().optional(),
    filter: Filter.optional(),
    speed: z.number().default(1),  // 1x, 2x, 0.5x 등
    includeTimestamps: z.boolean().default(true),
  })

  export type ReplayConfig = z.output<typeof ReplayConfig>
}