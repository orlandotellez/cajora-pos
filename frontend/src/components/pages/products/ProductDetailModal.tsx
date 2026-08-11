import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { X, Pencil, Camera, ArrowRight } from "lucide-react";
import { productsApi, type Product, type UpdateProductPayload } from "@/api/products";
import { useToast } from "@/components/common/ui/Toast";
import { money } from "@/lib/format";
import { UNIT_TYPE_LABELS } from "@/lib/constants";
import { BarcodeScanner } from "@/components/common/BarcodeScanner";
import type { Category, Supplier } from "@/api";
import styles from "./ProductDetailModal.module.css";

interface ProductDetailModalProps {
  product: Product;
  categories: Category[];
  suppliers: Supplier[];
  onClose: () => void;
  onSaved: () => void;
}

type Form = {
  name: string;
  barcode: string;
  unit_type: string;
  unit_quantity: number;
  category_id: string;
  supplier_id: string;
};

export function ProductDetailModal({ product, categories, suppliers, onClose, onSaved }: ProductDetailModalProps) {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [productData, setProductData] = useState(product);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [barcodeScannerOpen, setBarcodeScannerOpen] = useState(false);
  const [form, setForm] = useState<Form>({
    name: product.name,
    barcode: product.barcode ?? "",
    unit_type: product.unit_type ?? "",
    unit_quantity: product.unit_quantity ?? 0,
    category_id: product.category?.id ?? "",
    supplier_id: product.supplier?.id ?? "",
  });

  const unitLabel = productData.unit_type
    ? UNIT_TYPE_LABELS[productData.unit_type] || productData.unit_type
    : "—";

  function startEdit() {
    setForm({
      name: productData.name,
      barcode: productData.barcode ?? "",
      unit_type: productData.unit_type ?? "",
      unit_quantity: productData.unit_quantity ?? 0,
      category_id: productData.category?.id ?? "",
      supplier_id: productData.supplier?.id ?? "",
    });
    setEditing(true);
  }

  async function handleSave() {
    if (!form.name.trim()) {
      toast("El nombre es obligatorio", "error");
      return;
    }
    setSaving(true);
    try {
      // En edición los ids vacíos van como `null` (el server los desenlaza).
      const data: UpdateProductPayload = {
        name: form.name,
        barcode: form.barcode || null,
        unit_type: form.unit_type || null,
        unit_quantity: form.unit_quantity || null,
        category_id: form.category_id || null,
        supplier_id: form.supplier_id || null,
      };
      await productsApi.update(productData.id, data);
      setProductData({
        ...productData,
        name: form.name,
        barcode: form.barcode || undefined,
        unit_type: form.unit_type || undefined,
        unit_quantity: form.unit_quantity || undefined,
        category: form.category_id ? categories.find((c) => c.id === form.category_id) : undefined,
        supplier: form.supplier_id ? suppliers.find((s) => s.id === form.supplier_id) ?? null : null,
      });
      setEditing(false);
      onSaved();
      toast("Producto actualizado", "success");
    } catch (err) {
      console.error("Error al actualizar producto", err);
      toast((err as Error)?.message || "Error al actualizar producto", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>Detalle del producto</h2>
          <button onClick={onClose} className={styles.modalClose}>
            <X size={18} />
          </button>
        </div>

        <div className={styles.modalBody}>
          <div className={styles.productHeader}>
            <div className={styles.productName}>{productData.name}</div>
            {productData.barcode && (
              <div className={styles.productBarcode}>{productData.barcode}</div>
            )}
          </div>

          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <h3 className={styles.sectionTitle}>Datos generales</h3>
              {!editing && (
                <button onClick={startEdit} className={styles.editBtn}>
                  <Pencil size={13} />
                  Editar
                </button>
              )}
            </div>

            {!editing ? (
              <div className={styles.detailGrid}>
                <div className={styles.detailItem}>
                  <span className={styles.detailLabel}>Código de barras</span>
                  <span className={`${styles.detailValue} ${styles.detailBarcode}`}>
                    {productData.barcode || "—"}
                  </span>
                </div>
                <div className={styles.detailItem}>
                  <span className={styles.detailLabel}>Tipo de empaque</span>
                  <span className={styles.detailValue}>{unitLabel}</span>
                </div>
                <div className={styles.detailItem}>
                  <span className={styles.detailLabel}>Cant. x empaque</span>
                  <span className={styles.detailValue}>{productData.unit_quantity ?? "—"}</span>
                </div>
                <div className={styles.detailItem}>
                  <span className={styles.detailLabel}>Categoría</span>
                  <span className={styles.detailValue}>{productData.category?.name || "—"}</span>
                </div>
                <div className={styles.detailItem}>
                  <span className={styles.detailLabel}>Proveedor</span>
                  <span className={styles.detailValue}>{productData.supplier?.name || "—"}</span>
                </div>
              </div>
            ) : (
              <div className={styles.editForm}>
                <div className={styles.field}>
                  <label className={styles.fieldLabel}>Nombre *</label>
                  <input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className={styles.input}
                  />
                </div>
                <div className={styles.field}>
                  <label className={styles.fieldLabel}>Código de barras</label>
                  <div className={styles.barcodeWrapper}>
                    <input
                      value={form.barcode}
                      onChange={(e) => setForm({ ...form, barcode: e.target.value })}
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
                <div className={styles.formGrid}>
                  <div className={styles.field}>
                    <label className={styles.fieldLabel}>Tipo de empaque</label>
                    <select
                      value={form.unit_type}
                      onChange={(e) => setForm({ ...form, unit_type: e.target.value })}
                      className={styles.select}
                    >
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
                      value={form.unit_quantity}
                      onChange={(e) => setForm({ ...form, unit_quantity: Number(e.target.value) })}
                      className={styles.input}
                    />
                  </div>
                  <div className={styles.field}>
                    <label className={styles.fieldLabel}>Categoría</label>
                    <select
                      value={form.category_id}
                      onChange={(e) => setForm({ ...form, category_id: e.target.value })}
                      className={styles.select}
                    >
                      <option value="">Sin categoría</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className={styles.field}>
                    <label className={styles.fieldLabel}>Proveedor</label>
                    <select
                      value={form.supplier_id}
                      onChange={(e) => setForm({ ...form, supplier_id: e.target.value })}
                      className={styles.select}
                    >
                      <option value="">Sin proveedor</option>
                      {suppliers.map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className={styles.editActions}>
                  <button type="button" onClick={() => setEditing(false)} className={styles.secondaryBtn} disabled={saving}>
                    Cancelar
                  </button>
                  <button onClick={handleSave} className={styles.primaryBtn} disabled={saving}>
                    {saving ? "Guardando…" : "Guardar"}
                  </button>
                </div>
              </div>
            )}
          </section>

          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Información comercial</h3>
            <div className={styles.detailGrid}>
              <div className={styles.detailItem}>
                <span className={styles.detailLabel}>Precio venta</span>
                <span className={styles.detailValue}>{money(productData.price)}</span>
              </div>
              <div className={styles.detailItem}>
                <span className={styles.detailLabel}>Costo</span>
                <span className={styles.detailValue}>{money(productData.cost)}</span>
              </div>
              <div className={styles.detailItem}>
                <span className={styles.detailLabel}>Stock</span>
                <span className={styles.detailValue}>{productData.stock}</span>
              </div>
              <div className={styles.detailItem}>
                <span className={styles.detailLabel}>Alerta stock bajo</span>
                <span className={styles.detailValue}>{productData.low_stock_threshold}</span>
              </div>
            </div>
            <p className={styles.sectionHint}>
              Precio, costo y stock se gestionan desde la sección Inventario.
            </p>
            <button
              onClick={() => {
                onClose();
                navigate("/inventory");
              }}
              className={styles.inventoryBtn}
            >
              Ir a Inventario
              <ArrowRight size={14} />
            </button>
          </section>

          <button onClick={onClose} className={styles.closeBtn}>
            Cerrar
          </button>
        </div>
      </div>

      <BarcodeScanner
        open={barcodeScannerOpen}
        onScan={(code) => {
          setForm({ ...form, barcode: code });
          setBarcodeScannerOpen(false);
        }}
        onClose={() => setBarcodeScannerOpen(false)}
      />
    </div>
  );
}
