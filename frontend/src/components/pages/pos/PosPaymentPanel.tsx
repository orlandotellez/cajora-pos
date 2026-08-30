import { useCallback, useEffect, useRef, useState } from "react";
import { X, Search, UserCheck, UserPlus, Loader2 } from "lucide-react";
import { money } from "@/lib/format";
import { PAYMENT_METHODS } from "@/lib/constants";
import { usePosStore } from "@/store/posStore";
import { useCashSessionStore } from "@/store/cashSessionStore";
import { useSettingsStore } from "@/store/settingsStore";
import { clientsApi, type Client } from "@/api/clients";
import { creditsApi } from "@/api/credits";
import styles from "../../../pages/pos/Pos.module.css";



function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.row}>
      <span className={styles.rowLabel}>{label}</span>
      <span className={styles.rowValue}>{value}</span>
    </div>
  );
}



interface PosPaymentPanelProps {
  totals: { subtotal: number; discount: number; total: number; change: number };
  cartLength: number;
  discountPct: number;
  payment: string;
  received: string;
  manualAmount: boolean;
  checkingOut: boolean;
  onDiscountPct: (v: number) => void;
  onPayment: (v: string) => void;
  onReceived: (v: string) => void;
  onManualAmount: (v: boolean) => void;
  onCheckout: () => void;
  onClearCart: () => void;
  mobileMode?: boolean;
}

