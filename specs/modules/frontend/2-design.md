# Frontend Design

Sistema de diseno del POS System — tokens CSS, theming, componentes, patrones de UI.

---

## Principios

1. **Funcional > decorativo**. El POS es una herramienta de cajero: la UI debe ser rapida, clara y operable con teclado o touch.
2. **Tokens primero**. Cualquier valor (color, spacing, font-size) sale de CSS variables en `:root`. Nunca hardcoded.
3. **Tema claro/oscuro**. Por defecto claro (legible bajo luz fluorescente de un comercio), con toggle.
4. **Accesibilidad basica**: contraste AA, focus visible, navegacion por teclado, labels en inputs.

---

## Tokens (CSS variables)

Definidos en `src/index.css` con prefijo semantico:

### Color (light theme)

| Token | Default | Uso |
|---|---|---|
| `--color-bg` | `#F7F8FA` | Fondo de app. |
| `--color-surface` | `#FFFFFF` | Card / panel. |
| `--color-surface-2` | `#F0F2F5` | Sub-panel, header de tabla. |
| `--color-border` | `#E4E7EB` | Bordes. |
| `--color-text` | `#1A1A1A` | Texto principal. |
| `--color-text-muted` | `#6B7280` | Texto secundario. |
| `--color-primary` | `#3B82F6` | Acciones principales (botones primarios, links). |
| `--color-primary-hover` | `#2563EB` | :hover. |
| `--color-success` | `#10B981` | Ventas OK, stock OK. |
| `--color-warning` | `#F59E0B` | Stock bajo, alerta. |
| `--color-danger` | `#EF4444` | Errores, validacion, delete. |

### Color (dark theme, override en `[data-theme="dark"]`)

| Token | Valor |
|---|---|
| `--color-bg` | `#0F1419` |
| `--color-surface` | `#1A1D23` |
| `--color-surface-2` | `#252A33` |
| `--color-border` | `#2E333D` |
| `--color-text` | `#E4E7EB` |
| `--color-text-muted` | `#9CA3AF` |
| `--color-primary` | `#60A5FA` |
| `--color-primary-hover` | `#3B82F6` |
| `--color-success` | `#34D399` |
| `--color-warning` | `#FBBF24` |
| `--color-danger` | `#F87171` |

### Tipografia

```css
--font-sans: "Inter", system-ui, -apple-system, sans-serif;
--font-mono: "JetBrains Mono", monospace;

--text-xs: 0.75rem;     /* 12px - helpers */
--text-sm: 0.875rem;    /* 14px - body small, table */
--text-base: 1rem;      /* 16px - body */
--text-lg: 1.125rem;    /* 18px - h4 */
--text-xl: 1.25rem;     /* 20px - h3 */
--text-2xl: 1.5rem;     /* 24px - h2 */
--text-3xl: 1.875rem;   /* 30px - h1 */

--font-normal: 400;
--font-medium: 500;
--font-semibold: 600;
--font-bold: 700;
```

### Spacing (4px base)

```css
--space-1: 0.25rem;   /* 4px  */
--space-2: 0.5rem;    /* 8px  */
--space-3: 0.75rem;   /* 12px */
--space-4: 1rem;      /* 16px */
--space-5: 1.25rem;   /* 20px */
--space-6: 1.5rem;    /* 24px */
--space-8: 2rem;      /* 32px */
--space-10: 2.5rem;   /* 40px */
--space-12: 3rem;     /* 48px */
```

### Radius / sombras

```css
--radius-sm: 0.25rem;
--radius-md: 0.5rem;
--radius-lg: 0.75rem;
--radius-pill: 9999px;

--shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);
--shadow-md: 0 4px 6px rgba(0, 0, 0, 0.1);
--shadow-lg: 0 10px 15px rgba(0, 0, 0, 0.1);
```

### Breakpoints (mobile-first)

| Token | Min-width |
|---|---|
| `--bp-sm` | 640px |
| `--bp-md` | 768px |
| `--bp-lg` | 1024px |
| `--bp-xl` | 1280px |
| `--bp-2xl` | 1536px |

---

## Componentes base

Ubicados en `src/components/common/`. Se reusan en todas las pages.

| Componente | Uso |
|---|---|
| `Button` | Variantes: `primary`, `secondary`, `danger`, `ghost`. |
| `Input` | Con label + error state + helper text. |
| `Select` | Custom (no Radix `Select` directo). |
| `Modal` / `Dialog` | Wrappers de Radix Dialog. |
| `Toast` | Global via `ToastProvider`. |
| `ErrorBoundary` | Wrap top-level en `main.tsx`. |
| `Table` | Render lista paginada con sort + actions. |
| `Pagination` | Numerada o simple prev/next. |
| `Card` | Surface con padding, header opcional. |
| `Badge` | Estado: success, warning, danger, neutral. |

> Radix se usa para low-level (dropdown primitives, tooltip, scroll area); los wrappers en `common/` son los que consume la page.

---

## Patron de pagina

