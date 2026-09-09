import { describe, it, afterEach, mock } from "node:test"
import assert from "node:assert/strict"
import jwt from "jsonwebtoken"
import { generateTokens, verifyToken } from "../../../application/common/token.utils"
import { env } from "@/config/env"

const SECRET = "a-very-long-test-secret-that-exceeds-32-chars!!"

function useSecrets() {
  mock.property(env, "JWT_SECRET", SECRET as never)
  mock.property(env, "JWT_REFRESH_SECRET", SECRET as never)
}

describe("generateTokens", () => {
  afterEach(() => mock.restoreAll())

  it("returns an access token carrying the full payload", async () => {
    useSecrets()
    const { accessToken } = generateTokens("user-1", "ana@cajorapos.com", "admin", "store-1", "Tienda de Ana")
    assert.equal(typeof accessToken, "string")
    assert.ok(accessToken.length > 0)

    const decoded = jwt.verify(accessToken, SECRET) as {
      userId: string
      email: string
      role: string
      storeId: string
      storeName: string
    }
    assert.equal(decoded.userId, "user-1")
    assert.equal(decoded.email, "ana@cajorapos.com")
    assert.equal(decoded.role, "admin")
    assert.equal(decoded.storeId, "store-1")
    assert.equal(decoded.storeName, "Tienda de Ana")
  })

  it("returns a refresh token carrying the userId", async () => {
    useSecrets()
    const { refreshToken } = generateTokens("user-1", "ana@cajorapos.com", "admin", "store-1", "Tienda de Ana")
    const decoded = jwt.verify(refreshToken, SECRET) as { userId: string }
    assert.equal(decoded.userId, "user-1")
  })

  it("supports null store values", async () => {
    useSecrets()
    const { accessToken } = generateTokens("user-1", "ana@cajorapos.com", "cajero", null, null)
    const decoded = jwt.verify(accessToken, SECRET) as { storeId: unknown; storeName: unknown }
    assert.equal(decoded.storeId, null)
    assert.equal(decoded.storeName, null)
  })

  it("signs the access token with the configured short expiry", async () => {
    useSecrets()
    const { accessToken } = generateTokens("user-1", "ana@cajorapos.com", "admin", "store-1", "T")
    const decoded = jwt.verify(accessToken, SECRET, { complete: true }) as { payload: { exp?: number } }
    const ttl = (decoded.payload.exp ?? 0) - Math.floor(Date.now() / 1000)
    assert.ok(ttl <= 900 + 5, "access token should expire in ~900 seconds")
  })
})

describe("verifyToken", () => {
  afterEach(() => mock.restoreAll())

  it("returns the payload for a valid token", () => {
    useSecrets()
    const token = jwt.sign({ userId: "user-1" }, SECRET, { expiresIn: 900 })
    const payload = verifyToken(token, SECRET) as { userId: string }
    assert.equal(payload.userId, "user-1")
  })

  it("throws for an invalid token", () => {
    useSecrets()
    assert.throws(() => verifyToken("not-a-jwt", SECRET))
  })

  it("throws for a token signed with a different secret", () => {
    useSecrets()
    const token = jwt.sign({ userId: "user-1" }, "a-different-secret-value-over-32-chars!!!!!!!!!!!")
    assert.throws(() => verifyToken(token, SECRET))
  })

  it("throws for an expired token", () => {
    useSecrets()
    const token = jwt.sign({ userId: "user-1" }, SECRET, { expiresIn: -1 })
    assert.throws(() => verifyToken(token, SECRET))
  })
})
