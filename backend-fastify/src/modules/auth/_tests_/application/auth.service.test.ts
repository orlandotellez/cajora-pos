import { describe, it, beforeEach, afterEach, mock } from "bun:test"
import assert from "node:assert/strict"
import {
  UnauthorizedError,
  ConflictError,
  NotFoundError,
  InternalServerError,
  PaymentRequiredError,
} from "@/core/errors/AppError"
import type { IAuthRepository } from "../../domain/auth.interface"
import type { IUserEntity, IAccountEntity, ISessionEntity, IVerificationEntity } from "../../domain/auth.entities"
import type { ISsoCodeStore } from "../../infrastructure/sso-code.store"

const fakeStoreRow = { id: "store-1", name: "Tienda de Ana", address: null, phone: null }
const fakeTx = {
  store: {
    create: async (args: { data: { name: string; address?: string; phone?: string } }) => ({
      id: "store-1",
      name: args.data.name,
      address: args.data.address ?? "",
      phone: args.data.phone ?? "",
    }),
  },
  user: {
    create: async (args: { data: Partial<IUserEntity> }) => makeUser({ ...args.data, id: "user-1", email_verified: false }),
  },
  account: {
    create: async () => {},
  },
  settings: {
    create: async () => ({}),
  },
}

mock.module("@/config/prisma", () => ({
  prisma: {
    store: {
      findUnique: async () => fakeStoreRow,
      findFirst: async () => null,
    },
    $transaction: async (fn: (tx: typeof fakeTx) => Promise<unknown>) => fn(fakeTx),
  },
}))
mock.module("@/config/redis", () => ({
  redis: null,
  getRedisClient: () => null,
  closeRedis: async () => {},
}))

const { createAuthService } = await import("../../application/auth.service")

function fakeSsoStore() {
  const codes = new Map<string, string>()
  const store: ISsoCodeStore = {
    async set(code, userId) {
      codes.set(code, userId)
    },
    async consume(code) {
      const userId = codes.get(code)
      codes.delete(code)
      return userId ?? null
    },
  }
  return { store, codes }
}

function makeUser(overrides: Partial<IUserEntity> = {}): IUserEntity {
  const now = new Date()
  return {
    id: "user-1",
    name: "Ana",
    email: "ana@cajorapos.com",
    email_verified: true,
    role: "admin",
    is_owner: false,
    is_active: true,
    permissions: [],
    store_id: "store-1",
    created_at: now,
    updated_at: now,
    ...overrides,
  }
}

function makeAccount(overrides: Partial<IAccountEntity> = {}): IAccountEntity {
  const now = new Date()
  return {
    id: "acc-1",
    account_id: "user-1",
    provider_id: "credentials",
    user_id: "user-1",
    created_at: now,
    updated_at: now,
    ...overrides,
  }
}

function makeRepo(overrides: Partial<IAuthRepository> = {}) {
  const createdSessions: Array<{ userId: string; token: string; expiresAt: Date }> = []
  const createSession = (data: { userId: string; token: string; expiresAt: Date }) => {
    createdSessions.push(data)
    return { id: `sess-${createdSessions.length}`, ...data, created_at: new Date(), updated_at: new Date() } as ISessionEntity
  }

  const repo: IAuthRepository = {
    user: {
      async findById() {
        return null
      },
      async findByEmail() {
        return null
      },
      async create(data) {
        return makeUser({ ...data, email_verified: false })
      },
      async update(id, data) {
        return makeUser(data)
      },
      async softDelete() {},
    },
    account: {
      async findByProviderAndAccountId() {
        return null
      },
      async findByUserId() {
        return []
      },
      async findCredentialsAccountByEmail() {
        return null
      },
      async create() {
        return makeAccount()
      },
      async update() {
        return makeAccount()
      },
      async delete() {},
      async deleteByUserId() {},
    },
    session: {
      async create(data) {
        return createSession(data)
      },
      async findByToken() {
        return null
      },
      async findByUserId() {
        return []
      },
      async delete() {},
      async deleteByUserId() {},
      async deleteExpiredSessions() {
        return 0
      },
    },
    verification: {
      async create() {},
      async findByIdentifier() {
        return null
      },
      async findByIdentifierAndValue() {
        return null
      },
      async delete() {},
      async deleteByIdentifier() {},
      async deleteExpired() {
        return 0
      },
    },
    ...overrides,
  }

  return { repo, createdSessions, createSession }
}

