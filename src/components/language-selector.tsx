"use client";

import { useI18n, type Locale } from "@/i18n";

const LOCALES: { value: Locale; label: string }[] = [
  { value: "en", label: "EN" },
  { value: "es", label: "ES" },
];

export function LanguageSelector() {
  const { locale, setLocale } = useI18n();

  return (
    <div className="fixed bottom-4 right-[4.5rem] z-50 flex items-center gap-0.5 rounded-full bg-zinc-900 px-1 py-1 shadow-md">
      {LOCALES.map(({ value, label }) => (
        <button
          key={value}
          onClick={() => setLocale(value)}
          className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors ${
            locale === value
              ? "bg-white text-zinc-900"
              : "text-zinc-400 hover:text-zinc-200"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
