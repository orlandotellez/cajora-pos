# Frontend Quality

Convenciones de calidad del codigo del frontend React: lint, format, typecheck, accesibilidad, performance, testing.

---

## ESLint

Configurado en `frontend/eslint.config.js` (flat config nuevo de ESLint 9).

Reglas activas (resumen):

| Regla | Proposito |
|---|---|
| `@typescript-eslint/no-unused-vars` | Sin variables/vars sin usar. |
| `@typescript-eslint/no-explicit-any` | Evitar `any` (usar `unknown` + narrowing). |
| `react-hooks/rules-of-hooks` | Cumple rules of hooks (no condicionales en hooks). |
| `react-hooks/exhaustive-deps` | Effect deps correctas. |
| `react-refresh/only-export-components` | Detecta exports que rompen HMR. |
| `no-console` | Solo permitir `console.warn` / `console.error` (warn en dev). |
| `eqeqeq` | Solo `===` / `!==`. |
| `import/order` | Imports ordenados (libs externas -> internos -> relativos). |

> `pnpm lint` corre esto sobre `src/**/*.{ts,tsx}`.

---

## Prettier

`frontend/.prettierrc`:

```json
{
  "semi": true,
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 100,
  "tabWidth": 2,
  "arrowParens": "always"
}
```

Archivos ignorados en `.prettierignore`: `dist/`, `node_modules/`, `src-tauri/target/`, `*.md` (a veces — ver config).

> `pnpm format` formatea toda la base.

---

## TypeScript (strict)

`frontend/tsconfig.json` + `tsconfig.app.json`:

- `"strict": true`
- `"noUncheckedIndexedAccess": true` (acceder a array[i] devuelve `T | undefined`)
- `"noImplicitOverride": true`
- `"useUnknownInCatchVariables": true`
- `"exactOptionalPropertyTypes": true`
- `"forceConsistentCasingInFileNames": true`
- `paths`: `"@/*": ["src/*"]`

> `pnpm typecheck` (`tsc -b --noEmit`) debe pasar limpio antes de mergear.

---

## Naming

| Concepto | Convención |
|---|---|
| Component | `PascalCase`. |
| Component file | `PascalCase.tsx`. |
| Hook | `use<Thing>.ts`. |
| Util / helper | `camelCase.ts`. |
| API module | `<domain>.ts` (`products.ts`, `auth.ts`). |
| Type / interface | `PascalCase`. Suffix `Dto` para DTOs, `Response`/`Request` para payloads. |
| Enum / union | `PascalCase` para el tipo, `UPPER_SNAKE` para valores si es enum de TS. |
| CSS module | `PascalCase.module.css`. |
| Constante | `UPPER_SNAKE` solo para `const` globales inmutables (e.g. `API_TIMEOUT_MS`). |

---

## Imports

Orden (aplicado por `import/order`):

```ts
// 1. React / libs externas
import { useState } from "react";
import { useForm } from "react-hook-form";

// 2. Internals via @/
import { api } from "@/api/client";
import { Button } from "@/components/common/ui/Button";

// 3. Relativos
import styles from "./Pos.module.css";
import type { SaleItem } from "./types";
```

---

## React patterns

- Function components siempre. No class components.
- Custom hooks para logica reutilizable (`useToast`, `useDebounce`).
- `<Suspense>` para code-split.
- `useMemo` / `useCallback` SOLO si se justifica (regla: mide primero).
- Keys estables en listas (no usar index).
- `event.preventDefault()` explicito en handlers de form.

---

## API patterns

- Siempre via `api/<feature>.ts`, nunca `fetch` directo en pages.
- Try/catch en cada slot de la page:
  ```ts
  try {
    const data = await productsApi.list(params);
    setItems(data.items);
  } catch (err) {
    if (err instanceof ApiError) {
      toast.error(err.message);
    } else {
      toast.error("Error inesperado");
    }
  }
  ```
- No bloquear UI mas de 200ms sin loading state.
- Loading: skeleton o spinner — no ambos.

---

## Error boundaries

