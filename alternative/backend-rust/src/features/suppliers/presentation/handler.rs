use axum::{
    Extension, Json,
    extract::{Path, Query, State},
    http::StatusCode,
};
use uuid::Uuid;
use validator::Validate;

use crate::{
    features::suppliers::{
        application::service::SupplierService,
        domain::entities::{CreateSupplierData, UpdateSupplierData},
        infrastructure::{
            mappers::{
                delete_supplier_response::DeleteSupplierResponse,
                supplier_detail_response::SupplierDetailResponse,
                supplier_list_response::SupplierListResponse, supplier_response::SupplierResponse,
            },
            models::list_suppliers_params::ListSupplierParams,
        },
        presentation::dto::request::{
            CreateSupplierPayload, SupplierQueryParams, UpdateSupplierPayload,
        },
    },
    shared::{errors::app_error::AppError, security::Claims, state::app_state::AppState},
};

/// Parsea `is_active` desde un string a `Option<bool>`.
/// Acepta: "true"/"false" (case-insensitive) y "1"/"0".
fn parse_bool_opt(s: Option<&str>) -> Option<bool> {
    match s.map(|v| v.to_lowercase()).as_deref() {
        Some("true") | Some("1") => Some(true),
        Some("false") | Some("0") => Some(false),
        _ => None,
    }
}

fn parse_i64_opt(s: Option<&str>) -> Option<i64> {
    s.and_then(|v| v.parse::<i64>().ok())
}

pub async fn list_suppliers(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(query): Query<SupplierQueryParams>,
) -> Result<Json<SupplierListResponse>, AppError> {
    let store_id: Uuid = claims
        .store_id
        .ok_or_else(|| AppError::Unauthorized("No store context in token".to_string()))?;

    let params: ListSupplierParams = ListSupplierParams {
        search: query.search.filter(|s| !s.trim().is_empty()),
        is_active: parse_bool_opt(query.is_active.as_deref()),
        page: parse_i64_opt(query.page.as_deref()).unwrap_or(1),
        limit: parse_i64_opt(query.limit.as_deref()).unwrap_or(20),
    };

    let response: SupplierListResponse =
        SupplierService::list_suppliers(&state, store_id, params).await?;
    Ok(Json(response))
}

pub async fn get_supplier(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<SupplierDetailResponse>, AppError> {
    let store_id: Uuid = claims
        .store_id
        .ok_or_else(|| AppError::Unauthorized("No store contet in token".to_string()))?;

    let response: SupplierDetailResponse =
        SupplierService::get_supplier_by_id(&state, store_id, id).await?;

    Ok(Json(response))
}

pub async fn create_supplier(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(payload): Json<CreateSupplierPayload>,
) -> Result<(StatusCode, Json<SupplierResponse>), AppError> {
    let store_id: Uuid = claims
        .store_id
        .ok_or_else(|| AppError::Unauthorized("No store context in token".to_string()))?;

    payload.validate()?;

    let data: CreateSupplierData = payload.into_domain()?;

    let response: SupplierResponse =
        SupplierService::create_supplier(&state, store_id, data).await?;

    Ok((StatusCode::CREATED, Json(response)))
}

pub async fn update_supplier(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateSupplierPayload>,
) -> Result<Json<SupplierResponse>, AppError> {
    let store_id: Uuid = claims
        .store_id
        .ok_or_else(|| AppError::Unauthorized("No store context in token".to_string()))?;

    payload.validate()?;

    let data: UpdateSupplierData = payload.into_domain()?;

    let response: SupplierResponse =
        SupplierService::update_supplier(&state, store_id, id, data).await?;

    Ok(Json(response))
}

pub async fn delete_supplier(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<Json<DeleteSupplierResponse>, AppError> {
    let store_id: Uuid = claims
        .store_id
        .ok_or_else(|| AppError::Unauthorized("No store context in token".to_string()))?;

    SupplierService::delete_supplier(&state, store_id, id).await?;

    Ok(Json(DeleteSupplierResponse {
        message: "Supplier deleted successfully".to_string(),
    }))
}
