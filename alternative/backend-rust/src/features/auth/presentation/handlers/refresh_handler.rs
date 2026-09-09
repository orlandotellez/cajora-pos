use axum::{Json, extract::State, http::StatusCode};
use axum_extra::extract::CookieJar;

use crate::{
    features::auth::{
        application::authentication_service::AuthenticationService,
        presentation::dto::{request::RefreshRequest, response::RegisterResponse},
    },
    shared::{
        errors::app_error::AppError, security::cookies::set_auth_cookies,
        state::app_state::AppState,
    },
};

pub async fn refresh_token(
    State(state): State<AppState>,
    jar: CookieJar,
    payload: Option<Json<RefreshRequest>>,
) -> Result<(StatusCode, CookieJar, Json<RegisterResponse>), AppError> {
    // Primero intentar desde cookie httpOnly, luego body como fallback
    let refresh_token: String = jar
        .get("refreshToken")
        .map(|c| c.value().to_string())
        .or_else(|| {
            payload.and_then(|p| p.refresh_token.clone())
        })
        .ok_or_else(|| AppError::BadRequest("Refresh token required".to_string()))?;

    let response: RegisterResponse = AuthenticationService::refresh(&state, &refresh_token).await?;

    let jar: CookieJar = set_auth_cookies(jar, &response.access_token, &response.refresh_token);

    Ok((StatusCode::OK, jar, Json(response)))
}
