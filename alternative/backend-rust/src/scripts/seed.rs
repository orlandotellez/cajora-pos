// Ejecutar seeder con cargo run --bin seed

use bcrypt::DEFAULT_COST;
use dotenvy::dotenv;
use sqlx::PgPool;
use sqlx::postgres::PgPoolOptions;
use std::collections::HashMap;
use uuid::Uuid;

// ─────────────────────────────────────────────
// DATA
// ─────────────────────────────────────────────

const CATEGORIES: &[(&str, &str)] = &[
    (
        "Snacks y Chiverías",
        "Papas, churritos, cacahuates y botanas",
    ),
    (
        "Galletas y Dulces",
        "Galletas, caramelos, chocolates y chicles",
    ),
    ("Bebidas", "Gaseosas, jugos, aguas y energizantes"),
    ("Abarrotes", "Café, leche, aceite, sopas y salsas"),
    ("Lácteos y Fríos", "Leche, yogurt, crema y embutidos"),
    (
        "Higiene y Limpieza",
        "Papel higiénico, jabón, detergente y cuidado personal",
    ),
];

const SUPPLIERS: &[(&str, &str, &str, &str, &str, &str)] = &[
    (
        "Diana Nicaragua",
        "Ejecutivo de Ventas",
        "ventas@diana.com",
        "0000-0000",
        "Managua, Nicaragua",
        "Snacks, chiverías y productos Diana",
    ),
    (
        "Coca-Cola FEMSA Nicaragua",
        "Ejecutivo Comercial",
        "ventas@coca-cola.com",
        "0000-0000",
        "Managua, Nicaragua",
        "Bebidas Coca-Cola, Fanta, Sprite, Del Valle",
    ),
    (
        "Pepsi Nicaragua",
        "Ejecutivo Comercial",
        "ventas@pepsi.com",
        "0000-0000",
        "Managua, Nicaragua",
        "Pepsi, 7UP, Mirinda, AMP",
    ),
    (
        "Nestlé Nicaragua",
        "Ejecutivo Comercial",
        "ventas@nestle.com",
        "0000-0000",
        "Managua, Nicaragua",
        "Café, chocolates, lácteos y alimentos",
    ),
    (
        "Cargill Nicaragua",
        "Ejecutivo Comercial",
        "ventas@cargill.com",
        "0000-0000",
        "Managua, Nicaragua",
        "Tip Top, embutidos y productos alimenticios",
    ),
    (
        "Grupo Lala Nicaragua",
        "Ejecutivo Comercial",
        "ventas@lala.com",
        "0000-0000",
        "Managua, Nicaragua",
        "Lácteos y bebidas",
    ),
    (
        "Distribuidora La Colonia",
        "Ventas Mayoristas",
        "mayoreo@lacolonia.com",
        "0000-0000",
        "Managua, Nicaragua",
        "Abarrotes y productos de consumo masivo",
    ),
    (
        "Mayoreo El Gallo Más Gallo",
        "Ventas",
        "ventas@gallomasgallo.com",
        "0000-0000",
        "Managua, Nicaragua",
        "Distribución y abastecimiento",
    ),
    (
        "Kimberly-Clark Nicaragua",
        "Ejecutivo Comercial",
        "ventas@kimberly-clark.com",
        "0000-0000",
        "Managua, Nicaragua",
        "Papel higiénico, servilletas y productos de higiene",
    ),
    (
        "Unilever Nicaragua",
        "Ejecutivo Comercial",
        "ventas@unilever.com",
        "0000-0000",
        "Managua, Nicaragua",
        "Detergentes, jabones y productos de limpieza",
    ),
];

struct ProductSeed {
    name: &'static str,
    unit_type: &'static str,
    unit_quantity: Option<i32>,
    category: &'static str,
    supplier: &'static str,
    cost: f64,
    price: f64,
    stock: i32,
    low_stock: i32,
    tax_rate: f64,
}

