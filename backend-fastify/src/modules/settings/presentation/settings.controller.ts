import type { FastifyReply, FastifyRequest } from "fastify"
import { createSettingsService } from "../application/settings.service"
import { SettingsRepository } from "../infrastructure/settings.prisma.repository"
import type { UpdateSettingsData } from "../domain/settings.entities"
import { UpdateSettingsDtoSchema } from "./settings.dto"

const settingsService = createSettingsService(SettingsRepository)

export const settingsController = {
  get: async (request: FastifyRequest, reply: FastifyReply) => {
    const storeId = request.storeId
    if (!storeId) {
      return reply.status(200).send({
        name: "",
        low_stock_threshold: 5,
        updated_at: new Date().toISOString(),
      })
    }
    const result = await settingsService.get(storeId)
    return reply.status(200).send(result)
  },

  update: async (request: FastifyRequest, reply: FastifyReply) => {
    const data = UpdateSettingsDtoSchema.parse(request.body)
    const storeId = request.storeId
    if (!storeId) {
      return reply.status(400).send({ message: "Store context required" })
    }
    const result = await settingsService.update(data as UpdateSettingsData, storeId)
    return reply.status(200).send(result)
  },
}
