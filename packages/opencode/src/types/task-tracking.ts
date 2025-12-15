import { z } from "zod"
import { Identifier } from "../id/id"

export namespace TaskTracking {
  // 작업 정보
  export const Info = z.object({
    // TODO: Identifier.schema 오류 임시방편 - 작업 ID 검증
    // Identifier 모듈 문제로 임시로 string으로 변경
    id: z.string(),
    sessionId: z.string(),
    projectId: z.string().optional(),
    type: z.enum([
      "command",
      "file_edit",
      "file_create",
      "file_delete",
      "analysis",
      "generation",
      "search",
      "sync",
      "custom"
    ]),
    status: z.enum(["pending", "running", "completed", "failed", "cancelled"]).default("pending"),

    // 작업 상세 정보
    command: z.string().optional(),
    filePath: z.string().optional(),
    description: z.string().optional(),

    // 진행 상황 (0-100)
    progress: z.number().default(0),

    // 결과 및 오류
    result: z.any().optional(),
    error: z.string().optional(),

    // 타임스탬프
    createdAt: z.date().default(() => new Date()),
    startTime: z.date().optional(),
    endTime: z.date().optional(),
    estimatedDuration: z.number().optional(),  // 예상 소요 시간 (ms)

    // 의존성
    dependencies: z.array(z.string()).optional(),  // 의존하는 작업 ID 목록
    blockedBy: z.array(z.string()).optional(),    // 이 작업을 차단하는 작업 ID 목록

    // 우선순위
    priority: z.enum(["low", "normal", "high", "urgent"]).default("normal"),

    // 메타데이터
    metadata: z.record(z.any()).optional(),

    // 하위 작업
    subtasks: z.array(z.string()).optional(),  // 하위 작업 ID 목록
    parentTaskId: z.string().optional(),       // 상위 작업 ID
  })

  export type Info = z.output<typeof Info>

  // 작업 생성 입력
  export const CreateInput = z.object({
    sessionId: z.string(),
    projectId: z.string().optional(),
    type: z.enum([
      "command",
      "file_edit",
      "file_create",
      "file_delete",
      "analysis",
      "generation",
      "search",
      "sync",
      "custom"
    ]),
    command: z.string().optional(),
    filePath: z.string().optional(),
    description: z.string().optional(),
    priority: z.enum(["low", "normal", "high", "urgent"]).default("normal"),
    dependencies: z.array(z.string()).optional(),
    estimatedDuration: z.number().optional(),
    metadata: z.record(z.any()).optional(),
    parentTaskId: z.string().optional(),
  })

  export type CreateInput = z.output<typeof CreateInput>

  // 작업 업데이트 입력
  export const UpdateInput = z.object({
    status: z.enum(["pending", "running", "completed", "failed", "cancelled"]).optional(),
    progress: z.number().min(0).max(100).optional(),
    result: z.any().optional(),
    error: z.string().optional(),
    metadata: z.record(z.any()).optional(),
  })

  export type UpdateInput = z.output<typeof UpdateInput>

  // 작업 진행 상황 업데이트 입력
  export const ProgressUpdate = z.object({
    taskId: z.string(),
    progress: z.number().min(0).max(100),
    message: z.string().optional(),
    currentStep: z.string().optional(),
    totalSteps: z.number().optional(),
  })

  export type ProgressUpdate = z.output<typeof ProgressUpdate>

  // 작업 필터
  export const Filter = z.object({
    sessionId: z.string().optional(),
    projectId: z.string().optional(),
    type: z.enum([
      "command",
      "file_edit",
      "file_create",
      "file_delete",
      "analysis",
      "generation",
      "search",
      "sync",
      "custom"
    ]).optional(),
    status: z.enum(["pending", "running", "completed", "failed", "cancelled"]).optional(),
    priority: z.enum(["low", "normal", "high", "urgent"]).optional(),
    since: z.date().optional(),
    until: z.date().optional(),
    parentTaskId: z.string().optional(),
    limit: z.number().optional(),
  })

  export type Filter = z.output<typeof Filter>

  // 작업 큐
  export const Queue = z.object({
    id: z.string(),
    name: z.string(),
    sessionId: z.string().optional(),  // 세션별 큐일 경우
    projectId: z.string().optional(),  // 프로젝트별 큐일 경우

    // 큐 상태
    status: z.enum(["active", "paused", "stopped"]).default("active"),

    // 작업 목록
    pendingTasks: z.array(z.string()),
    runningTasks: z.array(z.string()),
    completedTasks: z.array(z.string()),

    // 큐 설정
    maxConcurrentTasks: z.number().default(5),
    priorityEnabled: z.boolean().default(true),

    // 타임스탬프
    createdAt: z.date().default(() => new Date()),
    lastProcessedAt: z.date().optional(),
  })

  export type Queue = z.output<typeof Queue>

  // 작업 통계
  export const Statistics = z.object({
    sessionId: z.string().optional(),
    projectId: z.string().optional(),

    // 기본 통계
    totalTasks: z.number(),
    pendingTasks: z.number(),
    runningTasks: z.number(),
    completedTasks: z.number(),
    failedTasks: z.number(),
    cancelledTasks: z.number(),

    // 성능 통계
    averageCompletionTime: z.number().optional(),  // ms
    successRate: z.number(),                       // 0-1
    throughput: z.number().optional(),             // tasks/hour

    // 타입별 통계
    taskTypeStats: z.record(z.object({
      count: z.number(),
      avgCompletionTime: z.number().optional(),
      successRate: z.number(),
    })),

    // 시간별 통계
    hourlyStats: z.array(z.object({
      hour: z.number(),
      completed: z.number(),
      failed: z.number(),
    })),

    // 마지막 업데이트
    lastUpdated: z.date().default(() => new Date()),
  })

  export type Statistics = z.output<typeof Statistics>

  // 작업 실행 로그
  export const ExecutionLog = z.object({
    // TODO: Identifier.schema 오류 임시방편 - 작업 로그 ID 검증
    // Identifier 모듈 문제로 임시로 string으로 변경
    id: z.string(),
    taskId: z.string(),
    timestamp: z.date().default(() => new Date()),
    level: z.enum(["debug", "info", "warn", "error"]).default("info"),
    message: z.string(),
    data: z.any().optional(),
  })

  export type ExecutionLog = z.output<typeof ExecutionLog>

  // 작업 결과
  export const Result = z.object({
    taskId: z.string(),
    success: z.boolean(),
    output: z.any().optional(),
    artifacts: z.array(z.object({
      type: z.enum(["file", "directory", "data", "url"]),
      path: z.string().optional(),
      content: z.string().optional(),
      metadata: z.record(z.any()).optional(),
    })).optional(),
    metrics: z.object({
      duration: z.number(),  // ms
      memoryUsed: z.number().optional(),  // bytes
      cpuUsed: z.number().optional(),     // percentage
    }).optional(),
  })

  export type Result = z.output<typeof Result>
}