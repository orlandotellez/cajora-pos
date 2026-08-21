import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { inventoryApi } from "@/api/inventory";
import { useToast } from "@/components/common/ui/Toast";
import { useCashSessionStore } from "@/store/cashSessionStore";
import { money } from "@/lib/format";
import { UNIT_TYPE_LABELS, unitQuantitySuffix, costUnitNoun } from "@/lib/constants";
import styles from "./AdjustStockModal.module.css";
import { useModalBack } from "@/hooks/useModalBack";

interface AdjustStockModalProps {
  adjust: {
    id: string;
    name: string;
    stock: number;
    cost?: number;
    unit_type?: string | null;
    unit_quantity?: number | null;
  };
  onClose: () => void;
  onApplied: () => void;
}

export function AdjustStockModal({ adjust, onClose, onApplied }: AdjustStockModalProps) {
  const { toast } = useToast();
  const canSellCash = useCashSessionStore((s) => s.canSellCash);
  // Botón de retroceso de Android / gesto de regreso cierra el modal.
  useModalBack(onClose);
  const [type, setType] = useState<"entrada" | "salida" | "ajuste">("entrada");
  const [qty, setQty] = useState(0);
  const defaultCost = (adjust.cost ?? 0) > 0 ? String(adjust.cost) : "";
  const [unitCost, setUnitCost] = useState(defaultCost);
  const [paidCash, setPaidCash] = useState(false);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const costNoun = costUnitNoun(adjust.unit_type);
  const qtyInvalid = type === "ajuste" ? qty === adjust.stock : qty < 1;

  useEffect(() => {
    useCashSessionStore.getState().fetchStatus();
  }, []);

  const costNumber = Number(unitCost) || 0;
  const expenseTotal = Math.round(costNumber * qty * 100) / 100;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!adjust) return;
    setSubmitting(true);
    try {
      await inventoryApi.create({
        product_id: adjust.id,
        movement_type: type,
        quantity: type === "ajuste" ? qty - adjust.stock : qty,
        ...(type === "entrada" && costNumber > 0 && { unit_cost: costNumber }),
        ...(type === "entrada" && paidCash && canSellCash && costNumber > 0 && { paid_cash: true }),
        note: note || undefined,
      });
      onApplied();
      onClose();
    } catch (err) {
      console.error("Error al ajustar inventario", err);
      toast((err as Error)?.message || "Error al ajustar inventario", "error");
    } finally {
      setSubmitting(false);
    }
  }

  function handleTypeChange(value: string) {
    const t = value as "entrada" | "salida" | "ajuste";
    setType(t);
    if (t === "ajuste") {
      setQty(adjust.stock);
    } else {
      setQty(0);
    }
    if (t === "entrada") {
      setUnitCost(defaultCost);
    } else {
      setUnitCost("");
      setPaidCash(false);
    }
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>Ajustar inventario</h2>
          <button onClick={onClose} className={styles.modalClose}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className={styles.modalForm}>
          <div className={styles.currentStock}>
            <div className={styles.currentStockName}>{adjust.name}</div>
            <div className={styles.currentStockValue}>
              Stock actual: <span className="tabular">{adjust.stock}</span>
            </div>
          </div>

          <div className={styles.field}>
            <label className={styles.fieldLabel}>Tipo de movimiento</label>
            <select value={type} onChange={(e) => handleTypeChange(e.target.value)} className={styles.select}>
              <option value="entrada">Entrada (compra)</option>
              <option value="salida">Salida (merma)</option>
              <option value="ajuste">Ajuste a nuevo valor</option>
            </select>
          </div>

          <div className={styles.field}>
            <label className={styles.fieldLabel}>
              {type === "ajuste" ? "Nuevo stock" : "Cantidad"}
            </label>
            <div className={styles.inputWithUnit}>
              <input
                type="number" min={type === "ajuste" ? 0 : 1} value={qty}
                onChange={(e) => setQty(Number(e.target.value))}
                className={styles.input} required
              />
              {adjust?.unit_type && (
                <span className={styles.unitBadge}>
                  {UNIT_TYPE_LABELS[adjust.unit_type] || adjust.unit_type}
                  {unitQuantitySuffix(adjust.unit_type, adjust.unit_quantity)}
                </span>
              )}
            </div>
            {qtyInvalid && (
              <p className={styles.paidCashHint}>
                {type === "ajuste"
                  ? "El nuevo stock es igual al actual, no hay nada que ajustar"
                  : "La cantidad debe ser mayor a 0"}
              </p>
            )}
          </div>

          {type === "entrada" && (
            <>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>
                  {costNoun === "unidad" ? "Costo unitario (opcional)" : `Costo por ${costNoun} (opcional)`}
                </label>
                <input
                  type="number" min={0} step="0.01"
                  value={unitCost}
                  onChange={(e) => setUnitCost(e.target.value)}
                  placeholder={`Cuánto te costó cada ${costNoun}`}
                  className={styles.input}
                />
              </div>

              <label className={styles.paidCashLabel}>
                <input
                  type="checkbox"
                  checked={paidCash && canSellCash}
                  disabled={!canSellCash || costNumber <= 0}
                  onChange={(e) => setPaidCash(e.target.checked)}
                />
                Pagado en efectivo desde la caja
              </label>
              {!canSellCash && (
                <p className={styles.paidCashHint}>Abrí la caja para registrar esta compra en efectivo</p>
              )}
              {paidCash && canSellCash && expenseTotal > 0 && (
                <p className={styles.paidCashHint}>
                  Se restarán {money(expenseTotal)} de la caja abierta
                </p>
              )}
            </>
          )}

          <div className={styles.field}>
            <label className={styles.fieldLabel}>Nota (opcional)</label>
            <input
              value={note} onChange={(e) => setNote(e.target.value)}
              placeholder="Motivo o referencia"
              className={styles.input}
            />
          </div>

          <button type="submit" className={styles.primaryBtn} disabled={submitting || qtyInvalid}>
            {submitting ? "Aplicando…" : "Aplicar"}
          </button>
        </form>
      </div>
    </div>
  );
}
