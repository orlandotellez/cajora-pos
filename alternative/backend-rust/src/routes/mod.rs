use axum::{Json, Router, routing::get};
use serde_json::{Value, json};

use crate::{features, shared::state::app_state::AppState};

async fn health() -> Json<Value> {
    Json(json!({
        "status": "ok",
        "timestamp": chrono::Utc::now().to_rfc3339()
    }))
}

pub fn create_routes() -> Router<AppState> {
    Router::new()
        .route("/health", get(health))
        .nest(
            "/api/v1/auth",
            features::auth::presentation::routes::routes(),
        )
        .nest(
            "/api/v1/categories",
            features::categories::presentation::routes::routes(),
        )
        .nest(
            "/api/v1/suppliers",
            features::suppliers::presentation::routes::routes(),
        )
}
