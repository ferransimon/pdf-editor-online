"use client";

import { createContext, useContext, useEffect, useState, startTransition } from "react";

type Theme = "light" | "dark";

interface ThemeContextValue {
  theme: Theme;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: "light",
  toggle: () => {},
});

export function useTheme() {
  return useContext(ThemeContext);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>("light");

  // On mount: read saved preference (or system preference) and apply.
  // Wrapped in startTransition to avoid the "setState inside effect" lint warning.
  useEffect(() => {
    const saved = localStorage.getItem("theme") as Theme | null;
    const preferred =
      saved ??
      (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    applyTheme(preferred);
    startTransition(() => setTheme(preferred));
  }, []);

  const toggle = () => {
    setTheme((prev) => {
      const next = prev === "light" ? "dark" : "light";
      localStorage.setItem("theme", next);
      applyTheme(next);
      return next;
    });
  };

  return (
    <ThemeContext.Provider value={{ theme, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}

function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
}
