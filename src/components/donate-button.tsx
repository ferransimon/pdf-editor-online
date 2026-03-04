"use client";

import { Heart } from "lucide-react";
import { useI18n } from "@/i18n";

export function DonateButton() {
  const { t } = useI18n();
  return (
    <a
      href="https://ko-fi.com/nomisdev"
      target="_blank"
      rel="noopener noreferrer"
      className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-1.5 rounded-full bg-zinc-900 px-4 py-2 text-xs font-medium text-zinc-50 shadow-md transition-colors hover:bg-[#ff5e5b]"
    >
      <Heart className="h-3.5 w-3.5 animate-pulse text-[#ff5e5b]" />
      {t.donate.label}
    </a>
  );
}
