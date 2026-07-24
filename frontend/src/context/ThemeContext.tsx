import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import logoDark from "@/assets/logo_dark.svg";
import logoLight from "@/assets/logo_light.svg";

type Theme = "light" | "dark";

const ThemeContext = createContext<{
  theme: Theme;
  toggle: () => void;
}>({ theme: "dark", toggle: () => {} });

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    const stored = localStorage.getItem("caja-theme");
    return (stored === "light" || stored === "dark") ? stored : "dark";
  });

  useEffect(() => {
    localStorage.setItem("caja-theme", theme);
    document.documentElement.setAttribute("data-theme", theme);

    // Update favicon to match theme
    let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (!link) {
      link = document.createElement("link");
      link.rel = "icon";
      link.type = "image/svg+xml";
      document.head.appendChild(link);
    }
    link.href = theme === "dark" ? logoLight : logoDark;

  }, [theme]);

  const toggle = () => setTheme((t) => (t === "dark" ? "light" : "dark"));

  return (
    <ThemeContext.Provider value={{ theme, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
