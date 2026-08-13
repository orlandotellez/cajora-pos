import { prisma } from "@/config/prisma"
import type { paypal_webhook_event } from "@prisma/client"
import type {
  IPayPalWebhookEventRepository,
  NewPayPalWebhookEvent,
} from "../domain/paypal-webhook-event.interface"

export const PayPalWebhookEventRepository: IPayPalWebhookEventRepository = {
  async insert(data: NewPayPalWebhookEvent): Promise<paypal_webhook_event> {
    return prisma.paypal_webhook_event.create({ data })
  },

  async markProcessed(id: string, notes?: string): Promise<void> {
    await prisma.paypal_webhook_event.update({
      where: { id },
      data: { processed_at: new Date(), notes },
    })
  },
}
