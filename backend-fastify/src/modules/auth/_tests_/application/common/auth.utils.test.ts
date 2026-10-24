import { describe, it } from "node:test"
import assert from "node:assert/strict"
import jwt from "jsonwebtoken"
import { env } from "@/config/env"
import { UnauthorizedError } from "@/core/errors/AppError"
import { authGuard } from "../../../application/common/auth.guard"
import { getAuthResultFromRequest, getUserIdFromCookies } from "../../../application/common/auth.utils"

const EMPTY_AUTH = { userId: null, role: null, storeId: null, storeName: null }

function signAccessToken(overrides: Record<string, unknown> = {}) {
  return jwt.sign(
    { userId: "user-1", role: "admin", storeId: "store-1", storeName: "Tienda", ...overrides },
    env.JWT_SECRET,
    { expiresIn: "1h" },
  )
}

function signExpiredAccessToken() {
  // `exp` en el pasado: mismo payload que un access token real, ya vencido.
  return jwt.sign(
    {
      userId: "user-1",
      role: "admin",
      storeId: "store-1",
      storeName: "Tienda",
      exp: Math.floor(Date.now() / 1000) - 60,
    },
    env.JWT_SECRET,
  )
}

function signRefreshToken() {
  return jwt.sign({ userId: "user-1" }, env.JWT_REFRESH_SECRET, { expiresIn: "7d" })
}

// El refresh token solo sirve para cambiarlo en /auth/refresh: nunca autentica una
// request normal. Si se acepta como credencial, una sesión sin storeId pasa authGuard y
// muere en storeGuard con 403 STORE_CONTEXT_REQUIRED — y el cliente no sabe refrescar.
describe("getUserIdFromCookies", () => {
  it("cookie con solo refresh token → resultado vacío y authGuard responde 401 (antes: 403 en storeGuard)", async () => {
    const request = { cookies: { refreshToken: signRefreshToken() }, headers: {} }

    assert.deepEqual(getUserIdFromCookies(request as never), EMPTY_AUTH)

    await assert.rejects(
      () => authGuard(request as never, {} as never),
      (err: unknown) => err instanceof UnauthorizedError && err.statusCode === 401,
    )
  })

  it("cookie con access token válido → resultado completo, storeId incluido", async () => {
    const request = { cookies: { accessToken: signAccessToken() }, headers: {} }

    assert.deepEqual(getUserIdFromCookies(request as never), {
      userId: "user-1",
      role: "admin",
      storeId: "store-1",
      storeName: "Tienda",
    })

    // authGuard debe dejar la request lista para storeGuard (storeId presente).
    await authGuard(request as never, {} as never)
    const decorated = request as unknown as { userId?: string; storeId?: string }
    assert.equal(decorated.userId, "user-1")
    assert.equal(decorated.storeId, "store-1")
  })

  it("cookie con access token vencido → resultado vacío, sin caer al refresh token", () => {
    const request = {
      cookies: { accessToken: signExpiredAccessToken(), refreshToken: signRefreshToken() },
      headers: {},
    }

    assert.deepEqual(getUserIdFromCookies(request as never), EMPTY_AUTH)
  })

  it("prefer \"storeId\" sigue cayendo al Bearer cuando la cookie no trae storeId", () => {
    const request = {
      cookies: { refreshToken: signRefreshToken() },
      headers: { authorization: `Bearer ${signAccessToken()}` },
    }

    const result = getAuthResultFromRequest(request as never, { prefer: "storeId" })
    assert.equal(result.userId, "user-1")
    assert.equal(result.storeId, "store-1")
  })

  it("request sin cookies y con Bearer válido → sigue autenticando (getUserIdFromBearerToken intacto)", () => {
    const request = { cookies: {}, headers: { authorization: `Bearer ${signAccessToken()}` } }

    const result = getAuthResultFromRequest(request as never)
    assert.equal(result.userId, "user-1")
    assert.equal(result.storeId, "store-1")
  })
})
