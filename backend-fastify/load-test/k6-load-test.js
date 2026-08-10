// ============================================================================
// k6 load test — capacidad REST del backend POS
// ============================================================================
// Mide cuántas peticiones/segundo y cuántas conexiones SSE aguanta el server.
//
// Requisitos:
//   1. Instalar k6: https://grafana.com/docs/k6/latest/set-up/install-k6/
//      (Linux: `sudo gpg -k` + deb, o `brew install k6`, o binario suelto)
//   2. Crear N usuarios de prueba (API_VUS + SSE_VUS) con email
//      `loadtest1@example.com`, `loadtest2@example.com`, ... (cada VU hace
//      login con SU usuario: así el rate-limit por usuario se comporta como
//      en producción y no rompe el test).
//      O usar K6_TOKEN con un token fijo para un smoke test rápido.
//
// Uso:
//   k6 run load-test/k6-load-test.js
//
// Env vars:
//   BASE_URL               default http://localhost:3000
//   LOADTEST_EMAIL_PREFIX  default "loadtest"   -> loadtest{VU}@{DOMINIO}
//   LOADTEST_EMAIL_DOMAIN  default "example.com"
//   LOADTEST_PASSWORD      default "Loadtest123!"
//   K6_TOKEN               token fijo (salta el login por usuario)
//   API_VUS                VUs del escenario de lecturas (default 50)
//   SSE_VUS                VUs del escenario de conexiones SSE (default 100)
//   TEST_DURATION          duración del test (default "2m")
// ============================================================================

import http from "k6/http";
import { check, sleep } from "k6";
import { Counter } from "k6/metrics";

const BASE_URL = (__ENV.BASE_URL || "http://localhost:3000").replace(/\/+$/, "");
const EMAIL_PREFIX = __ENV.LOADTEST_EMAIL_PREFIX || "loadtest";
const EMAIL_DOMAIN = __ENV.LOADTEST_EMAIL_DOMAIN || "example.com";
const PASSWORD = __ENV.LOADTEST_PASSWORD || "Loadtest123!";
const K6_TOKEN = __ENV.K6_TOKEN || "";
const API_VUS = Number(__ENV.API_VUS || 50);
const SSE_VUS = Number(__ENV.SSE_VUS || 100);
const TEST_DURATION = __ENV.TEST_DURATION || "2m";

export const options = {
  scenarios: {
    // Lecturas REST típicas de un cajero (productos, ventas, inventario).
    api_reads: {
      executor: "constant-vus",
      vus: API_VUS,
      duration: TEST_DURATION,
      exec: "apiReads",
    },
    // Conexiones SSE abiertas y sostenidas. Cada VU abre UNA conexión a
    // /events y la mantiene durante todo el test (responseTimeout 10m > test).
    // Si el server la cierra o falla -> error -> se cuenta en `sse_broken`.
    sse_hold: {
      executor: "constant-vus",
      vus: SSE_VUS,
      duration: TEST_DURATION,
      exec: "holdSse",
    },
  },
  thresholds: {
    // En el escenario de lecturas no debe fallar ni una de cada 1000 peticiones.
    "http_req_failed{scenario:api_reads}": ["rate<0.001"],
    // Lecturas: 95% deben responder en <500ms.
    "http_req_duration{scenario:api_reads}": ["p(95)<500"],
  },
};

// Las conexiones SSE del escenario sse_hold se mantienen abiertas todo el test;
// al terminar, k6 las interrumpe y eso puede marcarse como "failed" aunque el
// server esté sano — por eso NO hay threshold http_req_failed para ese
// escenario. La señal real es el Counter `sse_broken`: >0 = el server
// cerró/limitó conexiones durante la prueba.

// ── Contador custom: conexiones SSE que se rompieron durante la prueba ──────
// (métrica k6: las variables de módulo NO se comparten entre VUs ni llegan a
// handleSummary, así que se usa un Counter, que k6 agrega globalmente)
const sseBroken = new Counter("sse_broken");

// ── Auth por VU (login cacheado: k6 aísla el estado por VU) ─────────────────
let authToken = "";
function getToken() {
  if (authToken) return authToken;
  if (K6_TOKEN) {
    authToken = K6_TOKEN;
    return authToken;
  }
  const email = `${EMAIL_PREFIX}${__VU}@${EMAIL_DOMAIN}`;
  const res = http.post(
    `${BASE_URL}/api/v1/auth/login`,
    JSON.stringify({ email, password: PASSWORD }),
    { headers: { "Content-Type": "application/json" } },
  );
  const ok = check(res, { [`login ${email} 200`]: (r) => r.status === 200 });
  if (!ok) {
    console.error(`Login falló para ${email} (${res.status}): creá los usuarios de prueba`);
    throw new Error(`login ${email} falló`);
  }
  authToken = res.json().accessToken || "";
  return authToken;
}

function authParams() {
  return { headers: { Authorization: `Bearer ${getToken()}` } };
}

// ── Escenario 1: lecturas REST (mezcla realista de un cajero) ───────────────
export function apiReads() {
  const params = authParams();
  const r = Math.random();
  let res;
  if (r < 0.55) {
    // 55% productos (lo más consultado: tabla principal)
    res = http.get(`${BASE_URL}/api/v1/products?page=1&limit=25&active=true`, params);
  } else if (r < 0.75) {
    // 20% ventas del día
    res = http.get(`${BASE_URL}/api/v1/sales?page=1&limit=25`, params);
  } else if (r < 0.9) {
    // 15% movimientos de inventario
    res = http.get(`${BASE_URL}/api/v1/inventory?page=1&limit=10`, params);
  } else {
    // 10% categorías
    res = http.get(`${BASE_URL}/api/v1/categories`, params);
  }
  check(res, {
    "GET 2xx": (r) => r.status >= 200 && r.status < 300,
  });
  // ~5 lecturas/seg por cajero activo (think time realista)
  sleep(0.2);
}

// ── Escenario 2: conexiones SSE sostenidas ───────────────────────────────────
export async function holdSse() {
  const res = await http.asyncRequest(
    "GET",
    `${BASE_URL}/api/v1/events`,
    null,
    {
      headers: {
        Authorization: `Bearer ${getToken()}`,
        Accept: "text/event-stream",
      },
      // Mayor que TEST_DURATION: la conexión se mantiene todo el test.
      responseTimeout: "10m",
      tags: { name: "sse_hold" },
    },
  );
  // La conexión solo "termina" si el server la cierra o falla.
  if (res.status !== 200 || res.error) {
    sseBroken.add(1);
    console.warn(`[sse] conexión rota: status=${res.status} error=${res.error}`);
  }
  sleep(1);
}

export function handleSummary(data) {
  const broken = data.metrics?.sse_broken?.values?.count ?? 0;
  return {
    stdout: `\n=== RESUMEN DE CARGA ===\n` +
      `Peticiones REST/s: ${(data.metrics?.["http_reqs{scenario:api_reads}"]?.values?.rate ?? 0).toFixed(1)}\n` +
      `Lecturas p95: ${(data.metrics?.["http_req_duration{scenario:api_reads}"]?.values?.["p(95)"] ?? 0).toFixed(0)}ms\n` +
      `Fallos REST: ${(data.metrics?.["http_req_failed{scenario:api_reads}"]?.values?.rate ?? 0) * 100}%\n` +
      `Conexiones SSE rotas durante el test: ${broken} de ${SSE_VUS}\n` +
      `(los req/s son del escenario de lecturas; el SSE no suma ahí)\n` +
      `Para el número REAL de conexiones SSE sostenidas usá: npm run load-test:sse\n`,
  };
}
