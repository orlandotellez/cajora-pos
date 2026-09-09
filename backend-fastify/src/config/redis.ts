import Redis from "ioredis"
import { env } from "./env"
import { logger } from "./logger"

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
          logger.error("Redis max retries reached")
          return null
        }
        return Math.min(times * 200, 2000)
      },
    })

    redisClient.connect().then(() => {
      logger.info("Redis connected successfully")
    }).catch((error) => {
      logger.error({ err: error }, "Redis connection failed")
    })

    let hasLoggedRedisError = false

    redisClient.on("ready", () => {
      hasLoggedRedisError = false
      logger.info("Redis ready")
    })

    redisClient.on("error", (error) => {
      if (!hasLoggedRedisError) {
        logger.error({ err: error }, "Redis connection error")
        hasLoggedRedisError = true
      }
    })

    redisClient.on("reconnecting", () => {
      logger.warn("Redis reconnecting...")
    })

    redisClient.on("close", () => {
      logger.warn("Redis connection closed")
    })

    return redisClient
  } catch (error) {
    logger.error({ err: error }, "Redis unavailable, continuing without cache")
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
  logger.info("Redis disconnected")
}

export const redis = getRedisClient()
