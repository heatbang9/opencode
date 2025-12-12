import { Hono } from "hono"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { EnhancedSessionService } from "../services/enhanced-session"
import { Identifier } from "../../id/id"

const app = new Hono()

// 확장된 세션 생성
app.post("/", zValidator("json", z.object({
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
})), async (c) => {
  const input = c.req.valid("json")

  try {
    const session = await EnhancedSessionService.create({
      agent: input.agent,
      model: input.model,
      projectId: input.projectId,
      agentRole: input.agentRole,
      metadata: input.metadata,
      permissions: input.permissions,
      directory: input.directory,
      title: input.title,
    })

    return c.json({ success: true, data: session }, 201)
  } catch (error) {
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }, 500)
  }
})

// 세션 메타데이터 조회
app.get("/:id/metadata", zValidator("param", z.object({
  id: Identifier.schema("session"),
})), async (c) => {
  const { id } = c.req.valid("param")

  try {
    const session = await EnhancedSessionService.getStatus(id)
    return c.json({ success: true, data: session })
  } catch (error) {
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }, 404)
  }
})

// 세션 메타데이터 업데이트
app.put("/:id/metadata", zValidator("param", z.object({
  id: Identifier.schema("session"),
})), zValidator("json", z.object({
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
})), async (c) => {
  const { id } = c.req.valid("param")
  const metadata = c.req.valid("json")

  try {
    const updatedSession = await EnhancedSessionService.updateMetadata({
      sessionId: id,
      metadata,
    })

    return c.json({ success: true, data: updatedSession })
  } catch (error) {
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }, 500)
  }
})

// 세션 핑 (활성 상태 확인)
app.post("/:id/ping", zValidator("param", z.object({
  id: Identifier.schema("session"),
})), async (c) => {
  const { id } = c.req.valid("param")

  try {
    const result = await EnhancedSessionService.ping(id)
    return c.json({ success: true, data: result })
  } catch (error) {
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }, 500)
  }
})

// 상세 상태 정보 조회
app.get("/:id/status", zValidator("param", z.object({
  id: Identifier.schema("session"),
})), async (c) => {
  const { id } = c.req.valid("param")

  try {
    const status = await EnhancedSessionService.getStatus(id)
    return c.json({ success: true, data: status })
  } catch (error) {
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }, 404)
  }
})

// 세션 강제 종료
app.delete("/:id/force", zValidator("param", z.object({
  id: Identifier.schema("session"),
})), zValidator("json", z.object({
  reason: z.string().optional(),
})), async (c) => {
  const { id } = c.req.valid("param")
  const { reason } = c.req.valid("json")

  try {
    const result = await EnhancedSessionService.forceTerminate({
      sessionId: id,
      reason,
    })

    return c.json({ success: true, data: result })
  } catch (error) {
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }, 500)
  }
})

// 프로젝트별 세션 목록 조회
app.get("/project/:projectId", zValidator("param", z.object({
  projectId: z.string(),
})), zValidator("query", z.object({
  status: z.enum(["active", "idle", "busy", "error", "offline"]).optional(),
  agentRole: z.string().optional(),
})), async (c) => {
  const { projectId } = c.req.valid("param")
  const query = c.req.valid("query")

  try {
    const sessions = await EnhancedSessionService.listByProject({
      projectId,
      status: query.status,
      agentRole: query.agentRole,
    })

    return c.json({ success: true, data: sessions })
  } catch (error) {
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }, 500)
  }
})

// 에이전트 역할별 세션 목록 조회
app.get("/role/:agentRole", zValidator("param", z.object({
  agentRole: z.string(),
})), zValidator("query", z.object({
  status: z.enum(["active", "idle", "busy", "error", "offline"]).optional(),
})), async (c) => {
  const { agentRole } = c.req.valid("param")
  const query = c.req.valid("query")

  try {
    const sessions = await EnhancedSessionService.listByAgentRole({
      agentRole,
      status: query.status,
    })

    return c.json({ success: true, data: sessions })
  } catch (error) {
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }, 500)
  }
})

// 세션 통계 조회
app.get("/statistics", zValidator("query", z.object({
  projectId: z.string().optional(),
})), async (c) => {
  const query = c.req.valid("query")

  try {
    const stats = await EnhancedSessionService.getStatistics({
      projectId: query.projectId,
    })

    return c.json({ success: true, data: stats })
  } catch (error) {
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }, 500)
  }
})

// 세션 정리
app.post("/cleanup", zValidator("json", z.object({
  maxAge: z.number().optional(),
})), async (c) => {
  const input = c.req.valid("json")

  try {
    const result = await EnhancedSessionService.cleanup({
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

// 하트비트 체크
app.post("/heartbeat-check", zValidator("json", z.object({
  timeout: z.number().optional(),
})), async (c) => {
  const input = c.req.valid("json")

  try {
    const result = await EnhancedSessionService.heartbeatCheck({
      timeout: input.timeout,
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