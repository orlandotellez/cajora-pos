use async_trait::async_trait;
use uuid::Uuid;

use crate::{features::auth::domain::entities::User, shared::errors::app_error::AppError};

#[async_trait]
pub trait UserRepository: Send + Sync + 'static {
    async fn find_by_email(&self, email: &str) -> Result<Option<User>, AppError>;
    async fn find_by_id(&self, id: Uuid) -> Result<Option<User>, AppError>;
}
