import { z } from "zod"

export const CreateSaleItemDtoSchema = z.object({
  product_id: z.string().uuid(),
  product_name: z.string().min(1),
  quantity: z.number().int().positive(),
  unit_price: z.number().positive(),
  line_total: z.number().positive(),
})

export const CreateSaleServiceItemProductDtoSchema = z.object({
  product_id: z.string().uuid(),
  product_name: z.string().min(1),
  quantity: z.number().int().positive(),
  unit_price: z.number().positive(),
  line_total: z.number().positive(),
  affects_price: z.boolean().optional(),
})

export const CreateSaleServiceItemDtoSchema = z.object({
  service_id: z.string().uuid(),
  service_name: z.string().min(1),
  base_price: z.number().positive(),
  line_total: z.number().positive(),
  products: z.array(CreateSaleServiceItemProductDtoSchema).optional(),
})

export const CreateSaleDtoSchema = z.object({
  subtotal: z.number().positive(),
  discount: z.number().min(0),
  total: z.number().positive(),
  payment_method: z.enum(["efectivo", "tarjeta", "transferencia", "credito"]),
  amount_received: z.number().positive().optional(),
  change_given: z.number().min(0).optional(),
  user_name: z.string().min(1),
  items: z.array(CreateSaleItemDtoSchema).optional().default([]),
  service_items: z.array(CreateSaleServiceItemDtoSchema).optional().default([]),
}).refine(
  (data) => data.items.length > 0 || data.service_items!.length > 0,
  { message: "At least one item or service is required" }
)

export const SaleQuerySchema = z.object({
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  user_id: z.string().uuid().optional(),
  payment_method: z.enum(["efectivo", "tarjeta", "transferencia", "credito"]).optional(),
  q: z.string().min(1).optional(),
  min_total_qty: z.coerce.number().int().nonnegative().optional(),
  min_items_count: z.coerce.number().int().nonnegative().optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
})

export const ReportQuerySchema = z.object({
  start_date: z.string().optional(),
  end_date: z.string().optional(),
})

export const RevenueTrendQuerySchema = z.object({
  start_date: z.string(),
  end_date: z.string(),
  group_by: z.enum(["day", "week", "month"]),
})

export type CreateSaleDto = z.infer<typeof CreateSaleDtoSchema>
export type CreateSaleItemDto = z.infer<typeof CreateSaleItemDtoSchema>
export type CreateSaleServiceItemProductDto = z.infer<typeof CreateSaleServiceItemProductDtoSchema>
export type CreateSaleServiceItemDto = z.infer<typeof CreateSaleServiceItemDtoSchema>
export type SaleQueryDto = z.infer<typeof SaleQuerySchema>
export type ReportQueryDto = z.infer<typeof ReportQuerySchema>
export type RevenueTrendQueryDto = z.infer<typeof RevenueTrendQuerySchema>
