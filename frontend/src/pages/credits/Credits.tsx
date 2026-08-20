import { useCallback, useEffect, useState } from "react"
import { creditsApi, type ClientDebtSummary, type ClientDebtResponse } from "@/api/credits"
import { money } from "@/lib/format"
import { usePosStore } from "@/store/posStore"
import { useToast } from "@/components/common/ui/Toast"
import styles from "./Credits.module.css"

type FilterTab = "todos" | "morosos" | "saldados"

const TABS: { value: FilterTab; label: string }[] = [
  { value: "todos", label: "Todos" },
  { value: "morosos", label: "Morosos" },
  { value: "saldados", label: "Saldados" },
]

export default function Credits() {
  const currency = usePosStore((s) => s.currency)
  const { toast } = useToast()
  const [clients, setClients] = useState<ClientDebtSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [activeTab, setActiveTab] = useState<FilterTab>("todos")
  const [selected, setSelected] = useState<ClientDebtResponse | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [showPayment, setShowPayment] = useState<string | null>(null) // sale_id
  const [payAmount, setPayAmount] = useState("")
  const [payMethod, setPayMethod] = useState("efectivo")
  const [payNotes, setPayNotes] = useState("")
  const [paying, setPaying] = useState(false)
  const [totalPending, setTotalPending] = useState(0)

  const fetchClients = useCallback(async (term?: string, filter?: FilterTab) => {
    setLoading(true)
    try {
      const [res, total] = await Promise.all([
        creditsApi.list({ search: term || undefined, limit: 100, filter: filter || "todos" }),
        creditsApi.getTotal(),
      ])
      setClients(res.clients)
      setTotalPending(total.total)
    } catch {
      toast("Error al cargar cuentas por cobrar", "error")
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => { fetchClients(search, activeTab) }, [fetchClients, search, activeTab])

  useEffect(() => {
    const t = setTimeout(() => fetchClients(search, activeTab), 300)
    return () => clearTimeout(t)
  }, [search, activeTab, fetchClients])

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
      // Refresh detail
      const data = await creditsApi.getClientDebt(clientId)
      setSelected(data)
      fetchClients(search)
    } catch (err: any) {
      toast(err?.message || "Error al registrar pago", "error")
    } finally {
      setPaying(false)
    }
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" })
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.h1}>Cuentas por Cobrar</h1>
          <p className={styles.subtitle}>
            Total pendiente: <strong>{money(totalPending, currency)}</strong>
          </p>
        </div>
        <input
          type="text"
          placeholder="Buscar cliente..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className={styles.searchInput}
        />
      </header>

      {!selected && (
        <div className={styles.tabs}>
          {TABS.map((tab) => (
            <button
              key={tab.value}
              className={`${styles.tab} ${activeTab === tab.value ? styles.tabActive : ""}`}
              onClick={() => setActiveTab(tab.value)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {selected ? (
        <div className={styles.detailView}>
          <button className={styles.backBtn} onClick={() => { setSelected(null); setShowPayment(null) }}>
            ← Volver a la lista
          </button>

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
        </div>
      ) : (
        <div className={styles.clientsList}>
          {loading ? (
            <div className={styles.loading}>Cargando...</div>
          ) : clients.length === 0 ? (
            <div className={styles.empty}>No hay cuentas por cobrar</div>
          ) : (
            clients.map((c) => (
              <button key={c.client_id} className={`${styles.clientCard} ${c.oldest_pending_days && c.oldest_pending_days > 30 ? styles.clientCardOverdue : ""}`} onClick={() => openDetail(c.client_id)}>
                <div className={styles.clientInfo}>
                  <span className={styles.clientCardName}>{c.client_name}</span>
                  {c.client_phone && <span className={styles.clientCardPhone}>{c.client_phone}</span>}
                </div>
                <div className={styles.clientDebt}>
                  <span className={styles.debtBadge}>{money(c.total_debt, currency)}</span>
                  <span className={styles.saleCount}>{c.sale_count} venta{c.sale_count !== 1 ? "s" : ""}</span>
                  {c.oldest_pending_days != null && c.oldest_pending_days > 30 && (
                    <span className={styles.overdueTag}>{c.oldest_pending_days} días</span>
                  )}
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
