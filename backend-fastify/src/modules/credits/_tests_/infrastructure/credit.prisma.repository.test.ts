import { describe, it, mock, beforeEach } from "bun:test"
import assert from "node:assert/strict"

type QueryCall = { sql: string; args: any[] }

const queryCalls: QueryCall[] = []
let queryHandler: (sql: string, args: any[]) => any[] = () => []

mock.module("@/config/prisma", () => ({
  prisma: {
    $queryRawUnsafe: async (sql: string, ...args: any[]) => {
      queryCalls.push({ sql, args })
      return queryHandler(sql, args)
    },
  },
}))

const { CreditRepository } = await import("../../infrastructure/credit.prisma.repository")

beforeEach(() => {
  queryCalls.length = 0
  queryHandler = () => []
})

function listCalls(): QueryCall[] {
  return queryCalls.filter((call) => call.sql.includes("as sale_count"))
}

function countCalls(): QueryCall[] {
  return queryCalls.filter((call) => call.sql.includes("as total FROM"))
}

describe("CreditRepository.getClientsWithDebt", () => {
  it("aggregates a per-sale pending CTE without hiding soft-deleted debtors", async () => {
    queryHandler = (sql) =>
      sql.includes("as total FROM")
        ? [{ total: 1 }]
        : [
            {
              client_id: "cli-1",
              client_name: "Juan Pérez",
              client_phone: null,
              client_deleted: true,
              total_debt: "350.00",
              sale_count: 3,
              oldest_pending_days: 45,
            },
          ]

    const result = await CreditRepository.getClientsWithDebt({ storeId: "store-1", page: 2, limit: 10 })

    const [list, count] = [listCalls()[0], countCalls()[0]]
    assert.match(list.sql, /WITH sale_pending AS/)
    assert.match(list.sql, /s\.payment_method = 'credito' AND s\.client_id IS NOT NULL/)
    assert.match(list.sql, /c\.deleted_at IS NOT NULL/)
    assert.doesNotMatch(list.sql, /c\.deleted_at IS NULL/)
    assert.match(list.sql, /COUNT\(\*\)::int as sale_count/)
    assert.match(list.sql, /MIN\(sp\.created_at\) FILTER \(WHERE sp\.pending > 0\.009\)/)
    assert.match(list.sql, /LIMIT \$2::int OFFSET \$3::int/)
    assert.deepEqual(list.args, ["store-1", 10, 10])

    assert.match(count.sql, /WITH sale_pending AS/)
    assert.deepEqual(count.args, ["store-1"])

    assert.equal(result.clients.length, 1)
    assert.equal(result.clients[0].client_deleted, true)
    assert.equal(result.clients[0].total_debt, 350)
    assert.equal(result.clients[0].sale_count, 3)
    assert.equal(result.clients[0].oldest_pending_days, 45)
    assert.equal(result.total, 1)
    assert.equal(result.page, 2)
    assert.equal(result.limit, 10)
  })

  it("keeps the safe parameter numbering with store and search", async () => {
    await CreditRepository.getClientsWithDebt({ storeId: "store-1", search: "juan", page: 1, limit: 25 })

    const list = listCalls()[0]
    assert.match(list.sql, /c\.name ILIKE \$2::text OR c\.phone ILIKE \$2::text/)
    assert.match(list.sql, /s\.store_id = \$1::text/)
    assert.match(list.sql, /LIMIT \$3::int OFFSET \$4::int/)
    assert.deepEqual(list.args, ["store-1", "%juan%", 25, 0])
    assert.deepEqual(countCalls()[0].args, ["store-1", "%juan%"])
  })

  it("filters outstanding debtors with the pending sum only", async () => {
    await CreditRepository.getClientsWithDebt({ storeId: "store-1", filter: "todos" })

    assert.match(listCalls()[0].sql, /HAVING SUM\(sp\.pending\) > 0\.009/)
    assert.match(countCalls()[0].sql, /HAVING SUM\(sp\.pending\) > 0\.009/)
  })

  it("excludes soft-deleted clients from the settled filter in list and count", async () => {
    await CreditRepository.getClientsWithDebt({ storeId: "store-1", filter: "saldados" })

    assert.match(
      listCalls()[0].sql,
      /HAVING ABS\(SUM\(sp\.pending\)\) <= 0\.009 AND c\.deleted_at IS NULL/,
    )
    assert.match(
      countCalls()[0].sql,
      /HAVING ABS\(SUM\(sp\.pending\)\) <= 0\.009 AND c\.deleted_at IS NULL/,
    )
  })

  it("computes overdue clients from the oldest sale that still has a balance", async () => {
    await CreditRepository.getClientsWithDebt({ storeId: "store-1", filter: "morosos" })

    const overdue = /HAVING SUM\(sp\.pending\) > 0\.009 AND MIN\(sp\.created_at\) FILTER \(WHERE sp\.pending > 0\.009\) < NOW\(\) - INTERVAL '30 days'/
    assert.match(listCalls()[0].sql, overdue)
    assert.match(countCalls()[0].sql, overdue)
  })
})

describe("CreditRepository.getSummary", () => {
  it("returns the store-wide summary with numeric fields", async () => {
    queryHandler = () => [
      { total_pending: "1234.56", debtors_count: "3", overdue_count: "2", credit_sales_count: "7" },
    ]

    const summary = await CreditRepository.getSummary("store-1")

    assert.deepEqual(summary, {
      total_pending: 1234.56,
      debtors_count: 3,
      overdue_count: 2,
      credit_sales_count: 7,
    })
    assert.deepEqual(queryCalls[0].args, ["store-1"])
    assert.match(queryCalls[0].sql, /WITH sale_pending AS/)
    assert.match(queryCalls[0].sql, /s\.store_id = \$1::text/)
    assert.doesNotMatch(queryCalls[0].sql, /c\.deleted_at IS NULL/)
  })

  it("returns zeros when the store has no credit sales", async () => {
    const summary = await CreditRepository.getSummary("store-1")

    assert.deepEqual(summary, {
      total_pending: 0,
      debtors_count: 0,
      overdue_count: 0,
      credit_sales_count: 0,
    })
  })
})

describe("CreditRepository.getTotalPending", () => {
  it("returns the same number as the summary total pending", async () => {
    queryHandler = () => [
      { total_pending: "900.00", debtors_count: 2, overdue_count: 1, credit_sales_count: 4 },
    ]

    const total = await CreditRepository.getTotalPending("store-1")
    const summary = await CreditRepository.getSummary("store-1")

    assert.equal(total, 900)
    assert.equal(total, summary.total_pending)
  })
})
