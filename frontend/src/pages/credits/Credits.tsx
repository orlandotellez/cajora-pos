import { useMemo, useState } from "react"
import { creditsApi, type ClientDebtSummary, type ClientDebtResponse } from "@/api/credits"
import { money } from "@/lib/format"
import { usePosStore } from "@/store/posStore"
import { useCrudPagination } from "@/hooks/useCrudPagination"
import { DataTable, type Column } from "@/components/common/DataTable"
import { useToast } from "@/components/common/ui/Toast"
import { SlidePanel } from "@/components/common/ui/SlidePanel"
import styles from "./Credits.module.css"

type FilterTab = "todos" | "morosos" | "saldados"

const TABS: { value: FilterTab; label: string }[] = [
  { value: "todos", label: "Todos" },
  { value: "morosos", label: "Morosos" },
  { value: "saldados", label: "Saldados" },
]

type DebtRow = ClientDebtSummary & { id: string }

const OVERDUE_DAYS = 30

export default function Credits() {
  const currency = usePosStore((s) => s.currency)
  const { toast } = useToast()

  const [activeTab, setActiveTab] = useState<FilterTab>("todos")
  const [selected, setSelected] = useState<ClientDebtResponse | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [showPayment, setShowPayment] = useState<string | null>(null)
  const [payAmount, setPayAmount] = useState("")
  const [payMethod, setPayMethod] = useState("efectivo")
  const [payNotes, setPayNotes] = useState("")
  const [paying, setPaying] = useState(false)

  const {
    items: rawClients,
    total,
    page,
    q,
    loading,
    totalPages,
    setSearch,
    setPage,
    refreshImmediate,
  } = useCrudPagination<DebtRow>({
    fetcher: ({ page, limit, search, extraFilters }) =>
      creditsApi
        .list({ search: search || undefined, page, limit, filter: (extraFilters.filter as FilterTab) || "todos" })
        .then((res) => ({
          items: res.clients.map((c) => ({ ...c, id: c.client_id })),
          total: res.total,
        })),
    extraFilters: { filter: activeTab },
  })

  const [totalPending, setTotalPending] = useState(0)
  useMemo(() => {
    creditsApi.getTotal().then((res) => setTotalPending(res.total)).catch(() => {})
  }, [])

  const overdueCount = rawClients.filter((c) => c.oldest_pending_days != null && c.oldest_pending_days > OVERDUE_DAYS).length
  const creditSalesCount = rawClients.reduce((acc, c) => acc + c.sale_count, 0)

  async function openDetail(clientId: string) {
    setLoadingDetail(true)
    try {
      const data = await creditsApi.getClientDebt(clientId)
      setSelected(data)
    } catch {
      toast("Error al cargar detalle", "error")
    } finally {
      setLoadingDetail(false)
    }
  }

  async function handlePay(saleId: string, clientId: string, pending: number) {
    const amount = parseFloat(payAmount)
    if (!amount || amount <= 0) { toast("Ingresa un monto válido", "error"); return }
    if (amount > pending + 0.009) { toast(`El monto excede el pendiente de ${money(pending, currency)}`, "error"); return }

    setPaying(true)
    try {
      await creditsApi.registerPayment({
        sale_id: saleId,
        client_id: clientId,
        amount,
        payment_method: payMethod,
        notes: payNotes || undefined,
      })
      toast("Pago registrado correctamente", "success")
      setShowPayment(null)
      setPayAmount("")
      setPayNotes("")
      const data = await creditsApi.getClientDebt(clientId)
      setSelected(data)
      refreshImmediate()
    } catch (err: any) {
      toast(err?.message || "Error al registrar pago", "error")
    } finally {
      setPaying(false)
    }
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" })
  }

  const columns: Column<DebtRow>[] = useMemo(
    () => [
      {
        key: "client_name",
        label: "Cliente",
        render: (c) => <span style={{ fontWeight: 500 }}>{c.client_name}</span>,
      },
      {
        key: "client_phone",
        label: "Teléfono",
        render: (c) => <>{c.client_phone ?? "—"}</>,
      },
      {
        key: "sale_count",
        label: "Ventas a crédito",
        align: "right",
        render: (c) => <>{c.sale_count} venta{c.sale_count !== 1 ? "s" : ""}</>,
      },
      {
        key: "total_debt",
        label: "Deuda total",
        align: "right",
        render: (c) => <span style={{ fontWeight: 600, color: "#dc2626" }}>{money(c.total_debt, currency)}</span>,
      },
      {
        key: "oldest_pending_days",
        label: "Morosidad",
        align: "center",
        render: (c) => {
          if (c.oldest_pending_days != null && c.oldest_pending_days > OVERDUE_DAYS) {
            return (
              <span style={{
                fontSize: 11,
                fontWeight: 600,
                color: "#dc2626",
                background: "rgba(220, 38, 38, 0.1)",
                padding: "2px 6px",
                borderRadius: 5,
              }}>
                {c.oldest_pending_days} días
              </span>
            )
          }
          return <span style={{ color: "var(--muted-foreground)" }}>—</span>
        },
      },
    ],
    [currency],
  )

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.h1}>Cuentas por Cobrar</h1>
          <p className={styles.subtitle}>
            {loading && rawClients.length === 0 ? (
              <span className={styles.headerSkeleton} aria-hidden="true" />
            ) : (
              <>Total pendiente: <strong>{money(totalPending, currency)}</strong></>
            )}
          </p>
        </div>
        <input
          type="text"
          placeholder="Buscar cliente..."
          value={q}
          onChange={(e) => setSearch(e.target.value)}
          className={styles.searchInput}
        />
      </header>

      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Total pendiente</span>
          <span className={styles.statValue}>{loading && rawClients.length === 0 ? <span className={styles.skeleton} aria-hidden="true" /> : money(totalPending, currency)}</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Clientes adeudando</span>
          <span className={styles.statValue}>{loading && rawClients.length === 0 ? <span className={styles.skeleton} aria-hidden="true" /> : rawClients.length}</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Morosos (+{OVERDUE_DAYS} días)</span>
          <span className={`${styles.statValue} ${overdueCount > 0 && !(loading && rawClients.length === 0) ? styles.statDanger : ""}`}>{loading && rawClients.length === 0 ? <span className={styles.skeleton} aria-hidden="true" /> : overdueCount}</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Ventas a crédito</span>
          <span className={styles.statValue}>{loading && rawClients.length === 0 ? <span className={styles.skeleton} aria-hidden="true" /> : creditSalesCount}</span>
        </div>
      </div>

      <div className={styles.tabs}>
        {TABS.map((tab) => (
          <button
            key={tab.value}
            className={`${styles.tab} ${activeTab === tab.value ? styles.tabActive : ""}`}
            onClick={() => { setActiveTab(tab.value); setPage(1) }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <DataTable
        columns={columns}
        data={rawClients}
        loading={loading}
        total={total}
        page={page}
        totalPages={totalPages}
        onPageChange={setPage}
        onRowClick={(row) => openDetail(row.client_id)}
        emptyMessage="No hay cuentas por cobrar"
        skeletonCols={[{ width: "25%" }, { width: "15%" }, { width: "15%" }, { width: "15%" }, { width: "15%" }]}
        rowClassName={(row) => row.oldest_pending_days != null && row.oldest_pending_days > OVERDUE_DAYS ? styles.rowOverdue : undefined}
      />

      <SlidePanel
        open={selected !== null}
        onClose={() => { setSelected(null); setShowPayment(null) }}
        title="Detalle del cliente"
      >
        {selected && (
          <>
            <div className={styles.detailHeader}>
              <h2 className={styles.clientName}>{selected.client.client_name}</h2>
              {selected.client.client_phone && <span className={styles.clientPhone}>{selected.client.client_phone}</span>}
              <div className={styles.debtSummary}>
                <span className={styles.debtLabel}>Deuda total</span>
                <span className={styles.debtAmount}>{money(selected.client.total_debt, currency)}</span>
              </div>
            </div>

            {selected.sales.length > 0 && (
              <section className={styles.section}>
                <h3 className={styles.sectionTitle}>Ventas pendientes</h3>
                <div className={styles.salesList}>
                  {selected.sales.map((sale) => (
                    <div key={sale.id} className={styles.saleCard}>
                      <div className={styles.saleRow}>
                        <span className={styles.saleDate}>{formatDate(sale.created_at)}</span>
                        <span className={styles.saleTotal}>{money(sale.total, currency)}</span>
                      </div>
                      <div className={styles.saleBreakdown}>
                        <span>Pagado: {money(sale.paid, currency)}</span>
                        <span className={styles.pending}>Pendiente: {money(sale.pending, currency)}</span>
                      </div>
                      {sale.items.map((item, i) => (
                        <div key={i} className={styles.saleItem}>
                          <span>{item.quantity}× {item.name}</span>
                          <span>{money(item.line_total, currency)}</span>
                        </div>
                      ))}
                      {showPayment === sale.id ? (
                        <div className={styles.paymentForm}>
                          <input
                            type="number"
                            placeholder={`Máximo: ${sale.pending.toFixed(2)}`}
                            value={payAmount}
                            onChange={(e) => setPayAmount(e.target.value)}
                            className={styles.payInput}
                            autoFocus
                          />
                          <select value={payMethod} onChange={(e) => setPayMethod(e.target.value)} className={styles.paySelect}>
                            <option value="efectivo">Efectivo</option>
                            <option value="tarjeta">Tarjeta</option>
                            <option value="transferencia">Transferencia</option>
                          </select>
                          <input
                            type="text"
                            placeholder="Notas (opcional)"
                            value={payNotes}
                            onChange={(e) => setPayNotes(e.target.value)}
                            className={styles.payInput}
                          />
                          <div className={styles.payActions}>
                            <button className={styles.cancelBtn} onClick={() => { setShowPayment(null); setPayAmount(""); setPayNotes("") }}>Cancelar</button>
                            <button
                              className={styles.payBtn}
                              disabled={paying || !payAmount}
                              onClick={() => handlePay(sale.id, selected.client.client_id, sale.pending)}
                            >
                              {paying ? "Procesando..." : "Registrar pago"}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button className={styles.registerPayBtn} onClick={() => { setShowPayment(sale.id); setPayAmount(String(sale.pending.toFixed(2))) }}>
                          Registrar abono
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {selected.payments.length > 0 && (
              <section className={styles.section}>
                <h3 className={styles.sectionTitle}>Historial de pagos</h3>
                <div className={styles.paymentsList}>
                  {selected.payments.map((p) => (
                    <div key={p.id} className={styles.paymentRow}>
                      <span>{formatDate(p.created_at)}</span>
                      <span>{p.payment_method}</span>
                      <span className={styles.paymentAmount}>−{money(p.amount, currency)}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </SlidePanel>
    </div>
  )
}