describe("register", () => {
  beforeEach(() => mock.restore())
  afterEach(() => mock.restore())

  it("creates a user, hashes the password and returns fresh tokens", async () => {
    const accountArgs: unknown[] = []
    const verificationArgs: unknown[] = []
    let createdUserData: Record<string, unknown> | null = null

    const { repo, createdSessions, createSession } = makeRepo({
      user: {
        async findById() {
          return null
        },
        async findByEmail() {
          return null
        },
        async create(data) {
          createdUserData = data
          return makeUser({ ...data, email_verified: false })
        },
        async update(id, data) {
          return makeUser(data)
        },
        async softDelete() {},
      } as IAuthRepository["user"],
      account: {
        async findCredentialsAccountByEmail() {
          return null
        },
        async create(data) {
          accountArgs.push(data)
          return makeAccount(data)
        },
        async findByProviderAndAccountId() {
          return null
        },
        async findByUserId() {
          return []
        },
        async update() {
          return makeAccount()
        },
        async delete() {},
        async deleteByUserId() {},
      } as IAuthRepository["account"],
      verification: {
        async create(data) {
          verificationArgs.push(data)
        },
        async findByIdentifier() {
          return null
        },
        async findByIdentifierAndValue() {
          return null
        },
        async delete() {},
        async deleteByIdentifier() {},
        async deleteExpired() {
          return 0
        },
      } as IAuthRepository["verification"],
      session: {
        async create(data) {
          return createSession(data)
        },
        async findByToken() {
          return null
        },
        async findByUserId() {
          return []
        },
        async delete() {},
        async deleteByUserId() {},
        async deleteExpiredSessions() {
          return 0
        },
      } as IAuthRepository["session"],
    })

    const service = createAuthService(repo, fakeSsoStore().store)

    const result = await service.register(
      { name: "Ana", email: "  ANA@CajoraPOS.com ", password: "secret123", role: "cajero" },
      "store-1",
    )

    assert.equal(result.message, "User created successfully. Please verify your email.")
    assert.equal(result.user.email, "ana@cajorapos.com", "email must be trimmed and lowercased")
    assert.equal(result.user.role, "cajero")
    assert.equal(result.user.email_verified, false)
    assert.equal(result.store?.id, "store-1")
    assert.ok(result.accessToken)
    assert.ok(result.refreshToken)
    assert.ok(createdUserData, "user.create must be called")
    assert.notEqual((accountArgs[0] as { password: string }).password, "secret123", "password must be hashed")
    assert.ok(
      (accountArgs[0] as { password: string }).password.startsWith("$2"),
      "password must be a bcrypt hash",
    )
    assert.equal(verificationArgs.length, 1)
    assert.equal(createdSessions.length, 1)
    assert.equal(createdSessions[0].userId, "user-1")
  })

  it("rejects a duplicate email within the same store", async () => {
    const { repo } = makeRepo({
      user: {
        async findByEmail() {
          return makeUser()
        },
      } as Partial<IAuthRepository["user"]>,
    })

    const service = createAuthService(repo, fakeSsoStore().store)

    await assert.rejects(
      () =>
        service.register(
          { name: "Ana", email: "ana@cajorapos.com", password: "secret123" },
          "store-1",
        ),
      (err) => err instanceof ConflictError && /already registered in this store/i.test(err.message),
    )
  })
})

