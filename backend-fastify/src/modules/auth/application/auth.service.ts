import { ConflictError, NotFoundError, UnauthorizedError } from "@/core/errors/AppError"
import { comparePassword, hashPassword, generateVerificationCode } from "@/core/utils/crypto.utils"
import { generateTokens, verifyToken } from "@/core/utils/token.utils"
import { sendVerificationCodeEmail } from "../infrastructure/email-sender"
import { prisma } from "@/config/prisma"
import type { IAuthRepository } from "../domain/auth.interface"
import type {
  IAuthResponse,
  IRefreshResponse,
  IVerificationResponse,
  ILogoutResponse,
  IUserResponse,
  IUserSessionsResponse,
  ISessionResponse,
  IVerifyEmailResponse,
  IForgotPasswordResponse,
  IResetPasswordResponse,
  ILoginPayload,
  IVerifyEmailPayload,
  IForgotPasswordPayload,
  IResetPasswordPayload,
  IRegisterPayload,
  IRegisterStorePayload,
  IRegisterStoreResponse,
  IStoreResponse,
  ISsoChallengeResponse,
} from "../domain/auth.types"
import type { Role } from "@/types/auth"
import { env } from "@/config/env"
import type { IUserEntity } from "../domain/auth.entities"
import { generateSsoCode, type ISsoCodeStore } from "../infrastructure/sso-code.store"

const ACCESS_TOKEN_EXPIRY = 15 * 60 * 1000
const REFRESH_TOKEN_EXPIRY = 7 * 24 * 60 * 60 * 1000
const VERIFICATION_CODE_EXPIRY = 15 * 60 * 1000
const SESSION_EXPIRY = 7 * 24 * 60 * 60 * 1000
const SSO_CODE_TTL_SECONDS = 120

function mapUserToResponse(user: IUserEntity): IUserResponse {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    email_verified: user.email_verified,
    role: user.role as Role,
    permissions: user.permissions ?? [],
    phone: user.phone,
    image: user.image,
    store_id: user.store_id,
    created_at: user.created_at,
    updated_at: user.updated_at,
  }
}

function mapStoreToResponse(store: { id: string; name: string; address?: string | null; phone?: string | null }): IStoreResponse {
  return {
    id: store.id,
    name: store.name,
    address: store.address || undefined,
    phone: store.phone || undefined,
  }
}

async function getStoreInfo(storeId: string | null): Promise<IStoreResponse | null> {
  // Super admin: no pertenece a ninguna tienda.
  if (!storeId) return null
  const store = await prisma.store.findUnique({ where: { id: storeId } })
  if (!store) throw new NotFoundError("Store not found")
  return mapStoreToResponse(store)
}

