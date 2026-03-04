"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "./theme-provider";
import { useI18n } from "@/i18n";

export function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const { t } = useI18n();

  return (
    <button
      onClick={toggle}
      title={theme === "dark" ? t.theme.toLight : t.theme.toDark}
      className="fixed bottom-4 right-4 z-50 flex items-center justify-center w-9 h-9 rounded-full bg-zinc-900 text-zinc-50 shadow-lg hover:bg-zinc-700 transition-colors"
    >
      {theme === "dark" ? (
        <Sun className="h-4 w-4" />
      ) : (
        <Moon className="h-4 w-4" />
      )}
    </button>
  );
}
