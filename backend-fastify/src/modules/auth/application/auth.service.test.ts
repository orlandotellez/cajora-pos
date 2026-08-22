import { describe, it, beforeEach, afterEach, mock } from "node:test"
import assert from "node:assert/strict"
import { UnauthorizedError } from "@/core/errors/AppError"
import type { IAuthRepository } from "../domain/auth.interface"
import type { IUserEntity } from "../domain/auth.entities"
import type { ISsoCodeStore } from "../infrastructure/sso-code.store"

/**
 * Mockeamos los módulos de infraestructura ANTES de importar el service:
 *  - @/config/prisma: el cliente real es un Proxy inmutable; getStoreInfo lo usa.
 *  - @/config/redis: evita que sso-code.store conecte a Redis durante los tests.
 */
const fakeStoreRow = { id: "store-1", name: "Tienda de Ana", address: null, phone: null }
mock.module("@/config/prisma", {
  namedExports: {
    prisma: {
      store: {
        findUnique: async () => fakeStoreRow,
      },
    },
  },
})
mock.module("@/config/redis", {
  namedExports: {
    redis: null,
    getRedisClient: () => null,
    closeRedis: async () => {},
  },
})

const { createAuthService } = await import("./auth.service")

/** Store de códigos en memoria: consume es de un solo uso (como GETDEL). */
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

/** Repositorio fake: solo los métodos que toca el flujo SSO. */
function makeRepo(user: IUserEntity) {
  const createdSessions: Array<{ userId: string; token: string; expiresAt: Date }> = []
  const repo = {
    user: {
      async findById() {
        return user
      },
    },
    session: {
      async create(data: { userId: string; token: string; expiresAt: Date }) {
        createdSessions.push(data)
      },
    },
  } as unknown as IAuthRepository
  return { repo, createdSessions }
}

describe("SSO auth flow", () => {
  beforeEach(() => mock.restoreAll())
  afterEach(() => mock.restoreAll())

  it("ssoChallenge genera un código y lo guarda en el store", async () => {
    const { repo } = makeRepo(makeUser())
    const { store, codes } = fakeSsoStore()
    const service = createAuthService(repo, store)

    const result = await service.ssoChallenge("user-1")

    assert.equal(result.expires_in, 120)
    assert.ok(result.code.length >= 32, "el código debe tener alta entropía")
    assert.equal(codes.get(result.code), "user-1")
  })

  it("ssoExchange canjea un código válido y devuelve tokens frescos", async () => {
    const { repo, createdSessions } = makeRepo(makeUser())
    const { store, codes } = fakeSsoStore()
    const service = createAuthService(repo, store)

    const { code } = await service.ssoChallenge("user-1")
    const result = await service.ssoExchange(code)

    assert.equal(result.message, "SSO login successfully")
    assert.equal(result.user.id, "user-1")
    assert.equal(result.store?.name, "Tienda de Ana")
    assert.ok(result.accessToken, "debe emitir accessToken")
    assert.ok(result.refreshToken, "debe emitir refreshToken")
    assert.equal(createdSessions.length, 1)
    assert.equal(createdSessions[0].userId, "user-1")
    assert.equal(codes.size, 0, "el código debe consumirse")
  })

  it("ssoExchange rechaza un código inexistente", async () => {
    const { repo } = makeRepo(makeUser())
    const service = createAuthService(repo, fakeSsoStore().store)

    await assert.rejects(
      () => service.ssoExchange("codigo-inventado"),
      (err) => err instanceof UnauthorizedError && /invalid or expired/i.test(err.message),
    )
  })

  it("ssoExchange rechaza un código ya usado (un solo uso)", async () => {
    const { repo } = makeRepo(makeUser())
    const { store } = fakeSsoStore()
    const service = createAuthService(repo, store)

    const { code } = await service.ssoChallenge("user-1")
    await service.ssoExchange(code)

    await assert.rejects(
      () => service.ssoExchange(code),
      (err) => err instanceof UnauthorizedError,
    )
  })

  it("ssoExchange rechaza usuarios eliminados", async () => {
    const { repo } = makeRepo(makeUser({ deleted_at: new Date() }))
    const { store } = fakeSsoStore()
    const service = createAuthService(repo, store)

    const { code } = await service.ssoChallenge("user-1")

    await assert.rejects(
      () => service.ssoExchange(code),
      (err) => err instanceof UnauthorizedError && /deactivated/i.test(err.message),
    )
  })
})