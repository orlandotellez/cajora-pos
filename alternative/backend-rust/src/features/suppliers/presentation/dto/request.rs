use serde::Deserialize;
use validator::Validate;

use crate::{
    features::suppliers::domain::entities::{CreateSupplierData, UpdateSupplierData},
    shared::errors::app_error::AppError,
};

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SupplierQueryParams {
    pub search: Option<String>,
    pub is_active: Option<String>, // "true" | "false" | "1" | "0"
    pub page: Option<String>,
    pub limit: Option<String>,
}

#[derive(Debug, Validate, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateSupplierPayload {
    #[validate(length(min = 1, message = "Name is required"))]
    pub name: String,

    #[serde(default)]
    pub contact_name: Option<String>,

    #[validate(email)]
    #[serde(default)]
    pub email: Option<String>,

    #[serde(default)]
    pub phone: Option<String>,

    #[serde(default)]
    pub address: Option<String>,

    #[serde(default)]
    pub notes: Option<String>,

    #[serde(default)]
    pub is_active: Option<bool>,
}

impl CreateSupplierPayload {
    pub fn into_domain(self) -> Result<CreateSupplierData, AppError> {
        let name = self.name.trim();
        if name.is_empty() {
            return Err(AppError::BadRequest("Name is required".to_string()));
        }

        let trim_to_none = |s: Option<String>| s.filter(|v| !v.trim().is_empty());

        Ok(CreateSupplierData {
            name: name.to_string(),
            contact_name: trim_to_none(self.contact_name),
            email: trim_to_none(self.email),
            phone: trim_to_none(self.phone),
            address: trim_to_none(self.address),
            notes: trim_to_none(self.notes),
            is_active: self.is_active,
        })
    }
}

#[derive(Debug, Validate, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateSupplierPayload {
    #[validate(length(min = 1, message = "Name cannot be empty"))]
    #[serde(default)]
    pub name: Option<String>,

    #[serde(default)]
    pub contact_name: Option<String>,

    #[validate(email)]
    #[serde(default)]
    pub email: Option<String>,

    #[serde(default)]
    pub phone: Option<String>,

    #[serde(default)]
    pub address: Option<String>,

    #[serde(default)]
    pub notes: Option<String>,

    #[serde(default)]
    pub is_active: Option<bool>,
}

impl UpdateSupplierPayload {
    pub fn into_domain(self) -> Result<UpdateSupplierData, AppError> {
        if self.name.is_none()
            && self.contact_name.is_none()
            && self.email.is_none()
            && self.phone.is_none()
            && self.address.is_none()
            && self.notes.is_none()
            && self.is_active.is_none()
        {
            return Err(AppError::BadRequest(
                "At least one field must be provided".to_string(),
            ));
        }

        if let Some(ref raw_name) = self.name {
            if raw_name.trim().is_empty() {
                return Err(AppError::BadRequest("Name cannot be empty".to_string()));
            }
        }

        let trim_to_none = |s: Option<String>| s.filter(|v| !v.trim().is_empty());

        Ok(UpdateSupplierData {
            name: self
                .name
                .map(|v| v.trim().to_string())
                .filter(|v| !v.is_empty()),
            contact_name: trim_to_none(self.contact_name),
            email: trim_to_none(self.email),
            phone: trim_to_none(self.phone),
            address: trim_to_none(self.address),
            notes: trim_to_none(self.notes),
            is_active: self.is_active,
        })
    }
}
