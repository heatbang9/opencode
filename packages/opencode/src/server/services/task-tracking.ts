import { Storage } from "../../storage/storage"
import { Bus } from "../../bus"
import { Log } from "../../util/log"
import { TaskTracking } from "../../types/task-tracking"
import { fn } from "../../util/fn"
import { Identifier } from "../../id/id"
import { z } from "zod"

export namespace TaskTrackingService {
  const log = Log.create({ service: "task-tracking" })

  // 작업 생성
  export const create = fn(
    TaskTracking.CreateInput,
    async (input) => {
      // 의존성 확인
      if (input.dependencies) {
        for (const depId of input.dependencies) {
          const depTask = await get(depId)
          if (depTask.status !== "completed") {
            throw new Error(`Dependency not completed: ${depId}`)
          }
        }
      }

      const task: TaskTracking.Info = {
        id: Identifier.descending("task"),
        sessionId: input.sessionId,
        projectId: input.projectId,
        type: input.type,
        status: "pending",
        command: input.command,
        filePath: input.filePath,
        description: input.description,
        priority: input.priority,
        dependencies: input.dependencies,
        estimatedDuration: input.estimatedDuration,
        metadata: input.metadata,
        parentTaskId: input.parentTaskId,
        createdAt: new Date(),
        progress: 0,
      }

      await Storage.write(["task", task.id], task)

      // 부모 작업에 하위 작업 추가
      if (input.parentTaskId) {
        await Storage.update(
          ["task", input.parentTaskId],
          (draft) => {
            if (!draft.subtasks) draft.subtasks = []
            draft.subtasks.push(task.id)
          }
        )
      }

      // 작업 생성 이벤트 발행
      Bus.publish("task.created", {
        taskId: task.id,
        sessionId: task.sessionId,
        type: task.type,
      })

      log.info("Task created", {
        taskId: task.id,
        sessionId: task.sessionId,
        type: task.type,
      })

      return task
    }
  )

  // 작업 시작
  export const start = fn(
    z.object({
      taskId: z.string(),
    }),
    async (input) => {
      const task = await get(input.taskId)

      if (task.status !== "pending") {
        throw new Error(`Task cannot be started from status: ${task.status}`)
      }

      const updatedTask = await Storage.update(
        ["task", input.taskId],
        (draft) => {
          draft.status = "running"
          draft.startTime = new Date()
          draft.progress = 0
        }
      )

      // 작업 시작 이벤트 발행
      Bus.publish("task.started", {
        taskId: input.taskId,
        sessionId: task.sessionId,
      })

      log.info("Task started", {
        taskId: input.taskId,
        sessionId: task.sessionId,
      })

      return updatedTask
    }
  )

  // 작업 업데이트
  export const update = fn(
    z.object({
      taskId: z.string(),
      update: TaskTracking.UpdateInput,
    }),
    async (input) => {
      const task = await get(input.taskId)

      const updatedTask = await Storage.update(
        ["task", input.taskId],
        (draft) => {
          if (input.update.status !== undefined) {
            draft.status = input.update.status
            if (input.update.status === "completed") {
              draft.endTime = new Date()
              draft.progress = 100
            } else if (input.update.status === "failed") {
              draft.endTime = new Date()
            }
          }
          if (input.update.progress !== undefined) {
            draft.progress = Math.max(0, Math.min(100, input.update.progress))
          }
          if (input.update.result !== undefined) {
            draft.result = input.update.result
          }
          if (input.update.error !== undefined) {
            draft.error = input.update.error
          }
          if (input.update.metadata !== undefined) {
            draft.metadata = { ...draft.metadata, ...input.update.metadata }
          }
        }
      )

      // 상태 변경 이벤트 발행
      Bus.publish("task.updated", {
        taskId: input.taskId,
        sessionId: task.sessionId,
        status: updatedTask.status,
        progress: updatedTask.progress,
      })

      // 완료 또는 실패 시 추가 이벤트
      if (input.update.status === "completed") {
        Bus.publish("task.completed", {
          taskId: input.taskId,
          sessionId: task.sessionId,
          result: updatedTask.result,
        })

        // 의존하는 작업들 확인
        await checkDependentTasks(input.taskId)
      } else if (input.update.status === "failed") {
        Bus.publish("task.failed", {
          taskId: input.taskId,
          sessionId: task.sessionId,
          error: updatedTask.error,
        })
      }

      return updatedTask
    }
  )

