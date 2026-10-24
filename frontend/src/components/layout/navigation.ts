import type { ComponentType } from "react";
import {
  ScanBarcode,
  Package,
  Wrench,
  BarChart3,
  Settings,
  Boxes,
  Users,
  Receipt,
  Truck,
  Tag,
  Globe,
  UserCheck,
  DollarSign,
  Wallet,
  CreditCard,
  Store,
  Clock,
} from "lucide-react";
import type { Permission } from "@/api/auth";

/** Props que acepta cualquier icono de lucide usado en la navegación. */
export interface NavIconProps {
  className?: string;
  size?: number;
}

export interface NavItem {
  to: string;
  label: string;
  icon: ComponentType<NavIconProps>;
  /** Si se especifica, el usuario necesita este permiso para ver el ítem. */
  permission?: Permission;
  /**
   * Activo solo en la ruta EXACTA (útil para rutas raíz que son prefijo de
   * otras, p. ej. /super-admin vs /super-admin/stores).
   */
  end?: boolean;
}

export interface NavGroup {
  label: string;
  adminOnly?: boolean;
  superAdminOnly?: boolean;
  items: NavItem[];
}

/**
 * Fuente única de verdad de la navegación: el sidebar de escritorio, el drawer
 * móvil y la barra inferior de tabs salen todos de acá.
 */
export const navGroups: NavGroup[] = [
  {
    label: "PUNTO DE VENTA",
    items: [{ to: "/pos", label: "Venta", icon: ScanBarcode }],
  },
  {
    label: "CATÁLOGO",
    items: [
      { to: "/products", label: "Productos", icon: Package },
      { to: "/services", label: "Servicios", icon: Wrench },
      { to: "/suppliers", label: "Proveedores", icon: Truck, permission: "catalog_write" },
      { to: "/categories", label: "Categorías", icon: Tag, permission: "catalog_write" },
      { to: "/clients", label: "Clientes", icon: UserCheck },
      { to: "/inventory", label: "Inventario", icon: Boxes, permission: "inventory_write" },
    ],
  },
  {
    label: "OPERACIONES",
    items: [
      { to: "/sales", label: "Ventas", icon: Receipt },
      { to: "/credits", label: "Cuentas por Cobrar", icon: DollarSign },
      { to: "/cash-register", label: "Caja", icon: Wallet },
      { to: "/reports", label: "Reportes", icon: BarChart3, permission: "reports" },
    ],
  },
  {
    label: "ADMINISTRACIÓN",
    adminOnly: true,
    items: [
      { to: "/settings", label: "Ajustes", icon: Settings },
      { to: "/users", label: "Usuarios", icon: Users },
    ],
  },
  {
    label: "SUPER ADMIN",
    superAdminOnly: true,
    items: [
      { to: "/super-admin", label: "Panel Global", icon: Globe, end: true },
      { to: "/super-admin/subscriptions", label: "Suscripciones", icon: CreditCard },
      { to: "/super-admin/stores", label: "Tiendas", icon: Store },
      { to: "/super-admin/users", label: "Usuarios", icon: Users },
      { to: "/super-admin/events", label: "Eventos", icon: Clock },
    ],
  },
];

const navItemByPath = new Map<string, NavItem>(
  navGroups.flatMap((group) => group.items.map((item) => [item.to, item] as const)),
);

export interface NavAccess {
  /** Mismo `has` de `usePermissions`. */
  has: (permission: Permission) => boolean;
  /** Módulo de caja opcional (Ajustes → caja). */
  cashRegisterEnabled: boolean;
}

/** Un ítem es visible si el usuario tiene el permiso y el módulo está activo. */
export function isNavItemVisible(item: NavItem, access: NavAccess): boolean {
  if (item.permission && !access.has(item.permission)) return false;
  if (item.to === "/cash-register" && !access.cashRegisterEnabled) return false;
  return true;
}

/** Cuántos tabs entran en la barra inferior móvil. */
export const MOBILE_TAB_LIMIT = 4;

/**
 * Orden de prioridad de los tabs móviles. Se toma el primero que exista y sea
 * visible hasta completar `MOBILE_TAB_LIMIT`, así la barra siempre tiene 4 tabs
 * para cualquier rol y con el módulo de caja activo o desactivado.
 *
 * `/pos`, `/products`, `/sales` y `/clients` no tienen permiso asociado, por lo
 * que los 4 tabs siempre se pueden completar.
 */
const MOBILE_TAB_CANDIDATES: { to: string; tabLabel?: string }[] = [
  { to: "/pos", tabLabel: "Vender" },
  { to: "/products" },
  { to: "/sales" },
  { to: "/cash-register" },
  { to: "/clients" },
  { to: "/inventory" },
  { to: "/credits" },
  { to: "/reports" },
  { to: "/settings" },
];

export interface MobileTab {
  to: string;
  label: string;
  icon: ComponentType<NavIconProps>;
}

export function resolveMobileTabs(
  access: NavAccess,
  limit: number = MOBILE_TAB_LIMIT,
): MobileTab[] {
  const tabs: MobileTab[] = [];
  for (const candidate of MOBILE_TAB_CANDIDATES) {
    const item = navItemByPath.get(candidate.to);
    if (!item || !isNavItemVisible(item, access)) continue;
    tabs.push({
      to: item.to,
      label: candidate.tabLabel ?? item.label,
      icon: item.icon,
    });
    if (tabs.length === limit) break;
  }
  return tabs;
}
