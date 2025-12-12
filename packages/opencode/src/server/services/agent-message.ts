import { Storage } from "../../storage/storage"
import { Bus } from "../../bus"
import { Log } from "../../util/log"
import { AgentMessage } from "../../types/agent-message"
import { fn } from "../../util/fn"
import { Identifier } from "../../id/id"
import { z } from "zod"

export namespace AgentMessageService {
  const log = Log.create({ service: "agent-message" })

  // 메시지 전송
  export const send = fn(
    AgentMessage.CreateInput,
    async (input) => {
      const message: AgentMessage.Info = {
        id: Identifier.descending("agent_message"),
        ...input,
        status: "pending",
        timestamp: new Date(),
      }

      // 메시지 저장
      await Storage.write(["agent_message", message.id], message)

      // 수신자 세션에 메시지 큐 추가
      await queueMessage(input.to, message)

      // 메시지 발행 이벤트
      Bus.publish("agent.message_sent", {
        messageId: message.id,
        from: input.from,
        to: input.to,
        channel: input.channel,
      })

      // 메시지를 즉시 전달 시도
      await deliverMessage(message)

      log.info("Agent message sent", {
        messageId: message.id,
        from: input.from,
        to: input.to,
        channel: input.channel,
      })

      return message
    }
  )

  // 브로드캐스트 메시지 전송
  export const broadcast = fn(
    AgentMessage.BroadcastInput,
    async (input) => {
      const messages: AgentMessage.Info[] = []

      // 대상 세션 목록 결정
      let targetSessions: string[] = []

      if (input.workspaceId) {
        // 워크스페이스의 모든 세션
        const { ProjectWorkspaceService } = await import("./project-workspace")
        const workspace = await ProjectWorkspaceService.get(input.workspaceId)
        targetSessions = workspace.sessions
      } else {
        // 모든 활성 세션
        const { EnhancedSessionService } = await import("./enhanced-session")
        const sessions = await EnhancedSessionService.listByProject({})
        targetSessions = sessions.map(s => s.id).filter(id => id !== input.from)
      }

      // 제외할 세션 필터링
      if (input.excludeSessions) {
        targetSessions = targetSessions.filter(
          id => !input.excludeSessions!.includes(id)
        )
      }

      // 각 세션에 메시지 전송
      for (const sessionId of targetSessions) {
        const message: AgentMessage.Info = {
          id: Identifier.descending("agent_message"),
          from: input.from,
          to: sessionId,
          type: "broadcast",
          channel: input.channel,
          payload: input.payload,
          priority: input.priority,
          status: "pending",
          timestamp: new Date(),
        }

        await Storage.write(["agent_message", message.id], message)
        await queueMessage(sessionId, message)
        await deliverMessage(message)
        messages.push(message)
      }

      // 브로드캐스트 이벤트 발행
      Bus.publish("agent.broadcast", {
        from: input.from,
        channel: input.channel,
        targetCount: targetSessions.length,
      })

      log.info("Agent message broadcast", {
        from: input.from,
        channel: input.channel,
        targetCount: targetSessions.length,
      })

      return messages
    }
  )

  // 메시지 수신 확인
  export const acknowledge = fn(
    z.object({
      messageId: z.string(),
      sessionId: z.string(),
      status: z.enum(["delivered", "read", "processed"]),
    }),
    async (input) => {
      const message = await getMessage(input.messageId)

      if (message.to !== input.sessionId) {
        throw new Error("Not authorized to acknowledge this message")
      }

      const updatedMessage = await Storage.update(
        ["agent_message", input.messageId],
        (draft) => {
          draft.status = input.status
        }
      )

      // 수신 확인 이벤트 발행
      Bus.publish("agent.message_acknowledged", {
        messageId: input.messageId,
        sessionId: input.sessionId,
        status: input.status,
      })

      log.info("Message acknowledged", {
        messageId: input.messageId,
        sessionId: input.sessionId,
        status: input.status,
      })

      return updatedMessage
    }
  )

