"use client";

import { createContext, useContext, useEffect, useState, startTransition } from "react";
import { flushSync } from "react-dom";

type Theme = "light" | "dark";

interface ThemeContextValue {
  theme: Theme;
  toggle: (x?: number, y?: number) => void;
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

  const toggle = (x?: number, y?: number) => {
    // Set CSS custom properties for circle center
    if (x !== undefined && y !== undefined) {
      document.documentElement.style.setProperty("--x", `${x}px`);
      document.documentElement.style.setProperty("--y", `${y}px`);
    }

    const switchTheme = () => {
      flushSync(() => {
        setTheme((prev) => {
          const next = prev === "light" ? "dark" : "light";
          localStorage.setItem("theme", next);
          applyTheme(next);
          return next;
        });
      });
    };

    // Use View Transition API if available
    if (typeof document !== "undefined" && "startViewTransition" in document) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (document as any).startViewTransition(switchTheme);
    } else {
      switchTheme();
    }
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
