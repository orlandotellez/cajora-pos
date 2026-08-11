import { lazy } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import App from "@/App";
import { useAuth } from "@/context/AuthContext";
import Auth from "@/pages/auth/Auth";
import Pos from "@/pages/pos/Pos";
import Products from "@/pages/products/Products";
import Inventory from "@/pages/inventory/Inventory";
import Sales from "@/pages/sales/Sales";
import { NotFound } from "@/pages/not-found/NotFound";

// Reports arrastra recharts, así que dividirlo saca esa librería del bundle inicial.
const Reports = lazy(() => import("@/pages/reports/Reports"));
const Settings = lazy(() => import("@/pages/settings/Settings"));
const Users = lazy(() => import("@/pages/users/Users"));
const Services = lazy(() => import("@/pages/services/Services"));
const Suppliers = lazy(() => import("@/pages/suppliers/Suppliers"));
const Categories = lazy(() => import("@/pages/categories/Categories"));
const SuperAdmin = lazy(() => import("@/pages/super-admin/SuperAdmin"));

function HomeRedirect() {
  const { user, loading } = useAuth();
  if (loading) return null;
  return <Navigate to={user?.role === "super_admin" ? "/super-admin" : "/pos"} replace />;
}

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/auth" element={<Auth />} />
      <Route element={<App />}>
        <Route path="/" element={<HomeRedirect />} />
        <Route path="/pos" element={<Pos />} />
        <Route path="/products" element={<Products />} />
        <Route path="/services" element={<Services />} />
        <Route path="/suppliers" element={<Suppliers />} />
        <Route path="/categories" element={<Categories />} />
        <Route path="/inventory" element={<Inventory />} />
        <Route path="/sales" element={<Sales />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/users" element={<Users />} />
        <Route path="/super-admin" element={<SuperAdmin />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
