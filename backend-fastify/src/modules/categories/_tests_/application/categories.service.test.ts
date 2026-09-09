import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { createCategoryService } from "../../application/categories.service"
import type { ICategoryRepository } from "../../domain/categories.interface"
import { BadRequestError, ConflictError, NotFoundError } from "@/core/errors/AppError"
import { makeP2002 } from "@/tests/fakes"

function makeCategory(overrides: Record<string, unknown> = {}) {
  return {
    id: "cat-1",
    name: "Bebidas",
    description: "Gaseosas, jugos y aguas",
    created_at: new Date("2026-08-01T09:00:00Z"),
    updated_at: new Date("2026-08-30T15:30:00Z"),
    ...overrides,
  }
}

function makeFakeRepo(overrides: Partial<ICategoryRepository> = {}): ICategoryRepository {
  return {
    findAll: async ({ page = 1, limit = 20 } = {}) => ({
      categories: [makeCategory() as never],
      total: 1,
      page,
      limit,
    }),
    findById: async () => makeCategory() as never,
    create: async (data) => makeCategory({ name: data.name }) as never,
    update: async (_id, data) => makeCategory({ ...data }) as never,
    softDelete: async () => {},
    softDeleteMany: async (ids) => ({ count: ids.length }),
    ...overrides,
  }
}

describe("categories service", () => {
  describe("list", () => {
    it("returns paginated categories", async () => {
      const repo = makeFakeRepo({
        findAll: async ({ page = 1, limit = 20 } = {}) => ({
          categories: [makeCategory(), makeCategory({ id: "cat-2", name: "Lácteos" })],
          total: 2,
          page,
          limit,
        }),
      })
      const service = createCategoryService(repo)

      const result = await service.list({ page: 1, limit: 10 })

      assert.equal(result.total, 2)
      assert.equal(result.page, 1)
      assert.equal(result.limit, 10)
      assert.equal(result.categories.length, 2)
      assert.equal(result.categories[0].name, "Bebidas")
      assert.equal(result.categories[1].name, "Lácteos")
    })
  })

  describe("getById", () => {
    it("returns the category when found", async () => {
      const repo = makeFakeRepo({ findById: async () => makeCategory({ id: "cat-x" }) })
      const service = createCategoryService(repo)

      const category = await service.getById("cat-x", "store-1")

      assert.equal(category.id, "cat-x")
      assert.equal(category.name, "Bebidas")
    })

    it("throws NotFoundError when the category does not exist", async () => {
      const repo = makeFakeRepo({ findById: async () => null })
      const service = createCategoryService(repo)

      await assert.rejects(
        () => service.getById("ghost", "store-1"),
        (err: unknown) => err instanceof NotFoundError
      )
    })

    it("throws NotFoundError when the category is soft-deleted", async () => {
      const repo = makeFakeRepo({
        findById: async () => makeCategory({ deleted_at: new Date("2026-08-31T10:00:00Z") }),
      })
      const service = createCategoryService(repo)

      await assert.rejects(
        () => service.getById("cat-1", "store-1"),
        (err: unknown) => err instanceof NotFoundError
      )
    })
  })

  describe("create", () => {
    it("creates a category", async () => {
      const repo = makeFakeRepo()
      const service = createCategoryService(repo)

      const category = await service.create({ name: "Nuevos" }, "store-1")

      assert.equal(category.name, "Nuevos")
    })

    it("throws BadRequestError when name is empty", async () => {
      const service = createCategoryService(makeFakeRepo())

      await assert.rejects(
        () => service.create({ name: "   " }, "store-1"),
        (err: unknown) => err instanceof BadRequestError
      )
    })

    it("throws ConflictError when the name already exists", async () => {
      const repo = makeFakeRepo({
        create: async () => {
          throw makeP2002()
        },
      })
      const service = createCategoryService(repo)

      await assert.rejects(
        () => service.create({ name: "Bebidas" }, "store-1"),
        (err: unknown) => err instanceof ConflictError
      )
    })
  })

  describe("update", () => {
    it("updates a category partially", async () => {
      const repo = makeFakeRepo({
        update: async (_id, data) => makeCategory({ ...data }),
      })
      const service = createCategoryService(repo)

      const category = await service.update("cat-1", { name: "Refrescos" }, "store-1")

      assert.equal(category.name, "Refrescos")
    })

    it("throws NotFoundError when the category does not exist", async () => {
      const repo = makeFakeRepo({ findById: async () => null })
      const service = createCategoryService(repo)

      await assert.rejects(
        () => service.update("ghost", { name: "X" }, "store-1"),
        (err: unknown) => err instanceof NotFoundError
      )
    })

    it("throws NotFoundError when the category is soft-deleted", async () => {
      const repo = makeFakeRepo({
        findById: async () => makeCategory({ deleted_at: new Date("2026-08-31T10:00:00Z") }),
      })
      const service = createCategoryService(repo)

      await assert.rejects(
        () => service.update("cat-1", { name: "X" }, "store-1"),
        (err: unknown) => err instanceof NotFoundError
      )
    })

    it("throws ConflictError on duplicate name", async () => {
      const repo = makeFakeRepo({
        update: async () => {
          throw makeP2002()
        },
      })
      const service = createCategoryService(repo)

      await assert.rejects(
        () => service.update("cat-1", { name: "Bebidas" }, "store-1"),
        (err: unknown) => err instanceof ConflictError
      )
    })
  })

  describe("delete", () => {
    it("soft deletes an existing category", async () => {
      let softDeleted = false
      const repo = makeFakeRepo({
        softDelete: async () => { softDeleted = true },
      })
      const service = createCategoryService(repo)

      await service.delete("cat-1", "store-1")

      assert.equal(softDeleted, true)
    })

    it("throws NotFoundError when the category does not exist", async () => {
      const repo = makeFakeRepo({ findById: async () => null })
      const service = createCategoryService(repo)

      await assert.rejects(
        () => service.delete("ghost", "store-1"),
        (err: unknown) => err instanceof NotFoundError
      )
    })

    it("throws NotFoundError when the category is already deleted", async () => {
      const repo = makeFakeRepo({
        findById: async () => makeCategory({ deleted_at: new Date("2026-08-31T10:00:00Z") }),
      })
      const service = createCategoryService(repo)

      await assert.rejects(
        () => service.delete("cat-1", "store-1"),
        (err: unknown) => err instanceof NotFoundError
      )
    })
  })

  describe("deleteMany", () => {
    it("returns the number of deleted categories", async () => {
      const repo = makeFakeRepo({
        softDeleteMany: async () => ({ count: 2 }),
      })
      const service = createCategoryService(repo)

      const result = await service.deleteMany(["c1", "c2"], "store-1")

      assert.equal(result.deleted, 2)
    })
  })
})
