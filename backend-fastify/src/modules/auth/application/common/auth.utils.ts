import type { FastifyReply, FastifyRequest } from "fastify"
import type { Role } from "@/types/auth"
import { clearAuthCookies } from "./cookie.utils"
import { env } from "@/config/env"
import jwt, { type JwtPayload } from "jsonwebtoken"

interface AuthResult {
  userId: string | null
  role: Role | null
  storeId: string | null
  storeName: string | null
}

export const getUserIdFromCookies = (request: FastifyRequest): AuthResult => {
  const token = request.cookies.accessToken || request.cookies.refreshToken
  if (!token) return { userId: null, role: null, storeId: null, storeName: null }

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as JwtPayload & { userId?: string; role?: Role; storeId?: string; storeName?: string }
    return {
      userId: decoded.userId ?? null,
      role: decoded.role ?? null,
      storeId: decoded.storeId ?? null,
      storeName: decoded.storeName ?? null,
    }
  } catch {
    try {
      const decoded = jwt.verify(token, env.JWT_REFRESH_SECRET) as JwtPayload & { userId?: string }
      return { userId: decoded.userId ?? null, role: null, storeId: null, storeName: null }
    } catch {
      return { userId: null, role: null, storeId: null, storeName: null }
    }
  }
}

export const getUserIdFromBearerToken = (
  request: FastifyRequest
): AuthResult => {
  const authHeader = request.headers.authorization
  if (!authHeader) return { userId: null, role: null, storeId: null, storeName: null }

  const parts = authHeader.split(" ")
  if (parts.length !== 2 || parts[0] !== "Bearer") return { userId: null, role: null, storeId: null, storeName: null }

  const token = parts[1]

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as JwtPayload & { userId?: string; role?: Role; storeId?: string; storeName?: string }
    return {
      userId: decoded.userId ?? null,
      role: decoded.role ?? null,
      storeId: decoded.storeId ?? null,
      storeName: decoded.storeName ?? null,
    }
  } catch {
    return { userId: null, role: null, storeId: null, storeName: null }
  }
}

export const resolveCurrentUserId = async (
  request: FastifyRequest,
  reply: FastifyReply
): Promise<string | null> => {
  try {
    if (request.userId) return request.userId

    const fromCookies = getUserIdFromCookies(request)
    if (fromCookies.userId) return fromCookies.userId

    const fromBearer = getUserIdFromBearerToken(request)
    return fromBearer.userId
  } catch {
    await clearAuthCookies(reply)
    return null
  }
}
