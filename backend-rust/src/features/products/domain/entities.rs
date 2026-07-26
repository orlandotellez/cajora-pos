use chrono::{DateTime, Utc};
use serde::Serialize;
use sqlx::{prelude::FromRow, types::Decimal};
use uuid::Uuid;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, sqlx::Type)]
#[sqlx(type_name = "UNIT_TYPE", rename_all = "lowercase")]
pub enum UnitType {
    Unidad,
    Paquete,
    Caja,
    Bolsa,
    Botella,
    Lata,
    Sobre,
    Barra,
    Rollo,
    Galon,
    Ristra,
}

#[derive(Debug, FromRow)]
pub struct Product {
    pub id: Uuid,
    pub barcode: Option<String>,
    pub name: String,
    pub unit_type: Option<UnitType>,
    pub unit_quantity: Option<i32>,
    pub category_id: Option<Uuid>,
    pub supplier_id: Option<Uuid>,
    pub price: Decimal,
    pub cost: Decimal,
    pub tax_rate: Decimal,
    pub stock: i32,
    pub low_stock_threshold: i32,
    pub active: bool,
    pub store_id: Uuid,
    pub created_at: Option<DateTime<Utc>>,
    pub updated_at: Option<DateTime<Utc>>,
    pub deleted_at: Option<DateTime<Utc>>,
}

#[derive(Debug, FromRow)]
pub struct ProductListRow {
    pub id: Uuid,
    pub barcode: Option<String>,
    pub name: String,
    pub unit_type: Option<UnitType>,
    pub unit_quantity: Option<i32>,
    pub category_id: Option<Uuid>,
    pub supplier_id: Option<Uuid>,
    pub price: Decimal,
    pub cost: Decimal,
    pub tax_rate: Decimal,
    pub stock: i32,
    pub low_stock_threshold: i32,
    pub active: bool,
    pub store_id: Uuid,
    pub created_at: Option<DateTime<Utc>>,
    pub updated_at: Option<DateTime<Utc>>,
    pub deleted_at: Option<DateTime<Utc>>,
    // Joined (None si no hay matcheo, ej: producto sin categoría)
    pub category_join_id: Option<Uuid>,
    pub category_join_name: Option<String>,
    pub supplier_join_id: Option<Uuid>,
    pub supplier_join_name: Option<String>,
}

impl ProductListRow {
    pub fn category_ref(&self) -> Option<(Uuid, String)> {
        match (self.category_join_id, self.category_join_name.as_ref()) {
            (Some(id), Some(name)) => Some((id, name.clone())),
            _ => None,
        }
    }

    pub fn supplier_ref(&self) -> Option<(Uuid, String)> {
        match (self.supplier_join_id, self.supplier_join_name.as_ref()) {
            (Some(id), Some(name)) => Some((id, name.clone())),
            _ => None,
        }
    }
}
