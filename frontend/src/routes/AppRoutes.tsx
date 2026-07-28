import { Navigate, Route, Routes } from "react-router-dom";
import App from "@/App";
import Auth from "@/pages/auth/Auth";
import Pos from "@/pages/pos/Pos";
import Products from "@/pages/products/Products";
import Services from "@/pages/services/Services";
import Suppliers from "@/pages/suppliers/Suppliers";
import Categories from "@/pages/categories/Categories";
import Inventory from "@/pages/inventory/Inventory";
import Sales from "@/pages/sales/Sales";
import Reports from "@/pages/reports/Reports";
import { NotFound } from "@/pages/not-found/NotFound";
import Settings from "@/pages/settings/Settings";
import Users from "@/pages/users/Users";

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/auth" element={<Auth />} />
      <Route element={<App />}>
        <Route path="/" element={<Navigate to="/pos" replace />} />
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
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
