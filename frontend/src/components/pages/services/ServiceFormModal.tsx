import { useEffect, useState } from "react";
import { X, Package, Plus } from "lucide-react";
import { money } from "@/lib/format";
import type { Service, Product } from "@/api";
import type { CreateServicePayload } from "@/api/services";
import styles from "./ServiceFormModal.module.css";
import { useModalBack } from "@/hooks/useModalBack";

interface Props {
  editing: Service | "new" | null;
  products: Product[];
  onClose: () => void;
  onSave: (
    payload: CreateServicePayload,
    isNew: boolean,
    editingService: Service | null,
  ) => Promise<void>;
}

interface SelectedProduct {
  product_id: string;
  product_name: string;
  quantity: number;
}

const EMPTY_FORM = { name: "", description: "", base_price: 0 };

export function ServiceFormModal({ editing, products, onClose, onSave }: Props) {
  const isNew = typeof editing === "string";
  const editingService = typeof editing === "object" ? editing : null;

  // Botón de retroceso de Android / gesto de regreso cierra el modal.
  useModalBack(onClose);

  const [form, setForm] = useState(EMPTY_FORM);
  const [selectedProducts, setSelectedProducts] = useState<SelectedProduct[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Sincroniza form state cuando editing cambia (incl. "new" → service o service → null)
  useEffect(() => {
    if (typeof editing === "string") {
      setForm(EMPTY_FORM);
      setSelectedProducts([]);
      setError("");
      return;
    }
    if (editing) {
      setForm({
        name: editing.name,
        description: editing.description ?? "",
        base_price: editing.base_price,
      });
      setSelectedProducts(
        editing.products.map((sp) => ({
          product_id: sp.product_id,
          product_name: sp.product_name,
          quantity: sp.quantity,
        })),
      );
      setError("");
    }
  }, [editing]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const payload: CreateServicePayload = {
        name: form.name,
        description: form.description || undefined,
        base_price: form.base_price,
        products: selectedProducts.map((sp) => ({
          product_id: sp.product_id,
          quantity: sp.quantity,
        })),
      };
      await onSave(payload, isNew, editingService);
    } catch (err) {
      console.error("Error al guardar servicio:", err);
      setError(err instanceof Error ? err.message : "Error al guardar el servicio");
    } finally {
      setSubmitting(false);
    }
  }

  function addProduct() {
    const available = products.filter(
      (p) => !selectedProducts.find((sp) => sp.product_id === p.id),
    );
    if (available.length === 0) return;
    const first = available[0];
    setSelectedProducts([
      ...selectedProducts,
      { product_id: first.id, product_name: first.name, quantity: 1 },
    ]);
  }

  function removeProduct(productId: string) {
    setSelectedProducts(selectedProducts.filter((sp) => sp.product_id !== productId));
  }

  function updateQty(productId: string, qty: number) {
    if (qty <= 0) {
      removeProduct(productId);
      return;
    }
    setSelectedProducts(
      selectedProducts.map((sp) =>
        sp.product_id === productId ? { ...sp, quantity: qty } : sp,
      ),
    );
  }

  function changeProduct(oldId: string, newId: string) {
    const prod = products.find((p) => p.id === newId);
    if (
      !prod ||
      selectedProducts.find((sp) => sp.product_id === newId && sp.product_id !== oldId)
    ) {
      return;
    }
    setSelectedProducts(
      selectedProducts.map((sp) =>
        sp.product_id === oldId
          ? { ...sp, product_id: prod.id, product_name: prod.name }
          : sp,
      ),
    );
  }

  if (!editing) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>
            {isNew ? "Nuevo servicio" : "Editar servicio"}
          </h2>
          <button onClick={onClose} className={styles.modalClose}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className={styles.modalForm}>
          <div className={styles.field}>
            <label className={styles.fieldLabel}>Nombre *</label>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className={styles.input}
              required
            />
          </div>
          <div className={styles.field}>
            <label className={styles.fieldLabel}>Descripción</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className={styles.textarea}
              rows={3}
            />
          </div>
          <div className={styles.field}>
            <label className={styles.fieldLabel}>Precio base *</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={form.base_price}
              onChange={(e) => setForm({ ...form, base_price: Number(e.target.value) })}
              className={styles.input}
              required
            />
          </div>

          <div className={styles.field}>
            <div className={styles["products-header"]}>
              <label className={styles.fieldLabel}>Productos asociados</label>
              <button type="button" onClick={addProduct} className={styles["add-product-btn"]}>
                <Plus size={12} /> Agregar
              </button>
            </div>
            {selectedProducts.length === 0 ? (
              <div className={styles["no-products"]}>
                <Package size={20} />
                <span className={styles["no-products-text"]}>
                  Sin productos asociados
                </span>
              </div>
            ) : (
              <div className={styles["products-list"]}>
                {selectedProducts.map((sp) => (
                  <div key={sp.product_id} className={styles["product-row"]}>
                    <select
                      value={sp.product_id}
                      onChange={(e) => changeProduct(sp.product_id, e.target.value)}
                      className={styles["product-select"]}
                    >
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} — {money(p.price)}
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      min="1"
                      value={sp.quantity}
                      onChange={(e) => updateQty(sp.product_id, Number(e.target.value))}
                      className={styles["product-qty"]}
                    />
                    <button
                      type="button"
                      onClick={() => removeProduct(sp.product_id)}
                      className={styles["product-remove"]}
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {error && <p className={styles.error}>{error}</p>}

          <div className={styles["form-actions"]}>
            <button type="submit" className={styles.primaryBtn} disabled={submitting}>
              {submitting ? "Guardando…" : "Guardar"}
            </button>
            <button type="button" onClick={onClose} className={styles.secondaryBtn}>
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
