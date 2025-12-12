import { z } from "zod"
import { Identifier } from "../id/id"

export namespace ProjectWorkspace {
  // 프로젝트 워크스페이스 정보
  export const Info = z.object({
    id: z.string(),
    name: z.string(),
    path: z.string(),
    description: z.string().optional(),

    // 세션 관리
    sessions: z.array(z.string()),      // 연결된 세션 ID 목록

    // 파일 공유
    sharedFiles: z.array(z.string()),   // 공유 파일 목록

    // 격리 수준
    isolationLevel: z.enum(["none", "process", "container"]).default("process"),

    // 권한 설정
    permissions: z.object({
      read: z.array(z.string()),        // 읽기 권한 세션
      write: z.array(z.string()),       // 쓰기 권한 세션
      execute: z.array(z.string()),     // 실행 권한 세션
    }).default({
      read: [],
      write: [],
      execute: []
    }),

    // 상태 정보
    status: z.enum(["active", "inactive", "archived"]).default("active"),

    // 타임스탬프
    createdAt: z.date().default(() => new Date()),
    updatedAt: z.date().default(() => new Date()),

    // 설정
    settings: z.record(z.any()).optional(),
  })

  export type Info = z.output<typeof Info>

  // 워크스페이스 생성 입력
  export const CreateInput = z.object({
    name: z.string(),
    path: z.string(),
    description: z.string().optional(),
    isolationLevel: z.enum(["none", "process", "container"]).default("process"),
    settings: z.record(z.any()).optional(),
  })

  export type CreateInput = z.output<typeof CreateInput>

  // 워크스페이스 업데이트 입력
  export const UpdateInput = z.object({
    name: z.string().optional(),
    description: z.string().optional(),
    isolationLevel: z.enum(["none", "process", "container"]).optional(),
    status: z.enum(["active", "inactive", "archived"]).optional(),
    settings: z.record(z.any()).optional(),
  })

  export type UpdateInput = z.output<typeof UpdateInput>

  // 세션 추가 입력
  export const AddSessionInput = z.object({
    sessionId: z.string(),
    permissions: z.object({
      read: z.array(z.string()).optional(),
      write: z.array(z.string()).optional(),
      execute: z.array(z.string()).optional(),
    }).optional(),
  })

  export type AddSessionInput = z.output<typeof AddSessionInput>

  // 파일 공유 입력
  export const ShareFileInput = z.object({
    filePath: z.string(),
    sessionId: z.string().optional(),  // 특정 세션에만 공유
    permissions: z.enum(["read", "write", "read-write"]).default("read"),
  })

  export type ShareFileInput = z.output<typeof ShareFileInput>

  // 파일 동기화 입력
  export const SyncFileInput = z.object({
    filePath: z.string(),
    sessionId: z.string(),
    operation: z.enum(["push", "pull", "merge"]),
    content: z.string().optional(),
  })

  export type SyncFileInput = z.output<typeof SyncFileInput>

  // 워크스페이스 상태
  export const Status = z.object({
    workspaceId: z.string(),
    sessionCount: z.number(),
    activeSessionCount: z.number(),
    sharedFileCount: z.number(),
    lastActivity: z.date(),
    resourceUsage: z.object({
      diskUsage: z.number().optional(),
      memoryUsage: z.number().optional(),
      cpuUsage: z.number().optional(),
    }).optional(),
  })

  export type Status = z.output<typeof Status>
}