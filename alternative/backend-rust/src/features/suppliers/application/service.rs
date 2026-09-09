use uuid::Uuid;

use crate::{
    features::suppliers::{
        domain::{
            contracts::supplier_repository::SupplierRepository,
            entities::{CreateSupplierData, Supplier, UpdateSupplierData},
        },
        infrastructure::{
            mappers::{
                supplier_detail_response::SupplierDetailResponse,
                supplier_list_response::SupplierListResponse, supplier_response::SupplierResponse,
            },
            models::{
                list_suppliers_params::ListSupplierParams, paginated_result::PaginatedResult,
            },
            sqlx::supplier_repository::SqlxSupplierRepository,
        },
    },
    shared::{errors::app_error::AppError, state::app_state::AppState},
};

pub struct SupplierService;

impl SupplierService {
    pub async fn list_suppliers(
        state: &AppState,
        store_id: Uuid,
        params: ListSupplierParams,
    ) -> Result<SupplierListResponse, AppError> {
        let params: ListSupplierParams = params.normalize();
        let page: i64 = params.page;
        let limit: i64 = params.limit;

        let repo: SqlxSupplierRepository = SqlxSupplierRepository::new(state.db.clone());
        let result: PaginatedResult<Supplier> = repo.find_paginated(store_id, params).await?;

        Ok(SupplierListResponse::build(
            result.items,
            result.total,
            page,
            limit,
        ))
    }

    pub async fn get_supplier_by_id(
        state: &AppState,
        store_id: Uuid,
        id: Uuid,
    ) -> Result<SupplierDetailResponse, AppError> {
        let repo: SqlxSupplierRepository = SqlxSupplierRepository::new(state.db.clone());

        let supplier: Supplier = repo
            .find_by_id(store_id, id)
            .await?
            .ok_or_else(|| AppError::NotFound("Supplier not found".to_string()))?;

        let product_count: i64 = repo.count_products_by_supplier(store_id, id).await?;

        Ok(SupplierDetailResponse::build(supplier, product_count))
    }

    pub async fn create_supplier(
        state: &AppState,
        store_id: Uuid,
        data: CreateSupplierData,
    ) -> Result<SupplierResponse, AppError> {
        let repo: SqlxSupplierRepository = SqlxSupplierRepository::new(state.db.clone());
        let supplier: Supplier = repo.create(store_id, &data).await?;
        Ok(SupplierResponse::from(supplier))
    }

    pub async fn update_supplier(
        state: &AppState,
        store_id: Uuid,
        id: Uuid,
        data: UpdateSupplierData,
    ) -> Result<SupplierResponse, AppError> {
        let repo: SqlxSupplierRepository = SqlxSupplierRepository::new(state.db.clone());

        let supplier: Supplier = repo
            .update(store_id, id, &data)
            .await?
            .ok_or_else(|| AppError::NotFound("Supplier not found".to_string()))?;

        Ok(SupplierResponse::from(supplier))
    }

    pub async fn delete_supplier(
        state: &AppState,
        store_id: Uuid,
        id: Uuid,
    ) -> Result<(), AppError> {
        let repo: SqlxSupplierRepository = SqlxSupplierRepository::new(state.db.clone());

        let deleted: bool = repo.soft_delete(store_id, id).await?;
        if !deleted {
            return Err(AppError::NotFound("Supplier not found".to_string()));
        }

        Ok(())
    }
}