describe("login", () => {
  beforeEach(() => mock.restore())
  afterEach(() => mock.restore())

  it("rejects invalid credentials", async () => {
    const { repo } = makeRepo({
      account: {
        async findCredentialsAccountByEmail() {
          return null
        },
      } as Partial<IAuthRepository["account"]>,
    })

    const service = createAuthService(repo, fakeSsoStore().store)

    await assert.rejects(
      () => service.login({ email: "ana@cajorapos.com", password: "wrong" }),
      (err) => err instanceof UnauthorizedError && /invalid credentials/i.test(err.message),
    )
  })

  it("rejects credentials when the account has no password", async () => {
    const { repo } = makeRepo({
      account: {
        async findCredentialsAccountByEmail() {
          return makeAccount({ password: undefined })
        },
      } as Partial<IAuthRepository["account"]>,
    })

    const service = createAuthService(repo, fakeSsoStore().store)

    await assert.rejects(
      () => service.login({ email: "ana@cajorapos.com", password: "whatever" }),
      (err) => err instanceof UnauthorizedError && /invalid credentials/i.test(err.message),
    )
  })

  it("logs in with valid credentials and returns fresh tokens", async () => {
    const bcrypt = await import("bcrypt")
    const hash = await bcrypt.hash("correct-password", 4)

    const { repo, createdSessions } = makeRepo({
      account: {
        async findCredentialsAccountByEmail() {
          return makeAccount({ password: hash, user_id: "user-1" })
        },
      } as Partial<IAuthRepository["account"]>,
      user: {
        async findById() {
          return makeUser()
        },
      } as Partial<IAuthRepository["user"]>,
    })

    const service = createAuthService(repo, fakeSsoStore().store)

    const result = await service.login({ email: "ANA@cajorapos.com", password: "correct-password" })

    assert.equal(result.message, "Login successfully")
    assert.equal(result.user.id, "user-1")
    assert.equal(result.user.email, "ana@cajorapos.com")
    assert.ok(result.accessToken)
    assert.ok(result.refreshToken)
    assert.equal(createdSessions.length, 1)
  })

  it("rejects valid credentials for an inactive user", async () => {
    const bcrypt = await import("bcrypt")
    const hash = await bcrypt.hash("correct-password", 4)

    const { repo } = makeRepo({
      account: {
        async findCredentialsAccountByEmail() {
          return makeAccount({ password: hash, user_id: "user-1" })
        },
      } as Partial<IAuthRepository["account"]>,
      user: {
        async findById() {
          return makeUser({ is_active: false })
        },
      } as Partial<IAuthRepository["user"]>,
    })

    const service = createAuthService(repo, fakeSsoStore().store)

    await assert.rejects(
      () => service.login({ email: "ana@cajorapos.com", password: "correct-password" }),
      (err) => err instanceof PaymentRequiredError,
    )
  })
})

