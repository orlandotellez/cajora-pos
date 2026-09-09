use serde::Serialize;

use crate::features::suppliers::domain::entities::Supplier;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SupplierResponse {
    pub id: String,
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub contact_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub email: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub phone: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub address: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub notes: Option<String>,
    pub is_active: bool,
    pub created_at: String,
    pub updated_at: String,
}

impl From<Supplier> for SupplierResponse {
    fn from(s: Supplier) -> Self {
        Self {
            id: s.id.to_string(),
            name: s.name,
            contact_name: s.contact_name,
            email: s.email,
            phone: s.phone,
            address: s.address,
            notes: s.notes,
            is_active: s.is_active,
            created_at: s.created_at.map(|d| d.to_rfc3339()).unwrap_or_default(),
            updated_at: s.updated_at.unwrap_or_default().to_rfc3339(),
        }
    }
}
