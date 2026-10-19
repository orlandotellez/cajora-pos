import { describe, it, afterEach } from "node:test"
import assert from "node:assert/strict"
import { env } from "@/config/env"
import { AppError } from "@/core/errors/AppError"
import { whopBaseUrl, whopClient } from "../../infrastructure/whop.client"

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

/**
 * El mensaje de error es la única pista que queda en los logs del despliegue. Un 502
 * genérico ocultó un 401 por usar una key de sandbox contra la API de producción, y eso
 * costó una sesión entera de diagnóstico.
 */
describe("whopClient · errores del proveedor", () => {
  const originalFetch = globalThis.fetch
  const originalSandbox = env.WHOP_SANDBOX

  afterEach(() => {
    globalThis.fetch = originalFetch
    env.WHOP_SANDBOX = originalSandbox
  })

  function stubFetch(status: number, body: unknown): void {
    globalThis.fetch = (async () =>
      new Response(JSON.stringify(body), {
        status,
        headers: { "content-type": "application/json" },
      })) as unknown as typeof fetch
  }

  it("incluye el status y el mensaje de Whop (un 401 no debe parecer un fallo temporal)", async () => {
    stubFetch(401, { message: "Authentication failed" })

    await assert.rejects(
      () => whopClient.getMembership("mem_x"),
      (err: unknown) => {
        assert.ok(err instanceof AppError)
        assert.match((err as Error).message, /401/)
        assert.match((err as Error).message, /Authentication failed/)
        return true
      },
    )
  })

  it("un 404 sigue propagándose como 404 (patrón de recurso huérfano)", async () => {
    stubFetch(404, { message: "Not found" })

    await assert.rejects(
      () => whopClient.getMembership("mem_x"),
      (err: unknown) => err instanceof AppError && err.statusCode === 404,
    )
  })
})
