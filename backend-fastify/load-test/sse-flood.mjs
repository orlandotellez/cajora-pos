#!/usr/bin/env node
// ============================================================================
// sse-flood.mjs — mide cuántas conexiones SSE sostiene el server
// ============================================================================
// Abre N conexiones SSE reales contra /api/v1/events, las mantiene abiertas
// durante D segundos y reporta cuántas se conectaron, cuántos eventos les
// llegaron y cuántas se rompieron. Es la métrica más fiel para "¿cuántos
// terminales conectados aguanta mi backend?".
//
// Uso (Node >= 18, sin dependencias):
//   node load-test/sse-flood.mjs [BASE_URL] [CONEXIONES] [DURACION_S] [EMAIL] [PASSWORD]
//
//   O con env vars:
//     SSE_FLOOD_URL=..., SSE_FLOOD_CONN=200, SSE_FLOOD_DURATION=60,
//     SSE_FLOOD_EMAIL=..., SSE_FLOOD_PASSWORD=...
//
//   Si se pasa EMAIL/PASSWORD hace login (un solo usuario, ojo con el
//   rate-limit por usuario: 300 req/min). Alternativa: exportá
//   SSE_FLOOD_TOKEN con un token ya obtenido.
//
// Ejemplo:
//   node load-test/sse-flood.mjs http://localhost:3000 500 60 admin@demo.com Admin123!
// ============================================================================
import process from "node:process";

const BASE_URL = (process.env.SSE_FLOOD_URL || process.argv[2] || "http://localhost:3000").replace(/\/+$/, "");
const CONNECTIONS = Number(process.env.SSE_FLOOD_CONN || process.argv[3] || 200);
const DURATION_S = Number(process.env.SSE_FLOOD_DURATION || process.argv[4] || 60);
const EMAIL = process.env.SSE_FLOOD_EMAIL || process.argv[5] || "";
const PASSWORD = process.env.SSE_FLOOD_PASSWORD || process.argv[6] || "";
const TOKEN = process.env.SSE_FLOOD_TOKEN || "";

async function login() {
  if (TOKEN) return TOKEN;
  if (!EMAIL) {
    console.error("Necesitás EMAIL/PASSWORD o SSE_FLOOD_TOKEN para autenticarte.");
    process.exit(1);
  }
  const res = await fetch(`${BASE_URL}/api/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  if (!res.ok) {
    console.error(`Login falló (${res.status}). Revisá credenciales.`);
    process.exit(1);
  }
  const body = await res.json();
  return body.accessToken;
}

function openConnection(token, stats) {
  const ctrl = new AbortController();
  const conn = { connected: false, events: 0, broken: null };

  (async () => {
    try {
      const res = await fetch(`${BASE_URL}/api/v1/events`, {
        headers: { Authorization: `Bearer ${token}`, Accept: "text/event-stream" },
        signal: ctrl.signal,
      });
      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
      conn.connected = true;
      stats.connected++;

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        // Contar frames SSE (heartbeats incluidos) — barato y suficiente.
        const newlines = buffer.match(/\n\n/g);
        if (newlines) {
          conn.events += newlines.length;
          stats.events += newlines.length;
          buffer = buffer.slice(buffer.lastIndexOf("\n\n") + 2);
        }
      }
      // El server cerró el stream antes de tiempo.
      conn.broken = "cerrada por el server";
      stats.broken++;
    } catch (err) {
      if (err.name !== "AbortError") {
        conn.broken = String(err?.message ?? err);
        if (conn.connected) stats.broken++;
        else stats.failedToConnect++;
      }
    } finally {
      ctrl.abort();
    }
  })();

  return { ctrl, conn };
}

async function main() {
  const token = await login();
  console.log(`\n=== SSE FLOOD ===`);
  console.log(`URL: ${BASE_URL}/api/v1/events`);
  console.log(`Conexiones: ${CONNECTIONS} | duración: ${DURATION_S}s`);
  console.log("");

  const stats = { connected: 0, broken: 0, failedToConnect: 0, events: 0 };
  const opened = [];
  for (let i = 0; i < CONNECTIONS; i++) {
    opened.push(openConnection(token, stats));
  }

  // Progreso cada 5s.
  const reporter = setInterval(() => {
    console.log(
      `  [${new Date().toLocaleTimeString()}] conectadas: ${stats.connected}/${CONNECTIONS} | rotas: ${stats.broken} | eventos recibidos: ${stats.events}`,
    );
  }, 5_000);

  await new Promise((resolve) => setTimeout(resolve, DURATION_S * 1000));
  clearInterval(reporter);

  // Cortar todas y esperar un instante para que cierren limpio.
  for (const { ctrl } of opened) ctrl.abort();
  await new Promise((resolve) => setTimeout(resolve, 1_000));

  console.log("\n=== RESULTADO ===\n");
  console.log(`Conexiones abiertas        : ${CONNECTIONS}`);
  console.log(`Conexiones establecidas    : ${stats.connected}`);
  console.log(`Conexiones rotas           : ${stats.broken}`);
  console.log(`Fallaron al conectar       : ${stats.failedToConnect}`);
  console.log(`Eventos/heartbeats totales : ${stats.events}`);
  console.log("");

  const ok = stats.connected - stats.broken;
  const holdRate = stats.connected ? ((ok / stats.connected) * 100).toFixed(1) : "0";
  console.log(`Mantenidas sin errores     : ${ok}/${CONNECTIONS} (${holdRate}%)`);
  if (stats.broken === 0 && stats.failedToConnect === 0) {
    console.log("✅ El server sostuvo TODAS las conexiones durante el test.");
  } else {
    console.log("⚠️  Hubo conexiones que se rompieron. Revisá logs del backend y el límite de file descriptors (ulimit -n).");
  }
  process.exit(stats.broken === 0 && stats.failedToConnect === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
