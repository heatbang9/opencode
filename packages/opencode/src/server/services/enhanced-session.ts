import { Storage } from "../../storage/storage"
import { Bus } from "../../bus"
import { Log } from "../../util/log"
import { Instance } from "../../project/instance"
import { EnhancedSession } from "../../types/enhanced-session"
import { Session } from "../../session"
import { fn } from "../../util/fn"
import { Identifier } from "../../id/id"
import { z } from "zod"

export namespace EnhancedSessionService {
  const log = Log.create({ service: "enhanced-session" })

  // 확장된 세션 생성
  export const create = fn(
    EnhancedSession.CreateInput,
    async (input) => {
      // 기본 세션 생성
      const baseSession = await Session.create({
        title: input.title,
        directory: input.directory || Instance.directory,
      })

      // 확장된 세션 정보 병합
      const enhancedSession: EnhancedSession.Info = {
        ...baseSession,
        projectId: input.projectId,
        agentRole: input.agentRole,
        metadata: input.metadata || {},
        permissions: input.permissions,
        status: "idle",
        createdAt: new Date(),
        lastActivity: new Date(),
        time: baseSession.time,
      }

      // 확장된 세션 정보 저장
      await Storage.write(
        ["enhanced_session", Instance.project.id, enhancedSession.id],
        enhancedSession
      )

      // 이벤트 발행
      Bus.publish(Session.Event.Created, {
        info: enhancedSession,
      })

      log.info("Enhanced session created", { sessionId: enhancedSession.id })
      return enhancedSession
    }
  )

  // 세션 메타데이터 업데이트
  export const updateMetadata = fn(
    z.object({
      sessionId: Identifier.schema("session"),
      metadata: EnhancedSession.MetadataUpdate,
    }),
    async (input) => {
      const session = await get(input.sessionId)

      const updatedSession = await Storage.update(
        ["enhanced_session", Instance.project.id, input.sessionId],
        (draft) => {
          if (input.metadata.agentRole) {
            draft.agentRole = input.metadata.agentRole
          }
          if (input.metadata.metadata) {
            draft.metadata = { ...draft.metadata, ...input.metadata.metadata }
          }
          if (input.metadata.permissions) {
            draft.permissions = { ...draft.permissions, ...input.metadata.permissions }
          }
          draft.lastActivity = new Date()
          draft.time.updated = Date.now()
        }
      )

      Bus.publish(Session.Event.Updated, {
        info: updatedSession,
      })

      log.info("Session metadata updated", { sessionId: input.sessionId })
      return updatedSession
    }
  )

  // 세션 상태 업데이트
  export const updateStatus = fn(
    z.object({
      sessionId: Identifier.schema("session"),
      status: z.enum(["active", "idle", "busy", "error", "offline"]),
      currentTask: z.string().optional(),
    }),
    async (input) => {
      const updatedSession = await Storage.update(
        ["enhanced_session", Instance.project.id, input.sessionId],
        (draft) => {
          draft.status = input.status
          draft.lastActivity = new Date()
          draft.time.updated = Date.now()
        }
      )

      // 상태 정보 별도 저장
      const statusInfo: EnhancedSession.Status = {
        sessionId: input.sessionId,
        status: input.status,
        currentTask: input.currentTask,
        lastHeartbeat: new Date(),
      }

      await Storage.write(
        ["session_status", input.sessionId],
        statusInfo
      )

      Bus.publish(Session.Event.Updated, {
        info: updatedSession,
      })

      log.info("Session status updated", {
        sessionId: input.sessionId,
        status: input.status
      })
      return updatedSession
    }
  )

  // 세션 활성 상태 확인 (ping)
  export const ping = fn(
    Identifier.schema("session"),
    async (sessionId) => {
      try {
        const session = await get(sessionId)
        await updateStatus({
          sessionId,
          status: session.status === "offline" ? "active" : session.status,
        })

        return {
          alive: true,
          sessionId,
          lastActivity: session.lastActivity,
        }
      } catch (error) {
        return {
          alive: false,
          sessionId,
          error: error instanceof Error ? error.message : "Unknown error",
        }
      }
    }
  )

  // 상세 상태 정보 조회
  export const getStatus = fn(
    Identifier.schema("session"),
    async (sessionId) => {
      const [session, status] = await Promise.all([
        get(sessionId),
        Storage.read<EnhancedSession.Status>(["session_status", sessionId]),
      ])

      return {
        session,
        status: status || {
          sessionId,
          status: session.status,
          lastHeartbeat: session.lastActivity,
        },
      }
    }
  )

  // 세션 강제 종료
  export const forceTerminate = fn(
    z.object({
      sessionId: Identifier.schema("session"),
      reason: z.string().optional(),
    }),
    async (input) => {
      const session = await get(input.sessionId)

      // 세션 상태를 offline으로 변경
      await updateStatus({
        sessionId: input.sessionId,
        status: "offline",
      })

      // 실행 중인 작업 취소
      await cancelAllTasks(input.sessionId)

      // 세션 정리
      await Session.remove(input.sessionId)

      // 확장 세션 정보 삭제
      await Storage.remove(["enhanced_session", Instance.project.id, input.sessionId])
      await Storage.remove(["session_status", input.sessionId])

      log.warn("Session force terminated", {
        sessionId: input.sessionId,
        reason: input.reason
      })

      return {
        sessionId: input.sessionId,
        terminated: true,
        reason: input.reason || "Force terminated by request",
      }
    }
  )

