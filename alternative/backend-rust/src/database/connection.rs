use sqlx::{PgPool, postgres::PgPoolOptions};

use crate::shared::config::constants::DATABASE_URL;

pub async fn create_pool() -> Result<PgPool, sqlx::Error> {
    tracing::info!("DATABASE_URL {}", &DATABASE_URL.to_string());

    PgPoolOptions::new()
        .max_connections(10)
        .connect(&DATABASE_URL)
        .await
}
