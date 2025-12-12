import { Storage } from "../../storage/storage"
import { Bus } from "../../bus"
import { Log } from "../../util/log"
import { Instance } from "../../project/instance"
import { ProjectWorkspace } from "../../types/project-workspace"
import { fn } from "../../util/fn"
import { Identifier } from "../../id/id"
import { z } from "zod"
import path from "path"
import { existsSync, mkdirSync } from "fs"

export namespace ProjectWorkspaceService {
  const log = Log.create({ service: "project-workspace" })

  // 워크스페이스 생성
  export const create = fn(
    ProjectWorkspace.CreateInput,
    async (input) => {
      const workspaceId = Identifier.descending("workspace")

      // 워크스페이스 디렉토리 생성
      const workspacePath = path.resolve(input.path)
      if (!existsSync(workspacePath)) {
        mkdirSync(workspacePath, { recursive: true })
      }

      const workspace: ProjectWorkspace.Info = {
        id: workspaceId,
        name: input.name,
        path: workspacePath,
        description: input.description,
        sessions: [],
        sharedFiles: [],
        isolationLevel: input.isolationLevel,
        permissions: {
          read: [],
          write: [],
          execute: [],
        },
        status: "active",
        createdAt: new Date(),
        updatedAt: new Date(),
        settings: input.settings || {},
      }

      await Storage.write(["workspace", workspaceId], workspace)

      log.info("Workspace created", { workspaceId, name: input.name })
      return workspace
    }
  )

  // 워크스페이스 조회
  export const get = fn(
    z.string(),
    async (workspaceId) => {
      const workspace = await Storage.read<ProjectWorkspace.Info>(["workspace", workspaceId])
      if (!workspace) {
        throw new Error(`Workspace not found: ${workspaceId}`)
      }
      return workspace
    }
  )

  // 워크스페이스 업데이트
  export const update = fn(
    z.object({
      workspaceId: z.string(),
      update: ProjectWorkspace.UpdateInput,
    }),
    async (input) => {
      const workspace = await get(input.workspaceId)
      const updatedWorkspace = await Storage.update(
        ["workspace", input.workspaceId],
        (draft) => {
          if (input.update.name) draft.name = input.update.name
          if (input.update.description !== undefined) draft.description = input.update.description
          if (input.update.isolationLevel) draft.isolationLevel = input.update.isolationLevel
          if (input.update.status) draft.status = input.update.status
          if (input.update.settings) draft.settings = { ...draft.settings, ...input.update.settings }
          draft.updatedAt = new Date()
        }
      )

      log.info("Workspace updated", { workspaceId: input.workspaceId })
      return updatedWorkspace
    }
  )

  // 워크스페이스 삭제
  export const remove = fn(
    z.string(),
    async (workspaceId) => {
      const workspace = await get(workspaceId)

      // 연결된 모든 세션 제거
      for (const sessionId of workspace.sessions) {
        await removeSession(workspaceId, sessionId)
      }

      await Storage.remove(["workspace", workspaceId])

      log.info("Workspace deleted", { workspaceId })
    }
  )

  // 워크스페이스 목록 조회
  export const list = fn(
    z.object({
      status: z.enum(["active", "inactive", "archived"]).optional(),
    }),
    async (input) => {
      const workspaces: ProjectWorkspace.Info[] = []

      for await (const item of await Storage.list(["workspace"])) {
        const workspace = await Storage.read<ProjectWorkspace.Info>(item)
        if (!workspace) continue

        if (input.status && workspace.status !== input.status) continue
        workspaces.push(workspace)
      }

      return workspaces
    }
  )

