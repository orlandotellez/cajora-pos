import { createConnection } from "net"
import { logger } from "@/config/logger"

export interface TcpPrintResult {
  success: boolean
  bytes_sent: number
  duration_ms: number
  error?: string
}

// Envía bytes a una impresora por TCP.
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
          logger.error(
            { err: writeErr, host, port },
            "No se pudo escribir en la impresora",
          )
          finish({
            success: false,
            bytes_sent: 0,
            duration_ms: Date.now() - startTime,
            error: "No se pudo escribir en la impresora",
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
      logger.error(
        { err, host, port },
        "No se pudo conectar con la impresora",
      )
      finish({
        success: false,
        bytes_sent: 0,
        duration_ms: Date.now() - startTime,
        error: "No se pudo conectar con la impresora",
      })
    })

    socket.once("timeout", () => {
      logger.warn(
        { host, port, timeoutMs },
        "Tiempo de espera agotado al conectar con la impresora",
      )
      finish({
        success: false,
        bytes_sent: 0,
        duration_ms: Date.now() - startTime,
        error: "Tiempo de espera agotado",
      })
    })
  })
}
