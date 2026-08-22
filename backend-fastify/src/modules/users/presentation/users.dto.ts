import { z } from "zod"

const permissionSchema = z.enum([
  "catalog_read",
  "catalog_write",
  "inventory_read",
  "inventory_write",
  "reports",
  "settings",
  "users",
])

export const CreateUserDtoSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email format"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  role: z.enum(["admin", "cajero"]).optional(),
  permissions: z.array(permissionSchema).optional(),
  phone: z.string().optional(),
})

export const UpdateUserDtoSchema = z.object({
  name: z.string().min(2).optional(),
  email: z.string().email().optional(),
  role: z.enum(["admin", "cajero"]).optional(),
  permissions: z.array(permissionSchema).optional(),
  phone: z.string().optional(),
})

export const ToggleActiveDtoSchema = z.object({
  is_active: z.boolean(),
})

export const UserQuerySchema = z.object({
  search: z.string().optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(50),
})

export type CreateUserDto = z.infer<typeof CreateUserDtoSchema>
export type UpdateUserDto = z.infer<typeof UpdateUserDtoSchema>