  // 진행 상황 업데이트
  export const updateProgress = fn(
    TaskTracking.ProgressUpdate,
    async (input) => {
      const task = await get(input.taskId)

      const updatedTask = await Storage.update(
        ["task", input.taskId],
        (draft) => {
          draft.progress = Math.max(0, Math.min(100, input.progress))
        }
      )

      // 진행 상황 이벤트 발행
      Bus.publish("task.progress", {
        taskId: input.taskId,
        sessionId: task.sessionId,
        progress: input.progress,
        message: input.message,
        currentStep: input.currentStep,
        totalSteps: input.totalSteps,
      })

      return updatedTask
    }
  )

  // 작업 취소
  export const cancel = fn(
    z.string(),
    async (taskId) => {
      const task = await get(taskId)

      if (task.status === "completed" || task.status === "cancelled") {
        throw new Error(`Task cannot be cancelled from status: ${task.status}`)
      }

      const updatedTask = await Storage.update(
        ["task", taskId],
        (draft) => {
          draft.status = "cancelled"
          draft.endTime = new Date()
        }
      )

      // 하위 작업들도 취소
      if (task.subtasks) {
        for (const subtaskId of task.subtasks) {
          try {
            await cancel(subtaskId)
          } catch (error) {
            log.error("Failed to cancel subtask", {
              taskId: subtaskId,
              error,
            })
          }
        }
      }

      // 취소 이벤트 발행
      Bus.publish("task.cancelled", {
        taskId,
        sessionId: task.sessionId,
      })

      log.info("Task cancelled", {
        taskId,
        sessionId: task.sessionId,
      })

      return updatedTask
    }
  )

  // 작업 조회
  export const get = fn(
    z.string(),
    async (taskId) => {
      const task = await Storage.read<TaskTracking.Info>(["task", taskId])
      if (!task) {
        throw new Error(`Task not found: ${taskId}`)
      }
      return task
    }
  )

