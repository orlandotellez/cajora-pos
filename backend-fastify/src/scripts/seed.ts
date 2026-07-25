import { prisma } from "@/config/prisma.js"
import { hashPassword } from "@/core/utils/crypto.utils"

type CategoryMap = Record<string, string>
type SupplierMap = Record<string, string>

type ServiceSeed = {
  name: string
  description: string
  base_price: number
  products: { productName: string; quantity: number }[]
}

type ProductSeed = {
  name: string
  unit_type: "unidad" | "paquete" | "caja" | "bolsa" | "botella" | "lata" | "sobre" | "barra" | "rollo" | "galon" | "ristra"
  unit_quantity?: number
  category_name: string
  supplier_name: string
  cost: number
  price: number
  stock: number
  low_stock_threshold: number
  barcode?: string
}

const STORE_NAME = "Smart Miscelánea"

const categories = [
  { name: "Snacks y Chiverías", description: "Papas, churritos, cacahuates y botanas" },
  { name: "Galletas y Dulces", description: "Galletas, caramelos, chocolates y chicles" },
  { name: "Bebidas", description: "Gaseosas, jugos, aguas y energizantes" },
  { name: "Abarrotes", description: "Café, leche, aceite, sopas y salsas" },
  { name: "Lácteos y Fríos", description: "Leche, yogurt, crema y embutidos" },
  { name: "Higiene y Limpieza", description: "Papel higiénico, jabón, detergente y cuidado personal" },
]

const suppliers = [
  { name: "Diana Nicaragua", contact_name: "Ejecutivo de Ventas", email: "ventas@diana.com", phone: "0000-0000", address: "Managua, Nicaragua", notes: "Snacks, chiverías y productos Diana" },
  { name: "Coca-Cola FEMSA Nicaragua", contact_name: "Ejecutivo Comercial", email: "ventas@coca-cola.com", phone: "0000-0000", address: "Managua, Nicaragua", notes: "Bebidas Coca-Cola, Fanta, Sprite, Del Valle" },
  { name: "Pepsi Nicaragua", contact_name: "Ejecutivo Comercial", email: "ventas@pepsi.com", phone: "0000-0000", address: "Managua, Nicaragua", notes: "Pepsi, 7UP, Mirinda, AMP" },
  { name: "Nestlé Nicaragua", contact_name: "Ejecutivo Comercial", email: "ventas@nestle.com", phone: "0000-0000", address: "Managua, Nicaragua", notes: "Café, chocolates, lácteos y alimentos" },
  { name: "Cargill Nicaragua", contact_name: "Ejecutivo Comercial", email: "ventas@cargill.com", phone: "0000-0000", address: "Managua, Nicaragua", notes: "Tip Top, embutidos y productos alimenticios" },
  { name: "Grupo Lala Nicaragua", contact_name: "Ejecutivo Comercial", email: "ventas@lala.com", phone: "0000-0000", address: "Managua, Nicaragua", notes: "Lácteos y bebidas" },
  { name: "Distribuidora La Colonia", contact_name: "Ventas Mayoristas", email: "mayoreo@lacolonia.com", phone: "0000-0000", address: "Managua, Nicaragua", notes: "Abarrotes y productos de consumo masivo" },
  { name: "Mayoreo El Gallo Más Gallo", contact_name: "Ventas", email: "ventas@gallomasgallo.com", phone: "0000-0000", address: "Managua, Nicaragua", notes: "Distribución y abastecimiento" },
  { name: "Kimberly-Clark Nicaragua", contact_name: "Ejecutivo Comercial", email: "ventas@kimberly-clark.com", phone: "0000-0000", address: "Managua, Nicaragua", notes: "Papel higiénico, servilletas y productos de higiene" },
  { name: "Unilever Nicaragua", contact_name: "Ejecutivo Comercial", email: "ventas@unilever.com", phone: "0000-0000", address: "Managua, Nicaragua", notes: "Detergentes, jabones y productos de limpieza" },
]

