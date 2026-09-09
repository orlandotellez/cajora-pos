use sqlx::PgPool;
use uuid::Uuid;

use crate::{
    features::categories::domain::{
        contracts::category_repository::CategoryRepository, entities::Category,
    },
    shared::errors::app_error::AppError,
};

pub struct SqlxCategoryRepository {
    pool: PgPool,
}

impl SqlxCategoryRepository {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }
}

#[async_trait::async_trait]
impl CategoryRepository for SqlxCategoryRepository {
    async fn find_all(&self, store_id: Uuid) -> Result<Vec<Category>, AppError> {
        sqlx::query_as!(
            Category,
            r#"
            SELECT 
                id,
                name,
                description,
                store_id,
                created_at,
                updated_at,
                deleted_at
            FROM categories
            WHERE deleted_at IS NULL
                AND store_id = $1
            ORDER BY Name ASC
            "#,
            store_id
        )
        .fetch_all(&self.pool)
        .await
        .map_err(AppError::from)
    }
}
