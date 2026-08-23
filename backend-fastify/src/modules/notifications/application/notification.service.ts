import type {
  ICreateNotificationInput,
  INotification,
  INotificationRepository,
} from "../domain/notification.types"

export function createNotificationService(
  repository: INotificationRepository,
) {
  return {
    async create(data: ICreateNotificationInput): Promise<INotification> {
      return repository.create(data)
    },

    async getByUser(
      userId: string,
      options?: { unreadOnly?: boolean; limit?: number },
    ): Promise<INotification[]> {
      return repository.findByUserId(userId, options)
    },

    async getUnreadCount(userId: string): Promise<number> {
      return repository.countUnread(userId)
    },

    async markRead(id: string, userId: string): Promise<boolean> {
      return repository.markAsRead(id, userId)
    },

    async markAllRead(userId: string): Promise<number> {
      return repository.markAllAsRead(userId)
    },
  }
}

export type NotificationService = ReturnType<typeof createNotificationService>