  // 세션 추가
  export const addSession = fn(
    z.object({
      workspaceId: z.string(),
      input: ProjectWorkspace.AddSessionInput,
    }),
    async (input) => {
      const workspace = await get(input.workspaceId)

      // 세션이 이미 존재하는지 확인
      if (workspace.sessions.includes(input.input.sessionId)) {
        throw new Error(`Session already in workspace: ${input.input.sessionId}`)
      }

      const updatedWorkspace = await Storage.update(
        ["workspace", input.workspaceId],
        (draft) => {
          draft.sessions.push(input.input.sessionId)
          if (input.input.permissions) {
            if (input.input.permissions.read) {
              draft.permissions.read.push(...input.input.permissions.read)
            }
            if (input.input.permissions.write) {
              draft.permissions.write.push(...input.input.permissions.write)
            }
            if (input.input.permissions.execute) {
              draft.permissions.execute.push(...input.input.permissions.execute)
            }
          }
          draft.updatedAt = new Date()
        }
      )

      log.info("Session added to workspace", {
        workspaceId: input.workspaceId,
        sessionId: input.input.sessionId,
      })

      return updatedWorkspace
    }
  )

  // 세션 제거
  export const removeSession = fn(
    z.object({
      workspaceId: z.string(),
      sessionId: z.string(),
    }),
    async (input) => {
      const workspace = await get(input.workspaceId)

      const updatedWorkspace = await Storage.update(
        ["workspace", input.workspaceId],
        (draft) => {
          draft.sessions = draft.sessions.filter(id => id !== input.sessionId)
          draft.updatedAt = new Date()
        }
      )

      log.info("Session removed from workspace", {
        workspaceId: input.workspaceId,
        sessionId: input.sessionId,
      })

      return updatedWorkspace
    }
  )

  // 파일 공유
  export const shareFile = fn(
    z.object({
      workspaceId: z.string(),
      input: ProjectWorkspace.ShareFileInput,
    }),
    async (input) => {
      const workspace = await get(input.workspaceId)
      const filePath = path.resolve(input.input.filePath)

      // 파일이 존재하는지 확인
      if (!existsSync(filePath)) {
        throw new Error(`File not found: ${filePath}`)
      }

      const updatedWorkspace = await Storage.update(
        ["workspace", input.workspaceId],
        (draft) => {
          // 파일이 이미 공유되었는지 확인
          if (!draft.sharedFiles.includes(filePath)) {
            draft.sharedFiles.push(filePath)
          }
          draft.updatedAt = new Date()
        }
      )

      // 파일 공유 이벤트 발행
      Bus.publish("workspace.file_shared", {
        workspaceId: input.workspaceId,
        filePath,
        sessionId: input.input.sessionId,
        permissions: input.input.permissions,
      })

      log.info("File shared in workspace", {
        workspaceId: input.workspaceId,
        filePath,
      })

      return updatedWorkspace
    }
  )

  // 파일 공유 해제
  export const unshareFile = fn(
    z.object({
      workspaceId: z.string(),
      filePath: z.string(),
    }),
    async (input) => {
      const workspace = await get(input.workspaceId)
      const filePath = path.resolve(input.filePath)

      const updatedWorkspace = await Storage.update(
        ["workspace", input.workspaceId],
        (draft) => {
          draft.sharedFiles = draft.sharedFiles.filter(path => path !== filePath)
          draft.updatedAt = new Date()
        }
      )

      log.info("File unshared from workspace", {
        workspaceId: input.workspaceId,
        filePath,
      })

      return updatedWorkspace
    }
  )

  // 공유 파일 목록 조회
  export const getSharedFiles = fn(
    z.string(),
    async (workspaceId) => {
      const workspace = await get(workspaceId)
      return workspace.sharedFiles
    }
  )

  // 파일 동기화
  export const syncFile = fn(
    z.object({
      workspaceId: z.string(),
      input: ProjectWorkspace.SyncFileInput,
    }),
    async (input) => {
      const workspace = await get(input.workspaceId)

      switch (input.input.operation) {
        case "push":
          return await pushFile(input.input, workspace)
        case "pull":
          return await pullFile(input.input, workspace)
        case "merge":
          return await mergeFile(input.input, workspace)
      }
    }
  )

