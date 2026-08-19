import { randomBytes } from "node:crypto"
import { redis } from "@/config/redis"

export interface ISsoCodeStore {
  set(code: string, userId: string, ttlSeconds?: number): Promise<void>
  consume(code: string): Promise<string | null>
}

const PREFIX = "sso:code:"
export const SSO_CODE_TTL_SECONDS = 120

export const redisSsoCodeStore: ISsoCodeStore = {
  async set(code, userId, ttlSeconds = SSO_CODE_TTL_SECONDS) {
    if (!redis) throw new Error("Redis no disponible para emitir código SSO")
    await redis.set(`${PREFIX}${code}`, userId, "EX", ttlSeconds)
  },

  async consume(code) {
    if (!redis) return null
    const userId = await redis.getdel(`${PREFIX}${code}`)
    return userId ?? null
  },
}

export function generateSsoCode(): string {
  return randomBytes(32).toString("base64url")
}
