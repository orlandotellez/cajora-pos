use axum::{
    Router, middleware,
    routing::{delete, get, post},
};

use crate::{
    features::{
        auth::presentation::handlers::{
            forgot_password_handler, login_handler, logout_handler, refresh_handler,
            registration_handler, resend_verification_handler, reset_password_handler,
            session_handler, verify_email_handler,
        },
        stores::presentation::handler::register_store,
    },
    shared::{security::auth_guard, state::app_state::AppState},
};

pub fn routes() -> Router<AppState> {
    let public_routes = Router::new()
        .route("/login", post(login_handler::login_user))
        .route("/register-store", post(register_store))
        .route("/refresh", post(refresh_handler::refresh_token))
        .route("/logout", post(logout_handler::logout_user))
        .route("/verify-email", post(verify_email_handler::verify_email))
        .route(
            "/resend-verification",
            post(resend_verification_handler::resend_verification),
        )
        .route(
            "/forgot-password",
            post(forgot_password_handler::forgot_password),
        )
        .route(
            "/reset-password",
            post(reset_password_handler::reset_password),
        );

    let admin_routes = Router::new()
        .route("/register", post(registration_handler::register_user))
        .route_layer(middleware::from_fn(auth_guard::admin_middleware));

    let user_routes = Router::new()
        .route("/sessions", get(session_handler::get_sessions))
        .route(
            "/sessions/{session_id}",
            delete(session_handler::revoke_session),
        )
        .route_layer(middleware::from_fn(auth_guard::require_auth_middleware));

    public_routes.merge(admin_routes).merge(user_routes)
}
