use axum::{Json, extract::State, http::StatusCode};
use axum_extra::extract::CookieJar;
use validator::Validate;

use crate::{
    features::auth::{
        application::authentication_service::AuthenticationService,
        presentation::dto::{request::VerifyEmailRequest, response::MessageResponse},
    },
    shared::{
        errors::app_error::AppError,
        security::cookies::set_auth_cookies,
        state::app_state::AppState,
    },
};

pub async fn verify_email(
    State(state): State<AppState>,
    jar: CookieJar,
    Json(payload): Json<VerifyEmailRequest>,
) -> Result<(StatusCode, CookieJar, Json<MessageResponse>), AppError> {
    payload.validate()?;

    let response = AuthenticationService::verify_email(&state, &payload.identifier, &payload.code).await?;

    // Los tokens van SOLO en cookies, no en el body
    let jar = set_auth_cookies(jar, &response.access_token, &response.refresh_token);

    Ok((
        StatusCode::OK,
        jar,
        Json(MessageResponse {
            message: "Email verified successfully".to_string(),
        }),
    ))
}
