use async_trait::async_trait;

use crate::{
    features::auth::infrastructure::models::credentials_account::CredentialsAccount,
    shared::errors::app_error::AppError,
};

#[async_trait]
pub trait AccountRepository: Send + Sync + 'static {
    async fn find_credentials_by_email(
        &self,
        email: &str,
    ) -> Result<Option<CredentialsAccount>, AppError>;

    async fn update_password_by_email(
        &self,
        email: &str,
        hashed_password: &str,
    ) -> Result<(), AppError>;
}
