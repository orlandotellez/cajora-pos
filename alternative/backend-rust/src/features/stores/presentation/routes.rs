use axum::{Router, routing::post};

use crate::{
    features::stores::presentation::handler::register_store, shared::state::app_state::AppState,
};

pub fn routes() -> Router<AppState> {
    Router::new().route("/register-store", post(register_store))
}
