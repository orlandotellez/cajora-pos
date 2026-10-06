import { describe, it, beforeEach, afterEach, mock } from "node:test"
import assert from "node:assert/strict"
import jwt from "jsonwebtoken"
import { env } from "@/config/env"
import { ForbiddenError, PaymentRequiredError } from "@/core/errors/AppError"
import { createActiveUserGuard } from "./active-user.guard"
import type { IUserEntity } from "@/modules/users/domain/users.entities"

function makeUser(overrides: Partial<IUserEntity> = {}): IUserEntity {
  return {
    id: "user-1",
    name: "Ana",
    email: "ana@cajorapos.com",
    email_verified: true,
    role: "admin",
    is_owner: true,
    is_active: true,
    access_status: "enabled",
    permissions: [],
    phone: null,
    image: null,
    store_id: "store-1",
    created_at: new Date(),
    updated_at: new Date(),
    deleted_at: null,
    ...overrides,
  }
}

function makeRequest(): { cookies: Record<string, string>; headers: Record<string, string> } {
  const token = jwt.sign(
    { userId: "user-1", role: "admin", storeId: "store-1", storeName: "Tienda" },
    env.JWT_SECRET,
    { expiresIn: "1h" },
  )
  return { cookies: {}, headers: { authorization: `Bearer ${token}` } }
}

function makeGuard(user: IUserEntity | null) {
  const findById = mock.fn((_id: string): Promise<IUserEntity | null> => Promise.resolve(user))
  const guard = createActiveUserGuard({ userRepo: { findById } })
  return { guard, findById }
}

describe("activeUserGuard", () => {
  beforeEach(() => mock.restoreAll())
  afterEach(() => mock.restoreAll())

  it("usuario activo y con acceso → pasa", async () => {
    const { guard } = makeGuard(makeUser())

    await assert.doesNotReject(() => guard(makeRequest() as never, {} as never))
  })

  it("usuario desactivado por la tienda (is_active=false) → 402", async () => {
    const { guard } = makeGuard(makeUser({ is_active: false }))

    await assert.rejects(
      () => guard(makeRequest() as never, {} as never),
      (err: unknown) =>
        err instanceof PaymentRequiredError &&
        err.statusCode === 402 &&
        /desactivado/.test((err as Error).message),
    )
  })

  // El super admin restringe desde su panel con un switch propio: el dueño de la
  // tienda no puede deshacerlo, así que is_active sigue en true.
  it("usuario restringido por el super admin → 403, no 402 (no es un tema de pago)", async () => {
    const { guard } = makeGuard(makeUser({ access_status: "restricted" }))

    await assert.rejects(
      () => guard(makeRequest() as never, {} as never),
      (err: unknown) =>
        err instanceof ForbiddenError &&
        err.statusCode === 403 &&
        err.code === "USER_ACCESS_RESTRICTED",
    )
  })

  it("restringido gana aunque is_active esté en true", async () => {
    const { guard } = makeGuard(makeUser({ is_active: true, access_status: "restricted" }))

    await assert.rejects(
      () => guard(makeRequest() as never, {} as never),
      (err: unknown) => err instanceof ForbiddenError,
    )
  })

  it("desactivado y restringido a la vez → 403 (la restricción es la más específica)", async () => {
    const { guard } = makeGuard(makeUser({ is_active: false, access_status: "restricted" }))

    await assert.rejects(
      () => guard(makeRequest() as never, {} as never),
      (err: unknown) => err instanceof ForbiddenError && err.statusCode === 403,
    )
  })

  it("sin usuario en la DB → pasa (authGuard lo maneja)", async () => {
    const { guard, findById } = makeGuard(null)

    await assert.doesNotReject(() => guard(makeRequest() as never, {} as never))
    assert.equal(findById.mock.callCount(), 1)
  })

  it("sin userId en el token → no consulta el repo y pasa", async () => {
    const { guard, findById } = makeGuard(null)

    await assert.doesNotReject(() =>
      guard({ cookies: {}, headers: {} } as never, {} as never),
    )
    assert.equal(findById.mock.callCount(), 0)
  })
})