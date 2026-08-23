import { api } from "./client";

export type NotificationType =
  | "payment_failed"
  | "subscription_expiring"
  | "subscription_expired"
  | "subscription_canceled";

export interface Notification {
  id: string;
  user_id: string;
  store_id: string | null;
  type: NotificationType;
  title: string;
  message: string;
  read: boolean;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export const notificationsApi = {
  list: (options?: { unread?: boolean; limit?: number }) => {
    const params = new URLSearchParams();
    if (options?.unread) params.set("unread", "true");
    if (options?.limit) params.set("limit", String(options.limit));
    const qs = params.toString();
    return api.get<{ notifications: Notification[] }>(`/notifications${qs ? `?${qs}` : ""}`);
  },

  unreadCount: () => api.get<{ count: number }>("/notifications/unread-count"),

  markRead: (id: string) => api.patch<{ ok: boolean }>(`/notifications/${id}/read`),

  markAllRead: () => api.patch<{ count: number }>("/notifications/read-all"),
};
