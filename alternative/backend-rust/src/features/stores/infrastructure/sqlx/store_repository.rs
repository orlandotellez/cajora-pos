use async_trait::async_trait;
use chrono::Utc;
use sqlx::{PgPool, Postgres, Transaction};
use uuid::Uuid;

use crate::{
    features::stores::domain::{contracts::store_repository::StoreRepository, entities::Store},
    shared::errors::app_error::AppError,
};

#[derive(Clone)]
pub struct SqlxStoreRepository {
    pool: PgPool,
}

impl SqlxStoreRepository {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }
}

#[async_trait]
impl StoreRepository for SqlxStoreRepository {
    async fn find_by_name(&self, name: &str) -> Result<Option<Store>, AppError> {
        let store = sqlx::query_as::<_, Store>(
            r#"
            SELECT
                id,
                name,
                address,
                phone,
                created_at,
                updated_at
            FROM stores
            WHERE name = $1
            "#,
        )
        .bind(name)
        .fetch_optional(&self.pool)
        .await?;

        Ok(store)
    }
}

// ─── Operaciones transaccionales (fuera del trait) ───

impl SqlxStoreRepository {
    pub async fn create(
        tx: &mut Transaction<'_, Postgres>,
        name: &str,
        address: Option<&str>,
        phone: Option<&str>,
    ) -> Result<Store, AppError> {
        let store = sqlx::query_as::<_, Store>(
            r#"
            INSERT INTO stores (
                id, name, address, phone, created_at, updated_at
            )
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING
                id,
                name,
                address,
                phone,
                created_at,
                updated_at
            "#,
        )
        .bind(Uuid::new_v4())
        .bind(name)
        .bind(address)
        .bind(phone)
        .bind(Utc::now())
        .bind(Utc::now())
        .fetch_one(tx.as_mut())
        .await?;

        Ok(store)
    }
}
