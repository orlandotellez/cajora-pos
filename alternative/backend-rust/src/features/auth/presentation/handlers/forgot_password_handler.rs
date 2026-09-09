use axum::{Json, extract::State, http::StatusCode};
use validator::Validate;

use crate::{
    features::auth::{
        application::authentication_service::AuthenticationService,
        presentation::dto::{request::ForgotPasswordRequest, response::MessageResponse},
    },
    shared::{errors::app_error::AppError, state::app_state::AppState},
};

pub async fn forgot_password(
    State(state): State<AppState>,
    Json(payload): Json<ForgotPasswordRequest>,
) -> Result<(StatusCode, Json<MessageResponse>), AppError> {
    payload.validate()?;

    let response = AuthenticationService::forgot_password(&state, &payload.email).await?;

    Ok((StatusCode::OK, Json(response)))
}
