import type { ComponentType } from "react";
import {
  ScanBarcode,
  ShoppingBag,
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

export interface NavIconProps {
  className?: string;
  size?: number;
}

export interface NavItem {
  to: string;
  label: string;
  icon: ComponentType<NavIconProps>;
  permission?: Permission;
  end?: boolean;
}

export interface NavGroup {
  label: string;
  adminOnly?: boolean;
  superAdminOnly?: boolean;
  items: NavItem[];
}

export const navGroups: NavGroup[] = [
  {
    label: "PUNTO DE VENTA",
    items: [{ to: "/pos", label: "Venta", icon: ScanBarcode }],
  },
  {
    label: "CATÁLOGO",
    items: [
      { to: "/products", label: "Catálogo", icon: ShoppingBag },
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

export type NavIcon = ComponentType<NavIconProps>;

export function navIconFor(path: string): NavIcon | undefined {
  return navItemByPath.get(path)?.icon;
}

const navItemByPath = new Map<string, NavItem>(
  navGroups.flatMap((group) => group.items.map((item) => [item.to, item] as const)),
);

export interface NavAccess {
  has: (permission: Permission) => boolean;
  cashRegisterEnabled: boolean;
  isAdmin: boolean;
}

export function isNavItemVisible(item: NavItem, access: NavAccess): boolean {
  if (item.permission && !access.has(item.permission)) return false;
  if (item.to === "/cash-register" && !access.cashRegisterEnabled) return false;
  return true;
}

export const MOBILE_TAB_LIMIT = 4;

const MOBILE_TAB_CANDIDATES: { to: string; tabLabel?: string }[] = [
  { to: "/pos", tabLabel: "Vender" },
  { to: "/products" },
  { to: "/sales" },
  { to: "/cash-register" },
  { to: "/inventory" },
  { to: "/clients" },
  { to: "/credits" },
  { to: "/reports" },
  { to: "/settings" },
];

export const ADMIN_MOBILE_TAB_LIMIT = 5;

export interface MobileTab {
  to: string;
  label: string;
  icon: ComponentType<NavIconProps>;
}

export function resolveMobileTabs(
  access: NavAccess,
  limit: number = access.isAdmin ? ADMIN_MOBILE_TAB_LIMIT : MOBILE_TAB_LIMIT,
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
