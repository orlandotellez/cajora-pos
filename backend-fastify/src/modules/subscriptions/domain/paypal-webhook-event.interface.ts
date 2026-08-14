import type { Prisma } from "@prisma/client"
import type { paypal_webhook_event } from "@prisma/client"

export interface NewPayPalWebhookEvent {
  event_id: string
  event_type: string
  resource_type: string | null
  resource_id: string | null
  payload: Prisma.InputJsonValue
}

export interface IPayPalWebhookEventRepository {
  insert(data: NewPayPalWebhookEvent): Promise<paypal_webhook_event>
  markProcessed(id: string, notes?: string): Promise<void>
  findByEventIds(ids: string[]): Promise<Array<{ event_id: string; payload: Prisma.JsonValue }>>
}
