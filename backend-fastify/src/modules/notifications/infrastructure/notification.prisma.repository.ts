import { prisma } from "@/config/prisma"
import type {
  ICreateNotificationInput,
  INotification,
  INotificationRepository,
} from "../domain/notification.types"

function mapToEntity(row: {
  id: string
  user_id: string
  store_id: string | null
  type: string
  title: string
  message: string
  read: boolean
  metadata: unknown
  created_at: Date
}): INotification {
  return {
    id: row.id,
    user_id: row.user_id,
    store_id: row.store_id,
    type: row.type as INotification["type"],
    title: row.title,
    message: row.message,
    read: row.read,
    metadata: (row.metadata as Record<string, unknown>) ?? null,
    created_at: row.created_at,
  }
}

export const NotificationRepository: INotificationRepository = {
  async create(data) {
    const row = await prisma.notification.create({
      data: {
        user_id: data.user_id,
        store_id: data.store_id ?? null,
        type: data.type,
        title: data.title,
        message: data.message,
        metadata: data.metadata ?? undefined,
      },
    })
    return mapToEntity(row)
  },

  async findByUserId(userId, options = {}) {
    const rows = await prisma.notification.findMany({
      where: {
        user_id: userId,
        ...(options.unreadOnly ? { read: false } : {}),
      },
      orderBy: { created_at: "desc" },
      take: options.limit ?? 50,
    })
    return rows.map(mapToEntity)
  },

  async countUnread(userId) {
    return prisma.notification.count({
      where: { user_id: userId, read: false },
    })
  },

  async markAsRead(id, userId) {
    try {
      await prisma.notification.update({
        where: { id, user_id: userId },
        data: { read: true },
      })
      return true
    } catch {
      return false
    }
  },

  async markAllAsRead(userId) {
    const result = await prisma.notification.updateMany({
      where: { user_id: userId, read: false },
      data: { read: true },
    })
    return result.count
  },
}
