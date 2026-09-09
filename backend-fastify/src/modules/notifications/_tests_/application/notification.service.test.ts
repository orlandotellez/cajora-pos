import { describe, it } from "bun:test"
import assert from "node:assert/strict"
import { createNotificationService } from "../../application/notification.service"
import type { INotification, INotificationRepository } from "../../domain/notification.types"

function makeNotification(overrides: Partial<INotification> = {}): INotification {
  return {
    id: "notif-1",
    user_id: "user-1",
    store_id: "store-1",
    type: "subscription_expiring",
    title: "Suscripción por vencer",
    message: "Tu suscripción vence pronto",
    read: false,
    metadata: null,
    created_at: new Date("2026-09-01T10:00:00Z"),
    ...overrides,
  }
}

function makeNotificationRepo(
  overrides: Partial<INotificationRepository> = {},
): INotificationRepository {
  return {
    async create(data) {
      return makeNotification({ ...data, id: "notif-1" } as INotification)
    },
    async findByUserId() {
      return []
    },
    async countUnread() {
      return 0
    },
    async markAsRead() {
      return true
    },
    async markAllAsRead() {
      return 0
    },
    ...overrides,
  }
}

describe("notification service", () => {
  it("create delegates to the repository with the input", async () => {
    let received: any
    const repo = makeNotificationRepo({
      async create(data) {
        received = data
        return makeNotification({ ...data, id: "notif-new" } as INotification)
      },
    })

    const result = await createNotificationService(repo).create({
      user_id: "user-1",
      store_id: "store-1",
      type: "payment_failed",
      title: "Pago fallido",
      message: "No se pudo procesar el pago",
      metadata: { attempt: 2 },
    })

    assert.equal(received.user_id, "user-1")
    assert.equal(received.type, "payment_failed")
    assert.deepEqual(received.metadata, { attempt: 2 })
    assert.equal(result.id, "notif-new")
    assert.equal(result.title, "Pago fallido")
  })

  it("getByUser delegates without options", async () => {
    let receivedUserId: string | undefined
    let receivedOptions: any
    const repo = makeNotificationRepo({
      async findByUserId(userId, options) {
        receivedUserId = userId
        receivedOptions = options
        return [makeNotification()]
      },
    })

    const result = await createNotificationService(repo).getByUser("user-1")

    assert.equal(receivedUserId, "user-1")
    assert.equal(receivedOptions, undefined)
    assert.equal(result.length, 1)
  })

  it("getByUser forwards unreadOnly and limit options", async () => {
    let receivedOptions: any
    const repo = makeNotificationRepo({
      async findByUserId(userId, options) {
        receivedOptions = options
        return []
      },
    })

    await createNotificationService(repo).getByUser("user-1", { unreadOnly: true, limit: 5 })

    assert.deepEqual(receivedOptions, { unreadOnly: true, limit: 5 })
  })

  it("getUnreadCount returns the repository count", async () => {
    const repo = makeNotificationRepo({
      async countUnread() {
        return 3
      },
    })

    const count = await createNotificationService(repo).getUnreadCount("user-1")

    assert.equal(count, 3)
  })

  it("markRead returns true when the repository marks it", async () => {
    let receivedId: string | undefined
    let receivedUserId: string | undefined
    const repo = makeNotificationRepo({
      async markAsRead(id, userId) {
        receivedId = id
        receivedUserId = userId
        return true
      },
    })

    const result = await createNotificationService(repo).markRead("notif-1", "user-1")

    assert.equal(result, true)
    assert.equal(receivedId, "notif-1")
    assert.equal(receivedUserId, "user-1")
  })

  it("markRead returns false when the repository does not own the notification", async () => {
    const repo = makeNotificationRepo({
      async markAsRead() {
        return false
      },
    })

    const result = await createNotificationService(repo).markRead("notif-1", "other-user")

    assert.equal(result, false)
  })

  it("markAllRead returns the number updated by the repository", async () => {
    const repo = makeNotificationRepo({
      async markAllAsRead(userId) {
        assert.equal(userId, "user-1")
        return 7
      },
    })

    const count = await createNotificationService(repo).markAllRead("user-1")

    assert.equal(count, 7)
  })
})