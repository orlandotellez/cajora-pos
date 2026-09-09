use async_trait::async_trait;
use uuid::Uuid;

use crate::{
    features::suppliers::{
        domain::entities::{CreateSupplierData, Supplier, UpdateSupplierData},
        infrastructure::models::{
            list_suppliers_params::ListSupplierParams, paginated_result::PaginatedResult,
        },
    },
    shared::errors::app_error::AppError,
};

#[async_trait]
pub trait SupplierRepository: Send + Sync {
    async fn find_paginated(
        &self,
        store_id: Uuid,
        params: ListSupplierParams,
    ) -> Result<PaginatedResult<Supplier>, AppError>;

    async fn find_by_id(&self, store_id: Uuid, id: Uuid) -> Result<Option<Supplier>, AppError>;

    async fn count_products_by_supplier(
        &self,
        store_id: Uuid,
        supplier_id: Uuid,
    ) -> Result<i64, AppError>;

    async fn create(&self, store_id: Uuid, data: &CreateSupplierData)
    -> Result<Supplier, AppError>;

    async fn update(
        &self,
        store_id: Uuid,
        id: Uuid,
        data: &UpdateSupplierData,
    ) -> Result<Option<Supplier>, AppError>;

    async fn soft_delete(&self, store_id: Uuid, id: Uuid) -> Result<bool, AppError>;
}
