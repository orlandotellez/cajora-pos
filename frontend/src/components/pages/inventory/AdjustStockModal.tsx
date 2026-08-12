import { useState } from "react";
import { X } from "lucide-react";
import { inventoryApi } from "@/api/inventory";
import { useToast } from "@/components/common/ui/Toast";
import { UNIT_TYPE_LABELS } from "@/lib/constants";
import styles from "./AdjustStockModal.module.css";
import { useModalBack } from "@/hooks/useModalBack";

interface AdjustStockModalProps {
  adjust: {
    id: string;
    name: string;
    stock: number;
    unit_type?: string | null;
    unit_quantity?: number | null;
  };
  onClose: () => void;
  onApplied: () => void;
}

export function AdjustStockModal({ adjust, onClose, onApplied }: AdjustStockModalProps) {
  const { toast } = useToast();
  // Botón de retroceso de Android / gesto de regreso cierra el modal.
  useModalBack(onClose);
  const [type, setType] = useState<"entrada" | "salida" | "ajuste">("entrada");
  const [qty, setQty] = useState(0);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!adjust) return;
    setSubmitting(true);
    try {
      await inventoryApi.create({
        product_id: adjust.id,
        movement_type: type,
        quantity: type === "ajuste" ? qty - adjust.stock : qty,
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
                type="number" min={0} value={qty}
                onChange={(e) => setQty(Number(e.target.value))}
                className={styles.input} required
              />
              {adjust?.unit_type && (
                <span className={styles.unitBadge}>
                  {UNIT_TYPE_LABELS[adjust.unit_type] || adjust.unit_type}
                  {adjust.unit_quantity ? ` × ${adjust.unit_quantity}` : ""}
                </span>
              )}
            </div>
          </div>

          <div className={styles.field}>
            <label className={styles.fieldLabel}>Nota (opcional)</label>
            <input
              value={note} onChange={(e) => setNote(e.target.value)}
              placeholder="Motivo o referencia"
              className={styles.input}
            />
          </div>

          <button type="submit" className={styles.primaryBtn} disabled={submitting}>
            {submitting ? "Aplicando…" : "Aplicar"}
          </button>
        </form>
      </div>
    </div>
  );
}
