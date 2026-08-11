import { z } from "zod"

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
})

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
})

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
