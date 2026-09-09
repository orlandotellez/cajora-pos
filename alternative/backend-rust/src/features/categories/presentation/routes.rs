use axum::{Router, middleware, routing::get};

use crate::{
    features::categories::presentation::handler::list_categories,
    shared::{security::auth_guard::require_auth_middleware, state::app_state::AppState},
};

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/", get(list_categories))
        .route_layer(middleware::from_fn(require_auth_middleware))
}
