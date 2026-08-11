interface TcpPrintResult {
  success: boolean;
  bytes_sent: number;
  duration_ms: number;
  error: string | null;
}

/**
 * Envía los bytes ESC/POS a la impresora via TCP directo desde el dispositivo.
 *
 * En Tauri (APK/desktop): llama al comando Rust `send_raw_tcp`.
 * En browser dev: falla con error explicativo.
 */
export async function sendBytesToPrinter(
  dataBase64: string,
  address: string,
  port: number,
): Promise<TcpPrintResult> {
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    const result = await invoke<TcpPrintResult>("send_raw_tcp", {
      args: {
        data: dataBase64,
        host: address,
        port,
      },
    });
    return result;
  } catch (err) {
    return {
      success: false,
      bytes_sent: 0,
      duration_ms: 0,
      error: "Error al enviar a la impresora",
    };
  }
}
