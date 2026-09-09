use async_trait::async_trait;
use chrono::Utc;
use sqlx::{PgPool, Postgres, Transaction};
use uuid::Uuid;

use crate::{
    features::auth::{
        domain::contracts::account_repository::AccountRepository,
        infrastructure::models::credentials_account::CredentialsAccount,
    },
    shared::errors::app_error::AppError,
};

// ─── Implementación concreta del trait ───

#[derive(Clone)]
pub struct SqlxAccountRepository {
    pool: PgPool,
}

impl SqlxAccountRepository {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }
}

#[async_trait]
impl AccountRepository for SqlxAccountRepository {
    async fn find_credentials_by_email(
        &self,
        email: &str,
    ) -> Result<Option<CredentialsAccount>, AppError> {
        let result = sqlx::query_as::<_, CredentialsAccount>(
            r#"
            SELECT
                u.id as user_id,
                u.name,
                u.email,
                u.email_verified,
                u.image,
                u.role as role,
                u.store_id,
                u.created_at,
                u.updated_at,
                a.password
            FROM users u
            JOIN account a ON a.user_id = u.id
            WHERE u.email = $1
              AND u.deleted_at IS NULL
              AND a.provider_id = 'credentials'
            "#,
        )
        .bind(email)
        .fetch_optional(&self.pool)
        .await?;

        Ok(result)
    }

    async fn update_password_by_email(
        &self,
        email: &str,
        hashed_password: &str,
    ) -> Result<(), AppError> {
        sqlx::query!(
            r#"
            UPDATE account
            SET password = $1, updated_at = $2
            WHERE provider_id = 'credentials'
              AND account_id = $3
            "#,
            hashed_password,
            Utc::now(),
            email,
        )
        .execute(&self.pool)
        .await?;

        Ok(())
    }
}

// ─── Operaciones transaccionales (fuera del trait) ───

impl SqlxAccountRepository {
    pub async fn create(
        tx: &mut Transaction<'_, Postgres>,
        email: &str,
        password: &str,
        user_id: Uuid,
    ) -> Result<(), AppError> {
        sqlx::query!(
            r#"
                INSERT INTO account (
                    id, account_id, provider_id, user_id, password, created_at, updated_at
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7)
                "#,
            Uuid::new_v4(),
            email,
            "credentials",
            user_id,
            password,
            Utc::now(),
            Utc::now(),
        )
        .execute(tx.as_mut())
        .await?;

        Ok(())
    }
}
