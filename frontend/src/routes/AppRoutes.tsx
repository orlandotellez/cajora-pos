import { Navigate, Route, Routes } from "react-router-dom";
import App from "@/App";
import Auth from "@/pages/Auth";
import Pos from "@/pages/Pos";
import Products from "@/pages/Products";
import Services from "@/pages/Services";
import Suppliers from "@/pages/Suppliers";
import Inventory from "@/pages/Inventory";
import Sales from "@/pages/Sales";
import Reports from "@/pages/Reports";
import Settings from "@/pages/Settings";
import Users from "@/pages/Users";
import Categories from "@/pages/Categories";
import { NotFound } from "@/pages/NotFound";

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
