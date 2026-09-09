import { describe, it, beforeEach, afterEach, mock } from "bun:test"
import { mock as nodeMock } from "node:test"
import assert from "node:assert/strict"
import { NotFoundError } from "@/core/errors/AppError"

const prismaMocks: Record<string, any> = {
  store: { count: async () => 0, findMany: async () => [], findUnique: async () => null },
  user: { groupBy: async () => [], findMany: async () => [] },
  product: { count: async () => 0, groupBy: async () => [] },
  service: { groupBy: async () => [] },
  sale: { count: async () => 0 },
  subscription: {
    groupBy: async () => [],
    findMany: async () => [],
    count: async () => 0,
  },
  subscription_event: { findMany: async () => [], count: async () => 0 },
  $queryRaw: async () => [],
}

const subscriptionRepoMocks = {
  update: async () => ({
    id: "sub-1",
    store_id: "store-1",
    status: "active",
    paypal_subscription_id: "I-ABC123",
    updated_at: new Date("2026-09-02T10:00:00Z"),
  }),
}

const subscriptionEventRepoMocks = {
  create: async () => ({}),
}

mock.module("@/config/prisma", () => ({
  prisma: prismaMocks,
}))

const { createSuperAdminService } = await import("../../application/super-admin.service")

const superAdminService = createSuperAdminService({
  subscriptionRepo: subscriptionRepoMocks,
  eventRepo: subscriptionEventRepoMocks,
})

function makeStore(overrides: Record<string, any> = {}): any {
  return {
    id: "store-1",
    name: "Tienda Uno",
    address: "Av. Principal",
    phone: "555-0000",
    created_at: new Date("2026-06-01T10:00:00Z"),
    users: [{ name: "Owner Uno", email: "owner@store.com" }],
    subscription: {
      mode: "cloud",
      plan: "pro",
      status: "active",
      current_period_end: new Date("2026-10-01T10:00:00Z"),
      cancel_at_period_end: false,
    },
    ...overrides,
  }
}

function makeProblemSub(overrides: Record<string, any> = {}): any {
  return {
    id: "sub-1",
    store_id: "store-1",
    store: { name: "Tienda Uno" },
    status: "past_due",
    plan: "pro",
    mode: "cloud",
    current_period_end: null,
    cancel_at_period_end: false,
    ...overrides,
  }
}

function makeSubscriptionEvent(overrides: Record<string, any> = {}): any {
  return {
    id: "event-1",
    store_id: "store-1",
    store: { name: "Tienda Uno" },
    user_id: "user-1",
    user: { name: "Usuario Uno", email: "user@store.com" },
    action: "webhook_payment_failed",
    paypal_subscription_id: "I-ABC123",
    metadata: null,
    created_at: new Date("2026-09-01T10:00:00Z"),
    ...overrides,
  }
}

beforeEach(() => {
  prismaMocks.store.count = async () => 0
  prismaMocks.store.findMany = async () => []
  prismaMocks.store.findUnique = async () => null
  prismaMocks.user.groupBy = async () => []
  prismaMocks.user.findMany = async () => []
  prismaMocks.product.count = async () => 0
  prismaMocks.product.groupBy = async () => []
  prismaMocks.service.groupBy = async () => []
  prismaMocks.sale.count = async () => 0
  prismaMocks.subscription.groupBy = async () => []
  prismaMocks.subscription.findMany = async () => []
  prismaMocks.subscription.count = async () => 0
  prismaMocks.subscription_event.findMany = async () => []
  prismaMocks.subscription_event.count = async () => 0
  prismaMocks.$queryRaw = async () => []
  subscriptionRepoMocks.update = async () => ({
    id: "sub-1",
    store_id: "store-1",
    status: "active",
    paypal_subscription_id: "I-ABC123",
    updated_at: new Date("2026-09-02T10:00:00Z"),
  })
  subscriptionEventRepoMocks.create = async () => ({})
})

afterEach(() => {
  mock.restore()
  nodeMock.timers.reset()
})

