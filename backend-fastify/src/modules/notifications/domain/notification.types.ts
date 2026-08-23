export type NotificationType =
  | "payment_failed"
  | "subscription_expiring"
  | "subscription_expired"
  | "subscription_canceled"

export interface INotification {
  id: string
  user_id: string
  store_id: string | null
  type: NotificationType
  title: string
  message: string
  read: boolean
  metadata: Record<string, unknown> | null
  created_at: Date
}

export interface ICreateNotificationInput {
  user_id: string
  store_id?: string | null
  type: NotificationType
  title: string
  message: string
  metadata?: Record<string, unknown> | null
}

export interface INotificationRepository {
  create(data: ICreateNotificationInput): Promise<INotification>
  findByUserId(userId: string, options?: { unreadOnly?: boolean; limit?: number }): Promise<INotification[]>
  countUnread(userId: string): Promise<number>
  markAsRead(id: string, userId: string): Promise<boolean>
  markAllAsRead(userId: string): Promise<number>
}
