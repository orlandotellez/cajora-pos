use async_trait::async_trait;

use crate::{features::stores::domain::entities::Store, shared::errors::app_error::AppError};

#[async_trait]
pub trait StoreRepository: Send + Sync {
    async fn find_by_name(&self, name: &str) -> Result<Option<Store>, AppError>;
}
