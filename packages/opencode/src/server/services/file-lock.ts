import { Storage } from "../../storage/storage"
import { Bus } from "../../bus"
import { Log } from "../../util/log"
import { FileLock } from "../../types/file-lock"
import { fn } from "../../util/fn"
import { Identifier } from "../../id/id"
import { z } from "zod"
import path from "path"

export namespace FileLockService {
  const log = Log.create({ service: "file-lock" })

  // 기본 설정
  const config: FileLock.ManagerConfig = {
    defaultLockTimeout: 300000,  // 5분
    maxLockDuration: 3600000,    // 1시간
    deadlockCheckInterval: 5000,  // 5초
    autoExpireEnabled: true,
    queueEnabled: true,
    maxWaitTime: 30000,          // 30초
    historyRetentionPeriod: 86400000,  // 24시간
  }

  // 잠금 요청
  export const acquire = fn(
    FileLock.Request,
    async (input) => {
      // 기존 잠금 확인
      const existingLock = await getActiveLock(input.filePath)
      if (existingLock) {
        // 잠금 충돌 확인
        const conflict = checkConflict(existingLock, input)
        if (conflict) {
          // 큐에 대기
          if (config.queueEnabled) {
            return await queueForLock(input, conflict)
          } else {
            return {
              success: false,
              message: "File is already locked",
              conflictInfo: {
                sessionId: existingLock.sessionId,
                lockType: existingLock.lockType,
                createdAt: existingLock.createdAt,
                reason: existingLock.reason,
              },
            } as FileLock.Response
          }
        }
      }

      // 새 잠금 생성
      const lock: FileLock.Info = {
        id: Identifier.descending("file_lock"),
        filePath: input.filePath,
        sessionId: input.sessionId,
        lockType: input.lockType,
        status: "active",
        createdAt: new Date(),
        expiresAt: input.timeout ? new Date(Date.now() + input.timeout) : undefined,
        reason: input.reason,
      }

      await Storage.write(["file_lock", lock.id], lock)

      // 잠금 이벤트 발행
      Bus.publish("file.locked", {
        lockId: lock.id,
        filePath: input.filePath,
        sessionId: input.sessionId,
        lockType: input.lockType,
      })

      log.info("File lock acquired", {
        lockId: lock.id,
        filePath: input.filePath,
        sessionId: input.sessionId,
        lockType: input.lockType,
      })

      return {
        success: true,
        lockId: lock.id,
      }
    }
  )

  // 잠금 해제
  export const release = fn(
    z.object({
      lockId: z.string(),
      sessionId: z.string(),
    }),
    async (input) => {
      const lock = await getLock(input.lockId)
      if (!lock) {
        return {
          success: false,
          message: "Lock not found",
        }
      }

      if (lock.sessionId !== input.sessionId) {
        return {
          success: false,
          message: "Not authorized to release this lock",
        }
      }

      const updatedLock = await Storage.update(
        ["file_lock", input.lockId],
        (draft) => {
          draft.status = "released"
          draft.releasedAt = new Date()
        }
      )

      // 큐에서 다음 요청 처리
      await processQueue(lock.filePath)

      // 잠금 해제 이벤트 발행
      Bus.publish("file.unlocked", {
        lockId: input.lockId,
        filePath: lock.filePath,
        sessionId: input.sessionId,
      })

      log.info("File lock released", {
        lockId: input.lockId,
        filePath: lock.filePath,
        sessionId: input.sessionId,
      })

      return {
        success: true,
        lockId: input.lockId,
      }
    }
  )

  // 강제 잠금 해제
  export const forceRelease = fn(
    z.object({
      filePath: z.string(),
      reason: z.string(),
    }),
    async (input) => {
      const lock = await getActiveLock(input.filePath)
      if (!lock) {
        return {
          success: false,
          message: "No active lock found",
        }
      }

      const updatedLock = await Storage.update(
        ["file_lock", lock.id],
        (draft) => {
          draft.status = "released"
          draft.releasedAt = new Date()
        }
      )

      // 큐 처리
      await processQueue(input.filePath)

      // 강제 해제 이벤트 발행
      Bus.publish("file.lock.force_released", {
        lockId: lock.id,
        filePath: input.filePath,
        reason: input.reason,
      })

      log.warn("File lock force released", {
        lockId: lock.id,
        filePath: input.filePath,
        sessionId: lock.sessionId,
        reason: input.reason,
      })

      return {
        success: true,
        lockId: lock.id,
        message: "Lock force released",
      }
    }
  )

