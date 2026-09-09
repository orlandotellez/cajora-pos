use axum::{
    body::Body,
    extract::Request,
    middleware::Next,
    response::{IntoResponse, Response},
};

use crate::shared::security::jwt;

use super::cookies::extract_access_token;

/// Middleware para rutas que requieren admin autenticado.
/// Lee el token del header Authorization: Bearer o de la cookie accessToken.
pub async fn admin_middleware(
    mut req: Request<Body>,
    next: Next,
) -> Result<Response, Response> {
    let token = extract_bearer_token(&req)
        .or_else(|| extract_cookie_token(&req))
        .ok_or_else(|| {
            AppErrorJson::unauthorized("Authentication required").into_response()
        })?;

    let claims = jwt::verify_access_token(&token).map_err(|_| {
        AppErrorJson::unauthorized("Invalid or expired token").into_response()
    })?;

    if claims.role != "admin" {
        return Err(AppErrorJson::forbidden("Admin access required").into_response());
    }

    req.extensions_mut().insert(claims);

    Ok(next.run(req).await)
}

fn extract_bearer_token(req: &Request<Body>) -> Option<String> {
    req.headers()
        .get("Authorization")
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.strip_prefix("Bearer "))
        .map(|s| s.to_string())
}

fn extract_cookie_token(req: &Request<Body>) -> Option<String> {
    let cookie_header = req.headers().get("Cookie")?.to_str().ok()?;
    extract_access_token(cookie_header)
}

/// Middleware para rutas que requieren usuario autenticado (cualquier rol).
/// Lee el token del header Authorization: Bearer o de la cookie accessToken.
pub async fn require_auth_middleware(
    mut req: Request<Body>,
    next: Next,
) -> Result<Response, Response> {
    let token = extract_bearer_token(&req)
        .or_else(|| extract_cookie_token(&req))
        .ok_or_else(|| {
            AppErrorJson::unauthorized("Authentication required").into_response()
        })?;

    let claims = jwt::verify_access_token(&token).map_err(|_| {
        AppErrorJson::unauthorized("Invalid or expired token").into_response()
    })?;

    req.extensions_mut().insert(claims);

    Ok(next.run(req).await)
}

/// Helper para devolver errores JSON con el mismo formato que Fastify: `{"message": "..."}`
struct AppErrorJson {
    status: axum::http::StatusCode,
    message: String,
}

impl AppErrorJson {
    fn unauthorized(message: &str) -> Self {
        Self {
            status: axum::http::StatusCode::UNAUTHORIZED,
            message: message.to_string(),
        }
    }

    fn forbidden(message: &str) -> Self {
        Self {
            status: axum::http::StatusCode::FORBIDDEN,
            message: message.to_string(),
        }
    }
}

impl IntoResponse for AppErrorJson {
    fn into_response(self) -> Response {
        let body = serde_json::json!({ "message": self.message });
        (self.status, axum::Json(body)).into_response()
    }
}