const PRODUCTS: &[ProductSeed] = &[
    // ── Snacks y Chiverías (Diana Nicaragua) ──
    ProductSeed {
        name: "Ranchitas Originales",
        unit_type: "ristra",
        unit_quantity: Some(12),
        category: "Snacks y Chiverías",
        supplier: "Diana Nicaragua",
        cost: 55.0,
        price: 70.0,
        stock: 50,
        low_stock: 10,
        tax_rate: 0.0,
    },
    ProductSeed {
        name: "Jalapeños Diana",
        unit_type: "ristra",
        unit_quantity: Some(12),
        category: "Snacks y Chiverías",
        supplier: "Diana Nicaragua",
        cost: 60.0,
        price: 75.0,
        stock: 50,
        low_stock: 10,
        tax_rate: 0.0,
    },
    ProductSeed {
        name: "Elotitos Diana",
        unit_type: "ristra",
        unit_quantity: Some(12),
        category: "Snacks y Chiverías",
        supplier: "Diana Nicaragua",
        cost: 60.0,
        price: 75.0,
        stock: 50,
        low_stock: 10,
        tax_rate: 0.0,
    },
    ProductSeed {
        name: "Yuca Diana",
        unit_type: "ristra",
        unit_quantity: Some(12),
        category: "Snacks y Chiverías",
        supplier: "Diana Nicaragua",
        cost: 50.0,
        price: 65.0,
        stock: 50,
        low_stock: 10,
        tax_rate: 0.0,
    },
    ProductSeed {
        name: "Zambos con Chile",
        unit_type: "ristra",
        unit_quantity: Some(12),
        category: "Snacks y Chiverías",
        supplier: "Diana Nicaragua",
        cost: 70.0,
        price: 85.0,
        stock: 50,
        low_stock: 10,
        tax_rate: 0.0,
    },
    ProductSeed {
        name: "Tronaditas",
        unit_type: "ristra",
        unit_quantity: Some(12),
        category: "Snacks y Chiverías",
        supplier: "Diana Nicaragua",
        cost: 55.0,
        price: 70.0,
        stock: 50,
        low_stock: 10,
        tax_rate: 0.0,
    },
    ProductSeed {
        name: "Churritos Diana",
        unit_type: "ristra",
        unit_quantity: Some(12),
        category: "Snacks y Chiverías",
        supplier: "Diana Nicaragua",
        cost: 55.0,
        price: 70.0,
        stock: 50,
        low_stock: 10,
        tax_rate: 0.0,
    },
    // ── Galletas y Dulces (Mayoreo El Gallo Más Gallo) ──
    ProductSeed {
        name: "Galletas Chiky Chocolate",
        unit_type: "paquete",
        unit_quantity: Some(12),
        category: "Galletas y Dulces",
        supplier: "Mayoreo El Gallo Más Gallo",
        cost: 75.0,
        price: 90.0,
        stock: 50,
        low_stock: 10,
        tax_rate: 0.0,
    },
    ProductSeed {
        name: "Galletas Club Social",
        unit_type: "paquete",
        unit_quantity: Some(12),
        category: "Galletas y Dulces",
        supplier: "Mayoreo El Gallo Más Gallo",
        cost: 65.0,
        price: 80.0,
        stock: 50,
        low_stock: 10,
        tax_rate: 0.0,
    },
    ProductSeed {
        name: "Galletas Oreo",
        unit_type: "paquete",
        unit_quantity: Some(12),
        category: "Galletas y Dulces",
        supplier: "Mayoreo El Gallo Más Gallo",
        cost: 90.0,
        price: 110.0,
        stock: 50,
        low_stock: 10,
        tax_rate: 0.0,
    },
    ProductSeed {
        name: "Galletas Festival",
        unit_type: "paquete",
        unit_quantity: Some(12),
        category: "Galletas y Dulces",
        supplier: "Mayoreo El Gallo Más Gallo",
        cost: 80.0,
        price: 100.0,
        stock: 50,
        low_stock: 10,
        tax_rate: 0.0,
    },
    ProductSeed {
        name: "Galletas Canasta",
        unit_type: "paquete",
        unit_quantity: Some(12),
        category: "Galletas y Dulces",
        supplier: "Mayoreo El Gallo Más Gallo",
        cost: 75.0,
        price: 90.0,
        stock: 50,
        low_stock: 10,
        tax_rate: 0.0,
    },
    ProductSeed {
        name: "Galletas Soda Pozuelo",
        unit_type: "paquete",
        unit_quantity: Some(12),
        category: "Galletas y Dulces",
        supplier: "Mayoreo El Gallo Más Gallo",
        cost: 50.0,
        price: 65.0,
        stock: 50,
        low_stock: 10,
        tax_rate: 0.0,
    },
    ProductSeed {
        name: "Caramelos Bum Bum",
        unit_type: "bolsa",
        unit_quantity: Some(24),
        category: "Galletas y Dulces",
        supplier: "Mayoreo El Gallo Más Gallo",
        cost: 55.0,
        price: 70.0,
        stock: 30,
        low_stock: 5,
        tax_rate: 0.0,
    },
    ProductSeed {
        name: "Gomitas Trululú",
        unit_type: "paquete",
        unit_quantity: Some(12),
        category: "Galletas y Dulces",
        supplier: "Mayoreo El Gallo Más Gallo",
        cost: 65.0,
        price: 80.0,
        stock: 30,
        low_stock: 5,
        tax_rate: 0.0,
    },
    ProductSeed {
        name: "Chicles Clorets",
        unit_type: "caja",
        unit_quantity: Some(60),
        category: "Galletas y Dulces",
        supplier: "Mayoreo El Gallo Más Gallo",
        cost: 85.0,
        price: 105.0,
        stock: 30,
        low_stock: 5,
        tax_rate: 0.0,
    },
    ProductSeed {
        name: "Chicles Trident",
        unit_type: "caja",
        unit_quantity: Some(12),
        category: "Galletas y Dulces",
        supplier: "Mayoreo El Gallo Más Gallo",
        cost: 110.0,
        price: 135.0,
        stock: 30,
        low_stock: 5,
        tax_rate: 0.0,
    },
    ProductSeed {
        name: "Chocolates Crunch",
        unit_type: "barra",
        unit_quantity: None,
        category: "Galletas y Dulces",
        supplier: "Mayoreo El Gallo Más Gallo",
        cost: 25.0,
        price: 35.0,
        stock: 50,
        low_stock: 10,
        tax_rate: 0.0,
    },
    ProductSeed {
        name: "Mentas Halls",
        unit_type: "bolsa",
        unit_quantity: Some(50),
        category: "Galletas y Dulces",
        supplier: "Mayoreo El Gallo Más Gallo",
        cost: 40.0,
        price: 55.0,
        stock: 30,
        low_stock: 5,
        tax_rate: 0.0,
    },
    // ── Bebidas (Coca-Cola) ──
    ProductSeed {
        name: "Coca-Cola 355ml Vidrio",
        unit_type: "caja",
        unit_quantity: Some(24),
        category: "Bebidas",
        supplier: "Coca-Cola FEMSA Nicaragua",
        cost: 310.0,
        price: 360.0,
        stock: 24,
        low_stock: 6,
        tax_rate: 0.0,
    },
    ProductSeed {
        name: "Coca-Cola 500ml PET",
        unit_type: "paquete",
        unit_quantity: Some(12),
        category: "Bebidas",
        supplier: "Coca-Cola FEMSA Nicaragua",
        cost: 210.0,
        price: 240.0,
        stock: 24,
        low_stock: 6,
        tax_rate: 0.0,
    },
    ProductSeed {
        name: "Sprite 500ml",
        unit_type: "paquete",
        unit_quantity: Some(12),
        category: "Bebidas",
        supplier: "Coca-Cola FEMSA Nicaragua",
        cost: 200.0,
        price: 230.0,
        stock: 24,
        low_stock: 6,
        tax_rate: 0.0,
    },
    ProductSeed {
        name: "Fanta Naranja 500ml",
        unit_type: "paquete",
        unit_quantity: Some(12),
        category: "Bebidas",
        supplier: "Coca-Cola FEMSA Nicaragua",
        cost: 200.0,
        price: 230.0,
        stock: 24,
        low_stock: 6,
        tax_rate: 0.0,
    },
    ProductSeed {
        name: "Fresca 500ml",
        unit_type: "paquete",
        unit_quantity: Some(12),
        category: "Bebidas",
        supplier: "Coca-Cola FEMSA Nicaragua",
        cost: 200.0,
        price: 230.0,
        stock: 24,
        low_stock: 6,
        tax_rate: 0.0,
    },
    ProductSeed {
        name: "Del Valle Naranja 1L",
        unit_type: "paquete",
        unit_quantity: Some(12),
        category: "Bebidas",
        supplier: "Coca-Cola FEMSA Nicaragua",
        cost: 190.0,
        price: 220.0,
        stock: 24,
        low_stock: 6,
        tax_rate: 0.0,
    },
    ProductSeed {
        name: "Powerade 500ml",
        unit_type: "paquete",
        unit_quantity: Some(12),
        category: "Bebidas",
        supplier: "Coca-Cola FEMSA Nicaragua",
        cost: 240.0,
        price: 280.0,
        stock: 24,
        low_stock: 6,
        tax_rate: 0.0,
    },
    ProductSeed {
        name: "Agua Cristal 600ml",
        unit_type: "paquete",
        unit_quantity: Some(24),
        category: "Bebidas",
        supplier: "Coca-Cola FEMSA Nicaragua",
        cost: 180.0,
        price: 220.0,
        stock: 48,
        low_stock: 12,
        tax_rate: 0.0,
    },
    // ── Bebidas (Pepsi) ──
    ProductSeed {
        name: "Pepsi 500ml",
        unit_type: "paquete",
        unit_quantity: Some(12),
        category: "Bebidas",
        supplier: "Pepsi Nicaragua",
        cost: 180.0,
        price: 210.0,
        stock: 24,
        low_stock: 6,
        tax_rate: 0.0,
    },
    ProductSeed {
        name: "7UP 500ml",
        unit_type: "paquete",
        unit_quantity: Some(12),
        category: "Bebidas",
        supplier: "Pepsi Nicaragua",
        cost: 180.0,
        price: 210.0,
        stock: 24,
        low_stock: 6,
        tax_rate: 0.0,
    },
    ProductSeed {
        name: "Mirinda 500ml",
        unit_type: "paquete",
        unit_quantity: Some(12),
        category: "Bebidas",
        supplier: "Pepsi Nicaragua",
        cost: 165.0,
        price: 195.0,
        stock: 24,
        low_stock: 6,
        tax_rate: 0.0,
    },
    ProductSeed {
        name: "AMP Energy 500ml",
        unit_type: "paquete",
        unit_quantity: Some(12),
        category: "Bebidas",
        supplier: "Pepsi Nicaragua",
        cost: 220.0,
        price: 260.0,
        stock: 24,
        low_stock: 6,
        tax_rate: 0.0,
    },
    ProductSeed {
        name: "Adrenaline Rush 500ml",
        unit_type: "paquete",
        unit_quantity: Some(12),
        category: "Bebidas",
        supplier: "Pepsi Nicaragua",
        cost: 220.0,
        price: 260.0,
        stock: 24,
        low_stock: 6,
        tax_rate: 0.0,
    },
    ProductSeed {
        name: "Agua Purificada 600ml",
        unit_type: "paquete",
        unit_quantity: Some(24),
        category: "Bebidas",
        supplier: "Pepsi Nicaragua",
        cost: 160.0,
        price: 200.0,
        stock: 48,
        low_stock: 12,
        tax_rate: 0.0,
    },
    // ── Abarrotes (Nestlé) ──
    ProductSeed {
        name: "Nescafé Tradicional 200g",
        unit_type: "sobre",
        unit_quantity: None,
        category: "Abarrotes",
        supplier: "Nestlé Nicaragua",
        cost: 85.0,
        price: 105.0,
        stock: 30,
        low_stock: 6,
        tax_rate: 0.0,
    },
    ProductSeed {
        name: "Café Presto Instantáneo",
        unit_type: "sobre",
        unit_quantity: None,
        category: "Abarrotes",
        supplier: "Nestlé Nicaragua",
        cost: 48.0,
        price: 60.0,
        stock: 50,
        low_stock: 12,
        tax_rate: 0.0,
    },
    ProductSeed {
        name: "Maggi Sazonador",
        unit_type: "sobre",
        unit_quantity: None,
        category: "Abarrotes",
        supplier: "Nestlé Nicaragua",
        cost: 10.0,
        price: 15.0,
        stock: 100,
        low_stock: 20,
        tax_rate: 0.0,
    },
    ProductSeed {
        name: "Leche Ideal 400g",
        unit_type: "lata",
        unit_quantity: None,
        category: "Abarrotes",
        supplier: "Nestlé Nicaragua",
        cost: 55.0,
        price: 70.0,
        stock: 24,
        low_stock: 6,
        tax_rate: 0.0,
    },
    ProductSeed {
        name: "Chocapic 300g",
        unit_type: "caja",
        unit_quantity: None,
        category: "Abarrotes",
        supplier: "Nestlé Nicaragua",
        cost: 120.0,
        price: 145.0,
        stock: 24,
        low_stock: 6,
        tax_rate: 0.0,
    },
    ProductSeed {
        name: "Puré de Tomate Natura's",
        unit_type: "lata",
        unit_quantity: None,
        category: "Abarrotes",
        supplier: "Nestlé Nicaragua",
        cost: 35.0,
        price: 45.0,
        stock: 50,
        low_stock: 12,
        tax_rate: 0.0,
    },
    // ── Abarrotes (Cargill) ──
    ProductSeed {
        name: "Aceite Tip Top 1L",
        unit_type: "botella",
        unit_quantity: None,
        category: "Abarrotes",
        supplier: "Cargill Nicaragua",
        cost: 120.0,
        price: 140.0,
        stock: 24,
        low_stock: 6,
        tax_rate: 0.0,
    },
    ProductSeed {
        name: "Arroz Gold 2lb",
        unit_type: "bolsa",
        unit_quantity: None,
        category: "Abarrotes",
        supplier: "Cargill Nicaragua",
        cost: 65.0,
        price: 80.0,
        stock: 50,
        low_stock: 12,
        tax_rate: 0.0,
    },
    ProductSeed {
        name: "Frijoles Rojos 2lb",
        unit_type: "bolsa",
        unit_quantity: None,
        category: "Abarrotes",
        supplier: "Cargill Nicaragua",
        cost: 60.0,
        price: 75.0,
        stock: 50,
        low_stock: 12,
        tax_rate: 0.0,
    },
    ProductSeed {
        name: "Azúcar San Antonio 2lb",
        unit_type: "bolsa",
        unit_quantity: None,
        category: "Abarrotes",
        supplier: "Cargill Nicaragua",
        cost: 55.0,
        price: 70.0,
        stock: 50,
        low_stock: 12,
        tax_rate: 0.0,
    },
    // ── Abarrotes (La Colonia) ──
    ProductSeed {
        name: "Sopa Maruchan Vaso",
        unit_type: "caja",
        unit_quantity: Some(12),
        category: "Abarrotes",
        supplier: "Distribuidora La Colonia",
        cost: 220.0,
        price: 260.0,
        stock: 24,
        low_stock: 6,
        tax_rate: 0.0,
    },
    ProductSeed {
        name: "Sopa Maruchan Sobre",
        unit_type: "sobre",
        unit_quantity: None,
        category: "Abarrotes",
        supplier: "Distribuidora La Colonia",
        cost: 18.0,
        price: 25.0,
        stock: 100,
        low_stock: 20,
        tax_rate: 0.0,
    },
    ProductSeed {
        name: "Frijoles Molidos 1lb",
        unit_type: "bolsa",
        unit_quantity: None,
        category: "Abarrotes",
        supplier: "Distribuidora La Colonia",
        cost: 45.0,
        price: 55.0,
        stock: 50,
        low_stock: 12,
        tax_rate: 0.0,
    },
    ProductSeed {
        name: "Sal de Mesa 1lb",
        unit_type: "bolsa",
        unit_quantity: None,
        category: "Abarrotes",
        supplier: "Distribuidora La Colonia",
        cost: 12.0,
        price: 18.0,
        stock: 100,
        low_stock: 20,
        tax_rate: 0.0,
    },
    ProductSeed {
        name: "Salsa Inglesa Lea & Perrins",
        unit_type: "botella",
        unit_quantity: None,
        category: "Abarrotes",
        supplier: "Distribuidora La Colonia",
        cost: 65.0,
        price: 80.0,
        stock: 24,
        low_stock: 6,
        tax_rate: 0.0,
    },
    // ── Abarrotes (El Gallo Más Gallo) ──
    ProductSeed {
        name: "Tang Naranja",
        unit_type: "sobre",
        unit_quantity: None,
        category: "Abarrotes",
        supplier: "Mayoreo El Gallo Más Gallo",
        cost: 10.0,
        price: 15.0,
        stock: 100,
        low_stock: 20,
        tax_rate: 0.0,
    },
    ProductSeed {
        name: "Tang Limón",
        unit_type: "sobre",
        unit_quantity: None,
        category: "Abarrotes",
        supplier: "Mayoreo El Gallo Más Gallo",
        cost: 10.0,
        price: 15.0,
        stock: 100,
        low_stock: 20,
        tax_rate: 0.0,
    },
    ProductSeed {
        name: "Refresco Clight",
        unit_type: "sobre",
        unit_quantity: None,
        category: "Abarrotes",
        supplier: "Mayoreo El Gallo Más Gallo",
        cost: 15.0,
        price: 22.0,
        stock: 100,
        low_stock: 20,
        tax_rate: 0.0,
    },
    ProductSeed {
        name: "Avena Quaker",
        unit_type: "bolsa",
        unit_quantity: None,
        category: "Abarrotes",
        supplier: "Mayoreo El Gallo Más Gallo",
        cost: 40.0,
        price: 55.0,
        stock: 50,
        low_stock: 12,
        tax_rate: 0.0,
    },
    ProductSeed {
        name: "Incaparina",
        unit_type: "bolsa",
        unit_quantity: None,
        category: "Abarrotes",
        supplier: "Mayoreo El Gallo Más Gallo",
        cost: 45.0,
        price: 60.0,
        stock: 50,
        low_stock: 12,
        tax_rate: 0.0,
    },
    // ── Lácteos y Fríos (Lala) ──
    ProductSeed {
        name: "Leche Lala 1L",
        unit_type: "botella",
        unit_quantity: None,
        category: "Lácteos y Fríos",
        supplier: "Grupo Lala Nicaragua",
        cost: 65.0,
        price: 80.0,
        stock: 30,
        low_stock: 6,
        tax_rate: 0.0,
    },
    ProductSeed {
        name: "Yogurt Lala Bebible",
        unit_type: "botella",
        unit_quantity: None,
        category: "Lácteos y Fríos",
        supplier: "Grupo Lala Nicaragua",
        cost: 35.0,
        price: 45.0,
        stock: 30,
        low_stock: 6,
        tax_rate: 0.0,
    },
    ProductSeed {
        name: "Crema Lala 500ml",
        unit_type: "bolsa",
        unit_quantity: None,
        category: "Lácteos y Fríos",
        supplier: "Grupo Lala Nicaragua",
        cost: 55.0,
        price: 70.0,
        stock: 20,
        low_stock: 5,
        tax_rate: 0.0,
    },
    ProductSeed {
        name: "Mantequilla Lala 200g",
        unit_type: "barra",
        unit_quantity: None,
        category: "Lácteos y Fríos",
        supplier: "Grupo Lala Nicaragua",
        cost: 50.0,
        price: 65.0,
        stock: 20,
        low_stock: 5,
        tax_rate: 0.0,
    },
    // ── Higiene y Limpieza (Kimberly-Clark) ──
    ProductSeed {
        name: "Papel Higiénico Scott 4 rollos",
        unit_type: "paquete",
        unit_quantity: None,
        category: "Higiene y Limpieza",
        supplier: "Kimberly-Clark Nicaragua",
        cost: 120.0,
        price: 145.0,
        stock: 30,
        low_stock: 6,
        tax_rate: 0.0,
    },
    ProductSeed {
        name: "Pañuelos Kleenex",
        unit_type: "caja",
        unit_quantity: None,
        category: "Higiene y Limpieza",
        supplier: "Kimberly-Clark Nicaragua",
        cost: 45.0,
        price: 60.0,
        stock: 24,
        low_stock: 6,
        tax_rate: 0.0,
    },
    ProductSeed {
        name: "Toallas Húmedas Huggies",
        unit_type: "paquete",
        unit_quantity: None,
        category: "Higiene y Limpieza",
        supplier: "Kimberly-Clark Nicaragua",
        cost: 80.0,
        price: 100.0,
        stock: 20,
        low_stock: 5,
        tax_rate: 0.0,
    },
    ProductSeed {
        name: "Servilletas Scott",
        unit_type: "paquete",
        unit_quantity: None,
        category: "Higiene y Limpieza",
        supplier: "Kimberly-Clark Nicaragua",
        cost: 35.0,
        price: 45.0,
        stock: 50,
        low_stock: 12,
        tax_rate: 0.0,
    },
    // ── Higiene y Limpieza (Unilever) ──
    ProductSeed {
        name: "Jabón de Baño Dove",
        unit_type: "barra",
        unit_quantity: None,
        category: "Higiene y Limpieza",
        supplier: "Unilever Nicaragua",
        cost: 38.0,
        price: 48.0,
        stock: 50,
        low_stock: 12,
        tax_rate: 0.0,
    },
    ProductSeed {
        name: "Jabón de Baño Lux",
        unit_type: "barra",
        unit_quantity: None,
        category: "Higiene y Limpieza",
        supplier: "Unilever Nicaragua",
        cost: 30.0,
        price: 38.0,
        stock: 50,
        low_stock: 12,
        tax_rate: 0.0,
    },
    ProductSeed {
        name: "Detergente Rinso 250g",
        unit_type: "bolsa",
        unit_quantity: None,
        category: "Higiene y Limpieza",
        supplier: "Unilever Nicaragua",
        cost: 30.0,
        price: 38.0,
        stock: 50,
        low_stock: 12,
        tax_rate: 0.0,
    },
    ProductSeed {
        name: "Detergente Surf 250g",
        unit_type: "bolsa",
        unit_quantity: None,
        category: "Higiene y Limpieza",
        supplier: "Unilever Nicaragua",
        cost: 35.0,
        price: 45.0,
        stock: 50,
        low_stock: 12,
        tax_rate: 0.0,
    },
    ProductSeed {
        name: "Desodorante Axe",
        unit_type: "unidad",
        unit_quantity: None,
        category: "Higiene y Limpieza",
        supplier: "Unilever Nicaragua",
        cost: 65.0,
        price: 82.0,
        stock: 24,
        low_stock: 6,
        tax_rate: 0.0,
    },
    ProductSeed {
        name: "Shampoo Dove 400ml",
        unit_type: "botella",
        unit_quantity: None,
        category: "Higiene y Limpieza",
        supplier: "Unilever Nicaragua",
        cost: 85.0,
        price: 105.0,
        stock: 24,
        low_stock: 6,
        tax_rate: 0.0,
    },
];

