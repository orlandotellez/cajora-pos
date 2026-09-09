// ─── Graceful Shutdown ───
// Manejamos Ctrl+C y SIGTERM para cerrar el servidor limpiamente.

pub async fn shutdown_signal() {
    let ctrl_c = tokio::signal::ctrl_c();
    let mut term_signal = tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate())
        .expect("No se pudo instalar el handler de SIGTERM");

    tokio::select! {
        _ = ctrl_c => {
            tracing::info!("Ctrl+C recibido — cerrando servidor...");
        }
        _ = term_signal.recv() => {
            tracing::info!("SIGTERM recibido — cerrando servidor...");
        }
    }

    // Pequeña pausa para que los logs se vean antes de morir
    tokio::time::sleep(std::time::Duration::from_millis(50)).await;
}
