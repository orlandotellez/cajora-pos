use axum::{Extension, Json, extract::State};

use crate::{
    features::categories::{
        application::service::CategoryService, infrastructure::mapper::CategoryListResponse,
    },
    shared::{errors::app_error::AppError, security::Claims, state::app_state::AppState},
};

pub async fn list_categories(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<CategoryListResponse>, AppError> {
    let response: CategoryListResponse =
        CategoryService::list_categories(&state, claims.store_id.unwrap_or_default()).await?;

    Ok(Json(response))
}
