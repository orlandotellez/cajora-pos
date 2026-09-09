use sqlx::{PgPool, Postgres, QueryBuilder, postgres::PgQueryResult};
use uuid::Uuid;

use crate::{
    features::suppliers::{
        domain::{
            contracts::supplier_repository::SupplierRepository,
            entities::{CreateSupplierData, Supplier, UpdateSupplierData},
        },
        infrastructure::models::{
            list_suppliers_params::ListSupplierParams, paginated_result::PaginatedResult,
        },
    },
    shared::errors::app_error::AppError,
};

#[derive(Clone)]
pub struct SqlxSupplierRepository {
    pool: PgPool,
}

impl SqlxSupplierRepository {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }
}

#[async_trait::async_trait]
impl SupplierRepository for SqlxSupplierRepository {
    async fn find_paginated(
        &self,
        store_id: Uuid,
        params: ListSupplierParams,
    ) -> Result<PaginatedResult<Supplier>, AppError> {
        let offset: i64 = params.offset();

        let mut count_qb: QueryBuilder<Postgres> = QueryBuilder::new(
            "SELECT COUNT(*) FROM suppliers WHERE deleted_at IS NULL AND store_id = ",
        );
        count_qb.push_bind(store_id);

        if let Some(ref s) = params.search {
            let pat = format!("%{}%", s);
            count_qb.push(" AND (name ILIKE ");
            count_qb.push_bind(pat.clone());
            count_qb.push(" OR contact_name ILIKE ");
            count_qb.push_bind(pat);
            count_qb.push(")");
        }

        if let Some(is_active) = params.is_active {
            count_qb.push(" AND is_active = ");
            count_qb.push_bind(is_active);
        }

        let total: i64 = count_qb
            .build_query_scalar::<i64>()
            .fetch_one(&self.pool)
            .await?;

        // SELECT para los items
        let mut items_qb: QueryBuilder<Postgres> = QueryBuilder::new(
            r#"
            SELECT 
                id, 
                name, 
                contact_name, 
                email, 
                phone, 
                address, 
                notes,
                is_active, 
                store_id, 
                created_at, 
                updated_at, 
                deleted_at
            FROM suppliers
            WHERE deleted_at IS NULL AND store_id = "#,
        );
        items_qb.push_bind(store_id);

        if let Some(ref s) = params.search {
            let pat = format!("%{}%", s);
            items_qb.push(" AND (name ILIKE ");
            items_qb.push_bind(pat.clone());
            items_qb.push(" OR contact_name ILIKE ");
            items_qb.push_bind(pat);
            items_qb.push(")");
        }

        if let Some(is_active) = params.is_active {
            items_qb.push(" AND is_active = ");
            items_qb.push_bind(is_active);
        }

        items_qb.push(" ORDER BY name ASC LIMIT ");
        items_qb.push_bind(params.limit);
        items_qb.push(" OFFSET ");
        items_qb.push_bind(offset);

        let items: Vec<Supplier> = items_qb
            .build_query_as::<Supplier>()
            .fetch_all(&self.pool)
            .await?;

        Ok(PaginatedResult::new(items, total))
    }

    async fn find_by_id(&self, store_id: Uuid, id: Uuid) -> Result<Option<Supplier>, AppError> {
        let supplier: Option<Supplier> = sqlx::query_as!(
            Supplier,
            r#"
            SELECT
                id,
                name,
                contact_name,
                email,
                phone,
                address,
                notes,
                is_active,
                store_id,
                created_at,
                updated_at,
                deleted_at
            FROM suppliers 
            WHERE id = $1
                AND store_id = $2
                AND deleted_at IS NULL
            "#,
            id,
            store_id,
        )
        .fetch_optional(&self.pool)
        .await?;

        Ok(supplier)
    }

    async fn count_products_by_supplier(
        &self,
        store_id: Uuid,
        supplier_id: Uuid,
    ) -> Result<i64, AppError> {
        let count: i64 = sqlx::query_scalar!(
            r#"
            SELECT COUNT(*) AS "count!"
            FROM products 
            WHERE supplier_id = $1 
                AND store_id = $2 
                AND deleted_at IS NULL
            "#,
            supplier_id,
            store_id
        )
        .fetch_one(&self.pool)
        .await?;

        Ok(count)
    }

    async fn create(
        &self,
        store_id: Uuid,
        data: &CreateSupplierData,
    ) -> Result<Supplier, AppError> {
        let new_id: Uuid = Uuid::new_v4();

        let supplier: Supplier = sqlx::query_as!(
            Supplier,
            r#"
            INSERT INTO suppliers (
                id, 
                name, 
                contact_name, 
                email, 
                phone, 
                address, 
                notes,
                is_active, 
                store_id, 
                created_at, 
                updated_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
            RETURNING
                id, 
                name, 
                contact_name, 
                email, 
                phone, 
                address, 
                notes,
                is_active, 
                store_id, 
                created_at, 
                updated_at, 
                deleted_at
            "#,
            new_id,
            data.name,
            data.contact_name,
            data.email,
            data.phone,
            data.address,
            data.notes,
            data.is_active.unwrap_or(true), // columna es NOT NULL DEFAULT true
            store_id,
        )
        .fetch_one(&self.pool)
        .await?;

        Ok(supplier)
    }

    async fn update(
        &self,
        store_id: Uuid,
        id: Uuid,
        data: &UpdateSupplierData,
    ) -> Result<Option<Supplier>, AppError> {
        let supplier: Option<Supplier> = sqlx::query_as!(
            Supplier,
            r#"
            UPDATE suppliers SET
                name              = COALESCE($1, name),
                contact_name      = COALESCE($2, contact_name),
                email             = COALESCE($3, email),
                phone             = COALESCE($4, phone),
                address           = COALESCE($5, address),
                notes             = COALESCE($6, notes),
                is_active         = COALESCE($7, is_active),
                updated_at        = NOW()
            WHERE id = $8
              AND store_id = $9
              AND deleted_at IS NULL
            RETURNING
                id,
                name,
                contact_name,
                email,
                phone,
                address,
                notes,
                is_active,
                store_id,
                created_at,
                updated_at,
                deleted_at
            "#,
            data.name,
            data.contact_name,
            data.email,
            data.phone,
            data.address,
            data.notes,
            data.is_active,
            id,
            store_id,
        )
        .fetch_optional(&self.pool)
        .await?;

        Ok(supplier)
    }

    async fn soft_delete(&self, store_id: Uuid, id: Uuid) -> Result<bool, AppError> {
        let result: PgQueryResult = sqlx::query!(
            r#"
            UPDATE suppliers
            SET deleted_at = NOW(),
                updated_at = NOW()
            WHERE id = $1
              AND store_id = $2
              AND deleted_at IS NULL
            "#,
            id,
            store_id,
        )
        .execute(&self.pool)
        .await?;

        Ok(result.rows_affected() > 0)
    }
}
