import { env } from "@/config/env"
import type { ROLE } from "@prisma/client"
import type { FastifyRequest } from "fastify"
import type { SignOptions } from "jsonwebtoken"
import jwt from "jsonwebtoken"

interface TokenPayload {
  userId: string
  email: string
  role: ROLE
  storeId: string | null
  storeName: string | null
}

export const generateTokens = (userId: string, email: string, role: ROLE, storeId: string | null, storeName: string | null) => {
  const accessTokenOptions: SignOptions = {
    expiresIn: 900
  }

  const refreshTokenOptions: SignOptions = {
    expiresIn: 604000
  }

  const accessToken = jwt.sign(
    { userId, email, role, storeId, storeName } as TokenPayload,
    env.JWT_SECRET,
    accessTokenOptions
  )

  const refreshToken = jwt.sign(
    { userId },
    env.JWT_REFRESH_SECRET,
    refreshTokenOptions
  )

  return { accessToken, refreshToken }
}

export const verifyToken = (token: string, secret: string) => {
  return jwt.verify(token, secret)
}

export function getRefreshToken(request: FastifyRequest): string {
  const cookieToken = request.cookies.refreshToken
  const body = request.body as Record<string, unknown> | undefined
  const bodyToken = typeof body?.refreshToken === "string" ? body.refreshToken : undefined
  return cookieToken || bodyToken || ""
}