  // 워크스페이스 상태 조회
  export const getStatus = fn(
    z.string(),
    async (workspaceId) => {
      const workspace = await get(workspaceId)

      // 활성 세션 수 계산
      const { EnhancedSessionService } = await import("./enhanced-session")
      let activeSessionCount = 0

      for (const sessionId of workspace.sessions) {
        try {
          const status = await EnhancedSessionService.getStatus(sessionId)
          if (status.session.status === "active" || status.session.status === "busy") {
            activeSessionCount++
          }
        } catch (error) {
          // 세션이 존재하지 않을 수 있음
        }
      }

      const status: ProjectWorkspace.Status = {
        workspaceId,
        sessionCount: workspace.sessions.length,
        activeSessionCount,
        sharedFileCount: workspace.sharedFiles.length,
        lastActivity: workspace.updatedAt,
      }

      return status
    }
  )

  // 워크스페이스 권한 확인
  export const checkPermission = fn(
    z.object({
      workspaceId: z.string(),
      sessionId: z.string(),
      permission: z.enum(["read", "write", "execute"]),
      filePath: z.string().optional(),
    }),
    async (input) => {
      const workspace = await get(input.workspaceId)

      // 세션이 워크스페이스에 속해 있는지 확인
      if (!workspace.sessions.includes(input.sessionId)) {
        return false
      }

      // 권한 확인
      return workspace.permissions[input.permission].includes(input.sessionId)
    }
  )

  // 워크스페이스별 세션 목록 조회
  export const getSessions = fn(
    z.string(),
    async (workspaceId) => {
      const workspace = await get(workspaceId)
      return workspace.sessions
    }
  )

  // 파일 동기화 구현
  async function pushFile(input: ProjectWorkspace.SyncFileInput, workspace: ProjectWorkspace.Info) {
    // 파일을 다른 세션들로 푸시
    const { AgentMessageService } = await import("./agent-message")

    for (const sessionId of workspace.sessions) {
      if (sessionId === input.sessionId) continue

      await AgentMessageService.send({
        from: input.sessionId,
        to: sessionId,
        type: "notification",
        channel: "file",
        payload: {
          type: "FILE_CHANGED",
          filePath: input.filePath,
          operation: "push",
          content: input.content,
        },
      })
    }

    return { success: true, operation: "push" }
  }

  async function pullFile(input: ProjectWorkspace.SyncFileInput, workspace: ProjectWorkspace.Info) {
    // 다른 세션에서 파일 내용 가져오기
    const { AgentMessageService } = await import("./agent-message")

    // 메시지 브로드캐스트
    await AgentMessageService.broadcast({
      from: input.sessionId,
      channel: "file",
      payload: {
        type: "FILE_REQUEST",
        filePath: input.filePath,
        operation: "pull",
      },
      workspaceId: workspace.id,
    })

    return { success: true, operation: "pull" }
  }

  async function mergeFile(input: ProjectWorkspace.SyncFileInput, workspace: ProjectWorkspace.Info) {
    // 파일 병합 로직 (간단한 구현)
    // 실제로는 충돌 감지 및 3-way 병합 등 복잡한 로직 필요
    log.info("File merge requested", {
      workspaceId: workspace.id,
      filePath: input.filePath,
      sessionId: input.sessionId,
    })

    return { success: true, operation: "merge", message: "Merge initiated" }
  }

  // 워크스페이스 정리 (오래된 비활성 워크스페이스)
  export const cleanup = fn(
    z.object({
      maxInactiveDays: z.number().default(7),
    }),
    async (input) => {
      const cutoffTime = new Date()
      cutoffTime.setDate(cutoffTime.getDate() - input.maxInactiveDays)

      const cleaned: string[] = []

      for await (const item of await Storage.list(["workspace"])) {
        const workspace = await Storage.read<ProjectWorkspace.Info>(item)
        if (!workspace) continue

        if (workspace.status === "active" && workspace.updatedAt < cutoffTime) {
          await update({
            workspaceId: workspace.id,
            update: { status: "inactive" },
          })
          cleaned.push(workspace.id)
        }
      }

      log.info("Workspace cleanup completed", {
        cleanedCount: cleaned.length,
        workspaces: cleaned,
      })

      return { cleaned, count: cleaned.length }
    }
  )
}