describe("refresh", () => {
  beforeEach(() => mock.restore())
  afterEach(() => mock.restore())

  it("rejects an invalid refresh token", async () => {
    const { repo } = makeRepo()
    const service = createAuthService(repo, fakeSsoStore().store)

    await assert.rejects(
      () => service.refresh("not-a-jwt"),
      (err) => err instanceof UnauthorizedError && /invalid or expired refresh token/i.test(err.message),
    )
  })

  it("rejects a valid token with no matching session", async () => {
    const jsonwebtoken = await import("jsonwebtoken")
    const { env } = await import("@/config/env")
    const refreshToken = jsonwebtoken.sign({ userId: "user-1" }, env.JWT_REFRESH_SECRET, { expiresIn: 604000 })

    const { repo } = makeRepo({
      session: {
        async findByToken() {
          return null
        },
      } as Partial<IAuthRepository["session"]>,
    })

    const service = createAuthService(repo, fakeSsoStore().store)

    await assert.rejects(
      () => service.refresh(refreshToken),
      (err) => err instanceof UnauthorizedError && /invalid refresh token/i.test(err.message),
    )
  })

  it("rejects an expired session", async () => {
    const jsonwebtoken = await import("jsonwebtoken")
    const { env } = await import("@/config/env")
    const refreshToken = jsonwebtoken.sign({ userId: "user-1" }, env.JWT_REFRESH_SECRET, { expiresIn: 604000 })

    let deletedToken: string | null = null
    const { repo } = makeRepo({
      session: {
        async findByToken() {
          return { id: "sess-1", token: refreshToken, expires_at: new Date(Date.now() - 1000), user_id: "user-1", created_at: new Date(), updated_at: new Date() } as ISessionEntity
        },
        async delete(token: string) {
          deletedToken = token
        },
      } as Partial<IAuthRepository["session"]>,
    })

    const service = createAuthService(repo, fakeSsoStore().store)

    await assert.rejects(
      () => service.refresh(refreshToken),
      (err) => err instanceof UnauthorizedError && /session expired/i.test(err.message),
    )
    assert.equal(deletedToken, refreshToken, "expired session must be deleted")
  })

  it("rotates tokens successfully for a valid session", async () => {
    const jsonwebtoken = await import("jsonwebtoken")
    const { env } = await import("@/config/env")
    const refreshToken = jsonwebtoken.sign({ userId: "user-1" }, env.JWT_REFRESH_SECRET, { expiresIn: 604000 })

    const deletedTokens: string[] = []
    const { repo, createdSessions } = makeRepo({
      session: {
        async create(data) {
          createdSessions.push(data)
          return { id: `sess-${createdSessions.length}`, ...data, created_at: new Date(), updated_at: new Date() } as ISessionEntity
        },
        async findByToken() {
          return { id: "sess-1", token: refreshToken, expires_at: new Date(Date.now() + 100000), user_id: "user-1", created_at: new Date(), updated_at: new Date() } as ISessionEntity
        },
        async delete(token: string) {
          deletedTokens.push(token)
        },
      } as Partial<IAuthRepository["session"]>,
      user: {
        async findById() {
          return makeUser()
        },
      } as Partial<IAuthRepository["user"]>,
    })

    const service = createAuthService(repo, fakeSsoStore().store)

    const result = await service.refresh(refreshToken)

    assert.equal(result.message, "Token refreshed successfully")
    assert.ok(result.accessToken)
    assert.equal(deletedTokens.length, 1, "old session must be deleted")
    assert.equal(deletedTokens[0], refreshToken, "the presented token must be retired")
    assert.equal(createdSessions.length, 1, "new session must be created")
    assert.equal(createdSessions[0].token, result.refreshToken, "new session must use the issued token")
  })
})

