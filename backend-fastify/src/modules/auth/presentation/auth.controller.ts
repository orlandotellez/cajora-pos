import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify"
import { createAuthService } from "../application/auth.service"
import { AuthRepository } from "../infrastructure/auth.prisma.repository"
import {
  LoginPayloadDtoSchema,
  RegisterPayloadDtoSchema,
  RegisterStoreDtoSchema,
  VerifyEmailDtoSchema,
  ForgotPasswordDtoSchema,
  ResetPasswordDtoSchema,
  ResendVerificationDtoSchema,
  RevokeSessionDtoSchema,
  SsoExchangeDtoSchema
} from "./auth.dto"
import { env } from "@/config/env"
import { clearAuthCookies, setAuthCookies } from "@/core/utils/cookie.utils"
import { ConflictError, UnauthorizedError } from "@/core/errors/AppError"
import { resolveCurrentUserId } from "@/core/utils/auth.utils"
import { redisSsoCodeStore } from "../infrastructure/sso-code.store"

const authService = createAuthService(AuthRepository, redisSsoCodeStore)

function getRefreshToken(request: FastifyRequest): string {
  const cookieToken = request.cookies.refreshToken
  const body = request.body as Record<string, unknown> | undefined
  const bodyToken = typeof body?.refreshToken === "string" ? body.refreshToken : undefined
  return cookieToken || bodyToken || ""
}

export const authController = {
  register: async (request: FastifyRequest, reply: FastifyReply) => {
    const data = RegisterPayloadDtoSchema.parse(request.body)

    // Admin registers a user in their own store
    const storeId = request.storeId
    if (!storeId) {
      throw new UnauthorizedError("Store context required")
    }

    const result = await authService.register(data, storeId)

    // When register is called by an admin (authenticated via authGuard),
    // we must NOT overwrite the admin's cookies with the new user's tokens.
    if (!request.userId) {
      setAuthCookies(
        reply,
        result.accessToken,
        result.refreshToken,
        env.NODE_ENV === "production"
      )
    }

    return reply.status(201).send({
      message: result.message,
      user: result.user,
      store: result.store,
      accessToken: result.accessToken,
      refreshToken: result.refreshToken
    })
  },

  registerStore: async (request: FastifyRequest, reply: FastifyReply) => {
    const data = RegisterStoreDtoSchema.parse(request.body)

    const result = await authService.registerStore(data)

    setAuthCookies(reply, result.accessToken, result.refreshToken, env.NODE_ENV === "production")

    return reply.status(201).send({
      message: result.message,
      user: result.user,
      store: result.store,
      accessToken: result.accessToken,
      refreshToken: result.refreshToken
    })
  },

  login: async (request: FastifyRequest, reply: FastifyReply) => {
    const data = LoginPayloadDtoSchema.parse(request.body)

    const currentUserId = await resolveCurrentUserId(request, reply)

    const result = await authService.login(data)

    if (currentUserId && currentUserId === result.user.id) {
      setAuthCookies(reply, result.accessToken, result.refreshToken, env.NODE_ENV === "production")
      return reply.status(200).send({
        message: result.message,
        user: result.user,
        store: result.store,
        accessToken: result.accessToken,
        refreshToken: result.refreshToken
      })
    }

    if (currentUserId && currentUserId !== result.user.id) {
      await clearAuthCookies(reply)
    }

    setAuthCookies(reply, result.accessToken, result.refreshToken, env.NODE_ENV === "production")

    return reply.status(200).send({
      message: result.message,
      user: result.user,
      store: result.store,
      accessToken: result.accessToken,
      refreshToken: result.refreshToken
    })
  },

  ssoChallenge: async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = request.userId

    if (!userId) {
      throw new UnauthorizedError("Authentication required")
    }

    const result = await authService.ssoChallenge(userId)

    return reply.status(200).send(result)
  },

  ssoExchange: async (request: FastifyRequest, reply: FastifyReply) => {
    const { code } = SsoExchangeDtoSchema.parse(request.body)

    const result = await authService.ssoExchange(code)

    setAuthCookies(reply, result.accessToken, result.refreshToken, env.NODE_ENV === "production")

    return reply.status(200).send({
      message: result.message,
      user: result.user,
      store: result.store,
      accessToken: result.accessToken,
      refreshToken: result.refreshToken
    })
  },

  logout: async (request: FastifyRequest, reply: FastifyReply) => {
    const refreshToken = getRefreshToken(request)

    if (!refreshToken) {
      throw new UnauthorizedError("Refresh token required")
    }

    const result = await authService.logout(refreshToken)

    clearAuthCookies(reply)

    return reply.status(200).send(result)
  },

  refresh: async (request: FastifyRequest, reply: FastifyReply) => {
    const refreshToken = getRefreshToken(request)

    if (!refreshToken) {
      throw new UnauthorizedError("Refresh token required")
    }

    const result = await authService.refresh(refreshToken)

    setAuthCookies(reply, result.accessToken, result.refreshToken, env.NODE_ENV === "production")

    return reply.status(200).send({
      message: result.message,
      user: result.user,
      store: result.store,
      accessToken: result.accessToken,
      refreshToken: result.refreshToken
    })
  },

  verifyEmail: async (request: FastifyRequest, reply: FastifyReply) => {
    const data = VerifyEmailDtoSchema.parse(request.body)

    const result = await authService.verifyEmail(data)

    setAuthCookies(reply, result.accessToken, result.refreshToken, env.NODE_ENV === "production")

    return reply.status(200).send({
      message: result.message,
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
    })
  },

  resendVerification: async (request: FastifyRequest, reply: FastifyReply) => {
    const data = ResendVerificationDtoSchema.parse(request.body)

    const result = await authService.resendVerification(data.email)

    return reply.status(200).send({ message: result.message })
  },

  forgotPassword: async (request: FastifyRequest, reply: FastifyReply) => {
    const currentUserId = await resolveCurrentUserId(request, reply)
    if (currentUserId) {
      throw new ConflictError("Please logout before requesting password reset")
    }

    const data = ForgotPasswordDtoSchema.parse(request.body)

    const result = await authService.forgotPassword(data)

    return reply.status(200).send(result)
  },

  resetPassword: async (request: FastifyRequest, reply: FastifyReply) => {
    const currentUserId = await resolveCurrentUserId(request, reply)
    if (currentUserId) {
      throw new ConflictError("Please logout before resetting password")
    }

    const data = ResetPasswordDtoSchema.parse(request.body)

    const result = await authService.resetPassword(data)

    clearAuthCookies(reply)

    return reply.status(200).send(result)
  },

  getUserSessions: async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = await resolveCurrentUserId(request, reply)

    if (!userId) {
      throw new UnauthorizedError("Authentication required")
    }

    const result = await authService.getUserSessions(userId)

    return reply.status(200).send(result)
  },

  revokeSession: async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = await resolveCurrentUserId(request, reply)

    if (!userId) {
      throw new UnauthorizedError("Authentication required")
    }

    const params = request.params as { sessionId: string }
    const { sessionId } = RevokeSessionDtoSchema.parse(params)

    const result = await authService.revokeSession(userId, sessionId)

    return reply.status(200).send(result)
  }
}
