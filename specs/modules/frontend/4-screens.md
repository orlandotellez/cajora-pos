# Frontend Screens

Inventario completo de pantallas del POS System, con su proposito, estado actual en `src/pages/` y comportamiento.

---

## Convencion de nombres

| Convencion | Uso |
|---|---|
| Path | `/<feature>` (singular). |
| Archivo page | `src/pages/<Name>.tsx` + `src/pages/<Name>.module.css`. |
| Estado: ✅ implementado | UI viva + flujo end-to-end. |
| Estado: ⚠️ parcial | UI existe pero falta algun detalle. |
| Estado: ❌ no implementado | no existe. |

---

## `/auth` — Auth Page ✅

**Archivo**: `src/pages/Auth.tsx` + `src/pages/Auth.module.css`

**Proposito**: Pantalla unica con 3 modos (toggle):
1. **Login**: usuario existente inicia sesion.
2. **Register Store**: crea una tienda + usuario admin (flujo de onboarding inicial).
3. **Crear tienda con config API**: el usuario puede cambiar la URL del backend (campo `apiUrl`) antes del request.

**Inputs (login)**:
- email
- password
- (opcional) apiUrl (boton "Configurar API")

**Inputs (register-store)**:
- store_name, store_address?, store_phone?
- admin_name, admin_email, admin_password
- (opcional) apiUrl

**Submit**:
- Login → POST `/auth/login` → set cookies → redirect a `/pos`.
- Register Store → POST `/auth/register-store` → set cookies + crea store → redirect a `/pos`.

**Estados**:
- Empty (form vacio).
- Submitting (boton disabled + spinner).
- Error (toast o inline si 401/409).
- Success (redirect).

---

## `/pos` — POS Screen ✅

**Archivo**: `src/pages/Pos.tsx` + `src/pages/Pos.module.css`

**Proposito**: Pantalla principal donde el cajero registra ventas.

**Layout**:

```
┌─────────────────────────────────────────────────────────────┐
│ [buscar producto por nombre o barcode]   [+676]   [scan]    │
├─────────────────────────────────┬───────────────────────────┤
│  PRODUCT GRID (top sellers)     │   CART                    │
│  [Coca-Cola] [Sabritas] [Papas] │   ┌─────────────────────┐ │
│  [Chicles] [Cafe] [Pan] ...     │   │ Coca 600ml  x2 $50 │ │
│                                 │   │ Cafe 1kg    x1 $80 │ │
│  Resultados de busqueda         │   │ Subtotal:      $130│ │
│  (lista vertical)               │   │                  │ │
│                                 │   │ Total:         $151│ │
│                                 │   │ [efectivo][tarj.]│ │
│                                 │   │ Recibido:  $200   │ │
│                                 │   │ Cambio:     $49   │ │
│                                 │   │ [CONFIRMAR VENTA] │ │
└─────────────────────────────────┴───────────────────────────┘
```

**Features**:
- Agregar producto al cart (click o barcode scan).
- Modificar cantidad (input numerico o +/-).
- Remover item.
- Ver subtotal/descuento/total en vivo.
- Seleccionar metodo de pago (4 botones).
- Si `efectivo`: input "monto recibido", calcula cambio.
- Confirm: `POST /sales` → ticket preview + opcion de imprimir.
- Limpia cart al OK.

**Estado global**: `posStore.ts` (Zustand) — items, total, paymentMethod.

**Empty / Loading**:
- Lista de productos favoritos: vive en localStorage `pos.favorites`. Si vacia, mostrar grid generico.
- Cart vacio: copy + icono.

---

## `/products` — Products Page ✅

**Archivo**: `src/pages/Products.tsx`

**Proposito**: CRUD catalogo de productos.

**Features**:
- Lista paginada con filtros: `search`, `category_id`, `active`, `low_stock`, `out_of_stock`.
- Boton "Nuevo" abre modal con form.
- Click fila → edita.
- Icon trash → confirm dialog → soft-delete.
- Form tiene: name, barcode (opcional), unit_type, unit_quantity, category_id (select), supplier_id (select), price, cost, stock, low_stock_threshold.
- `category_id`/`supplier_id` vacios → submit `null` → backend desenlaza.