describe("verifyEmail", () => {
  beforeEach(() => mock.restore())
  afterEach(() => mock.restore())

  it("rejects an invalid verification code", async () => {
    const { repo } = makeRepo({
      verification: {
        async findByIdentifierAndValue() {
          return null
        },
      } as Partial<IAuthRepository["verification"]>,
    })

    const service = createAuthService(repo, fakeSsoStore().store)

    await assert.rejects(
      () => service.verifyEmail({ identifier: "ana@cajorapos.com", code: "ABC123" }),
      (err) => err instanceof UnauthorizedError && /invalid verification code/i.test(err.message),
    )
  })

  it("rejects an expired verification code", async () => {
    const { repo } = makeRepo({
      verification: {
        async findByIdentifierAndValue() {
          return { id: "v-1", identifier: "ana@cajorapos.com", value: "ABC123", expires_at: new Date(Date.now() - 1000), created_at: new Date(), updated_at: new Date() } as IVerificationEntity
        },
        async deleteByIdentifier() {},
      } as Partial<IAuthRepository["verification"]>,
    })

    const service = createAuthService(repo, fakeSsoStore().store)

    await assert.rejects(
      () => service.verifyEmail({ identifier: "ana@cajorapos.com", code: "ABC123" }),
      (err) => err instanceof UnauthorizedError && /verification code expired/i.test(err.message),
    )
  })

  it("verifies a valid code and marks the email as verified", async () => {
    let updatedUser: string | null = null
    const deletedIdentifiers: string[] = []
    const { repo, createdSessions } = makeRepo({
      verification: {
        async findByIdentifierAndValue() {
          return { id: "v-1", identifier: "ana@cajorapos.com", value: "ABC123", expires_at: new Date(Date.now() + 100000), created_at: new Date(), updated_at: new Date() } as IVerificationEntity
        },
        async deleteByIdentifier(identifier: string) {
          deletedIdentifiers.push(identifier)
        },
      } as Partial<IAuthRepository["verification"]>,
      user: {
        async findByEmail() {
          return makeUser()
        },
        async update(id, data) {
          updatedUser = id
          return makeUser(data)
        },
      } as Partial<IAuthRepository["user"]>,
    })

    const service = createAuthService(repo, fakeSsoStore().store)

    const result = await service.verifyEmail({ identifier: "ana@cajorapos.com", code: "ABC123" })

    assert.equal(result.message, "Email verified successfully")
    assert.ok(result.accessToken)
    assert.ok(result.refreshToken)
    assert.equal(updatedUser, "user-1")
    assert.ok(deletedIdentifiers.includes("ana@cajorapos.com"))
    assert.equal(createdSessions.length, 1)
  })
})

describe("forgotPassword and resetPassword", () => {
  beforeEach(() => mock.restore())
  afterEach(() => mock.restore())

  it("forgotPassword returns a generic message for a missing user", async () => {
    const { repo } = makeRepo({
      user: {
        async findByEmail() {
          return null
        },
      } as Partial<IAuthRepository["user"]>,
    })

    const service = createAuthService(repo, fakeSsoStore().store)

    const result = await service.forgotPassword({ email: "missing@cajorapos.com" })

    assert.match(result.message, /if the email exists/i)
    assert.ok(result.expires_at instanceof Date)
  })

  it("forgotPassword stores a reset code for an existing user", async () => {
    const createdVerifications: Array<{ identifier: string }> = []
    const { repo } = makeRepo({
      user: {
        async findByEmail() {
          return makeUser()
        },
      } as Partial<IAuthRepository["user"]>,
      verification: {
        async create(data) {
          createdVerifications.push(data)
        },
      } as Partial<IAuthRepository["verification"]>,
    })

    const service = createAuthService(repo, fakeSsoStore().store)

    const result = await service.forgotPassword({ email: "ana@cajorapos.com" })

    assert.match(result.message, /if the email exists/i)
    assert.equal(createdVerifications.length, 1)
    assert.equal(createdVerifications[0].identifier, "reset:ana@cajorapos.com")
    assert.ok((createdVerifications[0] as { value: string }).value, "a reset code must be generated")
  })

  it("resetPassword rejects an invalid code", async () => {
    const { repo } = makeRepo({
      verification: {
        async findByIdentifierAndValue() {
          return null
        },
      } as Partial<IAuthRepository["verification"]>,
    })

    const service = createAuthService(repo, fakeSsoStore().store)

    await assert.rejects(
      () => service.resetPassword({ email: "ana@cajorapos.com", code: "BAD", newPassword: "newpass123" }),
      (err) => err instanceof UnauthorizedError && /invalid reset code/i.test(err.message),
    )
  })

  it("resetPassword updates the password, clears sessions and verification", async () => {
    const updatedAccount: Array<{ password: string }> = []
    let sessionsCleared = false
    let verificationCleared = false
    const { repo } = makeRepo({
      verification: {
        async findByIdentifierAndValue() {
          return { id: "v-2", identifier: "reset:ana@cajorapos.com", value: "RESET1", expires_at: new Date(Date.now() + 100000), created_at: new Date(), updated_at: new Date() } as IVerificationEntity
        },
        async deleteByIdentifier() {
          verificationCleared = true
        },
      } as Partial<IAuthRepository["verification"]>,
      user: {
        async findByEmail() {
          return makeUser()
        },
      } as Partial<IAuthRepository["user"]>,
      account: {
        async findCredentialsAccountByEmail() {
          return makeAccount()
        },
        async update(id, data) {
          updatedAccount.push(data as { password: string })
          return makeAccount(data as Partial<IAccountEntity>)
        },
      } as Partial<IAuthRepository["account"]>,
      session: {
        async deleteByUserId() {
          sessionsCleared = true
        },
      } as Partial<IAuthRepository["session"]>,
    })

    const service = createAuthService(repo, fakeSsoStore().store)

    const result = await service.resetPassword({
      email: "ana@cajorapos.com",
      code: "RESET1",
      newPassword: "newpassword123",
    })

    assert.equal(result.message, "Password reset successfully. Please login with your new password.")
    assert.equal(updatedAccount.length, 1)
    assert.notEqual(updatedAccount[0].password, "newpassword123", "password must be hashed")
    assert.ok(updatedAccount[0].password.startsWith("$2"), "password must be a bcrypt hash")
    assert.equal(sessionsCleared, true)
    assert.equal(verificationCleared, true)
  })
})