struct ServiceSeed {
    name: &'static str,
    description: &'static str,
    base_price: f64,
    products: &'static [(&'static str, i32)],
}

const SERVICES: &[ServiceSeed] = &[
    ServiceSeed {
        name: "Cambio de Aceite",
        description: "Cambio completo de aceite de motor",
        base_price: 50.0,
        products: &[("Aceite Tip Top 1L", 4), ("Arroz Gold 2lb", 1)],
    },
    ServiceSeed {
        name: "Limpieza de Equipo",
        description: "Limpieza profesional de equipos electrónicos",
        base_price: 35.0,
        products: &[
            ("Papel Higiénico Scott 4 rollos", 1),
            ("Detergente Rinso 250g", 1),
        ],
    },
    ServiceSeed {
        name: "Paquete de Mantenimiento",
        description: "Servicio completo de mantenimiento preventivo",
        base_price: 75.0,
        products: &[("Aceite Tip Top 1L", 2), ("Detergente Surf 250g", 1)],
    },
];

struct UserSeed {
    name: &'static str,
    email: &'static str,
    password: &'static str,
    role: &'static str,
}

const TEST_USERS: &[UserSeed] = &[
    UserSeed {
        name: "Admin",
        email: "admin@smart-miscelanea.com",
        password: "admin123",
        role: "admin",
    },
    UserSeed {
        name: "Cajero",
        email: "cajero@smart-miscelanea.com",
        password: "cajero123",
        role: "cajero",
    },
];

