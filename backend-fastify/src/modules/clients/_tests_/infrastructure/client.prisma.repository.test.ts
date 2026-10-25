import { describe, it, mock, beforeEach } from "bun:test"
import assert from "node:assert/strict"

const saleCalls: any[] = []
let saleRows: any[] = []

mock.module("@/config/prisma", () => ({
  prisma: {
    sale: {
      findMany: async (args: any) => {
        saleCalls.push(args)
        return saleRows
      },
    },
  },
}))

const { ClientRepository } = await import("../../infrastructure/client.prisma.repository")

beforeEach(() => {
  saleCalls.length = 0
  saleRows = []
})

describe("ClientRepository.getOutstandingDebts", () => {
  it("returns an empty map without querying when no ids are given", async () => {
    const debts = await ClientRepository.getOutstandingDebts([], "store-1")

    assert.equal(debts.size, 0)
    assert.equal(saleCalls.length, 0)
  })

  it("sums pending balance per client and drops settled balances", async () => {
    saleRows = [
      { client_id: "cli-1", total: "400.00", credit_payments: [{ amount: "50.00" }] },
      { client_id: "cli-1", total: "100.00", credit_payments: [] },
      { client_id: "cli-2", total: "200.00", credit_payments: [{ amount: "200.00" }] },
      { client_id: "cli-3", total: "100.00", credit_payments: [{ amount: "99.995" }] },
    ]

    const debts = await ClientRepository.getOutstandingDebts(["cli-1", "cli-2", "cli-3"], "store-1")

    assert.equal(debts.size, 1)
    assert.equal(debts.get("cli-1"), 450)
    assert.equal(debts.has("cli-2"), false)
    assert.equal(debts.has("cli-3"), false)
  })

  it("queries credit sales of the given clients inside the store", async () => {
    await ClientRepository.getOutstandingDebts(["cli-1", "cli-2"], "store-1")

    assert.equal(saleCalls.length, 1)
    assert.deepEqual(saleCalls[0].where, {
      client_id: { in: ["cli-1", "cli-2"] },
      payment_method: "credito",
      store_id: "store-1",
    })
    assert.deepEqual(saleCalls[0].select, {
      client_id: true,
      total: true,
      credit_payments: { select: { amount: true } },
    })
  })

  it("omits the store filter when no storeId is provided", async () => {
    await ClientRepository.getOutstandingDebts(["cli-1"])

    assert.deepEqual(saleCalls[0].where, {
      client_id: { in: ["cli-1"] },
      payment_method: "credito",
    })
  })
})
