import { describe, it, afterEach } from "node:test"
import assert from "node:assert/strict"
import { env } from "@/config/env"
import { whopBaseUrl } from "../../infrastructure/whop.client"

/**
 * El flag decide contra qué cuenta habla el backend. Importa porque el sandbox tiene su
 * propia base y sus propias credenciales: apuntar mal significa leer datos de prueba en
 * producción, o al revés.
 *
 * Se asigna directo en `env` (y no con `mock.property`) para no dejar mocks de propiedad
 * anidados: en este repo eso ya rompió el `restoreAll` de `node:test` una vez.
 */
describe("whopBaseUrl", () => {
  const original = env.WHOP_SANDBOX

  afterEach(() => {
    env.WHOP_SANDBOX = original
  })

  it("WHOP_SANDBOX=false → apunta a la API de producción", () => {
    env.WHOP_SANDBOX = false
    assert.equal(whopBaseUrl(), "https://api.whop.com/api/v1")
  })

  it("WHOP_SANDBOX=true → apunta a la API de sandbox", () => {
    env.WHOP_SANDBOX = true
    assert.equal(whopBaseUrl(), "https://sandbox-api.whop.com/api/v1")
  })

  it("se resuelve por llamada: cambiar el flag no requiere recargar el módulo", () => {
    env.WHOP_SANDBOX = false
    const production = whopBaseUrl()
    env.WHOP_SANDBOX = true
    const sandbox = whopBaseUrl()

    assert.equal(production, "https://api.whop.com/api/v1")
    assert.equal(sandbox, "https://sandbox-api.whop.com/api/v1")
  })
})
