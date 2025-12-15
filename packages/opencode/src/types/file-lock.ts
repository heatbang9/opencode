import { z } from "zod"
import { Identifier } from "../id/id"

export namespace FileLock {
  // 파일 잠금 정보
  export const Info = z.object({
    // TODO: Identifier.schema 오류 임시방편 - 파일 잠금 ID 검증
    // Identifier 모듈 문제로 임시로 string으로 변경
    id: z.string(),
    filePath: z.string(),
    sessionId: z.string(),      // 잠금을 소유한 세션 ID
    lockType: z.enum(["read", "write", "exclusive"]).default("write"),

    // 잠금 상태
    status: z.enum(["active", "released", "expired"]).default("active"),

    // 잠금 생성 시간
    createdAt: z.date().default(() => new Date()),

    // 잠금 만료 시간
    expiresAt: z.date().optional(),

    // 잠금 해제 시간
    releasedAt: z.date().optional(),

    // 잠금 사유
    reason: z.string().optional(),

    // 메타데이터
    metadata: z.record(z.any()).optional(),
  })

  export type Info = z.output<typeof Info>

  // 잠금 생성 입력
  export const CreateInput = z.object({
    filePath: z.string(),
    sessionId: z.string(),
    lockType: z.enum(["read", "write", "exclusive"]).default("write"),
    duration: z.number().optional(),  // 잠금 유지 시간 (ms), 없으면 영구
    reason: z.string().optional(),
    metadata: z.record(z.any()).optional(),
  })

  export type CreateInput = z.output<typeof CreateInput>

  // 잠금 요청
  export const Request = z.object({
    filePath: z.string(),
    sessionId: z.string(),
    lockType: z.enum(["read", "write", "exclusive"]).default("write"),
    timeout: z.number().default(5000),  // 잠금 획득 대기 시간 (ms)
    reason: z.string().optional(),
  })

  export type Request = z.output<typeof Request>

  // 잠금 응답
  export const Response = z.object({
    success: z.boolean(),
    lockId: z.string().optional(),
    message: z.string().optional(),
    conflictInfo: z.object({
      sessionId: z.string(),
      lockType: z.enum(["read", "write", "exclusive"]),
      createdAt: z.date(),
      reason: z.string().optional(),
    }).optional(),
  })

  export type Response = z.output<typeof Response>

  // 잠금 충돌 정보
  export const Conflict = z.object({
    filePath: z.string(),
    requesterId: z.string(),
    holderId: z.string(),
    requestType: z.enum(["read", "write", "exclusive"]),
    holderType: z.enum(["read", "write", "exclusive"]),
    conflictType: z.enum(["write_write", "write_read", "exclusive_any"]),
    timestamp: z.date(),
    resolution: z.enum(["wait", "force", "cancel"]).optional(),
  })

  export type Conflict = z.output<typeof Conflict>

  // 잠금 관리자 설정
  export const ManagerConfig = z.object({
    // 기본 잠금 만료 시간 (ms)
    defaultLockTimeout: z.number().default(300000),  // 5분

    // 최대 잠금 시간 (ms)
    maxLockDuration: z.number().default(3600000),  // 1시간

    // 데드락 감지 간격 (ms)
    deadlockCheckInterval: z.number().default(5000),  // 5초

    // 자동 만료 활성화
    autoExpireEnabled: z.boolean().default(true),

    // 잠금 큐 활성화
    queueEnabled: z.boolean().default(true),

    // 최대 대기 시간 (ms)
    maxWaitTime: z.number().default(30000),  // 30초

    // 잠금 히스토리 보관 기간 (ms)
    historyRetentionPeriod: z.number().default(86400000),  // 24시간
  })

  export type ManagerConfig = z.output<typeof ManagerConfig>

  // 잠금 통계
  export const Statistics = z.object({
    totalLocks: z.number(),
    activeLocks: z.number(),
    expiredLocks: z.number(),
    conflictsCount: z.number(),
    averageWaitTime: z.number().optional(),  // ms
    lockTypeStats: z.record(z.object({
      count: z.number(),
      avgDuration: z.number().optional(),  // ms
    })),
    sessionStats: z.record(z.object({
      locksHeld: z.number(),
      conflictsCount: z.number(),
    })),
    lastUpdated: z.date().default(() => new Date()),
  })

  export type Statistics = z.output<typeof Statistics>

  // 잠금 이벤트
  export const Event = z.object({
    // TODO: Identifier.schema 오류 임시방편 - 잠금 이벤트 ID 검증
    // Identifier 모듈 문제로 임시로 string으로 변경
    id: z.string(),
    type: z.enum([
      "lock_acquired",
      "lock_released",
      "lock_expired",
      "lock_conflict",
      "lock_force_released",
      "deadlock_detected",
      "lock_queue_added",
      "lock_queue_removed"
    ]),
    lockId: z.string().optional(),
    filePath: z.string(),
    sessionId: z.string(),
    timestamp: z.date().default(() => new Date()),
    data: z.record(z.any()).optional(),
  })

  export type Event = z.output<typeof Event>

  // 잠금 큐 항목
  export const QueueItem = z.object({
    // TODO: Identifier.schema 오류 임시방편 - 잠금 큐 항목 ID 검증
    // Identifier 모듈 문제로 임시로 string으로 변경
    id: z.string(),
    filePath: z.string(),
    sessionId: z.string(),
    lockType: z.enum(["read", "write", "exclusive"]),
    requestedAt: z.date().default(() => new Date()),
    timeout: z.number(),
    reason: z.string().optional(),
    status: z.enum(["waiting", "granted", "timeout", "cancelled"]).default("waiting"),
  })

  export type QueueItem = z.output<typeof QueueItem>

  // 데드락 감지 결과
  export const DeadlockDetection = z.object({
    timestamp: z.date(),
    deadlocks: z.array(z.object({
      cycle: z.array(z.string()),  // 세션 ID 순환
      locks: z.array(z.object({
        lockId: z.string(),
        filePath: z.string(),
        sessionId: z.string(),
      })),
    })),
    resolutions: z.array(z.object({
      sessionId: z.string(),
      action: z.enum(["release", "timeout", "priority"]),
    })),
  })

  export type DeadlockDetection = z.output<typeof DeadlockDetection>
}