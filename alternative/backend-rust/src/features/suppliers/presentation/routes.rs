use axum::{Router, middleware, routing::get};

use crate::{
    features::suppliers::presentation::handler::{
        create_supplier, delete_supplier, get_supplier, list_suppliers, update_supplier,
    },
    shared::{security::auth_guard::require_auth_middleware, state::app_state::AppState},
};

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/", get(list_suppliers).post(create_supplier))
        .route(
            "/{id}",
            get(get_supplier)
                .put(update_supplier)
                .delete(delete_supplier),
        )
        .route_layer(middleware::from_fn(require_auth_middleware))
}