const products: ProductSeed[] = [
  { name: "Ranchitas Originales", unit_type: "ristra", unit_quantity: 12, category_name: "Snacks y Chiverías", supplier_name: "Diana Nicaragua", cost: 55, price: 70, stock: 50, low_stock_threshold: 10 },
  { name: "Jalapeños Diana", unit_type: "ristra", unit_quantity: 12, category_name: "Snacks y Chiverías", supplier_name: "Diana Nicaragua", cost: 60, price: 75, stock: 50, low_stock_threshold: 10 },
  { name: "Elotitos Diana", unit_type: "ristra", unit_quantity: 12, category_name: "Snacks y Chiverías", supplier_name: "Diana Nicaragua", cost: 60, price: 75, stock: 50, low_stock_threshold: 10 },
  { name: "Yuca Diana", unit_type: "ristra", unit_quantity: 12, category_name: "Snacks y Chiverías", supplier_name: "Diana Nicaragua", cost: 50, price: 65, stock: 50, low_stock_threshold: 10 },
  { name: "Zambos con Chile", unit_type: "ristra", unit_quantity: 12, category_name: "Snacks y Chiverías", supplier_name: "Diana Nicaragua", cost: 70, price: 85, stock: 50, low_stock_threshold: 10 },
  { name: "Tronaditas", unit_type: "ristra", unit_quantity: 12, category_name: "Snacks y Chiverías", supplier_name: "Diana Nicaragua", cost: 55, price: 70, stock: 50, low_stock_threshold: 10 },
  { name: "Churritos Diana", unit_type: "ristra", unit_quantity: 12, category_name: "Snacks y Chiverías", supplier_name: "Diana Nicaragua", cost: 55, price: 70, stock: 50, low_stock_threshold: 10 },

  { name: "Galletas Chiky Chocolate", unit_type: "paquete", unit_quantity: 12, category_name: "Galletas y Dulces", supplier_name: "Mayoreo El Gallo Más Gallo", cost: 75, price: 90, stock: 50, low_stock_threshold: 10 },
  { name: "Galletas Club Social", unit_type: "paquete", unit_quantity: 12, category_name: "Galletas y Dulces", supplier_name: "Mayoreo El Gallo Más Gallo", cost: 65, price: 80, stock: 50, low_stock_threshold: 10 },
  { name: "Galletas Oreo", unit_type: "paquete", unit_quantity: 12, category_name: "Galletas y Dulces", supplier_name: "Mayoreo El Gallo Más Gallo", cost: 90, price: 110, stock: 50, low_stock_threshold: 10 },
  { name: "Galletas Festival", unit_type: "paquete", unit_quantity: 12, category_name: "Galletas y Dulces", supplier_name: "Mayoreo El Gallo Más Gallo", cost: 80, price: 100, stock: 50, low_stock_threshold: 10 },
  { name: "Galletas Canasta", unit_type: "paquete", unit_quantity: 12, category_name: "Galletas y Dulces", supplier_name: "Mayoreo El Gallo Más Gallo", cost: 75, price: 90, stock: 50, low_stock_threshold: 10 },
  { name: "Galletas Soda Pozuelo", unit_type: "paquete", unit_quantity: 12, category_name: "Galletas y Dulces", supplier_name: "Mayoreo El Gallo Más Gallo", cost: 50, price: 65, stock: 50, low_stock_threshold: 10 },
  { name: "Caramelos Bum Bum", unit_type: "bolsa", unit_quantity: 24, category_name: "Galletas y Dulces", supplier_name: "Mayoreo El Gallo Más Gallo", cost: 55, price: 70, stock: 30, low_stock_threshold: 5 },
  { name: "Gomitas Trululú", unit_type: "paquete", unit_quantity: 12, category_name: "Galletas y Dulces", supplier_name: "Mayoreo El Gallo Más Gallo", cost: 65, price: 80, stock: 30, low_stock_threshold: 5 },
  { name: "Chicles Clorets", unit_type: "caja", unit_quantity: 60, category_name: "Galletas y Dulces", supplier_name: "Mayoreo El Gallo Más Gallo", cost: 85, price: 105, stock: 30, low_stock_threshold: 5 },
  { name: "Chicles Trident", unit_type: "caja", unit_quantity: 12, category_name: "Galletas y Dulces", supplier_name: "Mayoreo El Gallo Más Gallo", cost: 110, price: 135, stock: 30, low_stock_threshold: 5 },
  { name: "Chocolates Crunch", unit_type: "barra", category_name: "Galletas y Dulces", supplier_name: "Mayoreo El Gallo Más Gallo", cost: 25, price: 35, stock: 50, low_stock_threshold: 10 },
  { name: "Mentas Halls", unit_type: "bolsa", unit_quantity: 50, category_name: "Galletas y Dulces", supplier_name: "Mayoreo El Gallo Más Gallo", cost: 40, price: 55, stock: 30, low_stock_threshold: 5 },

  { name: "Coca-Cola 355ml Vidrio", unit_type: "caja", unit_quantity: 24, category_name: "Bebidas", supplier_name: "Coca-Cola FEMSA Nicaragua", cost: 310, price: 360, stock: 24, low_stock_threshold: 6 },
  { name: "Coca-Cola 500ml PET", unit_type: "paquete", unit_quantity: 12, category_name: "Bebidas", supplier_name: "Coca-Cola FEMSA Nicaragua", cost: 210, price: 240, stock: 24, low_stock_threshold: 6 },
  { name: "Sprite 500ml", unit_type: "paquete", unit_quantity: 12, category_name: "Bebidas", supplier_name: "Coca-Cola FEMSA Nicaragua", cost: 200, price: 230, stock: 24, low_stock_threshold: 6 },
  { name: "Fanta Naranja 500ml", unit_type: "paquete", unit_quantity: 12, category_name: "Bebidas", supplier_name: "Coca-Cola FEMSA Nicaragua", cost: 200, price: 230, stock: 24, low_stock_threshold: 6 },
  { name: "Fresca 500ml", unit_type: "paquete", unit_quantity: 12, category_name: "Bebidas", supplier_name: "Coca-Cola FEMSA Nicaragua", cost: 200, price: 230, stock: 24, low_stock_threshold: 6 },
  { name: "Del Valle Naranja 1L", unit_type: "paquete", unit_quantity: 12, category_name: "Bebidas", supplier_name: "Coca-Cola FEMSA Nicaragua", cost: 190, price: 220, stock: 24, low_stock_threshold: 6 },
  { name: "Powerade 500ml", unit_type: "paquete", unit_quantity: 12, category_name: "Bebidas", supplier_name: "Coca-Cola FEMSA Nicaragua", cost: 240, price: 280, stock: 24, low_stock_threshold: 6 },
  { name: "Agua Cristal 600ml", unit_type: "paquete", unit_quantity: 24, category_name: "Bebidas", supplier_name: "Coca-Cola FEMSA Nicaragua", cost: 180, price: 220, stock: 48, low_stock_threshold: 12 },

  { name: "Pepsi 500ml", unit_type: "paquete", unit_quantity: 12, category_name: "Bebidas", supplier_name: "Pepsi Nicaragua", cost: 180, price: 210, stock: 24, low_stock_threshold: 6 },
  { name: "7UP 500ml", unit_type: "paquete", unit_quantity: 12, category_name: "Bebidas", supplier_name: "Pepsi Nicaragua", cost: 180, price: 210, stock: 24, low_stock_threshold: 6 },
  { name: "Mirinda 500ml", unit_type: "paquete", unit_quantity: 12, category_name: "Bebidas", supplier_name: "Pepsi Nicaragua", cost: 165, price: 195, stock: 24, low_stock_threshold: 6 },
  { name: "AMP Energy 500ml", unit_type: "paquete", unit_quantity: 12, category_name: "Bebidas", supplier_name: "Pepsi Nicaragua", cost: 220, price: 260, stock: 24, low_stock_threshold: 6 },
  { name: "Adrenaline Rush 500ml", unit_type: "paquete", unit_quantity: 12, category_name: "Bebidas", supplier_name: "Pepsi Nicaragua", cost: 220, price: 260, stock: 24, low_stock_threshold: 6 },
  { name: "Agua Purificada 600ml", unit_type: "paquete", unit_quantity: 24, category_name: "Bebidas", supplier_name: "Pepsi Nicaragua", cost: 160, price: 200, stock: 48, low_stock_threshold: 12 },

  { name: "Nescafé Tradicional 200g", unit_type: "sobre", category_name: "Abarrotes", supplier_name: "Nestlé Nicaragua", cost: 85, price: 105, stock: 30, low_stock_threshold: 6 },
  { name: "Café Presto Instantáneo", unit_type: "sobre", category_name: "Abarrotes", supplier_name: "Nestlé Nicaragua", cost: 48, price: 60, stock: 50, low_stock_threshold: 12 },
  { name: "Maggi Sazonador", unit_type: "sobre", category_name: "Abarrotes", supplier_name: "Nestlé Nicaragua", cost: 10, price: 15, stock: 100, low_stock_threshold: 20 },
  { name: "Leche Ideal 400g", unit_type: "lata", category_name: "Abarrotes", supplier_name: "Nestlé Nicaragua", cost: 55, price: 70, stock: 24, low_stock_threshold: 6 },
  { name: "Chocapic 300g", unit_type: "caja", category_name: "Abarrotes", supplier_name: "Nestlé Nicaragua", cost: 120, price: 145, stock: 24, low_stock_threshold: 6 },
  { name: "Puré de Tomate Natura's", unit_type: "lata", category_name: "Abarrotes", supplier_name: "Nestlé Nicaragua", cost: 35, price: 45, stock: 50, low_stock_threshold: 12 },

  { name: "Aceite Tip Top 1L", unit_type: "botella", category_name: "Abarrotes", supplier_name: "Cargill Nicaragua", cost: 120, price: 140, stock: 24, low_stock_threshold: 6 },
  { name: "Arroz Gold 2lb", unit_type: "bolsa", category_name: "Abarrotes", supplier_name: "Cargill Nicaragua", cost: 65, price: 80, stock: 50, low_stock_threshold: 12 },
  { name: "Frijoles Rojos 2lb", unit_type: "bolsa", category_name: "Abarrotes", supplier_name: "Cargill Nicaragua", cost: 60, price: 75, stock: 50, low_stock_threshold: 12 },
  { name: "Azúcar San Antonio 2lb", unit_type: "bolsa", category_name: "Abarrotes", supplier_name: "Cargill Nicaragua", cost: 55, price: 70, stock: 50, low_stock_threshold: 12 },

  { name: "Sopa Maruchan Vaso", unit_type: "caja", unit_quantity: 12, category_name: "Abarrotes", supplier_name: "Distribuidora La Colonia", cost: 220, price: 260, stock: 24, low_stock_threshold: 6 },
  { name: "Sopa Maruchan Sobre", unit_type: "sobre", category_name: "Abarrotes", supplier_name: "Distribuidora La Colonia", cost: 18, price: 25, stock: 100, low_stock_threshold: 20 },
  { name: "Frijoles Molidos 1lb", unit_type: "bolsa", category_name: "Abarrotes", supplier_name: "Distribuidora La Colonia", cost: 45, price: 55, stock: 50, low_stock_threshold: 12 },
  { name: "Sal de Mesa 1lb", unit_type: "bolsa", category_name: "Abarrotes", supplier_name: "Distribuidora La Colonia", cost: 12, price: 18, stock: 100, low_stock_threshold: 20 },
  { name: "Salsa Inglesa Lea & Perrins", unit_type: "botella", category_name: "Abarrotes", supplier_name: "Distribuidora La Colonia", cost: 65, price: 80, stock: 24, low_stock_threshold: 6 },

  { name: "Tang Naranja", unit_type: "sobre", category_name: "Abarrotes", supplier_name: "Mayoreo El Gallo Más Gallo", cost: 10, price: 15, stock: 100, low_stock_threshold: 20 },
  { name: "Tang Limón", unit_type: "sobre", category_name: "Abarrotes", supplier_name: "Mayoreo El Gallo Más Gallo", cost: 10, price: 15, stock: 100, low_stock_threshold: 20 },
  { name: "Refresco Clight", unit_type: "sobre", category_name: "Abarrotes", supplier_name: "Mayoreo El Gallo Más Gallo", cost: 15, price: 22, stock: 100, low_stock_threshold: 20 },
  { name: "Avena Quaker", unit_type: "bolsa", category_name: "Abarrotes", supplier_name: "Mayoreo El Gallo Más Gallo", cost: 40, price: 55, stock: 50, low_stock_threshold: 12 },
  { name: "Incaparina", unit_type: "bolsa", category_name: "Abarrotes", supplier_name: "Mayoreo El Gallo Más Gallo", cost: 45, price: 60, stock: 50, low_stock_threshold: 12 },

  { name: "Leche Lala 1L", unit_type: "botella", category_name: "Lácteos y Fríos", supplier_name: "Grupo Lala Nicaragua", cost: 65, price: 80, stock: 30, low_stock_threshold: 6 },
  { name: "Yogurt Lala Bebible", unit_type: "botella", category_name: "Lácteos y Fríos", supplier_name: "Grupo Lala Nicaragua", cost: 35, price: 45, stock: 30, low_stock_threshold: 6 },
  { name: "Crema Lala 500ml", unit_type: "bolsa", category_name: "Lácteos y Fríos", supplier_name: "Grupo Lala Nicaragua", cost: 55, price: 70, stock: 20, low_stock_threshold: 5 },
  { name: "Mantequilla Lala 200g", unit_type: "barra", category_name: "Lácteos y Fríos", supplier_name: "Grupo Lala Nicaragua", cost: 50, price: 65, stock: 20, low_stock_threshold: 5 },

  { name: "Papel Higiénico Scott 4 rollos", unit_type: "paquete", category_name: "Higiene y Limpieza", supplier_name: "Kimberly-Clark Nicaragua", cost: 120, price: 145, stock: 30, low_stock_threshold: 6 },
  { name: "Pañuelos Kleenex", unit_type: "caja", category_name: "Higiene y Limpieza", supplier_name: "Kimberly-Clark Nicaragua", cost: 45, price: 60, stock: 24, low_stock_threshold: 6 },
  { name: "Toallas Húmedas Huggies", unit_type: "paquete", category_name: "Higiene y Limpieza", supplier_name: "Kimberly-Clark Nicaragua", cost: 80, price: 100, stock: 20, low_stock_threshold: 5 },
  { name: "Servilletas Scott", unit_type: "paquete", category_name: "Higiene y Limpieza", supplier_name: "Kimberly-Clark Nicaragua", cost: 35, price: 45, stock: 50, low_stock_threshold: 12 },

  { name: "Jabón de Baño Dove", unit_type: "barra", category_name: "Higiene y Limpieza", supplier_name: "Unilever Nicaragua", cost: 38, price: 48, stock: 50, low_stock_threshold: 12 },
  { name: "Jabón de Baño Lux", unit_type: "barra", category_name: "Higiene y Limpieza", supplier_name: "Unilever Nicaragua", cost: 30, price: 38, stock: 50, low_stock_threshold: 12 },
  { name: "Detergente Rinso 250g", unit_type: "bolsa", category_name: "Higiene y Limpieza", supplier_name: "Unilever Nicaragua", cost: 30, price: 38, stock: 50, low_stock_threshold: 12 },
  { name: "Detergente Surf 250g", unit_type: "bolsa", category_name: "Higiene y Limpieza", supplier_name: "Unilever Nicaragua", cost: 35, price: 45, stock: 50, low_stock_threshold: 12 },
  { name: "Desodorante Axe", unit_type: "unidad", category_name: "Higiene y Limpieza", supplier_name: "Unilever Nicaragua", cost: 65, price: 82, stock: 24, low_stock_threshold: 6 },
  { name: "Shampoo Dove 400ml", unit_type: "botella", category_name: "Higiene y Limpieza", supplier_name: "Unilever Nicaragua", cost: 85, price: 105, stock: 24, low_stock_threshold: 6 },
]