describe("SSO auth flow", () => {
  beforeEach(() => mock.restore())
  afterEach(() => mock.restore())

  it("ssoChallenge generates a code and stores it", async () => {
    const { repo } = makeRepo()
    const { store, codes } = fakeSsoStore()
    const service = createAuthService(repo, store)

    const result = await service.ssoChallenge("user-1")

    assert.equal(result.expires_in, 120)
    assert.ok(result.code.length >= 32, "the code must have high entropy")
    assert.equal(codes.get(result.code), "user-1")
  })

  it("ssoExchange exchanges a valid code and returns fresh tokens", async () => {
    const { repo, createdSessions } = makeRepo({
      user: {
        async findById() {
          return makeUser()
        },
      } as Partial<IAuthRepository["user"]>,
    })
    const { store, codes } = fakeSsoStore()
    const service = createAuthService(repo, store)

    const { code } = await service.ssoChallenge("user-1")
    const result = await service.ssoExchange(code)

    assert.equal(result.message, "SSO login successfully")
    assert.equal(result.user.id, "user-1")
    assert.equal(result.store?.name, "Tienda de Ana")
    assert.ok(result.accessToken)
    assert.ok(result.refreshToken)
    assert.equal(createdSessions.length, 1)
    assert.equal(codes.size, 0, "the code must be consumed")
  })

  it("ssoExchange rejects a nonexistent code", async () => {
    const { repo } = makeRepo()
    const service = createAuthService(repo, fakeSsoStore().store)

    await assert.rejects(
      () => service.ssoExchange("invented-code"),
      (err) => err instanceof UnauthorizedError && /invalid or expired/i.test(err.message),
    )
  })

  it("ssoExchange rejects an already used code (single use)", async () => {
    const { repo } = makeRepo({
      user: {
        async findById() {
          return makeUser()
        },
      } as Partial<IAuthRepository["user"]>,
    })
    const { store } = fakeSsoStore()
    const service = createAuthService(repo, store)

    const { code } = await service.ssoChallenge("user-1")
    await service.ssoExchange(code)

    await assert.rejects(
      () => service.ssoExchange(code),
      (err) => err instanceof UnauthorizedError,
    )
  })

  it("ssoExchange rejects a deleted user", async () => {
    const { repo } = makeRepo({
      user: {
        async findById() {
          return makeUser({ deleted_at: new Date() })
        },
      } as Partial<IAuthRepository["user"]>,
    })
    const { store } = fakeSsoStore()
    const service = createAuthService(repo, store)

    const { code } = await service.ssoChallenge("user-1")

    await assert.rejects(
      () => service.ssoExchange(code),
      (err) => err instanceof UnauthorizedError && /deactivated/i.test(err.message),
    )
  })
})