**Columnas**:
| Nombre | Cat | Precio | Stock | Estado | Acciones |
|---|---|---|---|---|---|

---

## `/sales` — Sales Page ✅

**Archivo**: `src/pages/Sales.tsx` + `src/pages/Sales.module.css`

**Proposito**: Lista ventas + ver detalle + reportes (solo admin).

**Tab 1**: Lista de ventas

- Filtros: rango de fechas, usuario, metodo de pago.
- Paginacion.
- Click fila → modal detalle.

**Tab 2 (admin)**: Reportes

- `GET /sales/report?start_date=&end_date=`: cards con totales (total_revenue, average_ticket, etc.).
- `GET /sales/revenue-trend?group_by=day|week|month`: grafico de linea.
- Top productos vendidos (lista table).

**Visualizacion**:
- Use `recharts` o `chart.js` para el grafico (decidir).
- Cards de KPI grandes en la parte superior.

---

## `/inventory` — Inventory Page ✅

**Archivo**: `src/pages/Inventory.tsx`

**Proposito**: Visualizar y registrar movimientos de inventario individuales.

**Tab 1**: Movimientos

- Lista de movimientos con filtros (`product_id`, `movement_type`).
- Click + → form nueva (entrada/salida/ajuste).

**Tab 2**: Stock bajo

- Lista de productos con `stock <= low_stock_threshold`.
- Resaltado rojo. CTA "Reponer".

**Tab 3**: Batches (entradas/salidas/ajustes masivos)

- Diferente a historial; agrupa movimientos de un mismo `batch` (e.g. compra a proveedor).
- Crear batch: wizard multi-step con productos + cantidades.
- Detalle batch: expande items.

---

## `/services` — Services Page ⚠️

**Archivo**: `src/pages/Services.tsx`

**Proposito**: CRUD servicios compuestos (e.g. "Combo Familiar" = [Coca 600ml x2] + [Sabritas x1]).

**Features**:
- Lista.
- Modal create/edit: nombre, descripcion, base_price, is_active, **products[]** (con cantidad).
- Soft-delete.

**Empty / partial**: UI existe pero el wiring con `servicesApi` esta parcial; revisar.

---

## `/suppliers` — Suppliers Page ✅

**Archivo**: `src/pages/Suppliers.tsx`

**Proposito**: CRUD proveedores.

**Features**:
- Lista.
- Modal: name, contact_name, email, phone, address, notes, is_active.
- Soft-delete.
- Mostrar `product_count` (de la respuesta `GET /suppliers/:id`).

---

## `/users` — Users Page ⚠️ (admin only)

**Archivo**: `src/pages/Users.tsx`

**Proposito**: Gestionar usuarios de la tienda (solo admin).

**Features**:
- Lista con search.
- Crear cajero (form: name, email, password, phone, role=cajero).
- Edit (name, email, role, phone).
- Soft-delete.

**Restriccion**: `<RequireAdmin>` en route. Si cajero intenta, redirect a `/pos`.

---

## `/settings` — Settings Page ✅

**Archivo**: `src/pages/Settings.tsx` + `src/pages/Settings.module.css`

**Proposito**: Configuracion del negocio (solo el admin edita; cajero puede ver).

**Sections**:

1. **Negocio**: nombre, address, phone, footer de ticket.
2. **Stock mínimo**: low_stock_threshold default (5).
3. **Impresora**: nombre, interface (USB / network / serial), IP, puerto, paper_size (80mm / 58mm), open_drawer (bool), cut_after (bool).

**Submit**: PUT `/settings` (upsert).

---

## `/` (root) — Redirect ✅

`/` → `Navigate to="/pos" replace`.

Si no autenticado: `<RequireAuth>` dispara redirect a `/auth`.

---

## `*` (NotFound) ❌

**Archivo**: `src/pages/NotFound.tsx` (crear si no existe).