  // 메시지 목록 조회
  export const list = fn(
    z.object({
      filter: AgentMessage.Filter.optional(),
    }),
    async (input) => {
      const messages: AgentMessage.Info[] = []

      for await (const item of await Storage.list(["agent_message"])) {
        const message = await Storage.read<AgentMessage.Info>(item)
        if (!message) continue

        if (input.filter) {
          if (input.filter.from && message.from !== input.filter.from) continue
          if (input.filter.to && message.to !== input.filter.to) continue
          if (input.filter.type && message.type !== input.filter.type) continue
          if (input.filter.channel && message.channel !== input.filter.channel) continue
          if (input.filter.status && message.status !== input.filter.status) continue
          if (input.filter.since && message.timestamp < input.filter.since) continue
          if (input.filter.until && message.timestamp > input.filter.until) continue
        }

        messages.push(message)
      }

      // 정렬 (최신 순)
      messages.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())

      // 제한
      if (input.filter?.limit) {
        messages.splice(input.filter.limit)
      }

      return messages
    }
  )

  // 세션별 메시지 목록 조회
  export const listForSession = fn(
    z.object({
      sessionId: z.string(),
      type: z.enum(["sent", "received", "both"]).default("both"),
      limit: z.number().optional(),
    }),
    async (input) => {
      const messages: AgentMessage.Info[] = []

      for await (const item of await Storage.list(["agent_message"])) {
        const message = await Storage.read<AgentMessage.Info>(item)
        if (!message) continue

        const isSent = message.from === input.sessionId
        const isReceived = message.to === input.sessionId

        if (input.type === "sent" && !isSent) continue
        if (input.type === "received" && !isReceived) continue
        if (input.type === "both" && !isSent && !isReceived) continue

        messages.push(message)
      }

      // 정렬 (최신 순)
      messages.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())

      // 제한
      if (input.limit) {
        messages.splice(input.limit)
      }

      return messages
    }
  )

  // 세션의 메시지 큐 조회
  export const getQueue = fn(
    z.string(),
    async (sessionId) => {
      const queuedMessages: AgentMessage.Info[] = []

      for await (const item of await Storage.list(["message_queue", sessionId])) {
        const messageId = item.at(-1)
        if (!messageId) continue

        const message = await Storage.read<AgentMessage.Info>(["agent_message", messageId])
        if (message && message.status === "pending") {
          queuedMessages.push(message)
        }
      }

      // 우선순위별 정렬
      const priorityOrder = { urgent: 0, high: 1, normal: 2, low: 3 }
      queuedMessages.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority])

      return queuedMessages
    }
  )

  // 메시지 통계 조회
  export const getStatistics = fn(
    z.object({
      sessionId: z.string().optional(),
      since: z.date().optional(),
    }),
    async (input) => {
      const stats: AgentMessage.Statistics = {
        totalMessages: 0,
        pendingMessages: 0,
        deliveredMessages: 0,
        processedMessages: 0,
        expiredMessages: 0,
        channelStats: {},
      }

      const cutoffTime = input.since || new Date(0)

      for await (const item of await Storage.list(["agent_message"])) {
        const message = await Storage.read<AgentMessage.Info>(item)
        if (!message) continue

        if (message.timestamp < cutoffTime) continue
        if (input.sessionId && message.from !== input.sessionId && message.to !== input.sessionId) continue

        stats.totalMessages++
        stats[message.status === "expired" ? "expiredMessages" :
               message.status === "pending" ? "pendingMessages" :
               message.status === "delivered" ? "deliveredMessages" :
               message.status === "read" ? "deliveredMessages" :
               "processedMessages"]++

        // 채널별 통계
        if (!stats.channelStats[message.channel]) {
          stats.channelStats[message.channel] = {
            count: 0,
            avgResponseTime: undefined,
          }
        }
        stats.channelStats[message.channel].count++
      }

      // 평균 응답 시간 계산
      stats.averageResponseTime = await calculateAverageResponseTime(input.sessionId)

      return stats
    }
  )

  // 만료된 메시지 정리
  export const cleanup = fn(
    z.object({
      maxAge: z.number().default(86400000),  // 24시간
    }),
    async (input) => {
      const cutoffTime = new Date()
      cutoffTime.setTime(cutoffTime.getTime() - input.maxAge)

      const cleaned: string[] = []

      for await (const item of await Storage.list(["agent_message"])) {
        const message = await Storage.read<AgentMessage.Info>(item)
        if (!message) continue

        // 만료된 메시지 확인
        if (message.timestamp < cutoffTime ||
            (message.expiresAt && message.expiresAt < new Date())) {

          await Storage.update(
            ["agent_message", message.id],
            (draft) => {
              draft.status = "expired"
            }
          )

          // 큐에서 제거
          await Storage.remove(["message_queue", message.to, message.id])

          cleaned.push(message.id)
        }
      }

      log.info("Message cleanup completed", {
        cleanedCount: cleaned.length,
        messages: cleaned,
      })

      return { cleaned, count: cleaned.length }
    }
  )

  // 유틸리티 함수
  async function getMessage(messageId: string): Promise<AgentMessage.Info> {
    const message = await Storage.read<AgentMessage.Info>(["agent_message", messageId])
    if (!message) {
      throw new Error(`Message not found: ${messageId}`)
    }
    return message
  }

  async function queueMessage(sessionId: string, message: AgentMessage.Info) {
    await Storage.write(["message_queue", sessionId, message.id], {
      queuedAt: new Date(),
      priority: message.priority,
    })
  }

  async function deliverMessage(message: AgentMessage.Info) {
    try {
      // 메시지 전달 시도
      // 실제로는 세션의 메시지 핸들러를 호출해야 함
      await Storage.update(
        ["agent_message", message.id],
        (draft) => {
          draft.status = "delivered"
        }
      )

      // 전달 이벤트 발행
      Bus.publish("agent.message_delivered", {
        messageId: message.id,
        to: message.to,
      })
    } catch (error) {
      log.error("Failed to deliver message", {
        messageId: message.id,
        error,
      })
    }
  }

  async function calculateAverageResponseTime(sessionId?: string): Promise<number | undefined> {
    let totalResponseTime = 0
    let responseCount = 0

    for await (const item of await Storage.list(["agent_message"])) {
      const message = await Storage.read<AgentMessage.Info>(item)
      if (!message) continue

      if (sessionId && message.from !== sessionId) continue
      if (!message.replyTo) continue

      // 응답 메시지 찾기
      const originalMessage = await Storage.read<AgentMessage.Info>(
        ["agent_message", message.replyTo]
      )
      if (!originalMessage) continue

      const responseTime = message.timestamp.getTime() - originalMessage.timestamp.getTime()
      totalResponseTime += responseTime
      responseCount++
    }

    return responseCount > 0 ? totalResponseTime / responseCount : undefined
  }
}