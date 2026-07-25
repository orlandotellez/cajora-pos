
export const UNIT_TYPE_LABELS: Record<string, string> = {
  unidad: "Unidad",
  paquete: "Paquete",
  caja: "Caja",
  bolsa: "Bolsa",
  botella: "Botella",
  lata: "Lata",
  sobre: "Sobre",
  barra: "Barra",
  rollo: "Rollo",
  galon: "Galón",
  ristra: "Ristra",
};


export const PAYMENT_METHODS = [
  { value: "efectivo", label: "Efectivo" },
  { value: "tarjeta", label: "Tarjeta" },
  { value: "transferencia", label: "Transferencia" },
  { value: "credito", label: "Crédito" },
] as const;

export type PaymentMethod = (typeof PAYMENT_METHODS)[number]["value"];


export const CURRENCIES = [
  { code: "NIO", label: "Córdoba (C$)" },
  { code: "USD", label: "Dólar ($)" },
  { code: "EUR", label: "Euro (€)" },
  { code: "MXN", label: "Peso Mexicano ($)" },
] as const;

export type CurrencyCode = (typeof CURRENCIES)[number]["code"];


export const MOVEMENT_TYPES = ["entrada", "salida", "ajuste", "venta"] as const;

/**
 * Tamaño de página por defecto para los listados paginados de las páginas
 * admin (Products, Services, Suppliers, Categories, Users, Sales, etc.).
 *
 * Si en el futuro el cliente quiere pág. de 20, 25, etc., cambiar este valor
 * único propaga a todas las vistas.
 */
export const PAGE_LIMIT = 10;
