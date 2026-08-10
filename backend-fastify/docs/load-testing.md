# Pruebas de carga (load testing)

Estas dos herramientas miden la capacidad real del backend **antes de
prometerle números a un cliente**. Usalas con un server en modo `production`
(`pnpm build && pnpm start`) contra una base de datos con datos realistas, no
en local con 3 productos.

| Herramienta | Mide | Archivo |
|---|---|---|
| **k6** | Capacidad REST: peticiones/segundo, latencia (p95), fallos | `load-test/k6-load-test.js` |
| **sse-flood (Node)** | Conexiones SSE simultáneas sostenidas (sockets) | `load-test/sse-flood.mjs` |

---

## 1. Instalar k6

https://grafana.com/docs/k6/latest/set-up/install-k6/

- **Linux (Debian/Ubuntu):**
  ```bash
  sudo gpg -k 0xC5AD17C747E3415A3642D57D77C6C491D6AC1D69
  echo "deb https://packages.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
  sudo apt-get update && sudo apt-get install k6
  ```
- **macOS:** `brew install k6`
- **Windows:** `choco install k6` (o binario desde la web)

## 2. Crear usuarios de prueba

El rate-limit ahora es **por usuario** (300 req/min). Si los 100 VUs de k6
usan el mismo token, vas a ver 429s — que es exactamente el comportamiento
correcto. Para medir capacidad (no el rate-limit), creá `API_VUS + SSE_VUS`
usuarios:

```bash
# con el script seed o desde la app: loadtest1@example.com ... loadtest150@example.com
# (password por defecto del test: Loadtest123!)
```

O para un **smoke test rápido de 1 usuario**, exportá un token:

```bash
# 1) obtené un token:
curl -s -X POST http://localhost:3000/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@demo.com","password":"Admin123!"}'
# 2) pegá el accessToken:
export K6_TOKEN=eyJhbGciOi...
```

## 3. Correr el test de k6 (capacidad REST)

```bash
cd backend-fastify
npm run load-test:k6                    # default: 50 VUs REST + 100 VUs SSE, 2 min
# o con parámetros:
k6 run load-test/k6-load-test.js \
  -e BASE_URL=https://tu-api.com \
  -e API_VUS=200 -e SSE_VUS=300 -e TEST_DURATION=5m
```

**Qué mirar en el reporte:**

| Métrica | Qué significa | Señal de problema |
|---|---|---|
| `http_reqs{scenario:api_reads}` (rate) | Peticiones/seg | — |
| `http_req_duration{scenario:api_reads}` p95 | Latencia de lectura | >500ms sostenido |
| `http_req_failed{scenario:api_reads}` | % de errores | >0.1% |
| `sse_broken` | Conexiones SSE que se rompieron | >0 con server sano |
| `http_req_duration` de la DB | Tiempo de query | cuello de botella en Postgres |

⚠️ k6 tiene un tope de `responseTimeout` de 10 minutos: para holdear conexiones
SSE más de 10 min (o para el número EXACTO de sockets) usá sse-flood.

## 4. Correr sse-flood (conexiones SSE)

```bash
cd backend-fastify
# 200 conexiones por 60s con un usuario:
node load-test/sse-flood.mjs http://localhost:3000 200 60 admin@demo.com Admin123!

# con token ya obtenido:
SSE_FLOOD_TOKEN=eyJhbGci... node load-test/sse-flood.mjs http://localhost:3000 500 120
```

**Qué mirar:** el reporte final — `Mantenidas sin errores: 500/500 (100%)` es el
objetivo. Si se rompen conexiones:

- Revisá el límite de file descriptors del proceso (`ulimit -n`, en systemd
  `LimitNOFILE=65535`). Cada socket SSE = 1 fd.
- Revisá timeouts del proxy/load balancer (Railway, Nginx `proxy_read_timeout`,
  Cloudflare) — deben permitir conexiones de larga duración.

## Números de referencia (con la arquitectura actual)

Con **una** instancia y **polling adaptativo** (el poll se pausa mientras el
SSE está conectado), el backend es event-driven: la carga no escala con los
terminales conectados sino con la tasa de eventos reales + lecturas puntuales.
En operación normal con 1000 terminales conectados por SSE, la carga efectiva
es del orden de decenas de req/s, no cientos.

El límite real está en **cuántas instancias necesitás**: con Redis pub/sub ya
conectado, el SSE funciona entre múltiples instancias — solo falta el load
balancer con sticky sessions opcionales (no requeridas, el estado está en Redis).

## Medir en producción de verdad

Para el número definitivo antes de vender: corré la prueba con los números que
quieras prometer (ej. `API_VUS=200 SSE_VUS=1000 TEST_DURATION=10m`) en el
mismo servidor/plan que vas a ofrecer, con la base poblada. Ese resultado es
tu respuesta comercial.
