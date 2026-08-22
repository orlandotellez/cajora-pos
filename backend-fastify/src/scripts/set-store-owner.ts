/**
 * Marca un usuario existente como propietario (owner) de su tienda.
 *
 * Uso:
 *   pnpm set-store-owner --email=owner@example.com
 *
 * - El usuario debe existir y pertenecer a una tienda (store_id no null).
 * - Solo puede haber un owner por tienda: si ya existe otro, se le quita el flag.
 *
 * ⚠️ Este script es la única vía para asignar el rol de owner manualmente.
 */
import "dotenv/config"
import { prisma } from "@/config/prisma"

function parseArgs(argv: string[]): Record<string, string> {
  const args: Record<string, string> = {}
  for (const arg of argv) {
    const match = arg.match(/^--([^=]+)=(.*)$/)
    if (match) args[match[1]] = match[2]
  }
  return args
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const email = args["email"]?.trim().toLowerCase()

  if (!email) {
    console.error("❌ Faltan argumentos obligatorios: --email=...")
    console.error("   Ejemplo: pnpm set-store-owner --email=admin@mitienda.com")
    process.exit(1)
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    console.error(`❌ Email inválido: ${email}`)
    process.exit(1)
  }

  // Buscar el usuario
  const user = await prisma.user.findFirst({
    where: { email, deleted_at: null },
    include: { store: { select: { id: true, name: true } } },
  })

  if (!user) {
    console.error(`❌ No se encontró un usuario activo con el email ${email}`)
    process.exit(1)
  }

  if (!user.store_id) {
    console.error(`❌ El usuario ${email} no pertenece a ninguna tienda (es super_admin).`)
    process.exit(1)
  }

  const storeName = user.store?.name ?? user.store_id

  // Si ya es owner, no hacer nada
  if (user.is_owner) {
    console.log(`ℹ️  ${user.name} (${email}) ya es el owner de "${storeName}". No hay cambios.`)
    await prisma.$disconnect()
    return
  }

  // Quitar el flag de owner a cualquier otro usuario en la misma tienda
  const previousOwner = await prisma.user.findFirst({
    where: { store_id: user.store_id, is_owner: true, deleted_at: null },
  })

  await prisma.$transaction(async (tx) => {
    // Quitar owner anterior si existe
    if (previousOwner) {
      await tx.user.update({
        where: { id: previousOwner.id },
        data: { is_owner: false },
      })
      console.log(`🔄 Se quitó el rol de owner a ${previousOwner.name} (${previousOwner.email})`)
    }

    // Asignar owner al usuario indicado
    await tx.user.update({
      where: { id: user.id },
      data: { is_owner: true },
    })
  })

  console.log(`✅ ${user.name} (${email}) ahora es el propietario de "${storeName}"`)
  console.log("   - Podrá iniciar sesión en la landing page")
  console.log("   - Se mostrará el badge 'Owner' en la gestión de usuarios")
}

main()
  .catch((err) => {
    console.error("Error:", err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
