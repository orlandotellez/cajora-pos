import { useAuth } from "@/context/AuthContext";
import type { Permission } from "@/api/auth";

const ALWAYS_ALLOWED: Permission[] = [
  "catalog_read",
  "inventory_read",
];

export function usePermissions() {
  const { user } = useAuth();

  const isAdmin = user?.role === "admin" || user?.role === "super_admin";
  const userPermissions: Permission[] = user?.permissions ?? [];

  function has(permission: Permission): boolean {
    if (isAdmin) return true;
    if (ALWAYS_ALLOWED.includes(permission)) return true;
    return userPermissions.includes(permission);
  }

  function hasAll(...permissions: Permission[]): boolean {
    return permissions.every((p) => has(p));
  }

  function hasAny(...permissions: Permission[]): boolean {
    return permissions.some((p) => has(p));
  }

  function getGranted(): Permission[] {
    if (isAdmin) {
      return [
        "catalog_read",
        "catalog_write",
        "inventory_read",
        "inventory_write",
        "reports",
        "settings",
        "users",
      ];
    }
    const granted = new Set<Permission>(ALWAYS_ALLOWED);
    for (const p of userPermissions) {
      granted.add(p);
    }
    return [...granted];
  }

  return { has, hasAll, hasAny, getGranted, isAdmin };
}