export function PosPaymentPanel({
  totals, cartLength, discountPct, payment, received, manualAmount, checkingOut,
  onDiscountPct, onPayment, onReceived, onManualAmount, onCheckout, onClearCart,
  mobileMode = false,
}: PosPaymentPanelProps) {
  const currency = usePosStore((s) => s.currency);
  const clientId = usePosStore((s) => s.clientId);
  const clientName = usePosStore((s) => s.clientName);
  const setClient = usePosStore((s) => s.setClient);
  const clearClient = usePosStore((s) => s.clearClient);
  const canSellCash = useCashSessionStore((s) => s.canSellCash);

  const cashRegisterEnabled = useSettingsStore((s) => s.cashRegisterEnabled);
  const sellCashAllowed = cashRegisterEnabled ? canSellCash : true;

  // Refresca el estado de caja al montar el panel (stale-while-revalidate:
  // solo dispara request si el último fetch es viejo).
  useEffect(() => {
    useCashSessionStore.getState().fetchStatus();
  }, []);

  const [showClientSection, setShowClientSection] = useState(false);
  const [clientSearch, setClientSearch] = useState("");
  const [clientResults, setClientResults] = useState<Client[]>([]);
  const [clientSearching, setClientSearching] = useState(false);
  const [showClientResults, setShowClientResults] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [clientDebt, setClientDebt] = useState<number | null>(null);
  const clientSearchRef = useRef<HTMLDivElement>(null);
  const clientSearchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const searchClients = useCallback((term: string) => {
    if (clientSearchTimeout.current) clearTimeout(clientSearchTimeout.current);
    if (!term.trim()) {
      setClientResults([]);
      return;
    }
    clientSearchTimeout.current = setTimeout(async () => {
      setClientSearching(true);
      try {
        const res = await clientsApi.list({ search: term, is_active: true, limit: 8 });
        setClientResults(res.clients);
      } catch {
        setClientResults([]);
      } finally {
        setClientSearching(false);
      }
    }, 300);
  }, []);

  // Fetch client debt when clientId changes
  useEffect(() => {
    if (!clientId) {
      setClientDebt(null);
      return;
    }
    let cancelled = false;
    creditsApi.getClientDebt(clientId)
      .then((res) => {
        if (!cancelled) setClientDebt(res.client.total_debt);
      })
      .catch(() => {
        if (!cancelled) setClientDebt(null);
      });
    return () => { cancelled = true; };
  }, [clientId]);

  useEffect(() => {
    searchClients(clientSearch);
  }, [clientSearch, searchClients]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (clientSearchRef.current && !clientSearchRef.current.contains(e.target as Node)) {
        setShowClientResults(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const [discountEnabled, setDiscountEnabled] = useState(discountPct > 0);
  useEffect(() => {
    if (mobileMode && discountPct === 0) setDiscountEnabled(false);
  }, [discountPct, mobileMode]);
  const showDiscountRows = !mobileMode || discountEnabled;
  const panel = (
    <>
      <div className={styles.totalsSection}>
        {mobileMode && (
          <label className={styles.manualAmountLabel}>
            <input
              type="checkbox"
              checked={discountEnabled}
              onChange={(e) => {
                const checked = e.target.checked;
                setDiscountEnabled(checked);
                if (!checked) onDiscountPct(0);
              }}
              className={styles.manualAmountCheckbox}
            />
            Aplicar Descuento
          </label>
        )}
        {showDiscountRows && (
          <>
            <Row label="Subtotal" value={money(totals.subtotal, currency)} />
            <div className={styles.discountRow}>
              <label className={styles.discountLabel}>Descuento %</label>
              <input
                type="number" min={0} max={100} value={discountPct}
                onChange={(e) => onDiscountPct(Number(e.target.value) || 0)}
                className={styles.discountInput}
              />
            </div>
            <Row label="− Descuento" value={money(totals.discount, currency)} />
          </>
        )}
      </div>

      <div className={styles.divider} />

      <div className={styles.totalRow}>
        <div className={styles.totalLabel}>Total</div>
        <div className={styles.totalValue}>{money(totals.total, currency)}</div>
      </div>

      {/* Client toggle */}
      <label className={styles.clientToggle}>
        <input
          type="checkbox"
          checked={showClientSection || !!clientId}
          onChange={(e) => {
            const checked = e.target.checked;
            setShowClientSection(checked);
            if (!checked) clearClient();
          }}
          className={styles.clientToggleCheckbox}
        />
        Asociar a cliente
      </label>

      {/* Client selector (only when enabled) */}
      {(showClientSection || clientId) && (
        <div className={styles.clientSection}>
          {clientId ? (
            <div className={styles.selectedClient}>
              <UserCheck size={14} className={styles.selectedClientIcon} />
              <span className={styles.selectedClientName}>{clientName}</span>
              {clientDebt != null && clientDebt > 0 && (
                <span className={styles.debtBadge}>Debe {money(clientDebt, currency)}</span>
              )}
              <button
                type="button"
                onClick={() => { clearClient(); setShowClientSection(false); }}
                className={styles.clearClientBtn}
              >
                <X size={14} />
              </button>
            </div>
          ) : (
            <div className={styles.clientSearchWrapper} ref={clientSearchRef}>
              <Search size={14} className={styles.clientSearchIcon} />
              <input
                type="text"
                value={clientSearch}
                onChange={(e) => {
                  setClientSearch(e.target.value);
                  setShowClientResults(true);
                }}
                onFocus={() => { if (clientSearch.trim()) setShowClientResults(true); }}
                placeholder="Buscar por nombre o teléfono…"
                className={styles.clientSearchInput}
              />
              {showClientResults && clientResults.length > 0 && (
                <div className={styles.clientResults}>
                  {clientResults.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      className={styles.clientResultItem}
                      onClick={() => {
                        setClient(c.id, c.name);
                        setClientSearch("");
                        setClientResults([]);
                        setShowClientResults(false);
                      }}
                    >
                      <span className={styles.clientResultName}>{c.name}</span>
                      {c.phone && <span className={styles.clientResultPhone}>{c.phone}</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Create client inline form */}
          {!clientId && (
            <>
              {!showCreateForm ? (
                <button
                  type="button"
                  className={styles.createClientToggle}
                  onClick={() => { setShowCreateForm(true); setCreateError(null); }}
                >
                  <UserPlus size={13} /> Crear cliente
                </button>
              ) : (
                <div className={styles.createClientForm}>
                  <input
                    type="text"
                    placeholder="Nombre *"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className={styles.createClientInput}
                    autoFocus
                  />
                  <input
                    type="tel"
                    placeholder="Teléfono (opcional)"
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    className={styles.createClientInput}
                  />
                  {createError && <span className={styles.createClientError}>{createError}</span>}
                  <div className={styles.createClientActions}>
                    <button
                      type="button"
                      className={styles.createClientCancel}
                      onClick={() => { setShowCreateForm(false); setNewName(""); setNewPhone(""); setCreateError(null); }}
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      className={styles.createClientSubmit}
                      disabled={!newName.trim() || creating}
                      onClick={async () => {
                        if (!newName.trim()) return;
                        setCreating(true);
                        setCreateError(null);
                        try {
                          const created = await clientsApi.create({ name: newName.trim(), phone: newPhone.trim() || undefined });
                          setClient(created.id, created.name);
                          setNewName("");
                          setNewPhone("");
                          setShowCreateForm(false);
                          setShowClientResults(false);
                        } catch (err) {
                          setCreateError((err as any)?.message || "Error al crear cliente");
                        } finally {
                          setCreating(false);
                        }
                      }}
                    >
                      {creating ? <Loader2 size={13} className={styles.spinner} /> : "Crear"}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      <div className={styles.paymentSection}>
        <div className={styles.field}>
          <label className={styles.fieldLabel}>Método de pago</label>
          <select
            value={payment}
            onChange={(e) => {
              onPayment(e.target.value);
              if (e.target.value === "credito") setShowClientSection(true);
            }}
            className={styles.select}
          >
            {PAYMENT_METHODS.map((pm) => (
              <option
                key={pm.value}
                value={pm.value}
                disabled={pm.value === "efectivo" && !sellCashAllowed}
              >
                {pm.label}{pm.value === "efectivo" && !sellCashAllowed ? " (caja cerrada)" : ""}
              </option>
            ))}
          </select>
        </div>
        {payment === "credito" && !clientId && (
          <p className={styles.creditHint}>Selecciona un cliente para vender a crédito</p>
        )}
        {payment === "efectivo" && !sellCashAllowed && (
          <p className={styles.creditHint}>Abrí la caja para cobrar en efectivo</p>
        )}
        {payment !== "credito" && (
          <>
            {payment === "tarjeta" || payment === "transferencia"
              ? (
                <label className={styles.manualAmountLabel}>
                  <input
                    type="checkbox"
                    checked={manualAmount}
                    onChange={(e) => onManualAmount(e.target.checked)}
                    className={styles.manualAmountCheckbox}
                  />
                  Adjuntar monto manualmente
                </label>
              )
              : null}
            {(payment === "efectivo" || manualAmount) && (
              <>
                <div className={styles.field}>
                  <label className={styles.fieldLabel}>Monto recibido</label>
                  <input
                    type="number" min={0} value={received}
                    onChange={(e) => onReceived(e.target.value)}
                    className={`${styles.input} ${styles.inputRight}`}
                  />
                </div>
                <div className={styles.changeRow}>
                  <span className={styles.changeLabel}>Cambio</span>
                  <span className={`${styles.changeValue} ${received && Number(received) < totals.total ? styles.changeNegative : ""}`}>
                    {received && Number(received) < totals.total
                      ? `−${money(totals.total - Number(received), currency)}`
                      : money(totals.change, currency)
                    }
                  </span>
                </div>
              </>
            )}
          </>
        )}
      </div>

      <button
        onClick={onCheckout}
        disabled={
          cartLength === 0 ||
          checkingOut ||
          (payment === "credito" && !clientId) ||
          (payment === "efectivo" && !sellCashAllowed) ||
          ((payment === "efectivo" || manualAmount) && received !== "" && Number(received || 0) < totals.total)
        }
        className={styles.checkoutBtn}
      >
        {checkingOut ? "Procesando venta..." : "Cobrar"}
      </button>
      {!mobileMode && cartLength > 0 && (
        <button onClick={onClearCart} className={styles.clearCart}>
          <X size={12} /> Vaciar carrito
        </button>
      )}
    </>
  );

  return mobileMode ? <div className={styles.mobileCompact}>{panel}</div> : panel;
}
