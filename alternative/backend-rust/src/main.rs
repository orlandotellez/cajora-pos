pub mod database;
pub mod features;
pub mod routes;
pub mod shared;

use axum::Router;
use dotenvy::dotenv;
use sqlx::{Pool, Postgres};
use std::net::{IpAddr, Ipv4Addr, SocketAddr};
use tokio::net::TcpListener;
use tower_http::{
    cors::CorsLayer,
    trace::{DefaultMakeSpan, DefaultOnRequest, DefaultOnResponse, TraceLayer},
};
use tracing::Level;

use crate::{
    database::connection::create_pool, shared::config::shutdown::shutdown_signal,
    shared::state::app_state::AppState,
};

const HOST: IpAddr = IpAddr::V4(Ipv4Addr::UNSPECIFIED);
const PORT: u16 = 4000;

#[tokio::main]
async fn main() {
    dotenv().ok();

    shared::config::logger::init();

    let cors: CorsLayer = shared::config::cors::init();

    let addr: SocketAddr = SocketAddr::new(HOST, PORT);

    let db: Pool<Postgres> = create_pool().await.expect("Error connect database");

    let router: Router = routes::create_routes()
        .with_state(AppState { db: db })
        .layer(cors)
        .layer(
            TraceLayer::new_for_http()
                .make_span_with(DefaultMakeSpan::new().level(Level::INFO))
                .on_request(DefaultOnRequest::new().level(Level::INFO))
                .on_response(DefaultOnResponse::new().level(Level::INFO)),
        );

    let listener: TcpListener = TcpListener::bind(&addr).await.unwrap_or_else(|e| {
        panic!(
            "No se pudo bindear al puerto {PORT} — {e}.\n  ¿Ya hay otro proceso corriendo? \
             Ejecutá:\n\n    lsof -i :{PORT}\n    kill -9 <PID>\n"
        )
    });

    tracing::info!("Server listen on http://{}", &addr);

    axum::serve(listener, router)
        .with_graceful_shutdown(shutdown_signal())
        .await
        .unwrap_or_else(|e| {
            panic!("Error al servir el servidor: {e}");
        });
}
