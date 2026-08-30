import { lazy } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import App from "@/App";
import { useAuth } from "@/context/AuthContext";
import { useSettingsStore } from "@/store/settingsStore";
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
const Clients = lazy(() => import("@/pages/clients/Clients"));
const Credits = lazy(() => import("@/pages/credits/Credits"));
const CashRegister = lazy(() => import("@/pages/cash-register/CashRegister"));
const SuperAdminLayout = lazy(() => import("@/pages/super-admin/SuperAdminLayout"));
const SuperAdminOverview = lazy(() => import("@/pages/super-admin/Overview"));
const SuperAdminSubscriptions = lazy(() => import("@/pages/super-admin/Subscriptions"));
const SuperAdminStores = lazy(() => import("@/pages/super-admin/Stores"));
const SuperAdminUsers = lazy(() => import("@/pages/super-admin/AllUsers"));
const SuperAdminEvents = lazy(() => import("@/pages/super-admin/Events"));
const Subscription = lazy(() => import("@/pages/subscription/Subscription"));

function HomeRedirect() {
  const { user, loading } = useAuth();
  if (loading) return null;
  return <Navigate to={user?.role === "super_admin" ? "/super-admin" : "/pos"} replace />;
}

function CashRegisterRoute() {
  const cashRegisterEnabled = useSettingsStore((s) => s.cashRegisterEnabled);
  if (!cashRegisterEnabled) return <Navigate to="/pos" replace />;
  return <CashRegister />;
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
        <Route path="/clients" element={<Clients />} />
        <Route path="/credits" element={<Credits />} />
        <Route path="/cash-register" element={<CashRegisterRoute />} />
        <Route path="/inventory" element={<Inventory />} />
        <Route path="/sales" element={<Sales />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/subscription" element={<Subscription />} />
        <Route path="/users" element={<Users />} />
        <Route path="/super-admin" element={<SuperAdminLayout />}>
          <Route index element={<SuperAdminOverview />} />
          <Route path="subscriptions" element={<SuperAdminSubscriptions />} />
          <Route path="stores" element={<SuperAdminStores />} />
          <Route path="users" element={<SuperAdminUsers />} />
          <Route path="events" element={<SuperAdminEvents />} />
        </Route>
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
