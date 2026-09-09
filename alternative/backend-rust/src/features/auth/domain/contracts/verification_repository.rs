use async_trait::async_trait;
use chrono::{DateTime, Utc};

use crate::{
    features::auth::domain::entities::Verification,
    shared::errors::app_error::AppError,
};

#[async_trait]
pub trait VerificationRepository: Send + Sync + 'static {
    async fn create(
        &self,
        identifier: &str,
        value: &str,
        expires_at: DateTime<Utc>,
    ) -> Result<(), AppError>;

    async fn find_by_identifier_and_value(
        &self,
        identifier: &str,
        value: &str,
    ) -> Result<Option<Verification>, AppError>;

    async fn delete_by_identifier(&self, identifier: &str) -> Result<(), AppError>;
}
