import Redis from "ioredis"
import { env } from "./env"

let redisClient: Redis | null = null

export const getRedisClient = () => {
  if (redisClient) return redisClient

  try {
    redisClient = new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: 3,
      lazyConnect: true,
      connectionName: "pos-system",
      retryStrategy: (times) => {
        if (times > 5) {
          console.error("Redis max retries reached")
          return null
        }
        return Math.min(times * 200, 2000)
      },
    })

    redisClient.connect().then(() => {
      console.log("Redis connected successfully")
    }).catch((error) => {
      console.error("Redis connection failed:", error)
    })

    let hasLoggedRedisError = false

    redisClient.on("ready", () => {
      hasLoggedRedisError = false
      console.log("Redis ready")
    })

    redisClient.on("error", (error) => {
      if (!hasLoggedRedisError) {
        console.error("Redis connection error:", error)
        hasLoggedRedisError = true
      }
    })

    redisClient.on("reconnecting", () => {
      console.warn("Redis reconnecting...")
    })

    redisClient.on("close", () => {
      console.warn("Redis connection closed")
    })

    return redisClient
  } catch (error) {
    console.error("Redis unavailable, continuing without cache")
    return null
  }
}

export const closeRedis = async () => {
  if (!redisClient) return
  try {
    await redisClient.quit()
  } catch {
    // Si quit() falla (p. ej. Redis en estado raro), forzar el cierre del
    // socket para que el shutdown no se cuelgue.
    redisClient.disconnect()
  }
  redisClient = null
  console.log("Redis disconnected")
}

export const redis = getRedisClient()
