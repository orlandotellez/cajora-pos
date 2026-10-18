import type { Prisma } from "@/generated/prisma/client"
import type { whop_webhook_event } from "@/generated/prisma/client"

export interface NewWhopWebhookEvent {
  event_id: string
  event_type: string
  resource_id: string | null
  payload: Prisma.InputJsonValue
}

export interface IWhopWebhookEventRepository {
  insert(data: NewWhopWebhookEvent): Promise<whop_webhook_event>
  findByEventId(eventId: string): Promise<whop_webhook_event | null>
  markProcessed(id: string, notes?: string): Promise<void>
}
