import type { Role } from "@/types/auth"
import type { IAccountEntity, ISessionEntity, IUserEntity, IVerificationEntity, Permission } from "../../domain/auth.entities"
import type { account, session, user, verification } from "@prisma/client"

export function mapPrismaUserToEntity(user: user): IUserEntity {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    email_verified: user.email_verified,
    phone: user.phone || undefined,
    image: user.image || undefined,
    role: user.role as Role,
    is_owner: user.is_owner ?? false,
    is_active: user.is_active ?? true,
    permissions: Array.isArray(user.permissions) ? (user.permissions as Permission[]) : [],
    store_id: user.store_id,
    created_at: user.created_at,
    updated_at: user.updated_at,
    deleted_at: user.deleted_at || undefined
  }
}

export function mapPrismaAccountToEntity(account: account): IAccountEntity {
  return {
    id: account.id,
    account_id: account.account_id,
    provider_id: account.provider_id,
    user_id: account.user_id || undefined,
    access_token: account.access_token || undefined,
    refresh_token: account.refresh_token || undefined,
    id_token: account.id_token || undefined,
    access_token_expires_at: account.access_token_expires_at || undefined,
    refresh_token_expires_at: account.refresh_token_expires_at || undefined,
    scope: account.scope || undefined,
    password: account.password || undefined,
    created_at: account.created_at,
    updated_at: account.updated_at
  }
}

export function mapPrismaSessionToEntity(session: session): ISessionEntity {
  return {
    id: session.id,
    expires_at: session.expires_at,
    token: session.token,
    ip_address: session.ip_address || undefined,
    user_agent: session.user_agent || undefined,
    user_id: session.user_id,
    created_at: session.created_at,
    updated_at: session.updated_at
  }
}

export function mapPrismaVerificationToEntity(verification: verification): IVerificationEntity {
  return {
    id: verification.id,
    identifier: verification.identifier,
    value: verification.value,
    expires_at: verification.expires_at,
    created_at: verification.created_at,
    updated_at: verification.updated_at
  }
}