  // 프로젝트별 세션 목록 조회
  export const listByProject = fn(
    z.object({
      projectId: z.string(),
      status: z.enum(["active", "idle", "busy", "error", "offline"]).optional(),
      agentRole: z.string().optional(),
    }),
    async (input) => {
      const sessions: EnhancedSession.Info[] = []

      for await (const item of await Storage.list(["enhanced_session", Instance.project.id])) {
        const session = await Storage.read<EnhancedSession.Info>(item)
        if (!session) continue

        if (session.projectId !== input.projectId) continue
        if (input.status && session.status !== input.status) continue
        if (input.agentRole && session.agentRole !== input.agentRole) continue

        sessions.push(session)
      }

      return sessions
    }
  )

  // 에이전트 역할별 세션 목록 조회
  export const listByAgentRole = fn(
    z.object({
      agentRole: z.string(),
      status: z.enum(["active", "idle", "busy", "error", "offline"]).optional(),
    }),
    async (input) => {
      const sessions: EnhancedSession.Info[] = []

      for await (const item of await Storage.list(["enhanced_session", Instance.project.id])) {
        const session = await Storage.read<EnhancedSession.Info>(item)
        if (!session) continue

        if (session.agentRole !== input.agentRole) continue
        if (input.status && session.status !== input.status) continue

        sessions.push(session)
      }

      return sessions
    }
  )

  // 세션 통계 조회
  export const getStatistics = fn(
    z.object({
      projectId: z.string().optional(),
    }),
    async (input) => {
      const stats = {
        total: 0,
        active: 0,
        idle: 0,
        busy: 0,
        error: 0,
        offline: 0,
        byAgentRole: {} as Record<string, number>,
      }

      for await (const item of await Storage.list(["enhanced_session", Instance.project.id])) {
        const session = await Storage.read<EnhancedSession.Info>(item)
        if (!session) continue

        if (input.projectId && session.projectId !== input.projectId) continue

        stats.total++
        stats[session.status]++

        if (session.agentRole) {
          stats.byAgentRole[session.agentRole] =
            (stats.byAgentRole[session.agentRole] || 0) + 1
        }
      }

      return stats
    }
  )

  // 유틸리티 함수
  async function get(sessionId: string): Promise<EnhancedSession.Info> {
    const session = await Storage.read<EnhancedSession.Info>(
      ["enhanced_session", Instance.project.id, sessionId]
    )

    if (!session) {
      throw new Error(`Enhanced session not found: ${sessionId}`)
    }

    return session
  }

  async function cancelAllTasks(sessionId: string) {
    // TaskTracking 서비스를 import하여 실행 중인 모든 작업 취소
    try {
      const { TaskTrackingService } = await import("./task-tracking")
      const tasks = await TaskTrackingService.list({ sessionId })

      for (const task of tasks) {
        if (task.status === "running") {
          await TaskTrackingService.cancel(task.id)
        }
      }
    } catch (error) {
      log.error("Failed to cancel tasks", { sessionId, error })
    }
  }

  // 세션 자동 정리 (오래된 세션 정리)
  export const cleanup = fn(
    z.object({
      maxAge: z.number().default(86400000),  // 24시간
    }),
    async (input) => {
      const cutoffTime = Date.now() - input.maxAge
      const cleaned: string[] = []

      for await (const item of await Storage.list(["enhanced_session", Instance.project.id])) {
        const session = await Storage.read<EnhancedSession.Info>(item)
        if (!session) continue

        if (session.lastActivity.getTime() < cutoffTime && session.status === "offline") {
          await forceTerminate({ sessionId: session.id, reason: "Auto cleanup" })
          cleaned.push(session.id)
        }
      }

      log.info("Session cleanup completed", {
        cleanedCount: cleaned.length,
        sessions: cleaned
      })

      return { cleaned, count: cleaned.length }
    }
  )

  // 주기적인 하트비트 체크
  export const heartbeatCheck = fn(
    z.object({
      timeout: z.number().default(300000),  // 5분
    }),
    async (input) => {
      const cutoffTime = Date.now() - input.timeout
      const timedOut: string[] = []

      for await (const item of await Storage.list(["session_status"])) {
        const status = await Storage.read<EnhancedSession.Status>(item)
        if (!status) continue

        if (status.lastHeartbeat.getTime() < cutoffTime && status.status !== "offline") {
          await updateStatus({
            sessionId: status.sessionId,
            status: "offline",
          })
          timedOut.push(status.sessionId)
        }
      }

      if (timedOut.length > 0) {
        log.warn("Sessions timed out", { sessions: timedOut })
      }

      return { timedOut, count: timedOut.length }
    }
  )
}