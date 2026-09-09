import type { IUserEntity } from "../../domain/users.entities"
import type { IUserResponse } from "../../domain/users.types"

export function mapUserToResponse(user: IUserEntity): IUserResponse {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    email_verified: user.email_verified,
    role: user.role,
    is_owner: user.is_owner ?? false,
    is_active: user.is_active ?? true,
    permissions: user.permissions ?? [],
    phone: user.phone || undefined,
    image: user.image || undefined,
    created_at: user.created_at instanceof Date ? user.created_at : new Date(user.created_at),
    updated_at: user.updated_at instanceof Date ? user.updated_at : new Date(user.updated_at),
  }
}