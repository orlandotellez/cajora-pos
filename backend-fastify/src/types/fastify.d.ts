import type { FastifyReply, FastifyRequest } from "fastify"

type GuardHandler = (request: FastifyRequest, reply: FastifyReply) => Promise<void>
type PermissionGuardHandler = (...requiredPermissions: string[]) => GuardHandler

declare module "fastify" {
  interface FastifyInstance {
    licenseGuard: GuardHandler
    activeUserGuard: GuardHandler
    permissionGuard: PermissionGuardHandler
  }
}