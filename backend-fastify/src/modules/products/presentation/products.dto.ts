import { z } from "zod"

const LOOSE_UNIT_TYPES = new Set(["unidad", "botella", "lata", "sobre", "barra", "rollo", "galon"])

function validatePackaging(data: { unit_type?: string | null; unit_quantity?: number | null }): boolean {
  if (!data.unit_type || LOOSE_UNIT_TYPES.has(data.unit_type)) return data.unit_quantity == null
  return (data.unit_quantity ?? 0) >= 2
}

const PACKAGING_ERROR =
  "Empaque inválido: los tipos de venta suelta (unidad, botella, lata, sobre, barra, rollo, galón) no llevan cantidad por empaque; los empaques (paquete, caja, bolsa, ristra) requieren una cantidad entera ≥ 2"

export const CreateProductDtoSchema = z.object({
  barcode: z.string().optional(),
  name: z.string().min(1, "Name is required"),
  unit_type: z.enum(["unidad", "paquete", "caja", "bolsa", "botella", "lata", "sobre", "barra", "rollo", "galon", "ristra"]).optional(),
  unit_quantity: z.number().int().positive().optional(),
  category_id: z.string().uuid().optional(),
  supplier_id: z.string().uuid().optional(),
  price: z.number().positive("Price must be positive"),
  cost: z.number().min(0).optional(),
  stock: z.number().int().min(0).optional(),
  low_stock_threshold: z.number().int().min(0).optional(),
  active: z.boolean().optional(),
}).refine(validatePackaging, { message: PACKAGING_ERROR, path: ["unit_quantity"] })

export const UpdateProductDtoSchema = z.object({
  barcode: z.string().optional().nullable(),
  name: z.string().min(1).optional(),
  unit_type: z.enum(["unidad", "paquete", "caja", "bolsa", "botella", "lata", "sobre", "barra", "rollo", "galon", "ristra"]).optional().nullable(),
  unit_quantity: z.number().int().positive().optional().nullable(),
  category_id: z.string().uuid().optional().nullable(),
  supplier_id: z.string().uuid().optional().nullable(),
  price: z.number().positive().optional(),
  cost: z.number().min(0).optional(),
  stock: z.number().int().min(0).optional(),
  low_stock_threshold: z.number().int().min(0).optional(),
  active: z.boolean().optional(),
}).refine(validatePackaging, { message: PACKAGING_ERROR, path: ["unit_quantity"] })

export const ProductQuerySchema = z.object({
  search: z.string().optional(),
  category_id: z.string().optional(),
  active: z.coerce.boolean().optional(),
  low_stock: z.coerce.boolean().optional(),
  out_of_stock: z.coerce.boolean().optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
})

export type CreateProductDto = z.infer<typeof CreateProductDtoSchema>
export type UpdateProductDto = z.infer<typeof UpdateProductDtoSchema>
export type ProductQueryDto = z.infer<typeof ProductQuerySchema>
