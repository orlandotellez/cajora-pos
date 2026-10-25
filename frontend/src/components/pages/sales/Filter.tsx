import { useState } from "react";
import { SlidersHorizontal, X } from "lucide-react";
import { PAYMENT_METHODS } from "@/lib/constants";
import { detectPeriod, periodRange, type SalesPeriod } from "@/lib/date-range";
import styles from "./Filter.module.css"

interface FilterProps {
  startDate: string
  setStartDate: (value: string) => void

  endDate: string
  setEndDate: (value: string) => void

  paymentFilter: string
  setPaymentFilter: (value: string) => void

  userNameFilter: string
  setUserNameFilter: (value: string) => void

  minItemsFilter: string
  setMinItemsFilter: (value: string) => void

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
  clearFilters
}: FilterProps) => {
  const [open, setOpen] = useState(false)
  const [customPeriod, setCustomPeriod] = useState(false)
  const period = customPeriod ? "custom" : detectPeriod(startDate, endDate)
  const extraCount = [paymentFilter, userNameFilter, minItemsFilter].filter((v) => v.trim() !== "").length

  function handlePeriod(value: string) {
    if (value === "custom") {
      setCustomPeriod(true)
      setOpen(true)
      return
    }
    setCustomPeriod(false)
    const range = periodRange(value as Exclude<SalesPeriod, "custom">)
    setStartDate(range.start)
    setEndDate(range.end)
  }

  function handleClear() {
    setCustomPeriod(false)
    clearFilters()
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.toolbar}>
        <select
          value={period}
          onChange={(e) => handlePeriod(e.target.value)}
          aria-label="Período"
          className={styles.periodSelect}
        >
          <option value="today">Hoy</option>
          <option value="7d">Últimos 7 días</option>
          <option value="30d">Último mes</option>
          <option value="custom">Personalizado</option>
        </select>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className={`${styles.filtersBtn} ${open ? styles.filtersBtnActive : ""}`}
          aria-expanded={open}
        >
          <SlidersHorizontal size={15} />
          <span>Filtros</span>
          {extraCount > 0 && <span className={styles.filtersCount}>{extraCount}</span>}
        </button>
      </div>

      {open && (
        <div className={styles.filters}>
          {period === "custom" && (
            <>
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
            </>
          )}
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
            type="number"
            min="1"
            value={minItemsFilter}
            onChange={(e) => setMinItemsFilter(e.target.value)}
            placeholder="Arts. mín."
            aria-label="Artículos mínimos (líneas distintas en la venta)"
            className={`${styles.filterInput} ${styles.filterInputNarrow}`}
          />
          <input
            type="text"
            value={userNameFilter}
            onChange={(e) => setUserNameFilter(e.target.value)}
            placeholder="Usuario"
            aria-label="Filtrar por usuario"
            className={styles.filterInput}
          />
          {(extraCount > 0 || period === "custom") && (
            <button type="button" onClick={handleClear} className={styles.clearBtn} title="Limpiar todos los filtros">
              <X size={14} />
              <span>Limpiar</span>
            </button>
          )}
        </div>
      )}
    </div>
  )
}
