"use client";

import { useState } from "react";
import { MonitorSmartphone } from "lucide-react";
import { useI18n } from "@/i18n";

export function MobileWarning() {
  const [dismissed, setDismissed] = useState(false);
  const { t } = useI18n();

  if (dismissed) return null;

  return (
    <div className="md:hidden fixed inset-0 z-100 flex flex-col items-center justify-center gap-6 bg-zinc-950/95 backdrop-blur-sm px-8 text-center">
      <div className="rounded-full bg-zinc-800 p-5">
        <MonitorSmartphone className="h-10 w-10 text-zinc-300" />
      </div>

      <div className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold text-zinc-50">
          {t.mobile.title}
        </h2>
        <p className="text-sm text-zinc-400 leading-relaxed">
          {t.mobile.desc}
        </p>
      </div>

      <button
        onClick={() => setDismissed(true)}
        className="rounded-full bg-zinc-700 px-5 py-2 text-sm font-medium text-zinc-200 hover:bg-zinc-600 transition-colors"
      >
        {t.mobile.continue}
      </button>
    </div>
  );
}
