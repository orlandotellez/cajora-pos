# Plan de prueba · Suscripción Cloud con Whop en sandbox

Probar el ciclo completo de la suscripción (compra → activación → renovación → renovación
fallida → cancelación → recuperación) **sin gastar dinero real**, usando el sandbox de Whop.

Complementa a `odd/tasks/whop-checkout-integration.md` (el documento de la implementación).
Este documento es la guía de ejecución de la prueba.

---

## 1 · Alcance y límites

### Qué cubre

| Área | Se prueba |
| --- | --- |
| Webhook | Entrega, verificación de firma, idempotencia |
| Activación | Fila local en `active` con período real del proveedor |
| Renovación | El período se extiende solo, sin intervención del cliente |
| Renovación fallida | `past_due`, gracia de 3 días, sin período fabricado |
| Cancelación | Desde la app, conservando el período pagado |
| Reactivación | Revertir la cancelación programada |
| Reconciliación | Red de seguridad cuando un webhook se pierde |
| Recuperación | `POST /subscriptions/whop/sync` vinculando por email |
| Doble cobro | Un segundo intento no debe cobrar dos veces |

### Qué NO cubre (limitación de Whop, no nuestra)

> La documentación de Whop dice textual: **"The sandbox environment isn't available for Whop
> Elements yet."**

El **formulario embebido** no se puede apuntar al sandbox. Se valida aparte, en producción y
**sin completar el pago**: alcanza con ver que el formulario monta en el paso 3.

---

## 2 · Prerrequisitos bloqueantes

Ninguna prueba funciona si falta alguno de estos.

- [ ] **Túnel HTTPS** apuntando al backend local. `localhost` no es alcanzable por Whop: sin
      túnel, el webhook **nunca llega** y todas las pruebas de activación fallan. Opciones:
      ngrok o Cloudflare Tunnel.
- [ ] **`WHOP_SANDBOX=true`** implementado en el código. Hoy `whop.client.ts` tiene la URL de
      producción fija; sin esta variable el backend habla con la cuenta real.
- [ ] El landing y el backend corriendo en el mismo entorno. `localhost:4321` (landing) habla
      con el backend local por el proxy de `/api`.

---

## 3 · Tareas

### Preparación del entorno

- [ ] **T1 · Variable de sandbox en el cliente de Whop**
  Agregar `WHOP_SANDBOX` a `config/env.ts` (mismo patrón que `PAYPAL_SANDBOX`) y usarla en
  `infrastructure/whop.client.ts` para elegir `https://sandbox-api.whop.com/api/v1` o
  `https://api.whop.com/api/v1`.
  *Verificación*: `tsc` limpio y un test que confirme la URL base según la variable.

- [ ] **T2 · Documentar la variable**
  Agregar `WHOP_SANDBOX=false` en `backend-fastify/.env.example` con el comentario de qué hace.
  *Nota*: los paths `.env*` están bloqueados por el harness; requiere autorización explícita.

- [ ] **T3 · Túnel HTTPS al backend local**
  Levantar el túnel y anotar la URL pública.
  *Verificación*: `curl` al túnel contra `/api/v1/subscriptions/mine` debe devolver **401**
  (existe y pide auth). Un 404 significa que el túnel apunta a otro lado.

- [ ] **T4 · Cuenta y plan de prueba en el sandbox**
  En `sandbox.whop.com`: crear el producto `PRUEBA - 1 semana`, precio **$1**, y elegir **el
  período más corto que permita** (1 día si está disponible; si no, 1 semana). Destildar
  **"Show on store page"**.
  *Verificación*: anotar el `plan_...` (no el `prod_...`).

- [ ] **T5 · API key del sandbox**
  Crear la key en el dashboard del sandbox **con los scopes tildados**: lectura de
  members/memberships y **escritura de memberships** (sin la de escritura no se puede cancelar).

- [ ] **T6 · Webhook del sandbox**
  Crear el webhook apuntando a `https://<túnel>/api/v1/webhooks/whop` con los cinco eventos:
  `membership.activated`, `membership.updated`, `payment.succeeded`, `payment.failed`,
  `invoice.past_due`. Copiar el `ws_...` (se muestra una sola vez).

- [ ] **T7 · Configurar los entornos**

  `backend-fastify/.env`:
  ```
  WHOP_ENABLED=true
  WHOP_SANDBOX=true
  WHOP_API_KEY=<key del sandbox>
  WHOP_WEBHOOK_SECRET=<ws_ del sandbox>
  WHOP_PLAN_ID_MONTHLY=<plan_ del sandbox>
  ```
  `landing-page/.env`:
  ```
  PUBLIC_WHOP_PLAN_ID=<el mismo plan_>
  ```

- [ ] **T8 · Verificar la entrega sin pagar**
  Usar **Send test event** en el dashboard del webhook de Whop.
  *Verificación*: la entrega responde **200** y en los logs no aparece "Verificación de firma
  falló". Un `warn` de "sin suscripción local vinculada" es el resultado esperado.

### Pruebas funcionales