export const createAuthService = (repository: IAuthRepository, ssoCodeStore: ISsoCodeStore) => ({

  register: async (data: IRegisterPayload, storeId: string): Promise<IAuthResponse> => {
    const { name, email, password, role = "cajero" } = data

    // Check email uniqueness within the same store
    const existingUser = await repository.user.findByEmail(email, storeId)
    if (existingUser) {
      throw new ConflictError("Email already registered in this store")
    }

    const hashedPassword = await hashPassword(password)

    const user = await repository.user.create({
      name,
      email,
      role,
      email_verified: false,
      store_id: storeId,
    })

    await repository.account.create({
      account_id: user.id,
      provider_id: "credentials",
      user_id: user.id,
      password: hashedPassword,
    })

    const verificationCode = generateVerificationCode()
    await repository.verification.create({
      identifier: email,
      value: verificationCode,
      expiresAt: new Date(Date.now() + VERIFICATION_CODE_EXPIRY),
    })

    // Enviar el código por email (fallback a console si no hay RESEND_API_KEY).
    await sendVerificationCodeEmail(email, verificationCode).catch((err) => {
      console.error(`[auth] No se pudo enviar código de verificación a ${email}:`, err)
    })

    const store = await getStoreInfo(storeId)
    if (!store) throw new NotFoundError("Store not found")
    const { accessToken, refreshToken } = generateTokens(user.id, user.email, user.role as Role, store.id, store.name)

    await repository.session.create({
      userId: user.id,
      token: refreshToken,
      expiresAt: new Date(Date.now() + SESSION_EXPIRY),
    })

    return {
      message: "User created successfully. Please verify your email.",
      user: mapUserToResponse(user),
      store,
      accessToken,
      refreshToken,
    }
  },

  registerStore: async (data: IRegisterStorePayload): Promise<IRegisterStoreResponse> => {
    const { storeName, storeAddress, storePhone, adminName, adminEmail, adminPassword } = data

    // Check store name uniqueness
    const existingStore = await prisma.store.findFirst({ where: { name: storeName } })
    if (existingStore) {
      throw new ConflictError("A store with this name already exists")
    }

    // Check email uniqueness within the future store (global email check for simplicity)
    const existingUser = await repository.user.findByEmail(adminEmail)
    if (existingUser) {
      throw new ConflictError("Email already registered")
    }

    const hashedPassword = await hashPassword(adminPassword)

    // Atomic transaction: store + user + account + settings + session
    const result = await prisma.$transaction(async (tx) => {
      // 1. Create store
      const store = await tx.store.create({
        data: {
          name: storeName,
          address: storeAddress || "",
          phone: storePhone || "",
        },
      })

      // 2. Create admin user (email pendiente de verificación)
      const user = await tx.user.create({
        data: {
          name: adminName,
          email: adminEmail,
          role: "admin",
          email_verified: false,
          store_id: store.id,
        },
      })

      // 3. Create account with hashed password
      await tx.account.create({
        data: {
          account_id: user.id,
          provider_id: "credentials",
          user_id: user.id,
          password: hashedPassword,
        },
      })

      // 4. Create default settings for the store
      await tx.settings.create({
        data: {
          store_id: store.id,
          name: storeName,
          address: storeAddress || "",
          phone: storePhone || "",
          low_stock_threshold: 5,
        },
      })

      return { store, user }
    })

    // Generate tokens after transaction
    const { accessToken, refreshToken } = generateTokens(
      result.user.id,
      result.user.email,
      "admin",
      result.store.id,
      result.store.name,
    )

    await repository.session.create({
      userId: result.user.id,
      token: refreshToken,
      expiresAt: new Date(Date.now() + SESSION_EXPIRY),
    })

    // Generar y enviar código de verificación por email (fallback a console sin RESEND_API_KEY).
    const verificationCode = generateVerificationCode()
    await repository.verification.create({
      identifier: adminEmail,
      value: verificationCode,
      expiresAt: new Date(Date.now() + VERIFICATION_CODE_EXPIRY),
    })
    await sendVerificationCodeEmail(adminEmail, verificationCode).catch((err) => {
      console.error(`[auth] No se pudo enviar código de verificación a ${adminEmail}:`, err)
    })

    return {
      message: "Store created successfully. Please verify your email.",
      user: {
        id: result.user.id,
        name: result.user.name,
        email: result.user.email,
        email_verified: false,
        role: "admin",
        permissions: [],
        phone: undefined,
        image: undefined,
        store_id: result.store.id,
        created_at: result.user.created_at,
        updated_at: result.user.updated_at,
      },
      store: mapStoreToResponse(result.store),
      accessToken,
      refreshToken,
    }
  },

  ssoChallenge: async (userId: string): Promise<ISsoChallengeResponse> => {
    const code = generateSsoCode()
    await ssoCodeStore.set(code, userId, SSO_CODE_TTL_SECONDS)

    return {
      code,
      expires_in: SSO_CODE_TTL_SECONDS,
    }
  },

  ssoExchange: async (code: string): Promise<IAuthResponse> => {
    const userId = await ssoCodeStore.consume(code)
    if (!userId) {
      throw new UnauthorizedError("Invalid or expired SSO code")
    }

    const user = await repository.user.findById(userId)
    if (!user) {
      throw new UnauthorizedError("User not found")
    }

    if (user.deleted_at) {
      throw new UnauthorizedError("Account has been deactivated")
    }

    const store = await getStoreInfo(user.store_id)
    const { accessToken, refreshToken } = generateTokens(
      user.id,
      user.email,
      user.role as Role,
      user.store_id ?? null,
      store?.name ?? null,
    )

    await repository.session.create({
      userId: user.id,
      token: refreshToken,
      expiresAt: new Date(Date.now() + SESSION_EXPIRY),
    })

    return {
      message: "SSO login successfully",
      user: mapUserToResponse(user),
      store,
      accessToken,
      refreshToken,
    }
  },

  login: async (data: ILoginPayload): Promise<IAuthResponse> => {
    const { email, password } = data

    const account = await repository.account.findCredentialsAccountByEmail(email)
    if (!account) {
      throw new UnauthorizedError("Invalid credentials")
    }

    if (!account.password) {
      throw new UnauthorizedError("Invalid credentials")
    }
    const isValidPassword = await comparePassword(password, account.password)
    if (!isValidPassword) {
      throw new UnauthorizedError("Invalid credentials")
    }

    const user = await repository.user.findById(account.user_id!)
    if (!user) {
      throw new UnauthorizedError("User not found")
    }

    if (user.deleted_at) {
      throw new UnauthorizedError("Account has been deactivated")
    }

    const store = await getStoreInfo(user.store_id)
    const { accessToken, refreshToken } = generateTokens(
      user.id,
      user.email,
      user.role as Role,
      user.store_id ?? null,
      store?.name ?? null,
    )

    await repository.session.create({
      userId: user.id,
      token: refreshToken,
      expiresAt: new Date(Date.now() + SESSION_EXPIRY),
    })

    return {
      message: "Login successfully",
      user: mapUserToResponse(user),
      store,
      accessToken,
      refreshToken,
    }
  },

  logout: async (refreshToken: string): Promise<ILogoutResponse> => {
    await repository.session.delete(refreshToken)

    return {
      message: "Logged out successfully",
    }
  },

  refresh: async (refreshToken: string): Promise<IRefreshResponse> => {
    let payload: { userId: string }

    try {
      payload = verifyToken(refreshToken, env.JWT_REFRESH_SECRET) as { userId: string }
    } catch {
      throw new UnauthorizedError("Invalid or expired refresh token")
    }

    const session = await repository.session.findByToken(refreshToken)
    if (!session) {
      throw new UnauthorizedError("Invalid refresh token")
    }

    if (session.expires_at < new Date()) {
      await repository.session.delete(refreshToken)
      throw new UnauthorizedError("Session expired")
    }

    const user = await repository.user.findById(payload.userId)
    if (!user) {
      throw new UnauthorizedError("User not found")
    }

    await repository.session.delete(refreshToken)

    const store = await getStoreInfo(user.store_id)
    const { accessToken, refreshToken: newRefreshToken } = generateTokens(
      user.id,
      user.email,
      user.role as Role,
      user.store_id ?? null,
      store?.name ?? null,
    )

    await repository.session.create({
      userId: user.id,
      token: newRefreshToken,
      expiresAt: new Date(Date.now() + SESSION_EXPIRY),
    })

    return {
      message: "Token refreshed successfully",
      user: mapUserToResponse(user),
      store,
      accessToken,
      refreshToken: newRefreshToken,
    }
  },

  verifyEmail: async (data: IVerifyEmailPayload): Promise<IVerifyEmailResponse> => {
    const { identifier, code } = data

    const verification = await repository.verification.findByIdentifierAndValue(
      identifier,
      code,
    )

    if (!verification) {
      throw new UnauthorizedError("Invalid verification code")
    }

    if (verification.expires_at < new Date()) {
      await repository.verification.deleteByIdentifier(identifier)
      throw new UnauthorizedError("Verification code expired")
    }

    const user = await repository.user.findByEmail(identifier)
    if (!user) {
      throw new NotFoundError("User not found")
    }

    await repository.user.update(user.id, { email_verified: true })

    await repository.verification.deleteByIdentifier(identifier)

    const store = await getStoreInfo(user.store_id)
    const { accessToken, refreshToken } = generateTokens(
      user.id,
      user.email,
      user.role as Role,
      user.store_id ?? null,
      store?.name ?? null,
    )

    await repository.session.create({
      userId: user.id,
      token: refreshToken,
      expiresAt: new Date(Date.now() + SESSION_EXPIRY),
    })

    return {
      message: "Email verified successfully",
      accessToken,
      refreshToken,
    }
  },

  forgotPassword: async (data: IForgotPasswordPayload): Promise<IForgotPasswordResponse> => {
    const { email } = data

    const user = await repository.user.findByEmail(email)
    if (!user) {
      return {
        message: "If the email exists, a reset code has been sent",
        expires_at: new Date(Date.now() + VERIFICATION_CODE_EXPIRY),
      }
    }

    const resetCode = generateVerificationCode()
    await repository.verification.create({
      identifier: `reset:${email}`,
      value: resetCode,
      expiresAt: new Date(Date.now() + VERIFICATION_CODE_EXPIRY),
    })

    console.log(`Password reset code for ${email}: ${resetCode}`)

    return {
      message: "If the email exists, a reset code has been sent",
      expires_at: new Date(Date.now() + VERIFICATION_CODE_EXPIRY),
    }
  },

  resetPassword: async (data: IResetPasswordPayload): Promise<IResetPasswordResponse> => {
    const { email, code, newPassword } = data

    const verification = await repository.verification.findByIdentifierAndValue(
      `reset:${email}`,
      code,
    )

    if (!verification) {
      throw new UnauthorizedError("Invalid reset code")
    }

    if (verification.expires_at < new Date()) {
      await repository.verification.deleteByIdentifier(`reset:${email}`)
      throw new UnauthorizedError("Reset code expired")
    }

    const user = await repository.user.findByEmail(email)
    if (!user) {
      throw new NotFoundError("User not found")
    }

    const account = await repository.account.findCredentialsAccountByEmail(email)
    if (!account) {
      throw new NotFoundError("Account not found")
    }

    const hashedPassword = await hashPassword(newPassword)
    await repository.account.update(account.id, { password: hashedPassword })

    await repository.session.deleteByUserId(user.id)

    await repository.verification.deleteByIdentifier(`reset:${email}`)

    return {
      message: "Password reset successfully. Please login with your new password.",
    }
  },

  getUserSessions: async (userId: string): Promise<IUserSessionsResponse> => {
    const sessions = await repository.session.findByUserId(userId)

    const validSessions: ISessionResponse[] = sessions
      .filter((s) => s.expires_at > new Date())
      .map((s) => ({
        id: s.id,
        expires_at: s.expires_at,
        ip_address: s.ip_address,
        user_agent: s.user_agent,
        created_at: s.created_at,
        updated_at: s.updated_at,
      }))

    return {
      sessions: validSessions,
    }
  },

  revokeSession: async (userId: string, sessionId: string): Promise<ILogoutResponse> => {
    const sessions = await repository.session.findByUserId(userId)
    const session = sessions.find((s) => s.id === sessionId)

    if (!session) {
      throw new NotFoundError("Session not found")
    }

    await repository.session.delete(session.token)

    return {
      message: "Session revoked successfully",
    }
  },

  resendVerification: async (email: string): Promise<IVerificationResponse> => {
    const user = await repository.user.findByEmail(email)

    if (!user) {
      return {
        message: "If the email exists, a new verification code has been sent",
        expiresAt: new Date(Date.now() + VERIFICATION_CODE_EXPIRY),
      }
    }

    if (user.email_verified) {
      throw new ConflictError("Email already verified")
    }

    await repository.verification.deleteByIdentifier(email)

    const verificationCode = generateVerificationCode()
    await repository.verification.create({
      identifier: email,
      value: verificationCode,
      expiresAt: new Date(Date.now() + VERIFICATION_CODE_EXPIRY),
    })

    await sendVerificationCodeEmail(email, verificationCode).catch((err) => {
      console.error(`[auth] No se pudo reenviar código de verificación a ${email}:`, err)
    })

    return {
      message: "New verification code sent",
      expiresAt: new Date(Date.now() + VERIFICATION_CODE_EXPIRY),
    }
  },
})