// ─────────────────────────────────────────────
// SEED LOGIC
// ─────────────────────────────────────────────

fn to_numeric(val: f64) -> f64 {
    (val * 100.0).round() / 100.0
}

async fn clean_db(pool: &PgPool) -> Result<(), sqlx::Error> {
    println!("   Limpiando base de datos existente...");

    let tables = [
        "sale_service_products",
        "sale_services",
        "sale_items",
        "sales",
        "service_products",
        "services",
        "inventory_batch_items",
        "inventory_movements",
        "inventory_batches",
        "products",
        "categories",
        "suppliers",
        "session",
        "account",
        "verification",
        "users",
    ];

    for table in tables {
        let sql = format!("DELETE FROM {}", table);
        sqlx::query(&sql).execute(pool).await?;
    }

    Ok(())
}

async fn seed_categories(pool: &PgPool) -> Result<HashMap<String, Uuid>, sqlx::Error> {
    println!("📂 Sembrando {} categorías...", CATEGORIES.len());
    let mut map = HashMap::new();

    for (name, desc) in CATEGORIES {
        let id = Uuid::new_v4();
        sqlx::query("INSERT INTO categories (id, name, description, updated_at) VALUES ($1, $2, $3, NOW())")
            .bind(id)
            .bind(name)
            .bind(desc)
            .execute(pool)
            .await?;
        map.insert(name.to_string(), id);
    }

    println!("   ✅ {} categorías", CATEGORIES.len());
    Ok(map)
}

