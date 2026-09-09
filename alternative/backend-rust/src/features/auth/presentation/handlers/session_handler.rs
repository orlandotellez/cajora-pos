use axum::{
    Json,
    extract::{Path, State},
    http::StatusCode,
    Extension,
};
use uuid::Uuid;

use crate::{
    features::auth::{
        application::authentication_service::AuthenticationService,
        presentation::dto::response::{MessageResponse, SessionListResponse},
    },
    shared::{
        errors::app_error::AppError,
        security::jwt::AccessTokenClaims,
        state::app_state::AppState,
    },
};

pub async fn get_sessions(
    State(state): State<AppState>,
    Extension(claims): Extension<AccessTokenClaims>,
) -> Result<(StatusCode, Json<SessionListResponse>), AppError> {
    let user_id = Uuid::parse_str(&claims.sub)
        .map_err(|_| AppError::BadRequest("Invalid token payload".to_string()))?;

    let response = AuthenticationService::get_user_sessions(&state, user_id).await?;

    Ok((StatusCode::OK, Json(response)))
}

pub async fn revoke_session(
    State(state): State<AppState>,
    Extension(claims): Extension<AccessTokenClaims>,
    Path(session_id): Path<Uuid>,
) -> Result<(StatusCode, Json<MessageResponse>), AppError> {
    let user_id = Uuid::parse_str(&claims.sub)
        .map_err(|_| AppError::BadRequest("Invalid token payload".to_string()))?;

    let response = AuthenticationService::revoke_session(&state, user_id, session_id).await?;

    Ok((StatusCode::OK, Json(response)))
}
