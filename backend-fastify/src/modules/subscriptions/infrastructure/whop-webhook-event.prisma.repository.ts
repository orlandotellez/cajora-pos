import { prisma } from "@/config/prisma"
import type { whop_webhook_event } from "@/generated/prisma/client"
import type {
  IWhopWebhookEventRepository,
  NewWhopWebhookEvent,
} from "../domain/whop-webhook-event.interface"

export const WhopWebhookEventRepository: IWhopWebhookEventRepository = {
  async insert(data: NewWhopWebhookEvent): Promise<whop_webhook_event> {
    return prisma.whop_webhook_event.create({ data })
  },

  async markProcessed(id: string, notes?: string): Promise<void> {
    await prisma.whop_webhook_event.update({
      where: { id },
      data: { processed_at: new Date(), notes },
    })
  },
}