- `<ErrorBoundary>` en `main.tsx` envuelve TODAS las routes.
- Cada page error-prone puede tener un sub-boundary si el error es recuperable.
- Error UI: copy amigable + boton "Recargar" + link "Reportar problema".

---

## Accesibilidad (a11y)

- Todos los inputs con `<label htmlFor>` (no solo placeholder).
- Focus visible en todos los interactivos.
- Modals: focus trap (Radix lo da) + closing con ESC.
- Buttons vs links: `<button>` para acciones, `<a>`/`<Link>` para navigation.
- Imagenes con `alt` o `aria-hidden` (iconos puros).
- Contraste: minimo AA (verificable con DevTools).

---

## Performance

| Regla | Implementación |
|---|---|
| Code-split por route | React Router `lazy()`. |
| Imagenes pesadas | `loading="lazy"`. |
| Listas largas (>100 items) | Virtualizar con `react-window` (futuro). |
| Bundle size | Inspeccionar con `vite-bundle-visualizer`. |
| Re-renders | Medir con React DevTools Profiler. |

---

## Mobile / responsive

- Mobile-first CSS.
- Breakpoints en `index.css` via vars (`--bp-sm|md|lg|xl|2xl`); en CSS Modules el
  corte real usado es `max-width: 767px` / `min-width: 768px`.
- Navegación: sidebar en escritorio; en <768px la barra inferior de 4 tabs
  (`MobileTabBar`) + drawer del botón ☰ para el resto del menú.
- El contenido de `main` reserva `var(--mobile-tabbar-offset)` abajo en móvil;
  cualquier barra fija propia de una page se apila con el mismo token.
- Tablas en pantallas chicas: scroll horizontal con `min-width` fijo pero wrapper `overflow-x: auto`.

---

## Tests (planeado)

Estrategia:

| Tipo | Stack | Cubre |
|---|---|---|
| Unit | Vitest + React Testing Library | helpers, hooks, componentes puros. |
| Integration | Vitest + Testing Library | flujos (login, create sale, etc.). |
| E2E | Playwright (futuro) | smoke tests en navegador real. |

> `vitest.config.ts` se creara cuando se arranque la suite. Por ahora, sin tests.

### Convenciones

- Tests en `__tests__/` al lado del archivo, o `*.test.tsx`.
- Tests con descripcion en espanol (`describe("Al renderizar ProductsPage")`).
- Coverage objetivo: 70% en `lib/`, 50% en `api/`, sin minimo en `pages/` (mejor integration).

---

## Performance budgets

| Métrica | Budget |
|---|---|
| Lighthouse Performance | >85 desktop, >70 mobile. |
| First Contentful Paint | <1.5s en dev (3G Fast). |
| Bundle JS inicial | <300kb gzipped. |
| Bundle CSS inicial | <50kb gzipped. |

> Medir con `pnpm build && lighthouse https://localhost:5173`.

---

## Code review checklist

Antes de pedir review, verificar:

- [ ] `pnpm lint` pasa.
- [ ] `pnpm format` aplicado.
- [ ] `pnpm typecheck` pasa.
- [ ] Manual smoke test del flujo cambiado (con backend dev corriendo).
- [ ] Si cambio feature con multi-tenant: probado con 2 stores distintos.
- [ ] Si cambio `AuthContext`: probado login + logout + refresh.
- [ ] Si cambio `api/<feature>.ts`: regenerar tipos.
- [ ] Si cambio CSS: verificar dark mode.
- [ ] Si cambio componente reusable: verificar todas las pages que lo usan.
- [ ] Sin `any`, sin `// @ts-ignore`, sin `console.log`.

---

## Anti-patterns prohibidas

- ❌ `any` (usar `unknown` + narrowing).
- ❌ `useEffect` para derivar estado (usar `useMemo` o computar inline).
- ❌ Mutacion directa de `state` (siempre setter o reducer).
- ❌ `dangerouslySetInnerHTML` sin sanitizar.
- ❌ Inline styles para cosas que puedan vivir en CSS modules.
- ❌ Componentes > 300 lineas — dividir.
- ❌ Logica de negocio en componentes (mover a `lib/` o `api/`).
- ❌ Strings hardcoded para i18n (futuro; hoy solo espanol).
