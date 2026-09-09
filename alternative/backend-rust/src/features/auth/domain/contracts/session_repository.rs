use async_trait::async_trait;
use chrono::{DateTime, Utc};
use uuid::Uuid;

use crate::{
    features::auth::infrastructure::models::session::Session,
    shared::errors::app_error::AppError,
};

#[async_trait]
pub trait SessionRepository: Send + Sync + 'static {
    async fn find_by_token(&self, token: &str) -> Result<Option<Session>, AppError>;
    async fn find_by_user_id(&self, user_id: Uuid) -> Result<Vec<Session>, AppError>;
    async fn delete_by_token(&self, token: &str) -> Result<(), AppError>;
    async fn delete_by_id(&self, id: Uuid) -> Result<(), AppError>;
    async fn delete_by_user_id(&self, user_id: Uuid) -> Result<(), AppError>;
    async fn create(
        &self,
        user_id: Uuid,
        token: &str,
        expires_at: DateTime<Utc>,
        ip_address: Option<&str>,
        user_agent: Option<&str>,
    ) -> Result<(), AppError>;
}
