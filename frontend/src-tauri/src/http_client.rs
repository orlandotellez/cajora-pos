use reqwest;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::OnceLock;

// Cliente HTTP estático con connection pooling.
// Se inicializa UNA sola vez y vive toda la vida de la app.
// Las conexiones TLS/HTTP se reúsan entre requests.
//
// Usamos OnceLock<Result<...>> para que si la inicialización falla
// (ej. TLS no disponible, certificados del sistema faltantes),
// propagamos el error como String en vez de panic con expect().
static HTTP_CLIENT: OnceLock<Result<reqwest::Client, String>> = OnceLock::new();

fn get_client() -> Result<&'static reqwest::Client, &'static str> {
    match HTTP_CLIENT.get_or_init(|| {
        reqwest::Client::builder()
            // Hasta 10 conexiones idle por host (Railway)
            .pool_max_idle_per_host(10)
            // Mantener conexiones idle hasta 60 segundos
            .pool_idle_timeout(std::time::Duration::from_secs(60))
            // TCP keepalive cada 30 segundos
            .tcp_keepalive(std::time::Duration::from_secs(30))
            // Timeout total por request
            .timeout(std::time::Duration::from_secs(30))
            // Timeout para establecimiento de conexión
            .connect_timeout(std::time::Duration::from_secs(10))
            // User-Agent descriptivo
            .user_agent("POS-System/1.0")
            .build()
            .map_err(|e| format!("Failed to build reqwest Client: {e}"))
    }) {
        Ok(client) => Ok(client),
        Err(_init_err) => {
            // El error de inicialización ya quedó guardado en el OnceLock,
            // pero no podemos devolver &String porque el borrow checker
            // no nos deja (el Err del OnceLock contiene un String local).
            // Devolvemos un &'static str genérico.
            Err("HTTP client initialization failed (TLS / certificates?)")
        }
    }
}

// Tipos serializables para el comando Tauri

#[derive(Deserialize)]
pub struct HttpRequestArgs {
    pub method: String,
    pub url: String,
    #[serde(default)]
    pub headers: HashMap<String, String>,
    #[serde(default)]
    pub body: Option<String>,
}

#[derive(Serialize)]
pub struct HttpResponse {
    pub status: u16,
    pub body: String,
}

// Comando Tauri

#[tauri::command]
pub async fn http_request(args: HttpRequestArgs) -> Result<HttpResponse, String> {
    // 1. Obtener el cliente (o error de inicialización)
    let client = get_client().map_err(|e| e.to_string())?;

    // 2. Construir request según método
    let mut req = match args.method.to_uppercase().as_str() {
        "GET" => client.get(&args.url),
        "POST" => {
            let mut r = client.post(&args.url);
            if let Some(body) = &args.body {
                r = r.body(body.clone());
            }
            r
        }
        "PUT" => {
            let mut r = client.put(&args.url);
            if let Some(body) = &args.body {
                r = r.body(body.clone());
            }
            r
        }
        "DELETE" => client.delete(&args.url),
        "PATCH" => {
            let mut r = client.patch(&args.url);
            if let Some(body) = &args.body {
                r = r.body(body.clone());
            }
            r
        }
        _ => return Err(format!("Unsupported HTTP method: {}", args.method)),
    };

    // 3. Agregar headers (Authorization, Content-Type, etc.)
    //    Content-Type viene desde client.ts cuando hay body.
    for (key, value) in &args.headers {
        req = req.header(key.as_str(), value.as_str());
    }

    // 4. Ejecutar request
    let response = req
        .send()
        .await
        .map_err(|e| format!("HTTP request to {} failed: {e}", args.url))?;

    // 5. Leer body (incluso para 204 No Content — viene vacío, ok)
    let status = response.status().as_u16();
    let body = response
        .text()
        .await
        .map_err(|e| format!("Failed to read response body from {}: {e}", args.url))?;

    Ok(HttpResponse { status, body })
}
