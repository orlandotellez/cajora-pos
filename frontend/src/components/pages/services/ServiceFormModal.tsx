import { useEffect, useMemo, useRef, useState } from "react";
import { X, Package, Plus, Trash2 } from "lucide-react";
import { money } from "@/lib/format";
import { productsApi, type Product } from "@/api/products";
import type { Service } from "@/api";
import type { CreateServicePayload } from "@/api/services";
import { useCatalogoStore } from "@/store/catalogoStore";
import { stripAccents } from "@/lib/catalog";
import { useDebouncedSearch } from "@/hooks/useDebouncedSearch";
import styles from "./ServiceFormModal.module.css";
import { useModalBack } from "@/hooks/useModalBack";

interface Props {
  editing: Service | "new" | null;
  onClose: () => void;
  onSave: (
    payload: CreateServicePayload,
    isNew: boolean,
    editingService: Service | null,
  ) => Promise<void>;
  /** Callback para eliminar el servicio. Si no se provee, no se muestra la danger zone. */
  onDelete?: (service: Service) => void;
}

interface SelectedProduct {
  product_id: string;
  product_name: string;
  quantity: number;
}

const EMPTY_FORM = { name: "", description: "", base_price: 0 };

/**
 * Combobox de producto con búsqueda vía API (nombre, barcode o categoría).
 * Reemplaza al <select> nativo: encontrás CUALQUIER producto del catálogo,
 * no solo los que venían precargados.
 */
function ProductRowCombobox({
  productId,
  productName,
  takenIds,
  onSelect,
}: {
  /** Id del producto actual de la fila ("" si la fila aún no eligió). */
  productId: string;
  productName: string;
  /** Ids de productos ya elegidos en OTRAS filas (para no repetirlos). */
  takenIds: Set<string>;
  onSelect: (p: Product) => void;
}) {
  const [draft, setDraft] = useState(productName);
  const [open, setOpen] = useState(false);
  const catalogoProducts = useCatalogoStore((s) => s.products);
  const catalogoLoaded = useCatalogoStore((s) => s.loaded);

  // Al elegir un producto, el nombre del input se sincroniza con él.
  useEffect(() => {
    setDraft(productName);
  }, [productName]);

  const isDirty = draft !== productName;

  const { results: apiResults, loading } = useDebouncedSearch<Product>({
    query: catalogoLoaded ? "" : (isDirty && draft) || "",
    fetcher: async (term) => {
      const res = await productsApi.list({ search: term, active: true, limit: 15 });
      return res.products;
    },
  });

  // Búsqueda local sobre el catálogo completo, ignorando acentos/mayúsculas.
  const localResults: Product[] = useMemo(() => {
    if (!catalogoLoaded) return [];
    const term = isDirty ? draft : "";
    const q = stripAccents(term.trim().toLowerCase());
    if (!q) return [];
    const all = Object.values(catalogoProducts);
    const out: Product[] = [];
    for (const p of all) {
      if (
        stripAccents(p.name.toLowerCase()).includes(q) ||
        (p.barcode && p.barcode.toLowerCase().includes(q))
      ) {
        out.push(p);
        if (out.length >= 15) break;
      }
    }
    return out;
  }, [catalogoLoaded, catalogoProducts, draft, isDirty]);

  const results = catalogoLoaded ? localResults : apiResults;
  const available = results.filter((p) => p.id === productId || !takenIds.has(p.id));

  function select(p: Product) {
    onSelect(p);
    setDraft(p.name);
    setOpen(false);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      if (available.length > 0) select(available[0]);
    } else if (e.key === "Escape") {
      setOpen(false);
      setDraft(productName);
    }
  }

  return (
    <div className={styles["product-combo"]}>
      <input
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value);
          setOpen(true);
        }}
        onFocus={(e) => {
          // Al enfocar, seleccionar el texto para que tipear reemplace directo.
          e.target.select();
          setOpen(true);
        }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={handleKeyDown}
        placeholder="Buscar producto…"
        className={styles["product-combo-input"]}
      />
      {/* Solo abrir el dropdown si el usuario modificó el texto (o la fila
          es nueva y no eligió nada todavía). */}
      {(isDirty || !productName) && open && draft.trim() && (
        <div className={styles["product-dropdown"]}>
          {loading ? (
            <div className={styles["product-dropdown-empty"]}>Buscando…</div>
          ) : available.length > 0 ? (
            available.map((p) => (
              <button
                key={p.id}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => select(p)}
                className={styles["product-dropdown-item"]}
              >
                <span className={styles["product-dropdown-name"]}>{p.name}</span>
                <span className={styles["product-dropdown-stock"]}>Stock: {p.stock}</span>
              </button>
            ))
          ) : (
            <div className={styles["product-dropdown-empty"]}>Sin resultados</div>
          )}
        </div>
      )}
    </div>
  );
}

export function ServiceFormModal({ editing, onClose, onSave, onDelete }: Props) {
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
        products: selectedProducts
          .filter((sp) => sp.product_id)
          .map((sp) => ({
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
    // Agrega una fila vacía: el usuario busca y elige desde el combobox.
    setSelectedProducts((prev) => [
      ...prev,
      { product_id: "", product_name: "", quantity: 1 },
    ]);
  }

  function changeProduct(rowIndex: number, product: Product) {
    if (
      selectedProducts.some(
        (sp, i) => i !== rowIndex && sp.product_id === product.id,
      )
    ) {
      return;
    }
    setSelectedProducts((prev) =>
      prev.map((sp, i) =>
        i === rowIndex
          ? { ...sp, product_id: product.id, product_name: product.name }
          : sp,
      ),
    );
  }

  function removeProduct(rowIndex: number) {
    setSelectedProducts((prev) => prev.filter((_, i) => i !== rowIndex));
  }

  function updateQty(rowIndex: number, qty: number) {
    if (qty <= 0) {
      removeProduct(rowIndex);
      return;
    }
    setSelectedProducts((prev) =>
      prev.map((sp, i) => (i === rowIndex ? { ...sp, quantity: qty } : sp)),
    );
  }

  if (!editing) return null;

  const takenIds = new Set(
    selectedProducts.map((sp) => sp.product_id).filter(Boolean),
  );

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
                {selectedProducts.map((sp, i) => (
                  <div key={sp.product_id || `new-${i}`} className={styles["product-row"]}>
                    <ProductRowCombobox
                      productId={sp.product_id}
                      productName={sp.product_name}
                      takenIds={takenIds}
                      onSelect={(p) => changeProduct(i, p)}
                    />
                    <input
                      type="number"
                      min="1"
                      value={sp.quantity}
                      onChange={(e) => updateQty(i, Number(e.target.value))}
                      className={styles["product-qty"]}
                      disabled={!sp.product_id}
                    />
                    <button
                      type="button"
                      onClick={() => removeProduct(i)}
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

          {!isNew && onDelete && editingService && (
            <section className={styles.dangerZone}>
              <h3 className={styles.dangerTitle}>Zona de peligro</h3>
              <p className={styles.dangerHint}>
                Eliminar este servicio es una acción permanente y no se puede deshacer.
              </p>
              <button
                type="button"
                onClick={() => onDelete(editingService)}
                className={styles.dangerBtn}
              >
                <Trash2 size={14} />
                Eliminar servicio
              </button>
            </section>
          )}
        </form>
      </div>
    </div>
  );
}