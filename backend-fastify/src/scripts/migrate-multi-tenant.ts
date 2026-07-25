import { prisma } from "@/config/prisma.js"
import { hashPassword } from "@/core/utils/crypto.utils"

/**
 * Migration script: Single-tenant → Multi-tenant
 *
 * This script:
 * 1. Creates a "default" store for all existing data
 * 2. Assigns store_id to all existing users, products, categories, etc.
 * 3. Creates default settings for the store (from existing global settings)
 * 4. Sets up an admin user for the default store
 *
 * Run: npx tsx src/scripts/migrate-multi-tenant.ts
 */

const DEFAULT_STORE_NAME = "Mi Tienda"
const DEFAULT_ADMIN_EMAIL = "admin@mi-tienda.com"
const DEFAULT_ADMIN_PASSWORD = "admin123"

async function migrate() {
  console.log("🏪 Starting multi-tenant migration...")

  // ─── Step 1: Check if migration already ran ───
  const existingStore = await prisma.store.findFirst()
  if (existingStore) {
    console.log("⚠️  Migration already completed. Default store found:", existingStore.id)
    console.log("   Run 'npx prisma migrate dev' first if you haven't yet.")
    return
  }

  // ─── Step 2: Create default store ───
  const store = await prisma.store.create({
    data: {
      name: DEFAULT_STORE_NAME,
      address: "",
      phone: "",
    },
  })
  console.log(`✅ Created default store: ${store.id} ("${DEFAULT_STORE_NAME}")`)

  // ─── Step 3: Assign store_id to existing users ───
  const existingUsers = await prisma.user.findMany({ where: { deleted_at: null } })
  console.log(`👤 Found ${existingUsers.length} users to migrate...`)

  for (const user of existingUsers) {
    await prisma.user.update({
      where: { id: user.id },
      data: { store_id: store.id },
    })
  }
  console.log(`   ✅ Assigned store_id to ${existingUsers.length} users`)

  // ─── Step 4: Assign store_id to existing data ───
  const tables = [
    { name: "categories", model: prisma.category },
    { name: "suppliers", model: prisma.supplier },
    { name: "products", model: prisma.product },
    { name: "services", model: prisma.service },
    { name: "sales", model: prisma.sale },
    { name: "inventory_batches", model: prisma.inventoryBatch },
    { name: "inventory_movements", model: prisma.inventoryMovement },
  ]

  for (const { name, model } of tables) {
    const count = await (model as any).updateMany({
      where: { store_id: null as any },
      data: { store_id: store.id },
    })
    console.log(`   ✅ ${name}: ${count.count} records updated`)
  }

  // ─── Step 5: Migrate global settings to per-store ───
  const globalSettings = await prisma.settings.findFirst()
  if (globalSettings) {
    // Update existing settings row to use store_id instead of id-based lookup
    await prisma.settings.update({
      where: { id: globalSettings.id },
      data: { store_id: store.id },
    })
    console.log(`   ✅ Settings migrated to store ${store.id}`)
  } else {
    // Create default settings for the store
    await prisma.settings.create({
      data: {
        store_id: store.id,
        name: DEFAULT_STORE_NAME,
        low_stock_threshold: 5,
      },
    })
    console.log(`   ✅ Default settings created for store ${store.id}`)
  }

  // ─── Step 6: Ensure admin user exists for the store ───
  const adminUser = await prisma.user.findFirst({
    where: { email: DEFAULT_ADMIN_EMAIL, deleted_at: null },
  })

  if (!adminUser) {
    const hashedPassword = await hashPassword(DEFAULT_ADMIN_PASSWORD)
    const user = await prisma.user.create({
      data: {
        name: "Admin",
        email: DEFAULT_ADMIN_EMAIL,
        role: "admin",
        email_verified: true,
        store_id: store.id,
      },
    })
    await prisma.account.create({
      data: {
        account_id: user.id,
        provider_id: "credentials",
        user_id: user.id,
        password: hashedPassword,
      },
    })
    console.log(`   ✅ Admin user created: ${DEFAULT_ADMIN_EMAIL} / ${DEFAULT_ADMIN_PASSWORD}`)
  } else {
    // Assign existing admin to the store
    await prisma.user.update({
      where: { id: adminUser.id },
      data: { store_id: store.id },
    })
    console.log(`   ✅ Existing admin assigned to store: ${adminUser.email}`)
  }

  // ─── Summary ───
  const userCount = await prisma.user.count({ where: { store_id: store.id } })
  const productCount = await prisma.product.count({ where: { store_id: store.id } })
  const categoryCount = await prisma.category.count({ where: { store_id: store.id } })
  const supplierCount = await prisma.supplier.count({ where: { store_id: store.id } })
  const serviceCount = await prisma.service.count({ where: { store_id: store.id } })
  const saleCount = await prisma.sale.count({ where: { store_id: store.id } })

  console.log("")
  console.log("═══════════════════════════════════════")
  console.log("   MIGRACIÓN COMPLETADA EXITOSAMENTE")
  console.log("═══════════════════════════════════════")
  console.log(`   🏪 Store:        ${store.name} (${store.id})`)
  console.log(`   👤 Usuarios:     ${userCount}`)
  console.log(`   📂 Categorías:   ${categoryCount}`)
  console.log(`   🏢 Proveedores:  ${supplierCount}`)
  console.log(`   📦 Productos:    ${productCount}`)
  console.log(`   🔧 Servicios:    ${serviceCount}`)
  console.log(`   🧾 Ventas:       ${saleCount}`)
  console.log("───────────────────────────────────────")
  console.log("")
  console.log("🔐 Admin login:")
  console.log(`   Email:    ${DEFAULT_ADMIN_EMAIL}`)
  console.log(`   Password: ${DEFAULT_ADMIN_PASSWORD}`)
  console.log("")
}

migrate()
  .catch((e) => {
    console.error("❌ Migration failed:", e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })