use axum::{Json, extract::State, http::StatusCode};
use axum_extra::extract::CookieJar;
use validator::Validate;

use crate::{
    features::auth::{
        application::authentication_service::AuthenticationService,
        presentation::dto::{request::LoginRequest, response::RegisterResponse},
    },
    shared::{
        errors::app_error::AppError, security::cookies::set_auth_cookies,
        state::app_state::AppState,
    },
};

pub async fn login_user(
    State(state): State<AppState>,
    jar: CookieJar,
    Json(payload): Json<LoginRequest>,
) -> Result<(StatusCode, CookieJar, Json<RegisterResponse>), AppError> {
    payload.validate()?;

    let response: RegisterResponse =
        AuthenticationService::login(&state, &payload.email, &payload.password).await?;

    let jar: CookieJar = set_auth_cookies(jar, &response.access_token, &response.refresh_token);

    Ok((StatusCode::OK, jar, Json(response)))
}