  // 잠금 상태 확인
  export const check = fn(
    z.string(),
    async (filePath) => {
      const lock = await getActiveLock(filePath)
      if (!lock) {
        return {
          locked: false,
          filePath,
        }
      }

      // 만료된 잠금 확인
      if (lock.expiresAt && lock.expiresAt < new Date()) {
        await expireLock(lock.id)
        return {
          locked: false,
          filePath,
        }
      }

      return {
        locked: true,
        filePath,
        lock: {
          id: lock.id,
          sessionId: lock.sessionId,
          lockType: lock.lockType,
          createdAt: lock.createdAt,
          expiresAt: lock.expiresAt,
          reason: lock.reason,
        },
      }
    }
  )

  // 잠금 목록 조회
  export const list = fn(
    z.object({
      sessionId: z.string().optional(),
      filePath: z.string().optional(),
      status: z.enum(["active", "released", "expired"]).optional(),
    }),
    async (input) => {
      const locks: FileLock.Info[] = []

      for await (const item of await Storage.list(["file_lock"])) {
        const lock = await Storage.read<FileLock.Info>(item)
        if (!lock) continue

        if (input.sessionId && lock.sessionId !== input.sessionId) continue
        if (input.filePath && lock.filePath !== input.filePath) continue
        if (input.status && lock.status !== input.status) continue

        locks.push(lock)
      }

      return locks.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    }
  )

  // 파일 잠금 통계 조회
  export const getStatistics = fn(
    z.object({
      sessionId: z.string().optional(),
    }),
    async (input) => {
      const stats: FileLock.Statistics = {
        totalLocks: 0,
        activeLocks: 0,
        expiredLocks: 0,
        conflictsCount: 0,
        lockTypeStats: {},
        sessionStats: {},
        lastUpdated: new Date(),
      }

      for await (const item of await Storage.list(["file_lock"])) {
        const lock = await Storage.read<FileLock.Info>(item)
        if (!lock) continue

        if (input.sessionId && lock.sessionId !== input.sessionId) continue

        stats.totalLocks++
        stats[lock.status === "expired" ? "expiredLocks" :
              lock.status === "active" ? "activeLocks" :
              "activeLocks"]++

        // 잠금 타입별 통계
        if (!stats.lockTypeStats[lock.lockType]) {
          stats.lockTypeStats[lock.lockType] = { count: 0 }
        }
        stats.lockTypeStats[lock.lockType].count++

        // 세션별 통계
        if (!stats.sessionStats[lock.sessionId]) {
          stats.sessionStats[lock.sessionId] = {
            locksHeld: 0,
            conflictsCount: 0,
          }
        }
        if (lock.status === "active") {
          stats.sessionStats[lock.sessionId].locksHeld++
        }
      }

      return stats
    }
  )

  // 데드락 감지
  export const detectDeadlocks = fn(
    z.object({}),
    async () => {
      const deadlocks: FileLock.DeadlockDetection = {
        timestamp: new Date(),
        deadlocks: [],
        resolutions: [],
      }

      // 활성 잠금 맵 생성
      const lockMap = new Map<string, FileLock.Info>()
      for await (const item of await Storage.list(["file_lock"])) {
        const lock = await Storage.read<FileLock.Info>(item)
        if (lock && lock.status === "active") {
          lockMap.set(lock.sessionId, lock)
        }
      }

      // 대기 큐 확인
      for await (const filePath of await Storage.list(["lock_queue"])) {
        const queue: FileLock.QueueItem[] = []
        for await (const item of await Storage.list(["lock_queue", filePath.at(-1)!])) {
          const queueItem = await Storage.read<FileLock.QueueItem>(item)
          if (queueItem && queueItem.status === "waiting") {
            queue.push(queueItem)
          }
        }

        // 사이클 감지 (간단한 구현)
        if (queue.length > 0 && lockMap.has(filePath.at(-1)!)) {
          // 더 복잡한 데드락 감지 로직 필요
          log.debug("Potential deadlock detected", { filePath })
        }
      }

      if (deadlocks.deadlocks.length > 0) {
        Bus.publish("file.lock.deadlock_detected", deadlocks)
      }

      return deadlocks
    }
  )

