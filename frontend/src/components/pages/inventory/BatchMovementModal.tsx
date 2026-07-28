import { useState, useRef } from "react";
import { X } from "lucide-react";
import { inventoryApi } from "@/api/inventory";
import type { Supplier, Product } from "@/api";
import type { CreateBatchPayload } from "@/api/inventory";
import { UNIT_TYPE_LABELS } from "@/lib/constants";
import styles from "../../../pages/inventory/Inventory.module.css";

interface BatchMovementModalProps {
  open: boolean;
  suppliers: Supplier[];
  products: Product[];
  onClose: () => void;
  onCreated: () => void;
}

type BatchFormItem = {
  id: string;
  productSearch: string;
  selectedProduct: Product | null;
  quantity: number;
  unitCost: number | null;
  notes: string;
  showDropdown: boolean;
};

export function BatchMovementModal({ open, suppliers, products, onClose, onCreated }: BatchMovementModalProps) {
  const [batchType, setBatchType] = useState<"entrada" | "salida" | "ajuste">("entrada");
  const [batchSupplierId, setBatchSupplierId] = useState("");
  const [batchNotes, setBatchNotes] = useState("");
  const [batchItems, setBatchItems] = useState<BatchFormItem[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const itemIdCounter = useRef(0);

  if (!open) return null;

  function searchProducts(query: string): Product[] {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    return products.filter(p =>
      p.name.toLowerCase().includes(q) ||
      (p.barcode && p.barcode.toLowerCase().includes(q))
    ).slice(0, 8);
  }

  function addBatchItem() {
    itemIdCounter.current += 1;
    setBatchItems(prev => [...prev, {
      id: `bi_${itemIdCounter.current}`,
      productSearch: "",
      selectedProduct: null,
      quantity: 0,
      unitCost: null,
      notes: "",
      showDropdown: false,
    }]);
  }

  function removeBatchItem(id: string) {
    setBatchItems(prev => prev.filter(i => i.id !== id));
  }

  function updateBatchItem(id: string, updates: Partial<BatchFormItem>) {
    setBatchItems(prev => prev.map(i => i.id === id ? { ...i, ...updates } : i));
  }

  function selectProductForItem(itemId: string, product: Product) {
    updateBatchItem(itemId, {
      selectedProduct: product,
      productSearch: product.name,
      showDropdown: false,
    });
  }

  async function submitBatch(e: React.FormEvent) {
    e.preventDefault();
    const validItems = batchItems.filter(i => i.selectedProduct && i.quantity > 0);
    if (validItems.length === 0) {
      return;
    }
    setSubmitting(true);
    try {
      const payload: CreateBatchPayload = {
        movement_type: batchType,
        supplier_id: batchType === "entrada" && batchSupplierId ? batchSupplierId : null,
        notes: batchNotes || null,
        items: validItems.map(i => ({
          product_id: i.selectedProduct!.id,
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
    } finally {
      setSubmitting(false);
    }
  }

  function resetForm() {
    setBatchType("entrada");
    setBatchSupplierId("");
    setBatchNotes("");
    setBatchItems([]);
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
          <div className={styles.field}>
            <label className={styles.fieldLabel}>Tipo de movimiento</label>
            <select value={batchType} onChange={(e) => setBatchType(e.target.value as "entrada" | "salida" | "ajuste")} className={styles.select}>
              <option value="entrada">Entrada (compra)</option>
              <option value="salida">Salida (merma)</option>
              <option value="ajuste">Ajuste</option>
            </select>
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
            <label className={styles.fieldLabel}>Notas generales (opcional)</label>
            <textarea
              value={batchNotes}
              onChange={(e) => setBatchNotes(e.target.value)}
              placeholder="Notas del movimiento"
              className={styles.formTextarea}
              rows={3}
            />
          </div>

          <div className={styles.field}>
            <label className={styles.fieldLabel}>Productos</label>
            <div className={styles.batchFormItems}>
              {batchItems.map((item) => (
                <div key={item.id} className={styles.batchFormItem}>
                  <div className={styles.batchFormItemRow}>
                    <div className={styles.batchFormSearchWrap}>
                      <input
                        value={item.productSearch}
                        onChange={(e) => {
                          const val = e.target.value;
                          updateBatchItem(item.id, { productSearch: val, selectedProduct: null, showDropdown: true });
                        }}
                        onBlur={() => setTimeout(() => updateBatchItem(item.id, { showDropdown: false }), 200)}
                        placeholder="Buscar producto…"
                        className={styles.batchFormSearchInput}
                      />
                      {item.showDropdown && item.productSearch && (
                        <div className={styles.batchDropdown}>
                          {searchProducts(item.productSearch).map((p) => (
                            <button
                              key={p.id}
                              type="button"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => selectProductForItem(item.id, p)}
                              className={styles.batchDropdownItem}
                            >
                              <span>{p.name}</span>
                              <span className={styles.batchDropdownStock}>Stock: {p.stock}</span>
                            </button>
                          ))}
                          {searchProducts(item.productSearch).length === 0 && (
                            <div className={styles.batchDropdownEmpty}>Sin resultados</div>
                          )}
                        </div>
                      )}
                    </div>
                    <button type="button" onClick={() => removeBatchItem(item.id)} className={styles.batchFormRemove}>
                      <X size={16} />
                    </button>
                  </div>
                  <div className={styles.batchFormQtyRow}>
                    <input
                      type="number" min={1} value={item.quantity || ""}
                      onChange={(e) => updateBatchItem(item.id, { quantity: Math.max(0, Number(e.target.value)) })}
                      placeholder="Cantidad"
                      className={styles.batchFormQtyInput}
                    />
                    {item.selectedProduct?.unit_type && (
                      <span className={styles.batchFormUnitBadge}>
                        {UNIT_TYPE_LABELS[item.selectedProduct.unit_type] || item.selectedProduct.unit_type}
                        {item.selectedProduct.unit_quantity ? ` × ${item.selectedProduct.unit_quantity}` : ""}
                      </span>
                    )}
                  </div>
                  <input
                    type="number" min={0} step={0.01}
                    value={item.unitCost ?? ""}
                    onChange={(e) => updateBatchItem(item.id, { unitCost: e.target.value ? Number(e.target.value) : null })}
                    placeholder="Costo unitario"
                    className={styles.batchFormCostInput}
                  />
                  <input
                    value={item.notes}
                    onChange={(e) => updateBatchItem(item.id, { notes: e.target.value })}
                    placeholder="Notas del producto (opcional)"
                    className={styles.batchFormNotesInput}
                  />
                </div>
              ))}
            </div>
            <button type="button" onClick={addBatchItem} className={styles.outlineBtn}>
              + Agregar producto
            </button>
          </div>

          {batchItems.filter(i => i.selectedProduct).length > 0 && (
            <div className={styles.batchSummary}>
              <div className={styles.batchSummaryTitle}>Resumen</div>
              <div className={styles.batchSummaryGrid}>
                <div className={styles.batchSummaryItem}>
                  <span className={styles.batchSummaryLabel}>Productos</span>
                  <span className={styles.batchSummaryValue}>{batchItems.filter(i => i.selectedProduct).length}</span>
                </div>
                <div className={styles.batchSummaryItem}>
                  <span className={styles.batchSummaryLabel}>Total unidades</span>
                  <span className={styles.batchSummaryValue}>
                    {batchItems.reduce((sum, i) => sum + (i.quantity || 0), 0)}
                  </span>
                </div>
              </div>
            </div>
          )}

          <button type="submit" className={styles.primaryBtn} disabled={submitting}>
            {submitting ? "Registrando…" : "Registrar movimiento agrupado"}
          </button>
        </form>
      </div>
    </div>
  );
}
