import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { createUserService } from "../../application/users.service"
import type { IUserRepository } from "../../domain/users.interface"
import type { IUserEntity } from "../../domain/users.entities"
import { ConflictError, NotFoundError } from "@/core/errors/AppError"

function makeUser(overrides: Partial<IUserEntity> = {}): IUserEntity {
  return {
    id: "user-1",
    name: "John Doe",
    email: "john@example.com",
    email_verified: true,
    role: "ADMIN" as IUserEntity["role"],
    is_owner: true,
    is_active: true,
    permissions: ["catalog_read"],
    phone: "+5491155551234",
    image: null,
    store_id: "store-1",
    created_at: new Date("2026-08-01T09:00:00Z"),
    updated_at: new Date("2026-08-30T15:30:00Z"),
    ...overrides,
  }
}

function makeFakeRepo(overrides: Partial<IUserRepository> = {}): IUserRepository {
  return {
    findAll: async ({ page = 1, limit = 20 } = {}) => ({ users: [makeUser()], total: 1, page, limit }),
    findById: async () => makeUser(),
    findByEmail: async () => null,
    create: async (data) => makeUser({ email: data.email, name: data.name }),
    update: async (id, data) => makeUser({ ...data }),
    softDelete: async () => {},
    softDeleteMany: async (ids) => ({ count: ids.length }),
    updatePassword: async () => {},
    ...overrides,
  }
}

describe("users service", () => {
  describe("list", () => {
    it("returns paginated users and total", async () => {
      const repo = makeFakeRepo({
        findAll: async ({ page = 1, limit = 20 } = {}) => ({
          users: [makeUser(), makeUser({ id: "user-2", email: "jane@example.com" })],
          total: 2,
          page,
          limit,
        }),
      })
      const service = createUserService(repo)

      const result = await service.list({ page: 2, limit: 10 })

      assert.equal(result.total, 2)
      assert.equal(result.page, 2)
      assert.equal(result.limit, 10)
      assert.equal(result.users.length, 2)
      assert.equal(result.users[0].id, "user-1")
      assert.equal(result.users[1].email, "jane@example.com")
    })
  })

  describe("getById", () => {
    it("returns the user when found", async () => {
      const repo = makeFakeRepo({ findById: async () => makeUser({ id: "abc" }) })
      const service = createUserService(repo)

      const user = await service.getById("abc")

      assert.equal(user.id, "abc")
      assert.equal(user.name, "John Doe")
    })

    it("throws NotFoundError when the user does not exist", async () => {
      const repo = makeFakeRepo({ findById: async () => null })
      const service = createUserService(repo)

      await assert.rejects(
        () => service.getById("ghost"),
        (err: unknown) => err instanceof NotFoundError
      )
    })
  })

  describe("create", () => {
    it("creates a user and hashes the password", async () => {
      let captured: { name: string; email: string; password: string } | undefined
      const repo = makeFakeRepo({
        create: async (data) => {
          captured = { name: data.name, email: data.email, password: data.password }
          return makeUser({ name: data.name, email: data.email })
        },
      })
      const service = createUserService(repo)

      const user = await service.create({ name: "New User", email: "new@example.com", password: "plainpass" }, "store-1")

      assert.equal(user.name, "New User")
      assert.equal(user.email, "new@example.com")
      assert.ok(captured)
      assert.notEqual(captured.password, "plainpass")
      assert.ok(captured.password.length > 0)
    })

    it("throws ConflictError when the email already exists", async () => {
      const repo = makeFakeRepo({ findByEmail: async () => makeUser() })
      const service = createUserService(repo)

      await assert.rejects(
        () => service.create({ name: "New", email: "john@example.com", password: "secret" }, "store-1"),
        (err: unknown) => err instanceof ConflictError
      )
    })
  })

  describe("update", () => {
    it("updates a user with partial data", async () => {
      const repo = makeFakeRepo({
        update: async (_id, data) => makeUser({ ...data }),
      })
      const service = createUserService(repo)

      const user = await service.update("user-1", { name: "Jane" }, "store-1")

      assert.equal(user.name, "Jane")
    })

    it("throws NotFoundError when the user does not exist", async () => {
      const repo = makeFakeRepo({ findById: async () => null })
      const service = createUserService(repo)

      await assert.rejects(
        () => service.update("ghost", { name: "Jane" }, "store-1"),
        (err: unknown) => err instanceof NotFoundError
      )
    })

    it("throws ConflictError when the new email is already taken by another user", async () => {
      const repo = makeFakeRepo({
        findById: async () => makeUser({ email: "current@example.com" }),
        findByEmail: async () => makeUser({ id: "other", email: "taken@example.com" }),
      })
      const service = createUserService(repo)

      await assert.rejects(
        () => service.update("user-1", { email: "taken@example.com" }, "store-1"),
        (err: unknown) => err instanceof ConflictError
      )
    })

    it("allows keeping the same email without a conflict check", async () => {
      let duplicateChecked = false
      const repo = makeFakeRepo({
        findById: async () => makeUser({ email: "same@example.com" }),
        findByEmail: async () => {
          duplicateChecked = true
          return makeUser()
        },
        update: async (_id, data) => makeUser({ ...data, email: "same@example.com" }),
      })
      const service = createUserService(repo)

      const user = await service.update("user-1", { email: "same@example.com" }, "store-1")

      assert.equal(user.email, "same@example.com")
      assert.equal(duplicateChecked, false)
    })
  })

  describe("delete", () => {
    it("soft deletes an existing user", async () => {
      let softDeleted = false
      const repo = makeFakeRepo({
        softDelete: async () => { softDeleted = true },
      })
      const service = createUserService(repo)

      await service.delete("user-1")

      assert.equal(softDeleted, true)
    })

    it("throws NotFoundError when the user does not exist", async () => {
      const repo = makeFakeRepo({ findById: async () => null })
      const service = createUserService(repo)

      await assert.rejects(
        () => service.delete("ghost"),
        (err: unknown) => err instanceof NotFoundError
      )
    })
  })

  describe("deleteMany", () => {
    it("returns the number of deleted users", async () => {
      const repo = makeFakeRepo({
        softDeleteMany: async () => ({ count: 3 }),
      })
      const service = createUserService(repo)

      const result = await service.deleteMany(["u1", "u2", "u3"])

      assert.equal(result.deleted, 3)
    })
  })

  describe("toggleActive", () => {
    it("activates a user", async () => {
      const repo = makeFakeRepo({
        update: async (_id, data) => makeUser({ ...data, is_active: true }),
      })
      const service = createUserService(repo)

      const user = await service.toggleActive("user-1", true)

      assert.equal(user.is_active, true)
    })

    it("deactivates a user", async () => {
      const repo = makeFakeRepo({
        update: async (_id, data) => makeUser({ ...data, is_active: false }),
      })
      const service = createUserService(repo)

      const user = await service.toggleActive("user-1", false)

      assert.equal(user.is_active, false)
    })

    it("throws NotFoundError when the user does not exist", async () => {
      const repo = makeFakeRepo({ findById: async () => null })
      const service = createUserService(repo)

      await assert.rejects(
        () => service.toggleActive("ghost", true),
        (err: unknown) => err instanceof NotFoundError
      )
    })
  })
})