```tsx
// src/pages/<Name>.tsx estructura comun

export default function Products() {
  // 1. State local: query, filters, selection, modal open
  // 2. Effects: fetch on mount + on filter change
  // 3. Handlers
  // 4. Render
  return (
    <div className={styles.page}>
      <header>
        <h1>Productos</h1>
        <Button onClick={openCreate}>Nuevo producto</Button>
      </header>

      <SearchBar value={...} onChange={...} />

      <Table
        columns={[
          { key: 'name', label: 'Nombre' },
          { key: 'price', label: 'Precio', render: formatMoney },
          ...
        ]}
        data={items}
        onRowClick={openEdit}
      />

      <Pagination {...paginationProps} />

      <Modal open={!!editing} onClose={close}>
        <ProductForm initial={editing} onSubmit={onSubmit} />
      </Modal>
    </div>
  );
}
```

> Cada page tiene su propio `*.module.css`. Layouts globales (sidebar, header) viven en `App.tsx` / `App.module.css`.

---

## Estados de UI

### Loading

- Skeleton (filas gris animadas en tables/cards).
- Spinner en botones durante submit.
- `aria-busy="true"` cuando hay fetch en curso.

### Empty

- Ilustracion o icono simple + copy + CTA ("No hay productos, agregar el primero").

### Error

- Inline en formularios junto al campo.
- Toast rojo en errores globales (network, 500).
- Empty states explicativos si el server devuelve `404` o lista vacia con filtro.

### Success

- Toast verde discreto.
- Redireccion despues de create/update/delete.

---

## Form patterns

- Labels **siempre** visibles (no placeholders label-only).
- Boton submit deshabilitado mientras `isSubmitting`.
- Validacion inline con Zod (mensaje por campo).
- Errores del backend (e.g. `"Price must be positive"`) mostrados en el campo correspondiente.

### Ejemplo

```tsx
const form = useForm<FormValues>({
  resolver: zodResolver(productSchema),
  defaultValues: { ... },
});

<Input
  {...form.register('name')}
  error={form.formState.errors.name?.message}
  label="Nombre"
  required
/>
```

---

## Tabla / list pattern

- Columnas configurables via array (key, label, render).
- Sort por columna (click header).
- Paginacion via prop.
- Action por fila via dropdown menu (3 puntos).
- Empty state custom.
- Loading skeleton (filas con opacity 0.5).

---

## Iconografia

- `lucide-react` como set unico. Iconos mas usados: `Search`, `Plus`, `Pencil`, `Trash2`, `ChevronDown`, `X`, `Check`.

---

## Tema oscuro

- Toggle en la header (icono sun/moon).
- Persist en `localStorage` con key `pos.theme`.
- Default: claro.
- Apply via `ThemeProvider` (set `data-theme` en `<html>`).
- `ThemeContext` expone `{ theme, toggle }`.

---

## Accesibilidad (a11y)

| Guideline | Implementación |
|---|---|
| Contraste | Minimo AA. |
| Focus | Visible (outline 2px var(--color-primary)). |
| Tab order | Natural, sin `tabindex` custom. |
| Labels | `<label htmlFor>` en cada input (no solo placeholder). |
| Roles ARIA | Solo donde Radix no los provee. |
| Skip link | "Saltar al contenido" en header. |
| Alt text | En imagenes reales (no iconos puros). |

---

## Layout (App shell)

```
┌─────────────────────────────────────────────────────┐
│  HEADER  [logo] [store name] [theme toggle] [user]  │
├──────────┬──────────────────────────────────────────┤
│          │                                          │
│ SIDEBAR  │  MAIN CONTENT                            │
│  - POS   │  (routed page)                           │
│  - Prod  │                                          │
│  - Sales │                                          │
│  - Inv   │                                          │
│  - Serv  │                                          │
│  - Prov  │                                          │
│  - Users │                                          │
│  - Sett  │                                          │
│          │                                          │
└──────────┴──────────────────────────────────────────┘
```

- Header fijo (top, 56px).
- Sidebar 240px (colapsable a 64px en pantallas chicas).
- Main scroll independiente.

### Layout móvil (<768px)

```
┌─────────────────────────────────────┐
│ [☰]                    [theme]      │  barra superior (50px)
├─────────────────────────────────────┤
│                                     │
│  MAIN CONTENT (routed page)         │
│                                     │
├─────────────────────────────────────┤
│ Vender │ Productos │ Ventas │ …      │  tab bar inferior (52px + safe-area)
└─────────────────────────────────────┘
```

- Sin sidebar: la navegación primaria es la barra inferior de 4 tabs
  (`MobileTabBar`), con el POS siempre primero.
- El resto de los módulos, el tema y el menú de usuario viven en el drawer que
  abre el botón ☰.
- Alto reservado: `--mobile-tabbar-height` (52px) +
  `--mobile-tabbar-offset` (alto + safe-area inferior). Cualquier elemento fijo
  propio de una page (p. ej. la barra "Ir a cobrar" del POS) se apila con
  `bottom: var(--mobile-tabbar-offset)`.

---

## Performance

- Code-split por route: `<Route lazy>` en React Router.
- Image lazy-load.
- `react-window` o virtualizacion en POS product search si >1000 items.
- CSS Modules: bundle pequeño.

---

## No usar

- ❌ Tailwind, styled-components, Emotion.
- ❌ Framer Motion salvo para una transicion critica (drag/drop).
- ❌ Animaciones > 300ms que distraigan en POS (cajero necesita velocidad).
- ❌ Themes custom fuera del token system.
