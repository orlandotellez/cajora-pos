use axum::{Json, extract::State, http::StatusCode};
use axum_extra::extract::CookieJar;

use crate::{
    features::auth::{
        application::authentication_service::AuthenticationService,
        presentation::dto::MessageResponse,
    },
    shared::{
        errors::app_error::AppError,
        security::cookies::clear_auth_cookies,
        state::app_state::AppState,
    },
};

pub async fn logout_user(
    State(state): State<AppState>,
    jar: CookieJar,
) -> Result<(StatusCode, CookieJar, Json<MessageResponse>), AppError> {
    // Leer refresh token de cookie primero, luego body
    let refresh_token = jar
        .get("refreshToken")
        .map(|c| c.value().to_string())
        .ok_or_else(|| AppError::BadRequest("Refresh token required".to_string()))?;

    let response = AuthenticationService::logout(&state, &refresh_token).await?;
    let jar = clear_auth_cookies(jar);

    Ok((StatusCode::OK, jar, Json(response)))
}
