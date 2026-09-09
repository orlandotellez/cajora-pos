use bcrypt::{hash, verify};

const BCRYPT_COST: u32 = 10;

use crate::shared::errors::app_error::AppError;

pub fn hash_password(password: &str) -> Result<String, AppError> {
    hash(password, BCRYPT_COST)
        .map_err(|e| AppError::InternalServerError(format!("Error hasheando password: {}", e)))
}

pub fn verify_password(password: &str, hash: &str) -> Result<bool, AppError> {
    verify(password, hash)
        .map_err(|e| AppError::InternalServerError(format!("Error verificando password: {}", e)))
}
