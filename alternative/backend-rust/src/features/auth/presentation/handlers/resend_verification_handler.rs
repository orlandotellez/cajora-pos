use axum::{Json, extract::State, http::StatusCode};
use validator::Validate;

use crate::{
    features::auth::{
        application::registration_service::RegistrationService,
        presentation::dto::{request::ResendVerificationRequest, response::MessageResponse},
    },
    shared::{errors::app_error::AppError, state::app_state::AppState},
};

pub async fn resend_verification(
    State(state): State<AppState>,
    Json(payload): Json<ResendVerificationRequest>,
) -> Result<(StatusCode, Json<MessageResponse>), AppError> {
    payload.validate()?;

    let response = RegistrationService::resend_verification(&state, &payload.email).await?;

    Ok((StatusCode::OK, Json(response)))
}
