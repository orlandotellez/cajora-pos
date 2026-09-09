use async_trait::async_trait;
use chrono::Utc;
use sqlx::{PgPool, Postgres, Transaction};
use uuid::Uuid;

use crate::{
    features::auth::domain::{
        contracts::user_repository::UserRepository, entities::User, enums::Role,
    },
    shared::errors::app_error::AppError,
};

// ─── Implementación concreta del trait ───

#[derive(Clone)]
pub struct SqlxUserRepository {
    pool: PgPool,
}

impl SqlxUserRepository {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }
}

#[async_trait]
impl UserRepository for SqlxUserRepository {
    async fn find_by_email(&self, email: &str) -> Result<Option<User>, AppError> {
        let user = sqlx::query_as::<_, User>(
            r#"
            SELECT
                id,
                name,
                email,
                email_verified,
                image,
                role,
                store_id,
                created_at,
                updated_at
            FROM users
            WHERE email = $1 AND deleted_at IS NULL
            "#,
        )
        .bind(email)
        .fetch_optional(&self.pool)
        .await?;

        Ok(user)
    }

    async fn find_by_id(&self, id: Uuid) -> Result<Option<User>, AppError> {
        let user = sqlx::query_as::<_, User>(
            r#"
            SELECT
                id,
                name,
                email,
                email_verified,
                image,
                role,
                store_id,
                created_at,
                updated_at
            FROM users
            WHERE id = $1 AND deleted_at IS NULL
            "#,
        )
        .bind(id)
        .fetch_optional(&self.pool)
        .await?;

        Ok(user)
    }
}

// ─── Operaciones transaccionales (fuera del trait) ───

impl SqlxUserRepository {
    pub async fn create(
        tx: &mut Transaction<'_, Postgres>,
        name: &str,
        email: &str,
        role: Role,
        email_verified: bool,
        store_id: Option<Uuid>,
    ) -> Result<User, AppError> {
        let user: User = sqlx::query_as::<_, User>(
            r#"
            INSERT INTO users (
                id, name, email, email_verified, role, store_id, created_at, updated_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING
                id,
                name,
                email,
                email_verified,
                image,
                role,
                store_id,
                created_at,
                updated_at
            "#,
        )
        .bind(Uuid::new_v4())
        .bind(name)
        .bind(email)
        .bind(email_verified)
        .bind(role)
        .bind(store_id)
        .bind(Utc::now())
        .bind(Utc::now())
        .fetch_one(tx.as_mut())
        .await?;

        Ok(user)
    }
}
