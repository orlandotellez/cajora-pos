import { useCallback, useEffect, useState } from "react";
import { Wallet, Plus, Lock, Unlock, History, ChevronLeft, ChevronRight } from "lucide-react";
import { cashRegisterApi, type CashSession, type CashCloseReportResponse } from "@/api/cash-register";
import { useCashSessionStore } from "@/store/cashSessionStore";
import { useAuth } from "@/context/AuthContext";
import { money } from "@/lib/format";
import { usePosStore } from "@/store/posStore";
import { useToast } from "@/components/common/ui/Toast";
import styles from "./CashRegister.module.css";

const PAGE_SIZE = 10;

function formatDateTime(iso?: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("es-MX", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function CashRegister() {
  const currency = usePosStore((s) => s.currency);
  const { user } = useAuth();
  const { toast } = useToast();
  const { openSessions, canSellCash, fetchStatus, hasOpenSessionFor } = useCashSessionStore();

  const isAdmin = user?.role === "admin" || user?.role === "super_admin";
  // El botón de abrir solo tiene sentido si YO no tengo caja abierta:
  // la de otro empleado no me habilita a abrir la mía dos veces.
  const mySessionOpen = hasOpenSessionFor(user?.id ?? "");

  // Formulario de apertura
  const [showOpenForm, setShowOpenForm] = useState(false);
  const [montoInicial, setMontoInicial] = useState("");
  const [label, setLabel] = useState("");
  const [creatingLabel, setCreatingLabel] = useState(false);
  const [opening, setOpening] = useState(false);

  // Formulario de cierre (session_id en curso)
  const [closingId, setClosingId] = useState<string | null>(null);
  const [montoContado, setMontoContado] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [closing, setClosing] = useState(false);
  const [report, setReport] = useState<CashCloseReportResponse | null>(null);

  // Historial
  const [history, setHistory] = useState<CashSession[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loadingHistory, setLoadingHistory] = useState(true);

  const fetchHistory = useCallback(async (p: number) => {
    setLoadingHistory(true);
    try {
      const res = await cashRegisterApi.history({ page: p, limit: PAGE_SIZE });
      setHistory(res.sessions);
      setTotal(res.total);
      setPage(res.page);
    } catch {
      toast("Error al cargar el historial de caja", "error");
    } finally {
      setLoadingHistory(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchStatus(true);
    fetchHistory(1);
  }, [fetchStatus, fetchHistory]);

  async function handleOpen() {
    const amount = Number(montoInicial);
    if (!amount || amount <= 0) {
      toast("Ingresá un monto inicial válido", "error");
      return;
    }
    if (!label.trim()) {
      toast("Elegí o creá un nombre para la caja", "error");
      return;
    }
    setOpening(true);
    try {
      await cashRegisterApi.open({ monto_inicial: amount, label: label.trim() || undefined });
      toast("Caja abierta correctamente", "success");
      setShowOpenForm(false);
      setMontoInicial("");
      setLabel("");
      setCreatingLabel(false);
      await fetchStatus(true);
      fetchHistory(1);
    } catch (err: any) {
      toast(err?.message || "Error al abrir la caja", "error");
    } finally {
      setOpening(false);
    }
  }

  async function handleClose(sessionId: string) {
    const amount = Number(montoContado);
    if (montoContado === "" || !Number.isFinite(amount) || amount < 0) {
      toast("Ingresá el efectivo contado", "error");
      return;
    }
    setClosing(true);
    try {
      const res = await cashRegisterApi.close({
        session_id: sessionId,
        monto_contado: amount,
        observaciones: observaciones.trim() || undefined,
      });
      setReport(res);
      setClosingId(null);
      setMontoContado("");
      setObservaciones("");
      await fetchStatus(true);
      fetchHistory(1);
    } catch (err: any) {
      toast(err?.message || "Error al cerrar la caja", "error");
    } finally {
      setClosing(false);
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // Cajas ya usadas (abiertas + historial): al abrir una nueva sesión se
  // sugieren como clasificador, así "Caja principal" se escribe una sola vez.
  const knownLabels = Array.from(
    new Set(
      [...openSessions, ...history]
        .map((s) => s.label)
        .filter((l): l is string => !!l)
    )
  );

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.h1}>Caja</h1>
          <p className={styles.subtitle}>
            {canSellCash
              ? "Hay caja abierta: podés cobrar en efectivo."
              : "No hay caja abierta. Abrí la caja para cobrar en efectivo."}
          </p>
        </div>
        {!showOpenForm && !mySessionOpen && (
          <button className={styles.primaryBtn} onClick={() => { setShowOpenForm(true); setReport(null); }}>
            <Plus size={15} /> Abrir caja
          </button>
        )}
      </header>

      {/* ---- Formulario de apertura ---- */}
      {showOpenForm && (
        <section className={styles.formCard}>
          <h3 className={styles.sectionTitle}>Abrir caja</h3>
          <div className={styles.formRow}>
            <label className={styles.fieldLabel}>Monto inicial *</label>
            <input
              type="number" min={0} step="0.01"
              placeholder="0.00"
              value={montoInicial}
              onChange={(e) => setMontoInicial(e.target.value)}
              className={styles.input}
              autoFocus
            />
          </div>
          <div className={styles.formRow}>
            <label className={styles.fieldLabel}>Caja *</label>
            {creatingLabel ? (
              <>
                <input
                  type="text"
                  placeholder="Nombre de la nueva caja (ej: Caja principal)"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  maxLength={50}
                  className={styles.input}
                  autoFocus
                />
                <button
                  type="button"
                  className={styles.linkBtn}
                  onClick={() => { setCreatingLabel(false); setLabel(""); }}
                >
                  ← Elegir una caja existente
                </button>
              </>
            ) : (
              <select
                value={label}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === "__new__") {
                    setCreatingLabel(true);
                    setLabel("");
                  } else {
                    setLabel(v);
                  }
                }}
                className={styles.select}
              >
                <option value="" disabled>
                  {knownLabels.length > 0 ? "Elegí una caja…" : "Todavía no hay cajas creadas"}
                </option>
                {knownLabels.map((l) => (
                  <option key={l} value={l}>{l}</option>
                ))}
                <option value="__new__">+ Crear nueva caja…</option>
              </select>
            )}
          </div>
          <div className={styles.formActions}>
            <button className={styles.cancelBtn} onClick={() => { setShowOpenForm(false); setMontoInicial(""); setLabel(""); setCreatingLabel(false); }}>
              Cancelar
            </button>
            <button className={styles.primaryBtn} disabled={opening || !label.trim()} onClick={handleOpen}>
              {opening ? "Abriendo..." : "Abrir caja"}
            </button>
          </div>
        </section>
      )}

      {/* ---- Reporte de cierre ---- */}
      {report && (
        <section className={`${styles.formCard} ${report.report.difference === 0 ? styles.reportOk : styles.reportDiff}`}>
          <h3 className={styles.sectionTitle}>Cierre registrado</h3>
          <div className={styles.reportGrid}>
            <span>Fondo inicial</span>
            <strong>{money(report.session.opening_amount, currency)}</strong>
            <span>Gastos en efectivo</span>
            <strong>−{money(report.report.expenses_total, currency)}</strong>
            <span>Efectivo esperado</span>
            <strong>{money(report.report.expected_amount, currency)}</strong>
            <span>Contado</span>
            <strong>{money(report.session.closing_amount_counted ?? 0, currency)}</strong>
            <span>Diferencia</span>
            <strong className={report.report.difference === 0 ? styles.diffZero : report.report.difference > 0 ? styles.diffPlus : styles.diffMinus}>
              {report.report.difference === 0 ? "Cuadrada ✓" : money(report.report.difference, currency)}
            </strong>
          </div>
          <div className={styles.formActions}>
            <button className={styles.cancelBtn} onClick={() => setReport(null)}>Cerrar</button>
          </div>
        </section>
      )}

      {/* ---- Sesiones abiertas ---- */}
      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>
          <Unlock size={14} /> Cajas abiertas ({openSessions.length})
        </h3>
        {openSessions.length === 0 ? (
          <div className={styles.emptyCard}>
            <Wallet size={22} />
            <p>No hay ninguna caja abierta</p>
          </div>
        ) : (
          openSessions.map((s) => (
            <div key={s.id} className={styles.sessionCard}>
              <div className={styles.sessionMain}>
                <span className={styles.sessionLabel}>{s.label || `Caja de ${s.user_name}`}</span>
                <span className={styles.sessionUser}>{s.user_name}</span>
                <span className={styles.sessionMeta}>Abierta {formatDateTime(s.opened_at)}</span>
              </div>
              <div className={styles.sessionAmounts}>
                <div className={styles.amountItem}>
                  <span className={styles.amountLabel}>Fondo inicial</span>
                  <span className={styles.amountValue}>{money(s.opening_amount, currency)}</span>
                </div>
                <div className={styles.amountItem}>
                  <span className={styles.amountLabel}>Entradas efectivo</span>
                  <span className={styles.amountValue}>{money(s.cash_so_far, currency)}</span>
                </div>
                {s.expenses_total > 0 && (
                  <div className={styles.amountItem}>
                    <span className={styles.amountLabel}>Gastos</span>
                    <span className={`${styles.amountValue} ${styles.diffMinus}`}>−{money(s.expenses_total, currency)}</span>
                  </div>
                )}
                <div className={styles.amountItem}>
                  <span className={styles.amountLabel}>Debería haber</span>
                  <span className={styles.amountValue}>
                    {money(Math.round((s.opening_amount + s.cash_so_far - s.expenses_total) * 100) / 100, currency)}
                  </span>
                </div>
              </div>
              {(isAdmin || s.user_id === user?.id) && (
                closingId === s.id ? (
                  <div className={styles.closeForm}>
                    <div className={styles.formRow}>
                      <label className={styles.fieldLabel}>Efectivo contado *</label>
                      <input
                        type="number" min={0} step="0.01"
                        placeholder="0.00"
                        value={montoContado}
                        onChange={(e) => setMontoContado(e.target.value)}
                        className={styles.input}
                        autoFocus
                      />
                    </div>
                    <div className={styles.formRow}>
                      <label className={styles.fieldLabel}>Observaciones (opcional)</label>
                      <input
                        type="text"
                        value={observaciones}
                        onChange={(e) => setObservaciones(e.target.value)}
                        className={styles.input}
                      />
                    </div>
                    <div className={styles.formActions}>
                      <button className={styles.cancelBtn} onClick={() => { setClosingId(null); setMontoContado(""); setObservaciones(""); }}>
                        Cancelar
                      </button>
                      <button className={styles.dangerBtn} disabled={closing} onClick={() => handleClose(s.id)}>
                        {closing ? "Cerrando..." : "Cerrar caja"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className={styles.sessionActions}>
                    <button className={styles.closeBtn} onClick={() => { setClosingId(s.id); setReport(null); }}>
                      <Lock size={13} /> Cerrar
                    </button>
                  </div>
                )
              )}
            </div>
          ))
        )}
      </section>

      {/* ---- Historial ---- */}
      <section className={styles.section}>
        <h3 className={styles.sectionTitle}><History size={14} /> Historial</h3>
        {loadingHistory ? (
          <div className={styles.emptyCard}><p>Cargando...</p></div>
        ) : history.length === 0 ? (
          <div className={styles.emptyCard}><p>Todavía no hay cierres registrados</p></div>
        ) : (
          <>
            <div className={styles.historyTable}>
              <div className={`${styles.historyRow} ${styles.historyHead}`}>
                <span>Caja</span>
                <span>Responsable</span>
                <span>Apertura</span>
                <span>Cierre</span>
                <span>Fondo</span>
                <span>Esperado</span>
                <span>Diferencia</span>
              </div>
              {history.map((s) => (
                <div key={s.id} className={styles.historyRow}>
                  <span>{s.label || `Caja de ${s.user_name}`}</span>
                  <span>{s.user_name}</span>
                  <span>{formatDateTime(s.opened_at)}</span>
                  <span>{formatDateTime(s.closed_at)}</span>
                  <span>{money(s.opening_amount, currency)}</span>
                  <span>{s.expected_amount != null ? money(s.expected_amount, currency) : "—"}</span>
                  <span className={
                    s.status === "abierto" ? styles.statusOpen
                      : s.difference === 0 ? styles.diffZero
                      : (s.difference ?? 0) > 0 ? styles.diffPlus : styles.diffMinus
                  }>
                    {s.status === "abierto" ? "Abierta" : s.difference === 0 ? "Cuadrada" : money(s.difference ?? 0, currency)}
                  </span>
                </div>
              ))}
            </div>
            {totalPages > 1 && (
              <div className={styles.pager}>
                <button disabled={page <= 1} onClick={() => fetchHistory(page - 1)} className={styles.pageBtn}>
                  <ChevronLeft size={14} /> Anterior
                </button>
                <span className={styles.pageInfo}>Página {page} de {totalPages}</span>
                <button disabled={page >= totalPages} onClick={() => fetchHistory(page + 1)} className={styles.pageBtn}>
                  Siguiente <ChevronRight size={14} />
                </button>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
