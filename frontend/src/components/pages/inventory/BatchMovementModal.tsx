import { useState, useRef, useEffect } from "react";
import { X, Trash2, PackageSearch } from "lucide-react";
import { inventoryApi } from "@/api/inventory";
import { useToast } from "@/components/common/ui/Toast";
import { useCashSessionStore } from "@/store/cashSessionStore";
import { useSettingsStore } from "@/store/settingsStore";
import { money } from "@/lib/format";
import { usePosStore } from "@/store/posStore";
import type { Supplier, Product } from "@/api";
import type { CreateBatchPayload } from "@/api/inventory";
import { UNIT_TYPE_LABELS, unitQuantitySuffix, costUnitNoun, needsUnitQuantity } from "@/lib/constants";
import styles from "./BatchMovementModal.module.css";
import { useModalBack } from "@/hooks/useModalBack";

interface BatchMovementModalProps {
  open: boolean;
  suppliers: Supplier[];
  products: Product[];
  onClose: () => void;
  onCreated: () => void;
}

type BatchFormItem = {
  id: string;
  product: Product;
  quantity: number;
  unitCost: number | null;
  notes: string;
  showNote: boolean;
};

export function BatchMovementModal({ open, suppliers, products, onClose, onCreated }: BatchMovementModalProps) {
  const { toast } = useToast();
  const currency = usePosStore((s) => s.currency);
  const canSellCashRaw = useCashSessionStore((s) => s.canSellCash);
  const cashRegisterEnabled = useSettingsStore((s) => s.cashRegisterEnabled);
  const canSellCash = cashRegisterEnabled ? canSellCashRaw : true;
  // Botón de retroceso de Android / gesto de regreso cierra el modal.
  useModalBack(onClose, open);
  const [batchType, setBatchType] = useState<"entrada" | "salida" | "ajuste">("entrada");
  const [batchSupplierId, setBatchSupplierId] = useState("");
  const [batchNotes, setBatchNotes] = useState("");
  const [showGeneralNotes, setShowGeneralNotes] = useState(false);
  const [paidCash, setPaidCash] = useState(false);
  const [batchItems, setBatchItems] = useState<BatchFormItem[]>([]);
  const [submitting, setSubmitting] = useState(false);
  // Buscador global: elegir un producto agrega la línea directamente.
  const [addSearch, setAddSearch] = useState("");
  const [showAddDropdown, setShowAddDropdown] = useState(false);
  const itemIdCounter = useRef(0);
  const addSearchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) useCashSessionStore.getState().fetchStatus();
  }, [open]);

  if (!open) return null;

  // Total a pagar en efectivo: Σ costo × cantidad (ítems con costo)
  const expenseTotal = Math.round(
    batchItems.reduce((sum, i) => sum + (i.unitCost ?? 0) * (i.quantity || 0), 0) * 100
  ) / 100;
  const totalUnits = batchItems.reduce((sum, i) => sum + (i.quantity || 0), 0);
  const validItems = batchItems.filter(i => i.quantity > 0);
  const canSubmit = !submitting && validItems.length > 0;

  function searchProducts(query: string): Product[] {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    return products.filter(p =>
      p.name.toLowerCase().includes(q) ||
      (p.barcode && p.barcode.toLowerCase().includes(q))
    ).slice(0, 8);
  }

  const addResults = searchProducts(addSearch);

  function addItemFromSearch(product: Product) {
    itemIdCounter.current += 1;
    setBatchItems(prev => [...prev, {
      id: `bi_${itemIdCounter.current}`,
      product,
      quantity: 1,
      // Precarga el costo establecido del producto, igual que en Ajustar inventario.
      unitCost: product.cost > 0 ? product.cost : null,
      notes: "",
      showNote: false,
    }]);
    setAddSearch("");
    setShowAddDropdown(false);
    // Devuelve el foco al buscador para cargar el siguiente producto al toque.
    requestAnimationFrame(() => addSearchRef.current?.focus());
  }

  function handleAddKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      if (addResults.length > 0) addItemFromSearch(addResults[0]);
    }
  }

  function removeBatchItem(id: string) {
    setBatchItems(prev => prev.filter(i => i.id !== id));
  }

  function updateBatchItem(id: string, updates: Partial<BatchFormItem>) {
    setBatchItems(prev => prev.map(i => i.id === id ? { ...i, ...updates } : i));
  }

  async function submitBatch(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const payload: CreateBatchPayload = {
        movement_type: batchType,
        supplier_id: batchType === "entrada" && batchSupplierId ? batchSupplierId : null,
        notes: batchNotes || null,
        ...(batchType === "entrada" && paidCash && canSellCash && expenseTotal > 0 && { paid_cash: true }),
        items: validItems.map(i => ({
          product_id: i.product.id,
          quantity: i.quantity,
          unit_cost: i.unitCost ?? null,
          notes: i.notes || null,
        })),
      };
      await inventoryApi.batchCreate(payload);
      onCreated();
      resetForm();
      onClose();
    } catch (err) {
      console.error("Error al registrar movimiento agrupado", err);
      toast((err as Error)?.message || "Error al registrar movimiento agrupado", "error");
    } finally {
      setSubmitting(false);
    }
  }

  function resetForm() {
    setBatchType("entrada");
    setBatchSupplierId("");
    setBatchNotes("");
    setShowGeneralNotes(false);
    setPaidCash(false);
    setBatchItems([]);
    setAddSearch("");
    setShowAddDropdown(false);
  }

  function handleClose() {
    if (!submitting) {
      resetForm();
      onClose();
    }
  }

  return (
    <div className={styles.overlay} onClick={handleClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>Movimiento agrupado</h2>
          <button onClick={handleClose} className={styles.modalClose} disabled={submitting}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={submitBatch} className={styles.modalForm}>
          <div className={styles.formBody}>
            <div className={styles.segmented}>
              {(["entrada", "salida", "ajuste"] as const).map((t) => (
                <button
                  key={t} type="button"
                  onClick={() => setBatchType(t)}
                  className={`${styles.segBtn} ${batchType === t ? styles.segBtnActive : ""}`}
                >
                  {t === "entrada" ? "Compra" : t === "salida" ? "Merma" : "Ajuste"}
                </button>
              ))}
            </div>

            {batchType === "entrada" && (
              <div className={styles.field}>
                <label className={styles.fieldLabel}>Proveedor</label>
                <select value={batchSupplierId} onChange={(e) => setBatchSupplierId(e.target.value)} className={styles.select}>
                  <option value="">Sin proveedor</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
            )}

            <div className={styles.field}>
              <label className={styles.fieldLabel}>Productos</label>
              <div className={styles.searchWrap}>
                <input
                  ref={addSearchRef}
                  value={addSearch}
                  onChange={(e) => { setAddSearch(e.target.value); setShowAddDropdown(true); }}
                  onKeyDown={handleAddKeyDown}
                  onBlur={() => setTimeout(() => setShowAddDropdown(false), 200)}
                  placeholder="Buscar producto por nombre o código…"
                  className={styles.addSearchInput}
                />
                {showAddDropdown && addSearch && (
                  <div className={styles.batchDropdown}>
                    {addResults.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => addItemFromSearch(p)}
                        className={styles.batchDropdownItem}
                      >
                        <span className={styles.batchDropdownName}>{p.name}</span>
                        <span className={styles.batchDropdownStock}>Stock: {p.stock}</span>
                      </button>
                    ))}
                    {addResults.length === 0 && (
                      <div className={styles.batchDropdownEmpty}>Sin resultados</div>
                    )}
                  </div>
                )}
              </div>

              {batchItems.length === 0 ? (
                <div className={styles.emptyState}>
                  <PackageSearch size={26} strokeWidth={1.5} />
                  <p>Buscá un producto arriba para agregarlo a la lista</p>
                </div>
              ) : (
                <div className={styles.itemList}>
                  {batchItems.map((item) => {
                    const noun = costUnitNoun(item.product.unit_type);
                    // El "×" solo tiene sentido en empaques (paquete, caja,
                    // bolsa, ristra): ahí multiplicás empaques por su costo.
                    // En venta suelta es solo cantidad y costo unitario.
                    const isPackage = needsUnitQuantity(item.product.unit_type);
                    const subtotal = Math.round((item.unitCost ?? 0) * (item.quantity || 0) * 100) / 100;
                    return (
                      <div key={item.id} className={styles.itemCard}>
                        <div className={styles.itemHeader}>
                          <div className={styles.itemInfo}>
                            <span className={styles.itemName}>{item.product.name}</span>
                            {item.product.unit_type && (
                              <span className={styles.itemUnitBadge}>
                                {UNIT_TYPE_LABELS[item.product.unit_type] || item.product.unit_type}
                                {unitQuantitySuffix(item.product.unit_type, item.product.unit_quantity)}
                              </span>
                            )}
                          </div>
                          <button
                            type="button" title="Quitar"
                            onClick={() => removeBatchItem(item.id)}
                            className={styles.itemRemove}
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                        <div className={styles.itemRow}>
                          <div className={styles.itemField}>
                            <span className={styles.itemFieldLabel}>Cantidad</span>
                            <input
                              type="number" min={1}
                              value={item.quantity || ""}
                              onChange={(e) => updateBatchItem(item.id, { quantity: Math.max(0, Number(e.target.value)) })}
                              className={styles.itemQtyInput}
                            />
                          </div>
                          {isPackage && <span className={styles.itemTimes}>×</span>}
                          <div className={`${styles.itemField} ${styles.itemFieldGrow}`}>
                            <span className={styles.itemFieldLabel}>
                              {noun === "unidad" ? "Costo unitario" : `Costo por ${noun}`}
                            </span>
                            <input
                              type="number" min={0} step={0.01}
                              value={item.unitCost ?? ""}
                              onChange={(e) => updateBatchItem(item.id, { unitCost: e.target.value ? Number(e.target.value) : null })}
                              className={styles.itemCostInput}
                            />
                          </div>
                          <div className={styles.itemField}>
                            <span className={styles.itemFieldLabel}>Total</span>
                            <span className={styles.itemSubtotal}>{money(subtotal, currency)}</span>
                          </div>
                        </div>
                        {item.showNote ? (
                          <input
                            value={item.notes}
                            onChange={(e) => updateBatchItem(item.id, { notes: e.target.value })}
                            placeholder="Nota del producto (opcional)"
                            className={styles.itemNoteInput}
                            autoFocus
                          />
                        ) : (
                          <button
                            type="button"
                            onClick={() => updateBatchItem(item.id, { showNote: true })}
                            className={styles.noteToggle}
                          >
                            + Nota
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {showGeneralNotes ? (
              <div className={styles.field}>
                <label className={styles.fieldLabel}>Notas generales (opcional)</label>
                <textarea
                  value={batchNotes}
                  onChange={(e) => setBatchNotes(e.target.value)}
                  placeholder="Notas del movimiento"
                  className={styles.formTextarea}
                  rows={2}
                  autoFocus
                />
              </div>
            ) : (
              <button type="button" onClick={() => setShowGeneralNotes(true)} className={styles.noteToggle}>
                + Nota general
              </button>
            )}
          </div>

          <div className={styles.formFooter}>
            {batchType === "entrada" && cashRegisterEnabled && (
              <>
                <label className={styles.paidCashLabel}>
                  <input
                    type="checkbox"
                    checked={paidCash && canSellCash}
                    disabled={!canSellCash || expenseTotal <= 0}
                    onChange={(e) => setPaidCash(e.target.checked)}
                  />
                  Pagado en efectivo desde la caja
                </label>
                {!canSellCash && (
                  <p className={styles.paidCashHint}>Abrí la caja para registrar esta compra en efectivo</p>
                )}
                {paidCash && canSellCash && expenseTotal > 0 && (
                  <p className={styles.paidCashHint}>
                    Se restarán {money(expenseTotal, currency)} de la caja abierta
                  </p>
                )}
              </>
            )}
            <div className={styles.footerSummary}>
              <span>
                {validItems.length} producto{validItems.length === 1 ? "" : "s"} · {totalUnits} unidad{totalUnits === 1 ? "" : "es"}
              </span>
              <span className={styles.footerTotal}>{money(expenseTotal, currency)}</span>
            </div>
            <button type="submit" className={styles.primaryBtn} disabled={!canSubmit}>
              {submitting ? "Registrando…" : "Registrar movimiento"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
