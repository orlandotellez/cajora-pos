import type { IUserEntity } from "../../domain/auth.entities"
import type { IUserResponse, IStoreResponse } from "../../domain/auth.types"
import type { Role } from "@/types/auth"

export function mapUserToResponse(user: IUserEntity): IUserResponse {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    email_verified: user.email_verified,
    role: user.role as Role,
    is_owner: user.is_owner ?? false,
    is_active: user.is_active ?? true,
    permissions: user.permissions ?? [],
    phone: user.phone,
    image: user.image,
    store_id: user.store_id,
    created_at: user.created_at,
    updated_at: user.updated_at,
  }
}

export function mapStoreToResponse(store: { id: string; name: string; address?: string | null; phone?: string | null }): IStoreResponse {
  return {
    id: store.id,
    name: store.name,
    address: store.address || undefined,
    phone: store.phone || undefined,
  }
}