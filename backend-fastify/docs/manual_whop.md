Manual · API de Whop para CajoraPOS

 Documento markdown. Los bloques están en formato .http: podés copiar cada uno a
 un archivo .http y ejecutarlo con la extensión REST Client (VS Code) o el HTTP
 Client de JetBrains.

 ────────────────────────────────────────────────────────────────────────────────

 1 · Las variables (lo único que editás)

 En formato .http las variables se declaran con @ y se usan con {{ }}. Van una
 sola vez, arriba del archivo:

 ```http
   @base_url      = https://api.whop.com/api/v1
   @api_key       = PEGAR_TU_API_KEY_ACA
   @account_id    = PEGAR_TU_ACCOUNT_ID_ACA
   @membership_id = PEGAR_TU_MEMBERSHIP_ID_ACA
 ```

 ┌───────────────┬─────────────────────────┬─────────────────────────────────────┐
 │ Qué           │ Dónde va                │ De dónde sale                       │
 ├───────────────┼─────────────────────────┼─────────────────────────────────────┤
 │ API key       │ @api_key, después de    │ Dashboard de Whop → Developer → API │
 │               │ Bearer                  │ keys                                │
 ├───────────────┼─────────────────────────┼─────────────────────────────────────┤
 │ account_id    │ @account_id             │ Lo devuelve el endpoint #1 de este  │
 │               │                         │ manual (biz_...)                    │
 ├───────────────┼─────────────────────────┼─────────────────────────────────────┤
 │ membership_id │ @membership_id          │ Lo devuelve el endpoint #3 o #4     │
 │               │                         │ (mem_...)                           │
 └───────────────┴─────────────────────────┴─────────────────────────────────────┘

 │ La API key es un secreto. Si vas a guardar este archivo en el repo, dejá el
 │ placeholder y usá tu key solo en un archivo local que esté en .gitignore. Si la
 │ key real termina en un commit, hay que rotarla.

 ────────────────────────────────────────────────────────────────────────────────

 2 · Endpoints

 ### #1 · Mi cuenta → de acá sale el account_id

 ```http
   ### Obtener la cuenta asociada a la API key
   GET {{base_url}}/accounts/me
   Authorization: Bearer {{api_key}}
   Accept: application/json
 ```

 En la respuesta buscá "id": "biz_...". Ese es el account_id: copialo a la
 variable de arriba.

 Requiere scope de lectura de company. Si devuelve forbidden, mirá la sección 3.

 ────────────────────────────────────────────────────────────────────────────────

 ### #2 · Listar planes → de acá sale el plan_...

 ```http
   ### Listar los planes (pricing options) de la cuenta
   GET {{base_url}}/plans?account_id={{account_id}}
   Authorization: Bearer {{api_key}}
   Accept: application/json
 ```

 account_id es obligatorio en este endpoint: sin él responde
 {"error":{"type":"bad_request","message":"account_id is required"}}.

 En la respuesta vas a ver tus dos planes ($1/mes y $12.99/mes). El que importa es
 el de **12.99**, y su `"id": "plan_..."` es el que va en:

 - WHOP_PLAN_ID_MONTHLY → backend-fastify/.env
 - PUBLIC_WHOP_PLAN_ID → landing-page/.env

 ────────────────────────────────────────────────────────────────────────────────

 ### #3 · Listar memberships

 ```http
   ### Listar las memberships de la cuenta
   GET {{base_url}}/memberships
   Authorization: Bearer {{api_key}}
   Accept: application/json
 ```

 Este endpoint no necesita account_id: con una API key de cuenta ya devuelve las
 de tu negocio (account_id y user_id solo filtran).

 Sirve como plan B para sacar el plan_...: cada membership incluye "plan": { "id":
 "plan_..." }. Si ya hiciste una compra de prueba, el dato está acá aunque
 /accounts/me te dé forbidden.

 ────────────────────────────────────────────────────────────────────────────────

 ### #4 · Ver una membership

 ```http
   ### Ver el detalle de una membership
   GET {{base_url}}/memberships/{{membership_id}}
   Authorization: Bearer {{api_key}}
   Accept: application/json
 ```

 Es exactamente la llamada que hace el backend en cada webhook (la regla "el
 evento dispara, la API decide"). Te sirve para ver el status real y el
 renewal_period_end que el sistema va a usar para decidir el acceso.

 ────────────────────────────────────────────────────────────────────────────────

 ### #5 · Cancelar una membership ⚠️

 ```http
   ### Cancelar al final del período
   POST {{base_url}}/memberships/{{membership_id}}/cancel
   Authorization: Bearer {{api_key}}
   Accept: application/json
 ```

 Es una acción real y destructiva. Programa la cancelación al final del período
 vigente: el cliente conserva el tiempo que ya pagó y después no se renueva.

 La usa el botón "Cancelar" de la app. Si te da forbidden, la API key no tiene
 scope de escritura y la cancelación no va a funcionar en producción.

 ────────────────────────────────────────────────────────────────────────────────

 ### #6 · Reactivar una membership

 ```http
   ### Revertir una cancelación programada
   POST {{base_url}}/memberships/{{membership_id}}/reactivate
   Authorization: Bearer {{api_key}}
   Accept: application/json
 ```

 Revierte la cancelación para que la membership vuelva a renovarse. Es la llamada
 detrás de "Reactivar" en la app.

 ────────────────────────────────────────────────────────────────────────────────

 3 · ¿La API key tiene los permisos que hacen falta?

 Whop crea las API keys sin scopes activados: hay que tildarlos al crearlas. Un
 forbidden con mensaje tipo Business account API key is not authorized for the ...
 scope significa exactamente eso.

 Para CajoraPOS hacen falta estos, agrupados como los muestra el dashboard:

 ┌─────────────────────────────────────────────┬─────────────────────────────────┐
 │ Para qué                                    │ Permisos                        │
 ├─────────────────────────────────────────────┼─────────────────────────────────┤
 │ Leer memberships (webhooks, reconciliación) │ Members / Memberships → lectura │
 ├─────────────────────────────────────────────┼─────────────────────────────────┤
 │ Leer la cuenta (endpoint #1)                │ Company / Accounts → lectura    │
 ├─────────────────────────────────────────────┼─────────────────────────────────┤
 │ Cancelar y reactivar desde la app           │ Memberships → escritura         │
 └─────────────────────────────────────────────┴─────────────────────────────────┘

 El de escritura es el que más se olvida, y no rompe el cobro: rompe la
 cancelación. Se descubre recién cuando un cliente quiere darse de baja. Los
 endpoints #5 y #6 son justamente cómo lo verificás antes de ponerlo en
 producción.

 Si los nombres que ves en la UI no coinciden con estos, pegame la lista tal cual
 aparece y te digo cuáles tildar.

 ────────────────────────────────────────────────────────────────────────────────

 4 · Orden recomendado para dejar todo listo

 1. Crear la API key con los scopes de la sección 3.
 2. Ejecutar #1 → copiar el biz_... a @account_id.
 3. Ejecutar #2 → copiar el plan_... del precio de 12.99.
 4. Ejecutar #3 → confirmar que hay memberships y sacar un mem_... si querés
    probar los últimos dos.
 5. Probar #5 y #6 sobre una membership de prueba para confirmar el scope de
    escritura.

 Con el plan_... en mano, ya podés completar los dos .env y pasar a la prueba de
 punta a punta.