- [ ] **T9 · Compra exitosa → activación**
  Crear la tienda desde el checkout y pagar con `4242 4242 4242 4242`.
  *Verificación*:
  ```sql
  SELECT status, provider, whop_membership_id, current_period_start, current_period_end
  FROM subscriptions WHERE whop_membership_id IS NOT NULL
  ORDER BY created_at DESC LIMIT 1;
  ```
  Esperado: `status = active`, `provider = whop`, y `current_period_end` **igual al período que
  configuraste** (1 día o 1 semana). **Si da 30 días, no está usando el período del proveedor.**

- [ ] **T10 · Renovación exitosa**
  Esperar el período. *Verificación*: `current_period_end` se movió **un período completo** sin
  que nadie hiciera nada, y hay un evento nuevo procesado:
  ```sql
  SELECT received_at, event_type, processed_at FROM whop_webhook_events
  ORDER BY received_at DESC LIMIT 10;
  ```

- [ ] **T11 · Renovación fallida → `past_due` + gracia**
  Repetir T9 con la tarjeta `4000 0000 0000 0341` (la tarjeta se guarda, pero los cobros
  posteriores se rechazan).
  *Verificación*:
  - La fila pasa a `past_due`.
  - **`current_period_end` NO se corre hacia adelante**: no debe fabricarse un período nuevo.
  - El acceso sigue hasta `current_period_end + 3 días` y después la API responde **402**.
  - El estado se resuelve contra el reloj, no contra el `status` guardado.

- [ ] **T12 · Cancelar y reactivar desde la app**
  Cancelar desde el perfil de la tienda.
  *Verificación*:
  - `cancel_at_period_end = true` y el acceso **no se corta** hasta el fin del período.
  - En Whop, la membership muestra la cancelación programada.
  - "Reactivar" revierte el flag y vuelve a renovar.

- [ ] **T13 · Reconciliación cuando un webhook se pierde**
  Simular la pérdida (por ejemplo, dejar el backend caído durante una renovación) y después:
  ```bash
  bun run reconcile
  ```
  *Verificación*: la fila se realinea con el estado real de Whop y `stats.drifted` sube.

- [ ] **T14 · Recuperación manual por email**
  Pagar **sin** pasar por el checkout de la app (checkout hospedado del sandbox) con el email del
  dueño de la tienda, y después usar "Ya pagué, verificar" en el landing.
  *Verificación*: `POST /subscriptions/whop/sync` vincula la membership por email y la suscripción
  pasa a `active`. Sin match de email, **no debe tocar la fila**.

- [ ] **T15 · Blindaje contra el doble cobro**
  Con la suscripción en `pending` (pago hecho, webhook no procesado), intentar pagar otra vez.
  *Verificación*: el sistema recupera la suscripción existente en vez de crear una segunda
  membership. **Debe existir una sola membership en Whop para esa tienda.**

### Cierre

- [ ] **T16 · Limpieza**
  Cancelar la membership de sandbox, revertir `WHOP_SANDBOX=false` y las credenciales de sandbox,
  restaurar el `plan_...` de producción, y apagar el túnel.

- [ ] **T17 · Registrar resultados**
  Anotar en la sección 5 qué pasó en cada prueba, con la evidencia (salida SQL, logs) de las que
  fallaron.

---

## 4 · Criterios de aceptación

La prueba se considera exitosa cuando:

1. La compra activa la tienda **sin intervención manual**.
2. La renovación extiende el período **sola**, y el período refleja el del proveedor (no 30 días).
3. Una renovación fallida **no fabrica período** y el acceso se corta recién pasado el grace.
4. Cancelar conserva el período pagado; reactivar lo reanuda.
5. Un webhook perdido se recupera por reconciliación o por el sync manual.
6. Pagar dos veces es **imposible** con una suscripción pendiente.
7. Ningún paso requiere que el cliente vuelva a escribir sus datos de pago.

---

## 5 · Resultados

| Tarea | Resultado | Evidencia / notas |
| --- | --- | --- |
| T1 | pendiente | |
| T2 | pendiente | |
| T3 | pendiente | |
| T4 | pendiente | |
| T5 | pendiente | |
| T6 | pendiente | |
| T7 | pendiente | |
| T8 | pendiente | |
| T9 | pendiente | |
| T10 | pendiente | |
| T11 | pendiente | |
| T12 | pendiente | |
| T13 | pendiente | |
| T14 | pendiente | |
| T15 | pendiente | |
| T16 | pendiente | |
| T17 | pendiente | |

---

## 6 · Riesgos conocidos

- **El embed no se prueba acá**: Whop Elements no soporta sandbox. Se valida en producción sin
  completar el pago.
- **La renovación exitosa tarda el período completo.** No hay forma de simular el paso del
  tiempo: por eso el plan debe usar el período más corto posible.
- **El sandbox tiene su propia base**: las suscripciones de sandbox no son las de producción, y
  las de producción no aparecen en sandbox.
- **Si la URL del túnel cambia**, hay que actualizar el webhook en el dashboard de Whop. Los
  túneles gratuitos rotan la URL en cada reinicio.