describe("super-admin service", () => {
  describe("getStats", () => {
    it("aggregates stores, users, products and sales counts", async () => {
      prismaMocks.store.count = async () => 5
      prismaMocks.user.groupBy = async () => [
        { role: "admin", _count: { _all: 2 } },
        { role: "cajero", _count: { _all: 3 } },
        { role: "super_admin", _count: { _all: 1 } },
      ]
      prismaMocks.product.count = async () => 40
      prismaMocks.$queryRaw = async () => [{ count: 4 }]
      prismaMocks.sale.count = async () => 100

      const result = await superAdminService.getStats()

      assert.equal(result.stores.total, 5)
      assert.equal(result.users.admins, 2)
      assert.equal(result.users.cashiers, 3)
      assert.equal(result.users.super_admins, 1)
      assert.equal(result.users.total, 5)
      assert.equal(result.products.total, 40)
      assert.equal(result.products.low_stock, 4)
      assert.equal(result.sales.total, 100)
    })

    it("returns zero counts when no data exists", async () => {
      const result = await superAdminService.getStats()

      assert.equal(result.stores.total, 0)
      assert.equal(result.users.total, 0)
      assert.equal(result.products.low_stock, 0)
      assert.equal(result.sales.today, 0)
    })
  })

  describe("getStores", () => {
    it("maps stores with owner, subscription and per-store counts", async () => {
      prismaMocks.store.findMany = async () => [makeStore()]
      prismaMocks.user.groupBy = async () => [
        { store_id: "store-1", _count: { _all: 2 } },
      ]
      prismaMocks.product.groupBy = async () => [
        { store_id: "store-1", _count: { _all: 10 } },
      ]
      prismaMocks.service.groupBy = async () => [
        { store_id: "store-1", _count: { _all: 5 } },
      ]

      const result = await superAdminService.getStores()

      assert.equal(result.total, 1)
      const store = result.stores[0]
      assert.equal(store.name, "Tienda Uno")
      assert.equal(store.owner_name, "Owner Uno")
      assert.equal(store.subscription_mode, "cloud")
      assert.equal(store.subscription_plan, "pro")
      assert.equal(store.users_count, 2)
      assert.equal(store.products_count, 10)
      assert.equal(store.services_count, 5)
      assert.equal(
        store.subscription_period_end,
        "2026-10-01T10:00:00.000Z",
      )
    })

    it("handles stores without owner or subscription", async () => {
      prismaMocks.store.findMany = async () => [
        makeStore({ users: [], subscription: null }),
      ]
      prismaMocks.user.groupBy = async () => []
      prismaMocks.product.groupBy = async () => []
      prismaMocks.service.groupBy = async () => []

      const result = await superAdminService.getStores()

      assert.equal(result.stores[0].owner_name, null)
      assert.equal(result.stores[0].subscription_mode, null)
      assert.equal(result.stores[0].subscription_period_end, null)
      assert.equal(result.stores[0].users_count, 0)
    })
  })

  describe("getStoreUsers", () => {
    it("throws NotFound when the store does not exist", async () => {
      prismaMocks.store.findUnique = async () => null

      await assert.rejects(
        superAdminService.getStoreUsers("missing"),
        NotFoundError,
      )
    })

    it("returns the store users sorted by creation", async () => {
      prismaMocks.store.findUnique = async () => ({ id: "store-1" })
      prismaMocks.user.findMany = async () => [
        {
          id: "user-1",
          name: "Usuario Uno",
          email: "u1@store.com",
          email_verified: true,
          role: "admin",
          is_owner: true,
          phone: "555-0001",
          created_at: new Date("2026-06-01T10:00:00Z"),
          deleted_at: null,
        },
      ]

      const result = await superAdminService.getStoreUsers("store-1")

      assert.equal(result.total, 1)
      assert.equal(result.users[0].name, "Usuario Uno")
      assert.equal(result.users[0].is_owner, true)
    })
  })

  describe("getSubscriptionEvents", () => {
    it("maps events with store and user names and returns the total", async () => {
      prismaMocks.subscription_event.findMany = async () => [makeSubscriptionEvent()]
      prismaMocks.subscription_event.count = async () => 1

      const result = await superAdminService.getSubscriptionEvents({})

      assert.equal(result.events.length, 1)
      assert.equal(result.total, 1)
      const event = result.events[0]
      assert.equal(event.store_name, "Tienda Uno")
      assert.equal(event.user_name, "Usuario Uno")
      assert.equal(event.user_email, "user@store.com")
      assert.equal(event.action, "webhook_payment_failed")
    })

    it("passes store, user, action and date filters to the query", async () => {
      let findManyArgs: any
      prismaMocks.subscription_event.findMany = async (args: any) => {
        findManyArgs = args
        return []
      }
      prismaMocks.subscription_event.count = async () => 0

      await superAdminService.getSubscriptionEvents({
        store_id: "store-1",
        user_id: "user-1",
        action: "webhook_payment_failed",
        from: "2026-08-01",
        to: "2026-08-31",
        offset: 10,
        limit: 5,
      })

      assert.equal(findManyArgs.where.store_id, "store-1")
      assert.equal(findManyArgs.where.user_id, "user-1")
      assert.equal(findManyArgs.where.action, "webhook_payment_failed")
      assert.equal(
        findManyArgs.where.created_at.gte.toISOString(),
        new Date("2026-08-01").toISOString(),
      )
      assert.equal(
        findManyArgs.where.created_at.lte.toISOString(),
        new Date("2026-08-31").toISOString(),
      )
      assert.equal(findManyArgs.skip, 10)
      assert.equal(findManyArgs.take, 5)
    })
  })

  describe("getSubscriptionHealth", () => {
    it("summarizes counts by status and mode and flags problem stores", async () => {
      nodeMock.timers.enable({ now: new Date("2026-09-01T00:00:00Z") })
      prismaMocks.subscription.groupBy = async () => [
        { status: "active", _count: { _all: 2 } },
        { status: "past_due", _count: { _all: 1 } },
        { status: "canceled", _count: { _all: 0 } },
        { status: "expired", _count: { _all: 0 } },
        { status: "pending", _count: { _all: 0 } },
      ]
      prismaMocks.subscription.findMany = async () => [
        makeProblemSub({
          current_period_end: new Date("2026-09-06T00:00:00Z"),
        }),
      ]
      prismaMocks.user.findMany = async () => [
        { store_id: "store-1", name: "Owner Uno", email: "owner@store.com" },
      ]
      prismaMocks.subscription_event.findMany = async () => [
        { store_id: "store-1", action: "webhook_payment_failed", created_at: new Date("2026-09-01T10:00:00Z") },
      ]

      const result = await superAdminService.getSubscriptionHealth()

      assert.equal(result.summary.total, 3)
      assert.equal(result.summary.active, 2)
      assert.equal(result.summary.past_due, 1)
      assert.equal(result.summary.cloud_total, 0)

      const store = result.problem_stores[0]
      assert.equal(store.store_name, "Tienda Uno")
      assert.equal(store.owner_name, "Owner Uno")
      assert.equal(store.status, "past_due")
      assert.equal(store.last_event_action, "webhook_payment_failed")
      assert.equal(store.days_until_expiry, 5)
    })

    it("handles problem stores without owners or events", async () => {
      prismaMocks.subscription.groupBy = async () => []
      prismaMocks.subscription.findMany = async () => [
        makeProblemSub({ store: null, current_period_end: null }),
      ]
      prismaMocks.user.findMany = async () => []
      prismaMocks.subscription_event.findMany = async () => []

      const result = await superAdminService.getSubscriptionHealth()

      assert.equal(result.summary.total, 0)
      assert.equal(result.problem_stores[0].store_name, "Desconocida")
      assert.equal(result.problem_stores[0].owner_name, null)
      assert.equal(result.problem_stores[0].last_event_action, null)
      assert.equal(result.problem_stores[0].days_until_expiry, null)
      assert.equal(result.recent_events.length, 0)
    })
  })

  describe("getSubscriptionsList", () => {
    it("maps subscriptions with owner, dates and expiry days", async () => {
      nodeMock.timers.enable({ now: new Date("2026-09-01T00:00:00Z") })
      prismaMocks.subscription.findMany = async () => [
        {
          id: "sub-1",
          store_id: "store-1",
          store: {
            name: "Tienda Uno",
            users: [{ name: "Owner Uno", email: "owner@store.com" }],
          },
          mode: "cloud",
          plan: "pro",
          status: "active",
          paypal_subscription_id: "I-ABC123",
          current_period_start: new Date("2026-08-01T00:00:00Z"),
          current_period_end: new Date("2026-09-08T00:00:00Z"),
          cancel_at_period_end: false,
          created_at: new Date("2026-06-01T00:00:00Z"),
          updated_at: new Date("2026-08-01T00:00:00Z"),
        },
      ]
      prismaMocks.subscription.count = async () => 1

      const result = await superAdminService.getSubscriptionsList({
        offset: 0,
        limit: 20,
      })

      assert.equal(result.total, 1)
      const sub = result.subscriptions[0]
      assert.equal(sub.store_name, "Tienda Uno")
      assert.equal(sub.owner_name, "Owner Uno")
      assert.equal(sub.status, "active")
      assert.equal(sub.days_until_expiry, 7)
      assert.equal(sub.current_period_end, "2026-09-08T00:00:00.000Z")
    })

    it("applies status, mode and search filters", async () => {
      let findManyArgs: any
      prismaMocks.subscription.findMany = async (args: any) => {
        findManyArgs = args
        return []
      }
      prismaMocks.subscription.count = async () => 0

      await superAdminService.getSubscriptionsList({
        status: "past_due",
        mode: "cloud",
        search: "tienda",
        offset: 0,
        limit: 10,
      })

      assert.equal(findManyArgs.where.status, "past_due")
      assert.equal(findManyArgs.where.mode, "cloud")
      assert.ok(Array.isArray(findManyArgs.where.OR))
      assert.equal(findManyArgs.where.OR.length, 3)
      assert.equal(findManyArgs.skip, 0)
      assert.equal(findManyArgs.take, 10)
    })

    it("returns null expiry days when the period has no end date", async () => {
      prismaMocks.subscription.findMany = async () => [
        {
          id: "sub-1",
          store_id: "store-1",
          store: { name: "Tienda Uno", users: [] },
          mode: "self_hosted",
          plan: "free",
          status: "active",
          paypal_subscription_id: null,
          current_period_start: null,
          current_period_end: null,
          cancel_at_period_end: false,
          created_at: new Date("2026-06-01T00:00:00Z"),
          updated_at: new Date("2026-08-01T00:00:00Z"),
        },
      ]
      prismaMocks.subscription.count = async () => 1

      const result = await superAdminService.getSubscriptionsList({
        offset: 0,
        limit: 10,
      })

      assert.equal(result.subscriptions[0].days_until_expiry, null)
      assert.equal(result.subscriptions[0].current_period_start, null)
      assert.equal(result.subscriptions[0].paypal_subscription_id, null)
    })
  })

  describe("updateSubscriptionStatus", () => {
    it("updates the subscription and records an audit event", async () => {
      let updateArgs: any
      let eventArgs: any
      subscriptionRepoMocks.update = async (storeId: string, data: any) => {
        updateArgs = { storeId, data }
        return {
          id: "sub-1",
          store_id: "store-1",
          status: "active",
          paypal_subscription_id: "I-ABC123",
          updated_at: new Date("2026-09-02T10:00:00Z"),
        }
      }
      subscriptionEventRepoMocks.create = async (args: any) => {
        eventArgs = args
        return {}
      }

      const result = await superAdminService.updateSubscriptionStatus("store-1", "canceled")

      assert.deepEqual(updateArgs, { storeId: "store-1", data: { status: "canceled" } })
      assert.equal(eventArgs.store_id, "store-1")
      assert.equal(eventArgs.user_id, null)
      assert.equal(eventArgs.action, "admin_status_change")
      assert.deepEqual(eventArgs.metadata, {
        new_status: "canceled",
        source: "super_admin_panel",
      })
      assert.equal(result?.store_id, "store-1")
      assert.equal(result?.status, "active")
    })

    it("returns null and does not record an event when the update fails", async () => {
      subscriptionRepoMocks.update = async () => null
      let eventCalled = false
      subscriptionEventRepoMocks.create = async () => {
        eventCalled = true
        return {}
      }

      const result = await superAdminService.updateSubscriptionStatus("store-1", "canceled")

      assert.equal(result, null)
      assert.equal(eventCalled, false)
    })
  })
})