import type { Product, Service } from "@/api"

/** Quita acentos/diacríticos para búsquedas sin importar tildes. */
function stripAccents(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
}

export interface CatalogSearchResult {
  _type: "product" | "service"
  id: string
  name: string
  barcode?: string
  unit_type?: string
  price: number
  data: Product | Service
}

export function searchCatalog(
  products: Record<string, Product>,
  services: Record<string, Service>,
  term: string,
  limit = 15,
): CatalogSearchResult[] {
  const q = stripAccents(term.trim().toLowerCase())
  if (!q) return []

  const results: CatalogSearchResult[] = []

  for (const p of Object.values(products)) {
    if (
      stripAccents(p.name.toLowerCase()).includes(q) ||
      (p.barcode && p.barcode.toLowerCase().includes(q))
    ) {
      results.push({
        _type: "product",
        id: p.id,
        name: p.name,
        barcode: p.barcode,
        unit_type: p.unit_type,
        price: p.price,
        data: p,
      })
      if (results.length >= limit) return results
    }
  }

  for (const s of Object.values(services)) {
    if (stripAccents(s.name.toLowerCase()).includes(q)) {
      results.push({
        _type: "service",
        id: s.id,
        name: s.name,
        price: s.base_price,
        data: s,
      })
      if (results.length >= limit) return results
    }
  }

  return results
}

export function findProductByBarcode(
  products: Record<string, Product>,
  barcode: string,
): Product | undefined {
  const q = barcode.trim().toLowerCase()
  if (!q) return undefined
  for (const p of Object.values(products)) {
    if (p.barcode && p.barcode.toLowerCase() === q) return p
  }
  return undefined
}
