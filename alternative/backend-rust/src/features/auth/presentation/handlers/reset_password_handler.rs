use axum::{Json, extract::State, http::StatusCode};
use validator::Validate;

use crate::{
    features::auth::{
        application::authentication_service::AuthenticationService,
        presentation::dto::{request::ResetPasswordRequest, response::MessageResponse},
    },
    shared::{errors::app_error::AppError, state::app_state::AppState},
};

pub async fn reset_password(
    State(state): State<AppState>,
    Json(payload): Json<ResetPasswordRequest>,
) -> Result<(StatusCode, Json<MessageResponse>), AppError> {
    payload.validate()?;

    let response = AuthenticationService::reset_password(
        &state,
        &payload.email,
        &payload.code,
        &payload.new_password,
    )
    .await?;

    Ok((StatusCode::OK, Json(response)))
}
