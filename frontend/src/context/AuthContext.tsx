import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { authApi, type AuthUser, type Store, type RegisterStorePayload } from "@/api/auth";

const REFRESH_INTERVAL = 14 * 60 * 1000;

interface AuthContextType {
  user: AuthUser | null;
  store: Store | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  registerStore: (data: RegisterStorePayload) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

function getStored<T>(key: string): T | null {
  try {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : null;
  } catch {
    localStorage.removeItem(key);
    return null;
  }
}

function setStored(key: string, value: unknown) {
  if (value) {
    localStorage.setItem(key, JSON.stringify(value));
  } else {
    localStorage.removeItem(key);
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();

  const [user, setUser] = useState<AuthUser | null>(() => getStored<AuthUser>("auth-user"));
  const [store, setStore] = useState<Store | null>(() => getStored<Store>("auth-store"));
  const [loading, setLoading] = useState(true);

  // Persist user & store to localStorage
  useEffect(() => { setStored("auth-user", user); }, [user]);
  useEffect(() => { setStored("auth-store", store); }, [store]);

  useEffect(() => {
    const initialize = async () => {
      const refreshToken = localStorage.getItem("auth-refresh-token");
      if (!refreshToken) {
        setLoading(false);
        return;
      }

      try {
        const res = await authApi.refresh(refreshToken);
        setUser(res.user);
        setStore(res.store);
        localStorage.setItem("auth-token", res.accessToken);
        localStorage.setItem("auth-refresh-token", res.refreshToken);
      } catch (err) {
        console.warn("[Auth] Error al refrescar sesión:", err);
        setUser(null);
        setStore(null);
        localStorage.removeItem("auth-token");
        localStorage.removeItem("auth-refresh-token");
      } finally {
        setLoading(false);
      }
    };

    initialize();
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      const refreshToken = localStorage.getItem("auth-refresh-token");
      if (!refreshToken) return;

      authApi.refresh(refreshToken)
        .then((res) => {
          setUser(res.user);
          setStore(res.store);
          localStorage.setItem("auth-token", res.accessToken);
          localStorage.setItem("auth-refresh-token", res.refreshToken);
        })
        .catch((err) => {
          console.warn("[Auth] Background refresh failed:", err?.status ?? "", err?.message ?? "");
        });
    }, REFRESH_INTERVAL);

    return () => clearInterval(interval);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setLoading(true);
    try {
      const res = await authApi.login({ email, password });
      setUser(res.user);
      setStore(res.store);
      localStorage.setItem("auth-token", res.accessToken);
      localStorage.setItem("auth-refresh-token", res.refreshToken);
      // El super admin va directo al panel global (no tiene tienda).
      navigate(res.user.role === "super_admin" ? "/super-admin" : "/pos");
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  const registerStore = useCallback(async (data: RegisterStorePayload) => {
    setLoading(true);
    try {
      const res = await authApi.registerStore(data);
      setUser(res.user);
      setStore(res.store);
      localStorage.setItem("auth-token", res.accessToken);
      localStorage.setItem("auth-refresh-token", res.refreshToken);
      navigate("/pos");
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  const logout = useCallback(async () => {
    try {
      const refreshToken = localStorage.getItem("auth-refresh-token");
      if (refreshToken) {
        await authApi.logout(refreshToken);
      }
    } catch (err) { console.warn("[Auth] Error al hacer logout:", err); }
    setUser(null);
    setStore(null);
    localStorage.removeItem("auth-token");
    localStorage.removeItem("auth-refresh-token");
    navigate("/auth");
  }, [navigate]);

  return (
    <AuthContext.Provider value={{ user, store, loading, login, logout, registerStore }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