const services: ServiceSeed[] = [
  { name: "Cambio de Aceite", description: "Cambio completo de aceite de motor", base_price: 50, products: [{ productName: "Aceite Tip Top 1L", quantity: 4 }, { productName: "Arroz Gold 2lb", quantity: 1 }] },
  { name: "Limpieza de Equipo", description: "Limpieza profesional de equipos electrónicos", base_price: 35, products: [{ productName: "Papel Higiénico Scott 4 rollos", quantity: 1 }, { productName: "Detergente Rinso 250g", quantity: 1 }] },
  { name: "Paquete de Mantenimiento", description: "Servicio completo de mantenimiento preventivo", base_price: 75, products: [{ productName: "Aceite Tip Top 1L", quantity: 2 }, { productName: "Detergente Surf 250g", quantity: 1 }] },
]

const seed = async () => {
  console.log("🌱 Iniciando seeder de POS...")

  await prisma.sale_service_product.deleteMany({})
  await prisma.sale_service.deleteMany({})
  await prisma.service_product.deleteMany({})
  await prisma.service.deleteMany({})
  await prisma.inventory_batch_item.deleteMany({})
  await prisma.inventory_batch.deleteMany({})
  await prisma.inventory_movement.deleteMany({})
  await prisma.sale_item.deleteMany({})
  await prisma.sale.deleteMany({})
  await prisma.session.deleteMany({})
  await prisma.account.deleteMany({})
  await prisma.user.deleteMany({})
  await prisma.verification.deleteMany({})
  await prisma.product.deleteMany({})
  await prisma.category.deleteMany({})
  await prisma.supplier.deleteMany({})
  await prisma.settings.deleteMany({})
  await prisma.store.deleteMany({})

  // ─── Create store ───
  console.log(`🏪 Creando tienda "${STORE_NAME}"...`)
  const store = await prisma.store.create({
    data: {
      name: STORE_NAME,
      address: "",
      phone: "",
    },
  })
  console.log(`   ✅ Tienda creada: ${store.id}`)

  // ─── Seed categories ───
  const catMap: CategoryMap = {}
  const supMap: SupplierMap = {}

  console.log(`📂 Sembrando ${categories.length} categorías...`)
  for (const cat of categories) {
    const created = await prisma.category.create({
      data: { name: cat.name, description: cat.description, store_id: store.id },
    })
    catMap[cat.name] = created.id
  }
  console.log(`   ✅ ${categories.length} categorías`)

  // ─── Seed suppliers ───
  console.log(`🏢 Sembrando ${suppliers.length} proveedores...`)
  for (const sup of suppliers) {
    const created = await prisma.supplier.create({
      data: { ...sup, store_id: store.id },
    })
    supMap[sup.name] = created.id
  }
  console.log(`   ✅ ${suppliers.length} proveedores`)

  // ─── Seed products ───
  console.log(`📦 Sembrando ${products.length} productos...`)
  for (const p of products) {
    await prisma.product.create({
      data: {
        name: p.name,
        unit_type: p.unit_type,
        unit_quantity: p.unit_quantity,
        category_id: catMap[p.category_name],
        supplier_id: supMap[p.supplier_name],
        cost: p.cost,
        price: p.price,
        stock: p.stock,
        low_stock_threshold: p.low_stock_threshold,
        active: true,
        store_id: store.id,
      },
    })
  }
  console.log(`   ✅ ${products.length} productos`)

  // ─── Seed services ───
  console.log(`🔧 Sembrando ${services.length} servicios...`)
  for (const svc of services) {
    const created = await prisma.service.create({
      data: {
        name: svc.name,
        description: svc.description,
        base_price: svc.base_price,
        is_active: true,
        store_id: store.id,
      },
    })

    for (const sp of svc.products) {
      const product = await prisma.product.findFirst({
        where: { name: { contains: sp.productName, mode: "insensitive" }, store_id: store.id, deleted_at: null },
      })
      if (product) {
        await prisma.service_product.create({
          data: {
          service_id: created.id,
          product_id: product.id,
          quantity: sp.quantity,
          },
        })
      }
    }
  }
  console.log(`   ✅ ${services.length} servicios`)

  // ─── Create default settings ───
  await prisma.settings.create({
    data: {
      store_id: store.id,
      name: STORE_NAME,
      low_stock_threshold: 5,
    },
  })
  console.log(`   ✅ Configuración por defecto creada`)

  // ─── Seed users ───
  const testUsers = [
    { name: "Admin", email: "admin@smart-miscelanea.com", password: "admin123", role: "admin" as const },
    { name: "Cajero", email: "cajero@smart-miscelanea.com", password: "cajero123", role: "cajero" as const },
  ]

  console.log(`👤 Sembrando ${testUsers.length} usuarios de prueba...`)
  for (const u of testUsers) {
    const user = await prisma.user.create({
      data: {
        name: u.name,
        email: u.email,
        role: u.role,
        email_verified: true,
        store_id: store.id,
      },
    })

    const hashedPassword = await hashPassword(u.password)
    await prisma.account.create({
      data: {
        account_id: user.id,
        provider_id: "credentials",
        user_id: user.id,
        password: hashedPassword,
      },
    })
    console.log(`   ✅ ${u.email} (${u.role})`)
  }

  console.log("")
  console.log("═══════════════════════════════════════")
  console.log("        RESUMEN DE DATOS SEMBRADOS")
  console.log("═══════════════════════════════════════")
  console.log(`   🏪 ${store.name}`)
  console.log(`   📂 ${categories.length} categorías`)
  console.log(`   🏢 ${suppliers.length} proveedores`)
  console.log(`   📦 ${products.length} productos`)
  console.log(`   🔧 ${services.length} servicios`)
  console.log(`   👤 ${testUsers.length} usuarios`)
  console.log("───────────────────────────────────────")

  const prodCounts = await prisma.product.groupBy({
    by: ["category_id"],
    _count: { id: true },
    where: { store_id: store.id, deleted_at: null },
  })

  console.log("   📦 Productos por categoría:")
  for (const c of prodCounts) {
    const cat = await prisma.category.findFirst({ where: { id: c.category_id!, store_id: store.id } })
    if (cat) console.log(`      • ${cat.name}: ${c._count.id} productos`)
  }

  console.log("   🏢 Productos por proveedor:")
  for (const s of suppliers) {
    const supplierRecord = await prisma.supplier.findFirst({ where: { name: s.name, store_id: store.id } })
    if (supplierRecord) {
      const productCount = await prisma.product.count({
        where: { supplier_id: supplierRecord.id, store_id: store.id, deleted_at: null },
      })
      console.log(`      • ${s.name}: ${productCount} productos`)
    }
  }

  console.log("═══════════════════════════════════════")
  console.log("")
  console.log("🔐 Usuarios de prueba:")
  for (const u of testUsers) {
    console.log(`   • ${u.email} / ${u.password} (${u.role})`)
  }
  console.log("")
  console.log("🎉 Seeder completado exitosamente!")
}

seed()
  .catch((e) => {
    console.error("❌ Seeder falló:", e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })