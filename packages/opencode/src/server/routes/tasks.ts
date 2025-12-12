import { Hono } from "hono"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { TaskTrackingService } from "../services/task-tracking"

const app = new Hono()

// 작업 생성
app.post("/", zValidator("json", z.object({
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
})), async (c) => {
  const input = c.req.valid("json")

  try {
    const task = await TaskTrackingService.create(input)
    return c.json({ success: true, data: task }, 201)
  } catch (error) {
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }, 500)
  }
})

// 작업 시작
app.post("/:id/start", zValidator("param", z.object({
  id: z.string(),
})), async (c) => {
  const { id } = c.req.valid("param")

  try {
    const updatedTask = await TaskTrackingService.start({ taskId: id })
    return c.json({ success: true, data: updatedTask })
  } catch (error) {
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }, 500)
  }
})

// 작업 업데이트
app.put("/:id", zValidator("param", z.object({
  id: z.string(),
})), zValidator("json", z.object({
  status: z.enum(["pending", "running", "completed", "failed", "cancelled"]).optional(),
  progress: z.number().min(0).max(100).optional(),
  result: z.any().optional(),
  error: z.string().optional(),
  metadata: z.record(z.any()).optional(),
})), async (c) => {
  const { id } = c.req.valid("param")
  const update = c.req.valid("json")

  try {
    const updatedTask = await TaskTrackingService.update({
      taskId: id,
      update,
    })

    return c.json({ success: true, data: updatedTask })
  } catch (error) {
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }, 500)
  }
})

// 진행 상황 업데이트
app.post("/:id/progress", zValidator("param", z.object({
  id: z.string(),
})), zValidator("json", z.object({
  progress: z.number().min(0).max(100),
  message: z.string().optional(),
  currentStep: z.string().optional(),
  totalSteps: z.number().optional(),
})), async (c) => {
  const { id } = c.req.valid("param")
  const input = c.req.valid("json")

  try {
    const updatedTask = await TaskTrackingService.updateProgress({
      taskId: id,
      ...input,
    })

    return c.json({ success: true, data: updatedTask })
  } catch (error) {
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }, 500)
  }
})

// 작업 취소
app.delete("/:id", zValidator("param", z.object({
  id: z.string(),
})), async (c) => {
  const { id } = c.req.valid("param")

  try {
    const updatedTask = await TaskTrackingService.cancel(id)
    return c.json({ success: true, data: updatedTask })
  } catch (error) {
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }, 500)
  }
})

// 작업 조회
app.get("/:id", zValidator("param", z.object({
  id: z.string(),
})), async (c) => {
  const { id } = c.req.valid("param")

  try {
    const task = await TaskTrackingService.get(id)
    return c.json({ success: true, data: task })
  } catch (error) {
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }, 404)
  }
})

// 작업 목록 조회
app.get("/", zValidator("query", z.object({
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
  since: z.string().datetime().optional(),
  until: z.string().datetime().optional(),
  parentTaskId: z.string().optional(),
  limit: z.number().optional(),
})), async (c) => {
  const query = c.req.valid("query")

  try {
    const tasks = await TaskTrackingService.list({
      filter: {
        sessionId: query.sessionId,
        projectId: query.projectId,
        type: query.type,
        status: query.status,
        priority: query.priority,
        since: query.since ? new Date(query.since) : undefined,
        until: query.until ? new Date(query.until) : undefined,
        parentTaskId: query.parentTaskId,
        limit: query.limit,
      },
    })

    return c.json({ success: true, data: tasks })
  } catch (error) {
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }, 500)
  }
})

// 세션별 작업 목록 조회
app.get("/session/:sessionId", zValidator("param", z.object({
  sessionId: z.string(),
})), zValidator("query", z.object({
  status: z.enum(["pending", "running", "completed", "failed", "cancelled"]).optional(),
})), async (c) => {
  const { sessionId } = c.req.valid("param")
  const query = c.req.valid("query")

  try {
    const tasks = await TaskTrackingService.listForSession({
      sessionId,
      status: query.status,
    })

    return c.json({ success: true, data: tasks })
  } catch (error) {
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }, 500)
  }
})

// 프로젝트별 작업 목록 조회
app.get("/project/:projectId", zValidator("param", z.object({
  projectId: z.string(),
})), zValidator("query", z.object({
  status: z.enum(["pending", "running", "completed", "failed", "cancelled"]).optional(),
})), async (c) => {
  const { projectId } = c.req.valid("param")
  const query = c.req.valid("query")

  try {
    const tasks = await TaskTrackingService.listForProject({
      projectId,
      status: query.status,
    })

    return c.json({ success: true, data: tasks })
  } catch (error) {
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }, 500)
  }
})

// 작업 통계 조회
app.get("/statistics", zValidator("query", z.object({
  sessionId: z.string().optional(),
  projectId: z.string().optional(),
  since: z.string().datetime().optional(),
})), async (c) => {
  const query = c.req.valid("query")

  try {
    const stats = await TaskTrackingService.getStatistics({
      sessionId: query.sessionId,
      projectId: query.projectId,
      since: query.since ? new Date(query.since) : undefined,
    })

    return c.json({ success: true, data: stats })
  } catch (error) {
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }, 500)
  }
})

// 실행 로그 추가
app.post("/:id/log", zValidator("param", z.object({
  id: z.string(),
})), zValidator("json", z.object({
  level: z.enum(["debug", "info", "warn", "error"]),
  message: z.string(),
  data: z.any().optional(),
})), async (c) => {
  const { id } = c.req.valid("param")
  const input = c.req.valid("json")

  try {
    const logEntry = await TaskTrackingService.addLog({
      taskId: id,
      ...input,
    })

    return c.json({ success: true, data: logEntry }, 201)
  } catch (error) {
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }, 500)
  }
})

// 작업 결과 저장
app.post("/:id/result", zValidator("param", z.object({
  id: z.string(),
})), zValidator("json", z.object({
  success: z.boolean(),
  output: z.any().optional(),
  artifacts: z.array(z.object({
    type: z.enum(["file", "directory", "data", "url"]),
    path: z.string().optional(),
    content: z.string().optional(),
    metadata: z.record(z.any()).optional(),
  })).optional(),
  metrics: z.object({
    duration: z.number(),
    memoryUsed: z.number().optional(),
    cpuUsed: z.number().optional(),
  }).optional(),
})), async (c) => {
  const { id } = c.req.valid("param")
  const result = c.req.valid("json")

  try {
    const savedResult = await TaskTrackingService.saveResult({
      taskId: id,
      result,
    })

    return c.json({ success: true, data: savedResult }, 201)
  } catch (error) {
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }, 500)
  }
})

// 작업 정리
app.post("/cleanup", zValidator("json", z.object({
  maxAge: z.number().optional(),
})), async (c) => {
  const input = c.req.valid("json")

  try {
    const result = await TaskTrackingService.cleanup({
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

export default app