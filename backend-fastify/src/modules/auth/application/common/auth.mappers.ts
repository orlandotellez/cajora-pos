import type { IUserEntity } from "../../domain/auth.entities"
import type { IUserResponse, IStoreResponse } from "../../domain/auth.types"
import type { ROLE } from "@/generated/prisma/client"
import { env } from "@/config/env"

/**
 * Con `EMAIL_VERIFICATION=false` (solo desarrollo) la cuenta se presenta como verificada.
 *
 * No alcanza con que el alta nazca verificada: una cuenta creada antes de activar el flag
 * sigue con `email_verified: false` en la fila, y el cliente arrastra ese valor en la sesión,
 * así que el paso de verificación reaparece pidiendo un código que nunca se emite. Acá se
 * resuelve en el único punto por el que pasan login, refresh y registro.
 *
 * El flag no puede estar activo en producción: el arranque falla (ver el `refine` de
 * `config/env.ts`).
 */
function isEmailVerified(user: IUserEntity): boolean {
  return env.EMAIL_VERIFICATION ? user.email_verified : true
}

export function mapUserToResponse(user: IUserEntity): IUserResponse {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    email_verified: isEmailVerified(user),
    role: user.role as ROLE,
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