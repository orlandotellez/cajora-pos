use axum::{Json, extract::State, http::StatusCode};
use axum_extra::extract::CookieJar;
use validator::Validate;

use crate::{
    features::stores::{
        application::service::StoreService,
        presentation::dto::{request::RegisterStoreRequest, response::RegisterStoreResponse},
    },
    shared::{
        errors::app_error::AppError, security::cookies::set_auth_cookies,
        state::app_state::AppState,
    },
};

pub async fn register_store(
    State(state): State<AppState>,
    jar: CookieJar,
    Json(payload): Json<RegisterStoreRequest>,
) -> Result<(StatusCode, CookieJar, Json<RegisterStoreResponse>), AppError> {
    payload.validate()?;

    let response: RegisterStoreResponse = StoreService::register_store(&state, payload).await?;

    let jar: CookieJar = set_auth_cookies(jar, &response.access_token, &response.refresh_token);

    Ok((StatusCode::CREATED, jar, Json(response)))
}
