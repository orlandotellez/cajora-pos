use axum::{Json, extract::State, http::StatusCode};
use validator::Validate;

use crate::{
    features::auth::{
        application::registration_service::RegistrationService,
        presentation::dto::{
            request::RegisterRequest, response::RegisterResponse,
        },
    },
    shared::{errors::app_error::AppError, state::app_state::AppState},
};

pub async fn register_user(
    State(state): State<AppState>,
    Json(payload): Json<RegisterRequest>,
) -> Result<(StatusCode, Json<RegisterResponse>), AppError> {
    payload.validate()?;

    let response: RegisterResponse = RegistrationService::register_user(&state, payload).await?;

    Ok((StatusCode::CREATED, Json(response)))
}
