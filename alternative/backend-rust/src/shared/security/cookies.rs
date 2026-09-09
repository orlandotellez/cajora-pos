use axum_extra::extract::CookieJar;
use cookie::Cookie;
use time::Duration;

use crate::shared::config::constants::NODE_ENV;

const ACCESS_TOKEN_MAX_AGE: i64 = 900; // 15 minutos
const REFRESH_TOKEN_MAX_AGE: i64 = 604800; // 7 días

fn is_production() -> bool {
    *NODE_ENV == "production"
}

pub fn set_auth_cookies(jar: CookieJar, access_token: &str, refresh_token: &str) -> CookieJar {
    let secure = is_production();
    let same_site = if secure {
        cookie::SameSite::Strict
    } else {
        cookie::SameSite::Lax
    };

    let access_cookie = Cookie::build(("accessToken", access_token.to_owned()))
        .path("/")
        .http_only(true)
        .secure(secure)
        .max_age(Duration::seconds(ACCESS_TOKEN_MAX_AGE))
        .same_site(same_site)
        .build();

    let refresh_cookie = Cookie::build(("refreshToken", refresh_token.to_owned()))
        .path("/")
        .http_only(true)
        .secure(secure)
        .max_age(Duration::seconds(REFRESH_TOKEN_MAX_AGE))
        .same_site(same_site)
        .build();

    jar.add(access_cookie).add(refresh_cookie)
}

/// Extrae el accessToken de un header Cookie crudo.
/// Ej: "accessToken=abc; refreshToken=def" → Some("abc")
pub fn extract_access_token(cookie_header: &str) -> Option<String> {
    cookie_header
        .split(';')
        .filter_map(|c| {
            let c = c.trim();
            c.strip_prefix("accessToken=")
        })
        .next()
        .map(|s| s.to_string())
}

pub fn clear_auth_cookies(jar: CookieJar) -> CookieJar {
    let secure = is_production();

    let access_cookie = Cookie::build(("accessToken", ""))
        .path("/")
        .http_only(true)
        .secure(secure)
        .max_age(Duration::seconds(0))
        .build();

    let refresh_cookie = Cookie::build(("refreshToken", ""))
        .path("/")
        .http_only(true)
        .secure(secure)
        .max_age(Duration::seconds(0))
        .build();

    jar.add(access_cookie).add(refresh_cookie)
}
