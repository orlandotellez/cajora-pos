use axum::http;
use tower_http::cors::CorsLayer;

use crate::shared::config::constants::FRONTEND_URL;

pub fn init() -> CorsLayer {
    CorsLayer::new()
        .allow_origin(FRONTEND_URL.parse::<http::HeaderValue>().unwrap())
        .allow_methods([
            http::Method::GET,
            http::Method::POST,
            http::Method::PUT,
            http::Method::PATCH,
            http::Method::DELETE,
        ])
        .allow_headers([http::header::CONTENT_TYPE, http::header::AUTHORIZATION])
        .allow_credentials(true)
}
