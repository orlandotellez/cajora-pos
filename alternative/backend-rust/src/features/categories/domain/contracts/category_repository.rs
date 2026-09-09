use uuid::Uuid;

use crate::{
    features::categories::domain::entities::Category, shared::errors::app_error::AppError,
};

#[async_trait::async_trait]
pub trait CategoryRepository: Send + Sync {
    async fn find_all(&self, store_id: Uuid) -> Result<Vec<Category>, AppError>;
}
