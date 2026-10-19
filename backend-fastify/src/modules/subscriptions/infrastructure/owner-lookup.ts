import { prisma } from "@/config/prisma"

/**
 * Último recurso para vincular pagos que no vinieron del checkout embebido: la
 * página hospedada de Whop (o un cobro anterior al vínculo) no copia el
 * `metadata.ref`, así que la única pista es el email del comprador. Se busca al
 * dueño de la tienda por ese email para no dejar la suscripción `pending` para
 * siempre.
 *
 * Se expone como objeto singleton, igual que los demás repositorios del módulo,
 * para que los tests puedan mockearlo con `mock.method`.
 */
export const OwnerLookup = {
  /** store_id del dueño de tienda con ese email, o null. */
  async findStoreIdByOwnerEmail(email: string): Promise<string | null> {
    const owner = await prisma.user.findFirst({
      where: { email: email.trim().toLowerCase(), is_owner: true, deleted_at: null },
      select: { store_id: true },
    })
    return owner?.store_id ?? null
  },
}
