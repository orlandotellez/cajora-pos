use std::env;

use once_cell::sync::Lazy;

pub static DATABASE_URL: Lazy<String> =
    Lazy::new(|| env::var("DATABASE_URL").expect("DATABASE_URL not be defined"));

pub static FRONTEND_URL: Lazy<String> =
    Lazy::new(|| env::var("FRONTEND_URL").expect("FRONTEND_URL not be defined"));

pub static JWT_SECRET: Lazy<String> =
    Lazy::new(|| env::var("JWT_SECRET").expect("JWT_SECRET not be defined"));

pub static JWT_REFRESH_SECRET: Lazy<String> =
    Lazy::new(|| env::var("JWT_REFRESH_SECRET").expect("JWT_REFRESH_SECRET not be defined"));

pub static NODE_ENV: Lazy<String> =
    Lazy::new(|| env::var("NODE_ENV").unwrap_or_else(|_| "development".to_string()));
