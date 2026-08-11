import { useState } from "react";
import { X, Camera } from "lucide-react";
import { productsApi, type Product, type UpdateProductPayload } from "@/api/products";
import { useToast } from "@/components/common/ui/Toast";
import { UNIT_TYPE_LABELS } from "@/lib/constants";
import { money } from "@/lib/format";
import { BarcodeScanner } from "@/components/common/BarcodeScanner";
import type { Category, Supplier } from "@/api";
import styles from "./EditInventoryModal.module.css";

interface EditInventoryModalProps {
  product: Product;
  categories: Category[];
  suppliers: Supplier[];
  onClose: () => void;
  onSaved: () => void;
}

export function EditInventoryModal({ product, categories, suppliers, onClose, onSaved }: EditInventoryModalProps) {
  const { toast } = useToast();
  const [name, setName] = useState(product.name);
  const [barcode, setBarcode] = useState(product.barcode ?? "");
  const [unitType, setUnitType] = useState(product.unit_type ?? "");
  const [unitQuantity, setUnitQuantity] = useState(product.unit_quantity ?? 0);
  const [categoryId, setCategoryId] = useState(product.category?.id ?? "");
  const [supplierId, setSupplierId] = useState(product.supplier?.id ?? "");
  const [price, setPrice] = useState(product.price);
  const [cost, setCost] = useState(product.cost);
  const [lowStockThreshold, setLowStockThreshold] = useState(product.low_stock_threshold);
  const [barcodeScannerOpen, setBarcodeScannerOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const margin = price - cost;
  const marginPct = price > 0 ? (margin / price) * 100 : 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      // En edición los ids vacíos van como `null` (el server los desenlaza).
      const data: UpdateProductPayload = {
        name,
        barcode: barcode || null,
        unit_type: unitType || null,
        unit_quantity: unitQuantity || null,
        category_id: categoryId || null,
        supplier_id: supplierId || null,
        price,
        cost,
        low_stock_threshold: lowStockThreshold,
      };
      await productsApi.update(product.id, data);
      onSaved();
      onClose();
      toast("Producto actualizado", "success");
    } catch (err) {
      console.error("Error al actualizar producto", err);
      toast((err as Error)?.message || "Error al actualizar producto", "error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>Editar producto</h2>
          <button onClick={onClose} className={styles.modalClose}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className={styles.modalForm}>
          <div className={styles.field}>
            <label className={styles.fieldLabel}>Nombre *</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={styles.input} required
            />
          </div>
          <div className={styles.field}>
            <label className={styles.fieldLabel}>Código de barras</label>
            <div className={styles.barcodeWrapper}>
              <input
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
                className={styles.barcodeInput}
                placeholder="Escanear o escribir"
              />
              <button
                type="button"
                onClick={() => setBarcodeScannerOpen(true)}
                className={styles.barcodeScanBtn}
                title="Escanear código de barras"
              >
                <Camera size={18} />
              </button>
            </div>
          </div>

          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Empaque y clasificación</h3>
            <div className={styles.formGrid}>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>Tipo de empaque</label>
                <select value={unitType} onChange={(e) => setUnitType(e.target.value)} className={styles.select}>
                  <option value="">Sin empaque</option>
                  {Object.entries(UNIT_TYPE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>Cant. x empaque</label>
                <input
                  type="number" min="0"
                  value={unitQuantity}
                  onChange={(e) => setUnitQuantity(Number(e.target.value))}
                  className={styles.input}
                />
              </div>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>Categoría</label>
                <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={styles.select}>
                  <option value="">Sin categoría</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>Proveedor</label>
                <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)} className={styles.select}>
                  <option value="">Sin proveedor</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </section>

          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Precio y costo</h3>
            <div className={styles.formGrid}>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>Precio venta</label>
                <input
                  type="number" step="0.01" min="0"
                  value={price}
                  onChange={(e) => setPrice(Number(e.target.value))}
                  className={styles.input} required
                />
              </div>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>Costo</label>
                <input
                  type="number" step="0.01" min="0"
                  value={cost}
                  onChange={(e) => setCost(Number(e.target.value))}
                  className={styles.input} required
                />
              </div>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>Alerta stock bajo</label>
                <input
                  type="number" min="0"
                  value={lowStockThreshold}
                  onChange={(e) => setLowStockThreshold(Number(e.target.value))}
                  className={styles.input} required
                />
              </div>
            </div>

            <div className={styles.marginBox}>
              <span className={styles.marginLabel}>Margen estimado</span>
              <div className={styles.marginValues}>
                <span className={`${styles.marginMoney} ${margin < 0 ? styles.marginNegative : ""}`}>
                  {money(margin)}
                </span>
                <span className={`${styles.marginPct} ${margin < 0 ? styles.marginNegative : ""}`}>
                  {marginPct.toFixed(1)}%
                </span>
              </div>
            </div>
          </section>

          <button type="submit" className={styles.primaryBtn} disabled={submitting}>
            {submitting ? "Guardando…" : "Guardar"}
          </button>
        </form>

        <BarcodeScanner
          open={barcodeScannerOpen}
          onScan={(code) => {
            setBarcode(code);
            setBarcodeScannerOpen(false);
          }}
          onClose={() => setBarcodeScannerOpen(false)}
        />
      </div>
    </div>
  );
}
