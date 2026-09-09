use serde::Serialize;

use crate::features::suppliers::{
    domain::entities::Supplier, infrastructure::mappers::supplier_response::SupplierResponse,
};

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SupplierListResponse {
    pub suppliers: Vec<SupplierResponse>,
    pub total: i64,
    pub page: i64,
    pub limit: i64,
    pub has_more: bool,
}

impl SupplierListResponse {
    pub fn build(items: Vec<Supplier>, total: i64, page: i64, limit: i64) -> Self {
        let has_more = page * limit < total;
        Self {
            suppliers: items.into_iter().map(Into::into).collect(),
            total,
            page,
            limit,
            has_more,
        }
    }
}