Pantalla generica 404 con link a `/pos`.

---

## `/reports` — Reports Page ⚠️ (admin only)

**Archivo**: `src/pages/Reports.tsx` + `src/pages/Reports.module.css`

**Proposito**: Visualización de KPIs y series temporales de ventas. Solo accesible por admin (similar a `/users`).

**Sections (tabs)**:

1. **KPIs del período seleccionado**:
   - Total de ventas (count).
   - Revenue total.
   - Descuentos aplicados.
   - Descuentos aplicados.
   - Average ticket.

2. **Revenue trend** (chart):
   - Selector de rango (`start_date` + `end_date`).
   - Selector de agrupación (`day | week | month`).
   - Line chart (usar `recharts` o `chart.js`).
   - Datos vía `GET /sales/revenue-trend?group_by=...&start_date=...&end_date=...`.

3. **Top productos**:
   - Table con `product_name`, `quantity`, `revenue`.
   - Datos vía `GET /sales/report?start_date=...&end_date=...`.

**Restricción**: `<RequireAdmin>` en route. Si cajero intenta, redirect a `/pos`.

**Estado**: ⚠️ UI existe; verificar el wiring completo con `salesApi.getReport()` y `salesApi.getRevenueTrend()`.

---

## Sidebar / Header (layout global) ✅

Definido en `App.tsx` + `App.module.css`.

**Header**:
- Logo + nombre del store (de `AuthContext.store.name`).
- Theme toggle (sun / moon).
- User menu (avatar, nombre, role badge, dropdown con `Logout`).

**Sidebar**:
- Lista de nav links (cada uno disabled si `RequireAdmin` y user no es admin).
- Active state con var(--color-primary) en background.
- Iconos (lucide).
- Colapsable a iconos-only en <768px.

---

## Patrones comunes

### **Header de page**

```tsx
<header>
  <div>
    <h1>Productos</h1>
    <p className={styles.subtitle}>Gestion del catalogo</p>
  </div>
  <Button variant="primary" onClick={openCreate}>
    <Plus size={16} /> Nuevo producto
  </Button>
</header>
```

### **Filtros / search bar**

```tsx
<div className={styles.filters}>
  <Input placeholder="Buscar..." value={search} onChange={...} icon={<Search />} />
  <Select label="Categoria" value={category_id} onChange={...} options={categories} />
  <Button variant="ghost" onClick={clearFilters}>Limpiar</Button>
</div>
```

### **Tabla con sort + actions**

```tsx
<Table
  columns={[...]}
  data={items}
  onSort={setSort}
  sortBy={sort.field}
  sortDir={sort.dir}
  onRowClick={openEdit}
  actions={(row) => (
    <DropdownMenu>
      <Item onClick={() => openEdit(row)}><Pencil /> Editar</Item>
      <Item danger onClick={() => askDelete(row.id)}><Trash2 /> Eliminar</Item>
    </DropdownMenu>
  )}
/>
```

### **Modal flow**

- Modal con `Dialog` Radix.
- Form dentro con `useForm`.
- Submit: button `Confirmar` (loading state mientras submit).
- Cancel: `Cancelar` o click outside (preguntar si hay cambios).
- Error inline o via toast.

---

## Estados globales que afectan pantallas

| Pantalla | Read state | Write state |
|---|---|---|
| `/auth` | (auth vacio) | set user + store + cookies |
| `/pos` | Auth (cualquiera) | (solo emite sales; no muta auth) |
| `/users` | store (solo admin) | users de la tienda |
| `/settings` | store (solo admin) | settings de la tienda |
| otras | Auth requerida | nada global |

---

## Tareas pendientes en pantallas

- ❌ `NotFound` puede no existir — verificar.
- ⚠️ `/services` parity con Fastify (`GET /services` y modal con products[]) — verificar wiring completo.
- ❌ Wizar de **create-batch** en `/inventory` puede ser basico — mejorar UX multi-step.
- ❌ Print receipt UX: hoy usa nueva ventana o `window.print()`; armar flujo con ESC/POS opcional.
