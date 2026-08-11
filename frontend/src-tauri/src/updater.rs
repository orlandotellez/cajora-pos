use serde::{Deserialize, Serialize};
use std::sync::OnceLock;
use tauri::{Manager, Runtime};

// ===========================================================================
// Actualización de la app (Android)
//
// Flujo:
//   1. El frontend lee `app_version` y `apk_url` del config remoto
//      (config-api.json en el bucket R2) — ver src/lib/api-config.ts.
//   2. `get_app_version` devuelve la versión instalada localmente.
//   3. Si la remota es mayor, el frontend llama `download_apk` con la URL.
//      Descargamos a cache y devolvemos la ruta del archivo.
//   4. `install_apk` delega al plugin mobile (UpdaterPlugin.kt, Kotlin)
//      que abre el instalador con FileProvider + ACTION_VIEW.
//
// API Tauri 2: `register_android_plugin` DEVUELVE un `PluginHandle<R>` que
// se guarda como managed state (patrón de tauri-plugin-fs / opener) y se
// recupera en los comandos con `app.state()`. NO existe `app.plugin_handle()`
// (fue un error de una API que nunca existió en 2.11.x).
// ===========================================================================

// Cliente HTTP con pooling, mismo patrón que http_client.rs.
// En Android no hay navegador con fetch, así que el download también
// va por reqwest nativo.
static HTTP_CLIENT: OnceLock<Result<reqwest::Client, String>> = OnceLock::new();

fn get_client() -> Result<&'static reqwest::Client, &'static str> {
    match HTTP_CLIENT.get_or_init(|| {
        reqwest::Client::builder()
            .pool_max_idle_per_host(2)
            .timeout(std::time::Duration::from_secs(120)) // APK grande, timeout amplio
            .connect_timeout(std::time::Duration::from_secs(15))
            .user_agent("POS-System-Updater/1.0")
            .build()
            .map_err(|e| format!("Failed to build updater reqwest Client: {e}"))
    }) {
        Ok(client) => Ok(client),
        Err(_) => Err("Updater HTTP client initialization failed (TLS / certificates?)"),
    }
}

#[derive(Deserialize)]
pub struct DownloadApkArgs {
    pub url: String,
}

#[derive(Serialize)]
pub struct DownloadApkResponse {
    pub path: String,
}

#[tauri::command]
pub async fn download_apk(
    app: tauri::AppHandle,
    args: DownloadApkArgs,
) -> Result<DownloadApkResponse, String> {
    let client = get_client().map_err(|e| e.to_string())?;

    let response = client
        .get(&args.url)
        .send()
        .await
        .map_err(|e| format!("No se pudo descargar la actualización: {e}"))?;

    if !response.status().is_success() {
        return Err(format!(
            "El servidor respondió {} al descargar la actualización",
            response.status()
        ));
    }

    let bytes = response
        .bytes()
        .await
        .map_err(|e| format!("Error leyendo la actualización descargada: {e}"))?;

    // Cache dir de la app: /data/user/0/<package>/cache
    // Ya está expuesto en file_paths.xml (cache-path) para el FileProvider.
    let cache_dir = app
        .path()
        .app_cache_dir()
        .map_err(|e| format!("No se pudo acceder al directorio de cache: {e}"))?;

    tokio::fs::create_dir_all(&cache_dir)
        .await
        .map_err(|e| format!("No se pudo crear el directorio de cache: {e}"))?;

    let apk_path = cache_dir.join("pos-system-update.apk");
    tokio::fs::write(&apk_path, &bytes)
        .await
        .map_err(|e| format!("No se pudo guardar el APK: {e}"))?;

    Ok(DownloadApkResponse {
        path: apk_path.to_string_lossy().to_string(),
    })
}

#[derive(Deserialize, Serialize, Clone)]
pub struct InstallApkArgs {
    pub path: String,
}

/// Respuesta del plugin Kotlin: `{"installed": true}`.
/// Solo se usa en targets mobile; en desktop queda sin referencias.
#[cfg_attr(not(mobile), allow(dead_code))]
#[derive(Deserialize)]
struct InstallApkResponse {
    #[allow(dead_code)]
    installed: bool,
}

/// State del plugin: el `PluginHandle` mobile solo existe en Android.
/// En otras plataformas queda `None` (el comando responde con error claro).
/// `handle` solo se lee en targets mobile → allow(dead_code) en desktop.
#[cfg_attr(not(mobile), allow(dead_code))]
struct UpdaterState<R: Runtime> {
    handle: Option<tauri::plugin::PluginHandle<R>>,
}

#[tauri::command]
pub async fn install_apk<R: Runtime>(
    app: tauri::AppHandle<R>,
    args: InstallApkArgs,
) -> Result<(), String> {
    // `run_mobile_plugin_async` solo existe en targets mobile (cfg mobile);
    // en desktop no hay instalación de APK.
    #[cfg(mobile)]
    {
        let state = app.state::<UpdaterState<R>>();
        let handle = state.handle.as_ref().ok_or_else(|| {
            "La instalación de APK solo está disponible en Android".to_string()
        })?;

        let _response: InstallApkResponse = handle
            .run_mobile_plugin_async("installApk", args)
            .await
            .map_err(|e| format!("Error al abrir el instalador: {e}"))?;

        Ok(())
    }

    #[cfg(not(mobile))]
    {
        let _ = (app, args);
        Err("La instalación de APK solo está disponible en Android".to_string())
    }
}

#[tauri::command]
pub fn get_app_version(app: tauri::AppHandle) -> Result<String, String> {
    Ok(app.package_info().version.to_string())
}

/// Registra el plugin mobile (UpdaterPlugin.kt en Android) y guarda el
/// `PluginHandle` en el state de la app.
pub fn init<R: Runtime>() -> tauri::plugin::TauriPlugin<R> {
    tauri::plugin::Builder::new("updater")
        .setup(|app, _api| {
            #[cfg(target_os = "android")]
            let handle = Some(
                _api
                    .register_android_plugin("com.dev_espada.frontend", "UpdaterPlugin")?,
            );
            #[cfg(not(target_os = "android"))]
            let handle: Option<tauri::plugin::PluginHandle<R>> = None;

            app.manage(UpdaterState { handle });
            Ok(())
        })
        .build()
}