  // 잠금 만료 처리
  export const expireLocks = fn(
    z.object({}),
    async () => {
      if (!config.autoExpireEnabled) {
        return { expired: [] }
      }

      const now = new Date()
      const expired: string[] = []

      for await (const item of await Storage.list(["file_lock"])) {
        const lock = await Storage.read<FileLock.Info>(item)
        if (!lock || lock.status !== "active") continue

        if (lock.expiresAt && lock.expiresAt < now) {
          await expireLock(lock.id)
          expired.push(lock.id)

          // 큐 처리
          await processQueue(lock.filePath)
        }
      }

      if (expired.length > 0) {
        log.info("Locks expired", { count: expired.length })
      }

      return { expired }
    }
  )

  // 유틸리티 함수
  async function getActiveLock(filePath: string): Promise<FileLock.Info | null> {
    for await (const item of await Storage.list(["file_lock"])) {
      const lock = await Storage.read<FileLock.Info>(item)
      if (lock && lock.filePath === filePath && lock.status === "active") {
        // 만료된 잠금 확인
        if (lock.expiresAt && lock.expiresAt < new Date()) {
          await expireLock(lock.id)
          continue
        }
        return lock
      }
    }
    return null
  }

  async function getLock(lockId: string): Promise<FileLock.Info | null> {
    return await Storage.read<FileLock.Info>(["file_lock", lockId])
  }

  async function checkConflict(
    existingLock: FileLock.Info,
    request: FileLock.Request
  ): FileLock.Conflict | null {
    // 동일 세션은 충돌 없음
    if (existingLock.sessionId === request.sessionId) {
      return null
    }

    // 잠금 타입별 충돌 확인
    const isWriteConflict =
      existingLock.lockType === "write" ||
      existingLock.lockType === "exclusive" ||
      request.lockType === "write" ||
      request.lockType === "exclusive"

    const isExclusiveConflict =
      existingLock.lockType === "exclusive" ||
      request.lockType === "exclusive"

    if (isWriteConflict || isExclusiveConflict) {
      return {
        filePath: request.filePath,
        requesterId: request.sessionId,
        holderId: existingLock.sessionId,
        requestType: request.lockType,
        holderType: existingLock.lockType,
        conflictType: isExclusiveConflict ? "exclusive_any" : "write_write",
        timestamp: new Date(),
      }
    }

    return null
  }

  async function queueForLock(
    request: FileLock.Request,
    conflict: FileLock.Conflict
  ): Promise<FileLock.Response> {
    const queueItem: FileLock.QueueItem = {
      id: Identifier.descending("lock_queue_item"),
      filePath: request.filePath,
      sessionId: request.sessionId,
      lockType: request.lockType,
      requestedAt: new Date(),
      timeout: request.timeout || config.maxWaitTime,
      reason: request.reason,
    }

    await Storage.write(
      ["lock_queue", request.filePath, queueItem.id],
      queueItem
    )

    // 대기 이벤트 발행
    Bus.publish("file.lock.queue_added", {
      filePath: request.filePath,
      sessionId: request.sessionId,
      lockType: request.lockType,
    })

    return {
      success: false,
      message: "Queued for lock",
      conflictInfo: {
        sessionId: conflict.holderId,
        lockType: conflict.holderType,
        createdAt: new Date(),
      },
    }
  }

  async function processQueue(filePath: string) {
    if (!config.queueEnabled) return

    const queue: FileLock.QueueItem[] = []
    for await (const item of await Storage.list(["lock_queue", filePath])) {
      const queueItem = await Storage.read<FileLock.QueueItem>(item)
      if (queueItem && queueItem.status === "waiting") {
        queue.push(queueItem)
      }
    }

    // 우선순위별 정렬
    queue.sort((a, b) => a.requestedAt.getTime() - b.requestedAt.getTime())

    // 큐의 첫 번째 항목 처리
    if (queue.length > 0) {
      const next = queue[0]
      const success = await acquire({
        filePath,
        sessionId: next.sessionId,
        lockType: next.lockType,
        timeout: next.timeout,
        reason: next.reason,
      })

      if (success.success) {
        // 큐에서 제거
        await Storage.remove(["lock_queue", filePath, next.id])
      }
    }
  }

  async function expireLock(lockId: string) {
    await Storage.update(
      ["file_lock", lockId],
      (draft) => {
        draft.status = "expired"
      }
    )

    // 만료 이벤트 발행
    Bus.publish("file.lock.expired", { lockId })
  }
}