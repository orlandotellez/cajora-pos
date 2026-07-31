import { PAYMENT_METHODS } from "@/lib/constants"
import styles from "./Filter.module.css"
import { X } from "lucide-react"

interface FilterProps {
  startDate: string
  setStartDate: (value: string) => void

  endDate: string
  setEndDate: (value: string) => void

  paymentFilter: string
  setPaymentFilter: (value: string) => void

  userNameFilter: string
  setUserNameFilter: (value: string) => void

  minQtyFilter: string
  setMinQtyFilter: (value: string) => void

  minItemsFilter: string
  setMinItemsFilter: (value: string) => void

  hasActiveFilters: boolean

  clearFilters: () => void
}

export const Filter = ({
  startDate,
  setStartDate,
  endDate,
  setEndDate,
  paymentFilter,
  setPaymentFilter,
  userNameFilter,
  setUserNameFilter,
  minItemsFilter,
  setMinItemsFilter,
  minQtyFilter,
  setMinQtyFilter,
  hasActiveFilters,
  clearFilters
}: FilterProps) => {
  return (
    <>
      <div className={styles.filters}>
        <input
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          aria-label="Fecha desde"
          className={styles.filterInput}
        />
        <input
          type="date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          aria-label="Fecha hasta"
          className={styles.filterInput}
        />
        <select
          value={paymentFilter}
          onChange={(e) => setPaymentFilter(e.target.value)}
          aria-label="Tipo de pago"
          className={styles.filterSelect}
        >
          <option value="">Todos los pagos</option>
          {PAYMENT_METHODS.map((pm) => (
            <option key={pm.value} value={pm.value}>{pm.label}</option>
          ))}
        </select>
        <input
          type="text"
          value={userNameFilter}
          onChange={(e) => setUserNameFilter(e.target.value)}
          placeholder="Usuario"
          aria-label="Filtrar por usuario"
          className={styles.filterInput}
        />
        <input
          type="number"
          min="1"
          value={minQtyFilter}
          onChange={(e) => setMinQtyFilter(e.target.value)}
          placeholder="Cantidad mín."
          aria-label="Cantidad mínima (suma de unidades en la venta)"
          className={`${styles.filterInput} ${styles.filterInputNarrow}`}
        />
        <input
          type="number"
          min="1"
          value={minItemsFilter}
          onChange={(e) => setMinItemsFilter(e.target.value)}
          placeholder="Arts. mín."
          aria-label="Artículos mínimos (líneas distintas en la venta)"
          className={`${styles.filterInput} ${styles.filterInputNarrow}`}
        />
        {hasActiveFilters && (
          <button type="button" onClick={clearFilters} className={styles.clearBtn} title="Limpiar todos los filtros">
            <X size={14} />
            <span>Limpiar</span>
          </button>
        )}
      </div>
    </>
  )
}

