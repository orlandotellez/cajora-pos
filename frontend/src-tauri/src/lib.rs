mod http_client;
mod tcp_printer;
mod updater;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(updater::init())
        .invoke_handler(tauri::generate_handler![
            http_client::http_request,
            tcp_printer::send_raw_tcp,
            updater::get_app_version,
            updater::download_apk,
            updater::install_apk,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
