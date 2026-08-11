import { Camera, X } from "lucide-react"
import styles from "./EditProductModal.module.css"
import { UNIT_TYPE_LABELS } from "@/lib/constants"
import type { Category, Supplier } from "@/api";

type Form = {
  name: string,
  barcode: string
  unit_type: string,
  unit_quantity: number,
  category_id: string,
  supplier_id: string,
  price: number,
  cost: number,
  stock: number,
  low_stock_threshold: number,
}

interface EditProductModalProps {
  setEditing: () => void
  form: Form
  setForm: React.Dispatch<React.SetStateAction<Form>>
  handleSave: (e: React.FormEvent) => Promise<void>
  submitting: boolean
  setBarcodeScannerOpen: React.Dispatch<React.SetStateAction<boolean>>
  categories: Category[]
  suppliers: Supplier[]
}

export const EditProductModal = ({ setEditing, handleSave, form, setForm, submitting, setBarcodeScannerOpen, categories, suppliers }: EditProductModalProps) => {
  return (
    <>
      <div className={styles.overlay} onClick={setEditing}>
        <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
          <div className={styles.modalHeader}>
            <h2 className={styles.modalTitle}>Nuevo producto</h2>
            <button onClick={setEditing} className={styles.modalClose}>
              <X size={18} />
            </button>
          </div>

          <form onSubmit={handleSave} className={styles.modalForm}>
            <div className={styles.field}>
              <label className={styles.fieldLabel}>Nombre *</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={styles.input} required />
            </div>
            <div className={styles.field}>
              <label className={styles.fieldLabel}>Código de barras</label>
              <div className={styles.barcodeWrapper}>
                <input value={form.barcode} onChange={(e) => setForm({ ...form, barcode: e.target.value })} className={styles.barcodeInput} placeholder="Escanear o escribir" />
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
                <select value={form.unit_type} onChange={(e) => setForm({ ...form, unit_type: e.target.value })} className={styles.select}>
                  <option value="">Sin empaque</option>
                  {Object.entries(UNIT_TYPE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>Cant. x empaque</label>
                <input type="number" min="0" value={form.unit_quantity} onChange={(e) => setForm({ ...form, unit_quantity: Number(e.target.value) })} className={styles.input} />
              </div>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>Categoría</label>
                <select value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })} className={styles.select}>
                  <option value="">Sin categoría</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>Proveedor</label>
                <select value={form.supplier_id} onChange={(e) => setForm({ ...form, supplier_id: e.target.value })} className={styles.select}>
                  <option value="">Sin proveedor</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className={styles.formGrid}>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>Precio venta</label>
                <input type="number" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: Number(e.target.value) })} className={styles.input} />
              </div>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>Costo</label>
                <input type="number" step="0.01" value={form.cost} onChange={(e) => setForm({ ...form, cost: Number(e.target.value) })} className={styles.input} />
              </div>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>Stock inicial</label>
                <input type="number" value={form.stock} onChange={(e) => setForm({ ...form, stock: Number(e.target.value) })} className={styles.input} />
              </div>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>Alerta stock bajo</label>
                <input type="number" value={form.low_stock_threshold} onChange={(e) => setForm({ ...form, low_stock_threshold: Number(e.target.value) })} className={styles.input} />
              </div>
            </div>
            <div className={styles.formActions}>
              <button type="submit" className={`${styles.primaryBtn} ${styles.btnFit}`} disabled={submitting}>
                {submitting ? "Guardando…" : "Guardar"}
              </button>
              <button type="button" onClick={setEditing} className={styles.secondaryBtn}>
                Cancelar
              </button>
            </div>
          </form>
        </div >
      </div >
    </>
  )
}
