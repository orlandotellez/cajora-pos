import type { FastifyReply, FastifyRequest } from "fastify"
import { NotificationRepository } from "../infrastructure/notification.prisma.repository"
import { createNotificationService } from "../application/notification.service"

const notificationService = createNotificationService(NotificationRepository)

function requireUserId(request: FastifyRequest): string {
  const user = (request as any).user as { id: string } | undefined
  if (!user?.id) {
    throw new Error("Unauthorized")
  }
  return user.id
}

export const notificationController = {
  list: async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = requireUserId(request)
    const q = request.query as Record<string, string | undefined>
    const unreadOnly = q.unread === "true"
    const limit = Math.min(Math.max(Number(q.limit ?? 50) || 50, 1), 100)

    const notifications = await notificationService.getByUser(userId, {
      unreadOnly,
      limit,
    })
    return reply.status(200).send({ notifications })
  },

  unreadCount: async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = requireUserId(request)
    const count = await notificationService.getUnreadCount(userId)
    return reply.status(200).send({ count })
  },

  markRead: async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = requireUserId(request)
    const { id } = request.params as { id: string }
    const ok = await notificationService.markRead(id, userId)
    return reply.status(ok ? 200 : 404).send({ ok })
  },

  markAllRead: async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = requireUserId(request)
    const count = await notificationService.markAllRead(userId)
    return reply.status(200).send({ count })
  },
}