async fn seed_suppliers(pool: &PgPool) -> Result<HashMap<String, Uuid>, sqlx::Error> {
    println!("🏢 Sembrando {} proveedores...", SUPPLIERS.len());
    let mut map = HashMap::new();

    for (name, contact, email, phone, address, notes) in SUPPLIERS {
        let id = Uuid::new_v4();
        sqlx::query(
            r#"INSERT INTO suppliers (id, name, contact_name, email, phone, address, notes, is_active, updated_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7, true, NOW())"#,
        )
        .bind(id)
        .bind(name)
        .bind(contact)
        .bind(email)
        .bind(phone)
        .bind(address)
        .bind(notes)
        .execute(pool)
        .await?;
        map.insert(name.to_string(), id);
    }

    println!("   ✅ {} proveedores", SUPPLIERS.len());
    Ok(map)
}

async fn seed_products(
    pool: &PgPool,
    cat_map: &HashMap<String, Uuid>,
    sup_map: &HashMap<String, Uuid>,
) -> Result<HashMap<String, Uuid>, sqlx::Error> {
    println!("📦 Sembrando {} productos...", PRODUCTS.len());
    let mut map = HashMap::new();

    for p in PRODUCTS {
        let id = Uuid::new_v4();
        let category_id = cat_map.get(p.category);
        let supplier_id = sup_map.get(p.supplier);

        sqlx::query(
            r#"INSERT INTO products
               (id, name, unit_type, unit_quantity, category_id, supplier_id,
                 price, cost, tax_rate, stock, low_stock_threshold, active, updated_at)
               VALUES ($1, $2, $3::"UNIT_TYPE", $4, $5, $6,
                        $7, $8, $9, $10, $11, true, NOW())"#,
        )
        .bind(id)
        .bind(p.name)
        .bind(p.unit_type)
        .bind(p.unit_quantity)
        .bind(category_id)
        .bind(supplier_id)
        .bind(to_numeric(p.price))
        .bind(to_numeric(p.cost))
        .bind(to_numeric(p.tax_rate))
        .bind(p.stock)
        .bind(p.low_stock)
        .execute(pool)
        .await?;

        map.insert(p.name.to_string(), id);
    }

    println!("   ✅ {} productos", PRODUCTS.len());
    Ok(map)
}

