/**
 * Crea la cuenta de super admin.
 *
 * Uso:
 *   pnpm create-super-admin --email=owner@example.com --password=Secreto123 [--name="Super Admin"]
 *
 * - El super admin NO pertenece a ninguna tienda (`store_id` null): su único
 *   objetivo es observar el panel global con los datos de todas las tiendas.
 * - Si el email ya existe, el script se niega (no promueve: promover a un
 *   usuario de tienda lo dejaría sin acceso a su tienda).
 *
 * ⚠️ No se puede crear un super admin desde la API de la app a propósito:
 *    este script es la única vía.
 */
import "dotenv/config"
import { prisma } from "@/config/prisma"
import { hashPassword } from "@/core/utils/crypto.utils"

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
  const password = args["password"]
  const name = args["name"]?.trim() || "Super Admin"

  if (!email || !password) {
    console.error("❌ Faltan argumentos obligatorios: --email=... --password=...")
    console.error("   Opcional: --name=...")
    process.exit(1)
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    console.error(`❌ Email inválido: ${email}`)
    process.exit(1)
  }
  if (password.length < 8) {
    console.error("❌ La contraseña debe tener al menos 8 caracteres")
    process.exit(1)
  }

  const existing = await prisma.user.findFirst({ where: { email } })
  if (existing) {
    console.error(`❌ Ya existe un usuario con el email ${email}. Elegí otro email para la cuenta de super admin.`)
    process.exit(1)
  }

  const hashed = await hashPassword(password)
  const user = await prisma.user.create({
    data: {
      name,
      email,
      role: "super_admin",
      email_verified: true,
      store_id: null,
    },
  })
  await prisma.account.create({
    data: {
      account_id: user.id,
      provider_id: "credentials",
      user_id: user.id,
      password: hashed,
    },
  })

  console.log(`✅ Super admin creado: ${user.email} (sin tienda — solo panel global)`)
  console.log("   Al iniciar sesión entrarás directo al Panel Global.")
}

main()
  .catch((err) => {
    console.error("Error:", err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
