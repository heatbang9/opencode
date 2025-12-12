import { z } from "zod"
import { Identifier } from "../id/id"

export namespace EnhancedSession {
  // 확장된 세션 정보 타입
  export const Info = z.object({
    // 기존 세션 정보
    id: Identifier.schema("session"),
    projectID: z.string(),
    directory: z.string(),
    parentID: Identifier.schema("session").optional(),
    title: z.string(),
    version: z.string(),

    // 확장 필드
    projectId: z.string().optional(),        // mainServer 프로젝트 ID
    agentRole: z.string().optional(),        // frontend, backend, database 등
    metadata: z.record(z.any()).optional(),  // 추가 메타데이터
    permissions: z.object({
      fileAccess: z.object({
        read: z.array(z.string()).optional(),
        write: z.array(z.string()).optional(),
        execute: z.array(z.string()).optional(),
      }).optional(),
      commands: z.array(z.string()).optional(),
      apiAccess: z.array(z.string()).optional(),
      networkAccess: z.boolean().optional(),
    }).optional(),

    // 상태 정보
    status: z.enum(["active", "idle", "busy", "error", "offline"]).default("idle"),

    // 타임스탬프
    createdAt: z.date().default(() => new Date()),
    lastActivity: z.date().default(() => new Date()),

    // 기존 time 필드와 호환
    time: z.object({
      created: z.number(),
      updated: z.number(),
      compacting: z.number().optional(),
      archived: z.number().optional(),
    }),
  })

  export type Info = z.output<typeof Info>

  // 세션 메타데이터 업데이트 타입
  export const MetadataUpdate = z.object({
    agentRole: z.string().optional(),
    metadata: z.record(z.any()).optional(),
    permissions: z.object({
      fileAccess: z.object({
        read: z.array(z.string()).optional(),
        write: z.array(z.string()).optional(),
        execute: z.array(z.string()).optional(),
      }).optional(),
      commands: z.array(z.string()).optional(),
      apiAccess: z.array(z.string()).optional(),
      networkAccess: z.boolean().optional(),
    }).optional(),
  })

  export type MetadataUpdate = z.output<typeof MetadataUpdate>

  // 세션 상태 정보
  export const Status = z.object({
    sessionId: z.string(),
    status: z.enum(["active", "idle", "busy", "error", "offline"]),
    currentTask: z.string().optional(),
    resourceUsage: z.object({
      memory: z.number().optional(),
      cpu: z.number().optional(),
      diskIO: z.number().optional(),
      networkIO: z.number().optional(),
    }).optional(),
    lastHeartbeat: z.date().default(() => new Date()),
  })

  export type Status = z.output<typeof Status>

  // 세션 생성 입력
  export const CreateInput = z.object({
    agent: z.string(),
    model: z.string(),
    projectId: z.string().optional(),
    agentRole: z.string().optional(),
    metadata: z.record(z.any()).optional(),
    permissions: z.object({
      fileAccess: z.object({
        read: z.array(z.string()),
        write: z.array(z.string()),
        execute: z.array(z.string()),
      }).optional(),
      commands: z.array(z.string()),
      apiAccess: z.array(z.string()),
      networkAccess: z.boolean(),
    }).optional(),
    directory: z.string().optional(),
    title: z.string().optional(),
  })

  export type CreateInput = z.output<typeof CreateInput>

  // 에이전트 역할 정의
  export const AgentRole = z.object({
    name: z.string(),
    displayName: z.string(),
    permissions: z.object({
      fileAccess: z.object({
        read: z.array(z.string()),
        write: z.array(z.string()),
        execute: z.array(z.string()),
      }),
      commands: z.array(z.string()),
      apiAccess: z.array(z.string()),
      networkAccess: z.boolean(),
    }),
    description: z.string().optional(),
  })

  export type AgentRole = z.output<typeof AgentRole>

  // 미리 정의된 에이전트 역할
  export const AgentRoles = {
    FRONTEND: {
      name: "frontend",
      displayName: "Frontend Developer",
      permissions: {
        fileAccess: {
          read: ["src/**/*", "public/**/*", "assets/**/*"],
          write: ["src/**/*", "public/**/*", "assets/**/*"],
          execute: ["npm", "yarn", "node", "npx"]
        },
        commands: ["npm run dev", "npm run build", "npm test"],
        apiAccess: ["file", "terminal"],
        networkAccess: true
      },
      description: "Frontend development specialist"
    },
    BACKEND: {
      name: "backend",
      displayName: "Backend Developer",
      permissions: {
        fileAccess: {
          read: ["server/**/*", "api/**/*", "backend/**/*"],
          write: ["server/**/*", "api/**/*", "backend/**/*"],
          execute: ["npm", "node", "python", "java", "go", "docker"]
        },
        commands: ["npm start", "python manage.py", "go run", "docker-compose up"],
        apiAccess: ["file", "terminal", "database"],
        networkAccess: true
      },
      description: "Backend development specialist"
    },
    DATABASE: {
      name: "database",
      displayName: "Database Specialist",
      permissions: {
        fileAccess: {
          read: ["database/**/*", "migrations/**/*", "seeds/**/*"],
          write: ["database/**/*", "migrations/**/*"],
          execute: ["mysql", "psql", "mongo", "sqlite3"]
        },
        commands: ["mysql", "psql", "mongo", "sqlite3"],
        apiAccess: ["database", "file"],
        networkAccess: false
      },
      description: "Database management specialist"
    },
    FULLSTACK: {
      name: "fullstack",
      displayName: "Full Stack Developer",
      permissions: {
        fileAccess: {
          read: ["**/*"],
          write: ["**/*"],
          execute: ["npm", "yarn", "node", "python", "java", "go", "docker"]
        },
        commands: ["npm run dev", "npm start", "python manage.py", "go run", "docker-compose up"],
        apiAccess: ["file", "terminal", "database"],
        networkAccess: true
      },
      description: "Full stack development specialist"
    }
  } as const
}