async fn seed_services(pool: &PgPool, prod_map: &HashMap<String, Uuid>) -> Result<(), sqlx::Error> {
    println!("🔧 Sembrando {} servicios...", SERVICES.len());

    for svc in SERVICES {
        let service_id = Uuid::new_v4();
        sqlx::query(
            r#"INSERT INTO services (id, name, description, base_price, is_active, updated_at)
               VALUES ($1, $2, $3, $4, true, NOW())"#,
        )
        .bind(service_id)
        .bind(svc.name)
        .bind(svc.description)
        .bind(to_numeric(svc.base_price))
        .execute(pool)
        .await?;

        for (prod_name, qty) in svc.products {
            if let Some(product_id) = prod_map.get(*prod_name) {
                let sp_id = Uuid::new_v4();
                sqlx::query(
                    r#"INSERT INTO service_products (id, service_id, product_id, quantity)
                       VALUES ($1, $2, $3, $4)"#,
                )
                .bind(sp_id)
                .bind(service_id)
                .bind(product_id)
                .bind(qty)
                .execute(pool)
                .await?;
            }
        }
    }

    println!("   ✅ {} servicios", SERVICES.len());
    Ok(())
}

async fn seed_users(pool: &PgPool) -> Result<(), sqlx::Error> {
    println!("👤 Sembrando {} usuarios de prueba...", TEST_USERS.len());

    for u in TEST_USERS {
        let user_id = Uuid::new_v4();

        sqlx::query(
            r#"INSERT INTO users (id, name, email, email_verified, role, updated_at)
               VALUES ($1, $2, $3, true, $4::"ROLE", NOW())"#,
        )
        .bind(user_id)
        .bind(u.name)
        .bind(u.email)
        .bind(u.role)
        .execute(pool)
        .await?;

        let hashed = bcrypt::hash(u.password, DEFAULT_COST).expect("Error hashing password");

        sqlx::query(
            r#"INSERT INTO account (id, account_id, provider_id, user_id, password, updated_at)
               VALUES ($1, $2, 'credentials', $3, $4, NOW())"#,
        )
        .bind(Uuid::new_v4())
        .bind(user_id)
        .bind(user_id)
        .bind(&hashed)
        .execute(pool)
        .await?;

        println!("   ✅ {} ({})", u.email, u.role);
    }

    Ok(())
}

