import { prisma } from "@/config/prisma"
import type {
  IAuthRepository,
  IUserRepository,
  IAccountRepository,
  ISessionRepository,
  IVerificationRepository
} from "../domain/auth.interface"
import type {
  IUserEntity,
  IAccountEntity,
  ISessionEntity,
  IVerificationEntity,
  CreateUserData,
  UpdateUserData,
  CreateAccountData,
  CreateSessionData,
  CreateVerificationData
} from "../domain/auth.entities"
import {
  mapPrismaUserToEntity,
  mapPrismaAccountToEntity,
  mapPrismaSessionToEntity,
  mapPrismaVerificationToEntity
} from "./mappers/auth.prisma.mappers"

const UserRepository: IUserRepository = {
  async findByEmail(email: string, storeId?: string): Promise<IUserEntity | null> {
    const where: any = { email, deleted_at: null }
    if (storeId) {
      where.store_id = storeId
    }
    const user = await prisma.user.findFirst({ where })
    if (!user) return null
    return mapPrismaUserToEntity(user)
  },

  async findById(id: string): Promise<IUserEntity | null> {
    const user = await prisma.user.findFirst({
      where: { id, deleted_at: null }
    })
    if (!user) return null
    return mapPrismaUserToEntity(user)
  },

  async create(data: CreateUserData): Promise<IUserEntity> {
    const user = await prisma.user.create({
      data: {
        name: data.name,
        email: data.email,
        phone: data.phone,
        image: data.image,
        role: data.role || "cajero",
        email_verified: data.email_verified || false,
        store_id: data.store_id,
      }
    })
    return mapPrismaUserToEntity(user)
  },

  async update(id: string, data: UpdateUserData): Promise<IUserEntity> {
    const user = await prisma.user.update({
      where: { id },
      data: data
    })
    return mapPrismaUserToEntity(user)
  },

  async softDelete(id: string): Promise<void> {
    await prisma.user.update({
      where: { id },
      data: { deleted_at: new Date() }
    })
  }
}

const AccountRepository: IAccountRepository = {
  async findByProviderAndAccountId(
    providerId: string,
    accountId: string
  ): Promise<IAccountEntity | null> {
    const account = await prisma.account.findFirst({
      where: { provider_id: providerId, account_id: accountId }
    })
    if (!account) return null
    return mapPrismaAccountToEntity(account)
  },

  async findByUserId(userId: string): Promise<IAccountEntity[]> {
    const accounts = await prisma.account.findMany({
      where: { user_id: userId }
    })
    return accounts.map(mapPrismaAccountToEntity)
  },

  async findCredentialsAccountByEmail(email: string): Promise<IAccountEntity | null> {
    const user = await prisma.user.findFirst({
      where: { email, deleted_at: null }
    })
    if (!user) return null

    const account = await prisma.account.findFirst({
      where: {
        user_id: user.id,
        provider_id: "credentials"
      }
    })
    if (!account) return null
    return mapPrismaAccountToEntity(account)
  },

  async create(data: CreateAccountData): Promise<IAccountEntity> {
    const account = await prisma.account.create({
      data: {
        account_id: data.account_id,
        provider_id: data.provider_id,
        user_id: data.user_id,
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        id_token: data.id_token,
        access_token_expires_at: data.access_token_expires_at,
        refresh_token_expires_at: data.refresh_token_expires_at,
        scope: data.scope,
        password: data.password
      }
    })
    return mapPrismaAccountToEntity(account)
  },

  async update(
    id: string,
    data: Partial<CreateAccountData>
  ): Promise<IAccountEntity> {
    const account = await prisma.account.update({
      where: { id },
      data: data
    })
    return mapPrismaAccountToEntity(account)
  },

  async delete(id: string): Promise<void> {
    await prisma.account.delete({ where: { id } })
  },

  async deleteByUserId(userId: string): Promise<void> {
    await prisma.account.deleteMany({ where: { user_id: userId } })
  }
}

const SessionRepository: ISessionRepository = {
  async create(data: CreateSessionData): Promise<ISessionEntity> {
    const session = await prisma.session.create({
      data: {
        user_id: data.userId,
        token: data.token,
        expires_at: data.expiresAt,
        ip_address: data.ipAddress,
        user_agent: data.userAgent
      }
    })
    return mapPrismaSessionToEntity(session)
  },

  async findByToken(token: string): Promise<ISessionEntity | null> {
    const session = await prisma.session.findFirst({
      where: { token }
    })
    if (!session) return null
    return mapPrismaSessionToEntity(session)
  },

  async findByUserId(userId: string): Promise<ISessionEntity[]> {
    const sessions = await prisma.session.findMany({
      where: { user_id: userId }
    })
    return sessions.map(mapPrismaSessionToEntity)
  },

  async delete(token: string): Promise<void> {
    await prisma.session.deleteMany({ where: { token } })
  },

  async deleteByUserId(userId: string): Promise<void> {
    await prisma.session.deleteMany({ where: { user_id: userId } })
  },

  async deleteExpiredSessions(): Promise<number> {
    const result = await prisma.session.deleteMany({
      where: { expires_at: { lt: new Date() } }
    })
    return result.count
  }
}

const VerificationRepository: IVerificationRepository = {
  async create(data: CreateVerificationData): Promise<IVerificationEntity> {
    await prisma.verification.deleteMany({
      where: { identifier: data.identifier }
    })

    const verification = await prisma.verification.create({
      data: {
        identifier: data.identifier,
        value: data.value,
        expires_at: data.expiresAt
      }
    })
    return mapPrismaVerificationToEntity(verification)
  },

  async findByIdentifier(identifier: string): Promise<IVerificationEntity | null> {
    const verification = await prisma.verification.findFirst({
      where: { identifier }
    })
    if (!verification) return null
    return mapPrismaVerificationToEntity(verification)
  },

  async findByIdentifierAndValue(
    identifier: string,
    value: string
  ): Promise<IVerificationEntity | null> {
    const verification = await prisma.verification.findFirst({
      where: { identifier, value }
    })
    if (!verification) return null
    return mapPrismaVerificationToEntity(verification)
  },

  async delete(id: string): Promise<void> {
    await prisma.verification.delete({ where: { id } })
  },

  async deleteByIdentifier(identifier: string): Promise<void> {
    await prisma.verification.deleteMany({ where: { identifier } })
  },

  async deleteExpired(): Promise<number> {
    const result = await prisma.verification.deleteMany({
      where: { expires_at: { lt: new Date() } }
    })
    return result.count
  }
}

export const AuthRepository: IAuthRepository = {
  user: UserRepository,
  account: AccountRepository,
  session: SessionRepository,
  verification: VerificationRepository
}
