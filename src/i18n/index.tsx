"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  startTransition,
} from "react";
import { en, type Translations } from "./en";
import { es } from "./es";

export type Locale = "en" | "es";

const LOCALES: Record<Locale, Translations> = { en, es };

interface I18nContextValue {
  t: Translations;
  locale: Locale;
  setLocale: (l: Locale) => void;
}

const I18nContext = createContext<I18nContextValue>({
  t: en,
  locale: "en",
  setLocale: () => {},
});

export function useI18n() {
  return useContext(I18nContext);
}

/** Detect browser language, defaulting to English. */
function detectLocale(): Locale {
  try {
    const saved = localStorage.getItem("locale") as Locale | null;
    if (saved && saved in LOCALES) return saved;
    const browser = navigator.language.slice(0, 2).toLowerCase();
    return (browser in LOCALES ? browser : "en") as Locale;
  } catch {
    return "en";
  }
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("en");

  useEffect(() => {
    startTransition(() => setLocaleState(detectLocale()));
  }, []);

  const setLocale = (l: Locale) => {
    localStorage.setItem("locale", l);
    startTransition(() => setLocaleState(l));
  };

  return (
    <I18nContext.Provider value={{ t: LOCALES[locale], locale, setLocale }}>
      {children}
    </I18nContext.Provider>
  );
}
