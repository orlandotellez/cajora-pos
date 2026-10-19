import { describe, it } from "bun:test"
import assert from "node:assert/strict"
import { envSchema } from "@/config/env"

/**
 * El schema es la guarda de seguridad de `EMAIL_VERIFICATION`: desactivar la verificación
 * crea cuentas ya verificadas, así que en producción tiene que ser imposible arrancar así.
 * Se testea el schema y no el proceso, porque el proceso sale con `exit(1)`.
 */
const base = {
  DATABASE_URL: "postgresql://usuario:clave@localhost:5432/pos",
  JWT_SECRET: "x".repeat(40),
  JWT_REFRESH_SECRET: "y".repeat(40),
}

describe("envSchema · EMAIL_VERIFICATION", () => {
  it("por defecto exige la verificación de correo", () => {
    const result = envSchema.safeParse({ ...base, NODE_ENV: "development" })

    assert.equal(result.success, true)
    assert.equal(result.success && result.data.EMAIL_VERIFICATION, true)
  })

  it("en desarrollo se puede desactivar", () => {
    const result = envSchema.safeParse({
      ...base,
      NODE_ENV: "development",
      EMAIL_VERIFICATION: "false",
    })

    assert.equal(result.success, true)
    assert.equal(result.success && result.data.EMAIL_VERIFICATION, false)
  })

  it("en producción NO se puede desactivar (fail closed)", () => {
    const result = envSchema.safeParse({
      ...base,
      NODE_ENV: "production",
      EMAIL_VERIFICATION: "false",
    })

    assert.equal(result.success, false)
  })

  it("en producción con la verificación activa, el entorno es válido", () => {
    const result = envSchema.safeParse({ ...base, NODE_ENV: "production" })

    assert.equal(result.success, true)
  })
})
