import { createConnection } from "net"

export interface TcpPrintResult {
  success: boolean
  bytes_sent: number
  duration_ms: number
  error?: string
}

export function sendBytesViaTCP(
  host: string,
  port: number,
  bytes: Uint8Array,
  timeoutMs: number = 5000
): Promise<TcpPrintResult> {
  return new Promise((resolve) => {
    const startTime = Date.now()
    const socket = createConnection({ host, port, timeout: timeoutMs })

    let resolved = false
    const finish = (result: TcpPrintResult) => {
      if (resolved) return
      resolved = true
      try { socket.destroy() } catch (_) { /* noop */ }
      resolve(result)
    }

    socket.once("connect", () => {
      socket.write(Buffer.from(bytes), (writeErr) => {
        if (writeErr) {
          finish({
            success: false,
            bytes_sent: 0,
            duration_ms: Date.now() - startTime,
            error: `Write error: ${writeErr.message}`,
          })
          return
        }
        socket.end(() => {
          finish({
            success: true,
            bytes_sent: bytes.length,
            duration_ms: Date.now() - startTime,
          })
        })
      })
    })

    socket.once("error", (err) => {
      finish({
        success: false,
        bytes_sent: 0,
        duration_ms: Date.now() - startTime,
        error: `Connection error: ${err.message}`,
      })
    })

    socket.once("timeout", () => {
      finish({
        success: false,
        bytes_sent: 0,
        duration_ms: Date.now() - startTime,
        error: `Timeout después de ${timeoutMs}ms`,
      })
    })
  })
}
