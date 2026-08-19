import type { FastifyInstance, FastifyPluginOptions } from "fastify"
import { authController } from "./auth.controller"
import { authGuard, adminGuard } from "@/core/guard/auth.guard"
import { toJsonSchema } from "@/http/swagger-schema"
import {
  LoginPayloadDtoSchema,
  RegisterPayloadDtoSchema,
  RegisterStoreDtoSchema,
  RefreshTokenDtoSchema,
  VerifyEmailDtoSchema,
  ResendVerificationDtoSchema,
  ForgotPasswordDtoSchema,
  ResetPasswordDtoSchema,
  SsoExchangeDtoSchema,
} from "./auth.dto"

const TAGS = ["Auth"]

export const authRoutes = async (fastify: FastifyInstance, _opts: FastifyPluginOptions) => {
  // PUBLIC ROUTES
  fastify.post("/register-store", {
    schema: { tags: TAGS, body: toJsonSchema(RegisterStoreDtoSchema) },
  }, authController.registerStore)

  fastify.post("/register", {
    schema: { tags: TAGS, body: toJsonSchema(RegisterPayloadDtoSchema) },
    preHandler: [authGuard, adminGuard],
  }, authController.register)

  fastify.post("/login", {
    schema: { tags: TAGS, body: toJsonSchema(LoginPayloadDtoSchema) },
  }, authController.login)

  fastify.post("/refresh", {
    schema: { tags: TAGS, body: toJsonSchema(RefreshTokenDtoSchema) },
  }, authController.refresh)

  fastify.post("/logout", {
    schema: { tags: TAGS, body: toJsonSchema(RefreshTokenDtoSchema) },
  }, authController.logout)

  fastify.post("/sso/challenge", {
    schema: { tags: TAGS },
    preHandler: authGuard,
  }, authController.ssoChallenge)

  fastify.post("/sso/exchange", {
    schema: { tags: TAGS, body: toJsonSchema(SsoExchangeDtoSchema) },
    config: { rateLimit: { max: 10, timeWindow: "1 minute" } },
  }, authController.ssoExchange)

  // Email Verification
  fastify.post("/verify-email", {
    schema: { tags: TAGS, body: toJsonSchema(VerifyEmailDtoSchema) },
  }, authController.verifyEmail)

  fastify.post("/resend-verification", {
    schema: { tags: TAGS, body: toJsonSchema(ResendVerificationDtoSchema) },
  }, authController.resendVerification)

  // Password Reset
  fastify.post("/forgot-password", {
    schema: { tags: TAGS, body: toJsonSchema(ForgotPasswordDtoSchema) },
  }, authController.forgotPassword)

  fastify.post("/reset-password", {
    schema: { tags: TAGS, body: toJsonSchema(ResetPasswordDtoSchema) },
  }, authController.resetPassword)

  // PROTECTED ROUTES
  fastify.get(
    "/sessions",
    { schema: { tags: TAGS }, preHandler: authGuard },
    authController.getUserSessions
  )

  fastify.delete(
    "/sessions/:sessionId",
    {
      schema: { tags: TAGS },
      preHandler: authGuard,
    },
    authController.revokeSession
  )
}
