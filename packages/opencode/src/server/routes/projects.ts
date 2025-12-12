import { Hono } from "hono"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { ProjectWorkspaceService } from "../services/project-workspace"

const app = new Hono()

// 프로젝트 워크스페이스 생성
app.post("/", zValidator("json", z.object({
  name: z.string(),
  path: z.string(),
  description: z.string().optional(),
  isolationLevel: z.enum(["none", "process", "container"]).default("process"),
  settings: z.record(z.any()).optional(),
})), async (c) => {
  const input = c.req.valid("json")

  try {
    const workspace = await ProjectWorkspaceService.create(input)
    return c.json({ success: true, data: workspace }, 201)
  } catch (error) {
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }, 500)
  }
})

// 프로젝트 정보 조회
app.get("/:id", zValidator("param", z.object({
  id: z.string(),
})), async (c) => {
  const { id } = c.req.valid("param")

  try {
    const workspace = await ProjectWorkspaceService.get(id)
    return c.json({ success: true, data: workspace })
  } catch (error) {
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }, 404)
  }
})

// 프로젝트 설정 업데이트
app.put("/:id", zValidator("param", z.object({
  id: z.string(),
})), zValidator("json", z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  isolationLevel: z.enum(["none", "process", "container"]).optional(),
  status: z.enum(["active", "inactive", "archived"]).optional(),
  settings: z.record(z.any()).optional(),
})), async (c) => {
  const { id } = c.req.valid("param")
  const update = c.req.valid("json")

  try {
    const updatedWorkspace = await ProjectWorkspaceService.update({
      workspaceId: id,
      update,
    })

    return c.json({ success: true, data: updatedWorkspace })
  } catch (error) {
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }, 500)
  }
})

// 프로젝트 삭제
app.delete("/:id", zValidator("param", z.object({
  id: z.string(),
})), async (c) => {
  const { id } = c.req.valid("param")

  try {
    await ProjectWorkspaceService.remove(id)
    return c.json({ success: true, message: "Project deleted successfully" })
  } catch (error) {
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }, 500)
  }
})

// 프로젝트 목록 조회
app.get("/", zValidator("query", z.object({
  status: z.enum(["active", "inactive", "archived"]).optional(),
})), async (c) => {
  const query = c.req.valid("query")

  try {
    const workspaces = await ProjectWorkspaceService.list({
      status: query.status,
    })

    return c.json({ success: true, data: workspaces })
  } catch (error) {
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }, 500)
  }
})

// 프로젝트 세션 목록 조회
app.get("/:id/sessions", zValidator("param", z.object({
  id: z.string(),
})), async (c) => {
  const { id } = c.req.valid("param")

  try {
    const sessions = await ProjectWorkspaceService.getSessions(id)
    return c.json({ success: true, data: sessions })
  } catch (error) {
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }, 500)
  }
})

// 세션 추가
app.post("/:id/sessions", zValidator("param", z.object({
  id: z.string(),
})), zValidator("json", z.object({
  sessionId: z.string(),
  permissions: z.object({
    read: z.array(z.string()).optional(),
    write: z.array(z.string()).optional(),
    execute: z.array(z.string()).optional(),
  }).optional(),
})), async (c) => {
  const { id } = c.req.valid("param")
  const input = c.req.valid("json")

  try {
    const updatedWorkspace = await ProjectWorkspaceService.addSession({
      workspaceId: id,
      input,
    })

    return c.json({ success: true, data: updatedWorkspace })
  } catch (error) {
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }, 500)
  }
})

// 세션 제거
app.delete("/:id/sessions/:sessionId", zValidator("param", z.object({
  id: z.string(),
  sessionId: z.string(),
})), async (c) => {
  const { id, sessionId } = c.req.valid("param")

  try {
    const updatedWorkspace = await ProjectWorkspaceService.removeSession({
      workspaceId: id,
      sessionId,
    })

    return c.json({ success: true, data: updatedWorkspace })
  } catch (error) {
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }, 500)
  }
})

// 파일 공유
app.post("/:id/files/share", zValidator("param", z.object({
  id: z.string(),
})), zValidator("json", z.object({
  filePath: z.string(),
  sessionId: z.string().optional(),
  permissions: z.enum(["read", "write", "read-write"]).default("read"),
})), async (c) => {
  const { id } = c.req.valid("param")
  const input = c.req.valid("json")

  try {
    const updatedWorkspace = await ProjectWorkspaceService.shareFile({
      workspaceId: id,
      input,
    })

    return c.json({ success: true, data: updatedWorkspace })
  } catch (error) {
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }, 500)
  }
})

// 공유 파일 목록 조회
app.get("/:id/files/shared", zValidator("param", z.object({
  id: z.string(),
})), async (c) => {
  const { id } = c.req.valid("param")

  try {
    const sharedFiles = await ProjectWorkspaceService.getSharedFiles(id)
    return c.json({ success: true, data: sharedFiles })
  } catch (error) {
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }, 500)
  }
})

// 파일 공유 해제
app.delete("/:id/files/unshare", zValidator("param", z.object({
  id: z.string(),
})), zValidator("json", z.object({
  filePath: z.string(),
})), async (c) => {
  const { id } = c.req.valid("param")
  const { filePath } = c.req.valid("json")

  try {
    const updatedWorkspace = await ProjectWorkspaceService.unshareFile({
      workspaceId: id,
      filePath,
    })

    return c.json({ success: true, data: updatedWorkspace })
  } catch (error) {
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }, 500)
  }
})

// 파일 동기화
app.post("/:id/files/sync", zValidator("param", z.object({
  id: z.string(),
})), zValidator("json", z.object({
  filePath: z.string(),
  sessionId: z.string(),
  operation: z.enum(["push", "pull", "merge"]),
  content: z.string().optional(),
})), async (c) => {
  const { id } = c.req.valid("param")
  const input = c.req.valid("json")

  try {
    const result = await ProjectWorkspaceService.syncFile({
      workspaceId: id,
      input,
    })

    return c.json({ success: true, data: result })
  } catch (error) {
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }, 500)
  }
})

// 프로젝트 상태 조회
app.get("/:id/status", zValidator("param", z.object({
  id: z.string(),
})), async (c) => {
  const { id } = c.req.valid("param")

  try {
    const status = await ProjectWorkspaceService.getStatus(id)
    return c.json({ success: true, data: status })
  } catch (error) {
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }, 500)
  }
})

// 권한 확인
app.post("/:id/check-permission", zValidator("param", z.object({
  id: z.string(),
})), zValidator("json", z.object({
  sessionId: z.string(),
  permission: z.enum(["read", "write", "execute"]),
  filePath: z.string().optional(),
})), async (c) => {
  const { id } = c.req.valid("param")
  const input = c.req.valid("json")

  try {
    const hasPermission = await ProjectWorkspaceService.checkPermission({
      workspaceId: id,
      sessionId: input.sessionId,
      permission: input.permission,
      filePath: input.filePath,
    })

    return c.json({ success: true, data: { hasPermission } })
  } catch (error) {
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }, 500)
  }
})

// 프로젝트 정리
app.post("/cleanup", zValidator("json", z.object({
  maxInactiveDays: z.number().optional(),
})), async (c) => {
  const input = c.req.valid("json")

  try {
    const result = await ProjectWorkspaceService.cleanup({
      maxInactiveDays: input.maxInactiveDays,
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