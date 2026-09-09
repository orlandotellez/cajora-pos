import { describe, it } from "node:test"
import assert from "node:assert/strict"
import {
  generateVerificationCode,
  hashPassword,
  comparePassword,
} from "../../../application/common/crypto.utils"

describe("generateVerificationCode", () => {
  it("returns a 6-character code", () => {
    const code = generateVerificationCode()
    assert.equal(typeof code, "string")
    assert.equal(code.length, 6)
  })

  it("only uses uppercase letters and digits", () => {
    const code = generateVerificationCode()
    assert.match(code, /^[A-Z0-9]{6}$/)
  })

  it("produces variation across calls", () => {
    const codes = new Set(Array.from({ length: 50 }, () => generateVerificationCode()))
    assert.ok(codes.size > 1, "codes should vary across calls")
  })
})

describe("password hashing", () => {
  it("hashes a password into a bcrypt hash", async () => {
    const hash = await hashPassword("s3cret-password")
    assert.equal(typeof hash, "string")
    assert.ok(hash.startsWith("$2"), "must be a bcrypt hash")
  })

  it("compares matching password and hash as true", async () => {
    const password = "s3cret-password"
    const hash = await hashPassword(password)
    const ok = await comparePassword(password, hash)
    assert.equal(ok, true)
  })

  it("compares a wrong password against a hash as false", async () => {
    const hash = await hashPassword("correct-password")
    const ok = await comparePassword("wrong-password", hash)
    assert.equal(ok, false)
  })

  it("generates unique hashes for the same password", async () => {
    const a = await hashPassword("same-password")
    const b = await hashPassword("same-password")
    assert.notEqual(a, b, "bcrypt salts must produce distinct hashes")
  })
})