  // 작업 목록 조회
  export const list = fn(
    z.object({
      filter: TaskTracking.Filter.optional(),
    }),
    async (input) => {
      const tasks: TaskTracking.Info[] = []

      for await (const item of await Storage.list(["task"])) {
        const task = await Storage.read<TaskTracking.Info>(item)
        if (!task) continue

        if (input.filter) {
          if (input.filter.sessionId && task.sessionId !== input.filter.sessionId) continue
          if (input.filter.projectId && task.projectId !== input.filter.projectId) continue
          if (input.filter.type && task.type !== input.filter.type) continue
          if (input.filter.status && task.status !== input.filter.status) continue
          if (input.filter.priority && task.priority !== input.filter.priority) continue
          if (input.filter.since && task.createdAt < input.filter.since) continue
          if (input.filter.until && task.createdAt > input.filter.until) continue
          if (input.filter.parentTaskId && task.parentTaskId !== input.filter.parentTaskId) continue
        }

        tasks.push(task)
      }

      // 정렬 (생성 시간 내림차순)
      tasks.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())

      // 제한
      if (input.filter?.limit) {
        tasks.splice(input.filter.limit)
      }

      return tasks
    }
  )

  // 세션별 작업 목록 조회
  export const listForSession = fn(
    z.object({
      sessionId: z.string(),
      status: z.enum(["pending", "running", "completed", "failed", "cancelled"]).optional(),
    }),
    async (input) => {
      return await list({
        filter: {
          sessionId: input.sessionId,
          status: input.status,
        },
      })
    }
  )

  // 프로젝트별 작업 목록 조회
  export const listForProject = fn(
    z.object({
      projectId: z.string(),
      status: z.enum(["pending", "running", "completed", "failed", "cancelled"]).optional(),
    }),
    async (input) => {
      return await list({
        filter: {
          projectId: input.projectId,
          status: input.status,
        },
      })
    }
  )

  // 작업 통계 조회
  export const getStatistics = fn(
    z.object({
      sessionId: z.string().optional(),
      projectId: z.string().optional(),
      since: z.date().optional(),
    }),
    async (input) => {
      const stats: TaskTracking.Statistics = {
        sessionId: input.sessionId,
        projectId: input.projectId,
        totalTasks: 0,
        pendingTasks: 0,
        runningTasks: 0,
        completedTasks: 0,
        failedTasks: 0,
        cancelledTasks: 0,
        successRate: 0,
        taskTypeStats: {},
        hourlyStats: [],
        lastUpdated: new Date(),
      }

      const cutoffTime = input.since || new Date(0)

      for await (const item of await Storage.list(["task"])) {
        const task = await Storage.read<TaskTracking.Info>(item)
        if (!task) continue

        if (task.createdAt < cutoffTime) continue
        if (input.sessionId && task.sessionId !== input.sessionId) continue
        if (input.projectId && task.projectId !== input.projectId) continue

        stats.totalTasks++
        stats[task.status === "pending" ? "pendingTasks" :
              task.status === "running" ? "runningTasks" :
              task.status === "completed" ? "completedTasks" :
              task.status === "failed" ? "failedTasks" :
              "cancelledTasks"]++

        // 타입별 통계
        if (!stats.taskTypeStats[task.type]) {
          stats.taskTypeStats[task.type] = {
            count: 0,
            avgCompletionTime: undefined,
            successRate: 0,
          }
        }
        stats.taskTypeStats[task.type].count++

        // 완료 시간 계산
        if (task.status === "completed" && task.startTime && task.endTime) {
          const duration = task.endTime.getTime() - task.startTime.getTime()
          const current = stats.taskTypeStats[task.type].avgCompletionTime || 0
          const count = stats.taskTypeStats[task.type].count
          stats.taskTypeStats[task.type].avgCompletionTime =
            (current * (count - 1) + duration) / count
        }
      }

      // 성공률 계산
      const finished = stats.completedTasks + stats.failedTasks + stats.cancelledTasks
      if (finished > 0) {
        stats.successRate = stats.completedTasks / finished
      }

      return stats
    }
  )

  // 실행 로그 추가
  export const addLog = fn(
    z.object({
      taskId: z.string(),
      level: z.enum(["debug", "info", "warn", "error"]),
      message: z.string(),
      data: z.any().optional(),
    }),
    async (input) => {
      const logEntry: TaskTracking.ExecutionLog = {
        id: Identifier.descending("task_log"),
        taskId: input.taskId,
        timestamp: new Date(),
        level: input.level,
        message: input.message,
        data: input.data,
      }

      await Storage.write(["task_log", input.taskId, logEntry.id], logEntry)

      return logEntry
    }
  )

  // 작업 결과 저장
  export const saveResult = fn(
    z.object({
      taskId: z.string(),
      result: TaskTracking.Result,
    }),
    async (input) => {
      const task = await get(input.taskId)

      await Storage.write(["task_result", input.taskId], input.result)

      // 결과 저장 이벤트 발행
      Bus.publish("task.result_saved", {
        taskId: input.taskId,
        sessionId: task.sessionId,
        success: input.result.success,
      })

      log.info("Task result saved", {
        taskId: input.taskId,
        sessionId: task.sessionId,
        success: input.result.success,
      })

      return input.result
    }
  )

  // 의존하는 작업 확인
  async function checkDependentTasks(completedTaskId: string) {
    // 이 작업을 의존하는 다른 작업들 찾기
    for await (const item of await Storage.list(["task"])) {
      const task = await Storage.read<TaskTracking.Info>(item)
      if (!task || !task.dependencies) continue

      if (task.dependencies.includes(completedTaskId) && task.status === "pending") {
        // 모든 의존성이 완료되었는지 확인
        let allCompleted = true
        for (const depId of task.dependencies) {
          const depTask = await get(depId)
          if (depTask.status !== "completed") {
            allCompleted = false
            break
          }
        }

        if (allCompleted) {
          // 의존성 해결 이벤트 발행
          Bus.publish("task.dependency_resolved", {
            taskId: task.id,
            sessionId: task.sessionId,
            resolvedDependency: completedTaskId,
          })
        }
      }
    }
  }

  // 오래된 작업 정리
  export const cleanup = fn(
    z.object({
      maxAge: z.number().default(86400000),  // 24시간
    }),
    async (input) => {
      const cutoffTime = new Date()
      cutoffTime.setTime(cutoffTime.getTime() - input.maxAge)

      const cleaned: string[] = []

      for await (const item of await Storage.list(["task"])) {
        const task = await Storage.read<TaskTracking.Info>(item)
        if (!task) continue

        if (task.createdAt < cutoffTime &&
            (task.status === "completed" || task.status === "failed" || task.status === "cancelled")) {

          // 관련 데이터 정리
          await Storage.remove(["task", task.id])
          await Storage.remove(["task_result", task.id])
          for await (const logItem of await Storage.list(["task_log", task.id])) {
            await Storage.remove(logItem)
          }

          cleaned.push(task.id)
        }
      }

      log.info("Task cleanup completed", {
        cleanedCount: cleaned.length,
        tasks: cleaned,
      })

      return { cleaned, count: cleaned.length }
    }
  )
}