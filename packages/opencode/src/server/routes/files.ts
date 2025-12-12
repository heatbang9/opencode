import { Hono } from "hono"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { FileLockService } from "../services/file-lock"

const app = new Hono()

// 파일 잠금 요청
app.post("/lock", zValidator("json", z.object({
  filePath: z.string(),
  sessionId: z.string(),
  lockType: z.enum(["read", "write", "exclusive"]).default("write"),
  timeout: z.number().optional(),
  reason: z.string().optional(),
})), async (c) => {
  const input = c.req.valid("json")

  try {
    const result = await FileLockService.acquire({
      ...input,
    })

    return c.json({ success: true, data: result })
  } catch (error) {
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }, 500)
  }
})

// 파일 잠금 해제
app.delete("/lock/:lockId", zValidator("param", z.object({
  lockId: z.string(),
})), zValidator("json", z.object({
  sessionId: z.string(),
})), async (c) => {
  const { lockId } = c.req.valid("param")
  const { sessionId } = c.req.valid("json")

  try {
    const result = await FileLockService.release({
      lockId,
      sessionId,
    })

    return c.json({ success: true, data: result })
  } catch (error) {
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }, 500)
  }
})

// 파일 잠금 상태 확인
app.get("/lock/status", zValidator("query", z.object({
  filePath: z.string(),
})), async (c) => {
  const { filePath } = c.req.valid("query")

  try {
    const status = await FileLockService.check(filePath)
    return c.json({ success: true, data: status })
  } catch (error) {
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }, 500)
  }
})

// 파일 잠금 강제 해제
app.post("/lock/force-release", zValidator("json", z.object({
  filePath: z.string(),
  reason: z.string(),
})), async (c) => {
  const input = c.req.valid("json")

  try {
    const result = await FileLockService.forceRelease({
      filePath: input.filePath,
      reason: input.reason,
    })

    return c.json({ success: true, data: result })
  } catch (error) {
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }, 500)
  }
})

// 잠금 목록 조회
app.get("/locks", zValidator("query", z.object({
  sessionId: z.string().optional(),
  filePath: z.string().optional(),
  status: z.enum(["active", "released", "expired"]).optional(),
})), async (c) => {
  const query = c.req.valid("query")

  try {
    const locks = await FileLockService.list({
      sessionId: query.sessionId,
      filePath: query.filePath,
      status: query.status,
    })

    return c.json({ success: true, data: locks })
  } catch (error) {
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }, 500)
  }
})

// 파일 잠금 통계 조회
app.get("/locks/statistics", zValidator("query", z.object({
  sessionId: z.string().optional(),
})), async (c) => {
  const query = c.req.valid("query")

  try {
    const stats = await FileLockService.getStatistics({
      sessionId: query.sessionId,
    })

    return c.json({ success: true, data: stats })
  } catch (error) {
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }, 500)
  }
})

// 데드락 감지
app.post("/locks/deadlock-detect", async (c) => {
  try {
    const deadlocks = await FileLockService.detectDeadlocks()
    return c.json({ success: true, data: deadlocks })
  } catch (error) {
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }, 500)
  }
})

// 만료된 잠금 정리
app.post("/locks/expire", async (c) => {
  try {
    const result = await FileLockService.expireLocks()
    return c.json({ success: true, data: result })
  } catch (error) {
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }, 500)
  }
})

export default app