#[tokio::main]
async fn main() {
    dotenv().ok();

    println!("🌱 Iniciando seeder de POS...");
    println!("");

    let database_url = std::env::var("DATABASE_URL").expect("DATABASE_URL must be set in .env");

    let pool = PgPoolOptions::new()
        .max_connections(2)
        .connect(&database_url)
        .await
        .expect("Error connecting to database");

    // 1. Clean
    clean_db(&pool).await.expect("Error cleaning database");

    // 2. Categories + Suppliers
    let cat_map = seed_categories(&pool)
        .await
        .expect("Error seeding categories");
    let sup_map = seed_suppliers(&pool)
        .await
        .expect("Error seeding suppliers");

    // 3. Products
    let prod_map = seed_products(&pool, &cat_map, &sup_map)
        .await
        .expect("Error seeding products");

    // 4. Services
    seed_services(&pool, &prod_map)
        .await
        .expect("Error seeding services");

    // 5. Users
    seed_users(&pool).await.expect("Error seeding users");

    // 6. Summary
    println!("");
    println!("═══════════════════════════════════════");
    println!("        RESUMEN DE DATOS SEMBRADOS");
    println!("═══════════════════════════════════════");
    println!("   📂 {} categorías", CATEGORIES.len());
    println!("   🏢 {} proveedores", SUPPLIERS.len());
    println!("   📦 {} productos", PRODUCTS.len());
    println!("   🔧 {} servicios", SERVICES.len());
    println!("   👤 {} usuarios", TEST_USERS.len());
    println!("───────────────────────────────────────");

    // Productos por categoría
    for (cat_name, _) in CATEGORIES {
        let cat_id = cat_map.get(*cat_name);
        let count: (i64,) = sqlx::query_as(
            "SELECT COUNT(*) FROM products WHERE category_id = $1 AND deleted_at IS NULL",
        )
        .bind(cat_id)
        .fetch_one(&pool)
        .await
        .expect("Error counting products");
        println!("      • {}: {} productos", cat_name, count.0);
    }

    // Productos por proveedor
    for (sup_name, _, _, _, _, _) in SUPPLIERS {
        if let Some(sup_id) = sup_map.get(*sup_name) {
            let count: (i64,) = sqlx::query_as(
                "SELECT COUNT(*) FROM products WHERE supplier_id = $1 AND deleted_at IS NULL",
            )
            .bind(sup_id)
            .fetch_one(&pool)
            .await
            .expect("Error counting products by supplier");
            println!("      • {}: {} productos", sup_name, count.0);
        }
    }

    println!("═══════════════════════════════════════");
    println!("");
    println!("🔐 Usuarios de prueba:");
    for u in TEST_USERS {
        println!("   • {} / {} ({})", u.email, u.password, u.role);
    }
    println!("");
    println!("🎉 Seeder completado exitosamente!");
}
