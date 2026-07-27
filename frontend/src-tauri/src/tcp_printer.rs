use base64::Engine;
use serde::{Deserialize, Serialize};
use std::time::Instant;
use tokio::io::AsyncWriteExt;

#[derive(Deserialize)]
pub struct SendRawTcpArgs {
    pub data: String,
    pub host: String,
    pub port: u16,
}

#[derive(Serialize)]
pub struct TcpPrintResult {
    pub success: bool,
    pub bytes_sent: usize,
    pub duration_ms: u64,
    pub error: Option<String>,
}

#[tauri::command]
pub async fn send_raw_tcp(args: SendRawTcpArgs) -> Result<TcpPrintResult, String> {
    let start = Instant::now();

    // 1. Decodificar base64 → bytes
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(&args.data)
        .map_err(|e| format!("Error al decodificar base64: {e}"))?;

    let bytes_len = bytes.len();

    // 2. Conectar por TCP a la impresora
    let addr = format!("{}:{}", args.host, args.port);
    let mut stream = tokio::net::TcpStream::connect(&addr)
        .await
        .map_err(|e| format!("No se pudo conectar a {addr}: {e}"))?;

    // 3. Enviar los bytes
    stream
        .write_all(&bytes)
        .await
        .map_err(|e| format!("Error al enviar datos a {addr}: {e}"))?;

    // 4. Cerrar la conexión
    stream.shutdown().await.map_err(|e| format!("Error al cerrar conexión: {e}"))?;

    let elapsed = start.elapsed();

    Ok(TcpPrintResult {
        success: true,
        bytes_sent: bytes_len,
        duration_ms: elapsed.as_millis() as u64,
        error: None,
    })
}
