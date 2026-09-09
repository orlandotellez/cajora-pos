use serde::Deserialize;
use validator::Validate;

#[derive(Debug, Deserialize, Validate)]
#[serde(rename_all = "camelCase")]
pub struct RegisterStoreRequest {
    #[validate(length(min = 2, message = "Store name must be at least 2 characters"))]
    pub store_name: String,

    pub store_address: Option<String>,

    pub store_phone: Option<String>,

    #[validate(length(min = 2, message = "Name must be at least 2 characters"))]
    pub admin_name: String,

    #[validate(email(message = "Invalid email format"))]
    pub admin_email: String,

    #[validate(length(min = 8, message = "Password must be at least 8 characters"))]
    pub admin_password: String,
}
