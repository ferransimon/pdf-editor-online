"use client";

import Link from "next/link";
import { Scissors, Merge, PenLine, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/i18n";

interface ModeSelectorProps {
  onSplit: () => void;
  onMerge: () => void;
  onAnnotate: () => void;
}

export function ModeSelector({ onSplit, onMerge, onAnnotate }: ModeSelectorProps) {
  const { t } = useI18n();
  return (
    <div className="flex min-h-screen items-center justify-center bg-white">
      <div className="flex flex-col items-center gap-10 max-w-xl w-full px-8">
        <div className="flex flex-col items-center gap-2 text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
            PDF Editor
          </h1>
          <p className="text-sm text-zinc-400">
            {t.modeSelector.subtitle}
          </p>
        </div>

        <div className="grid grid-cols-3 gap-4 w-full">
          <ModeCard
            icon={<Scissors className="h-6 w-6" />}
            title={t.modeSelector.split}
            description={t.modeSelector.splitDesc}
            onClick={onSplit}
          />
          <ModeCard
            icon={<Merge className="h-6 w-6" />}
            title={t.modeSelector.merge}
            description={t.modeSelector.mergeDesc}
            onClick={onMerge}
          />
          <ModeCard
            icon={<PenLine className="h-6 w-6" />}
            title={t.modeSelector.annotate}
            description={t.modeSelector.annotateDesc}
            onClick={onAnnotate}
          />
        </div>

        {/* Privacy disclaimer */}
        <div className="flex items-start gap-2.5 rounded-xl border border-zinc-100 bg-zinc-50 px-4 py-3 text-left w-full">
          <ShieldCheck className="h-4 w-4 shrink-0 mt-0.5 text-zinc-400" />
          <p className="text-xs text-zinc-400 leading-relaxed">
            <span className="font-medium text-zinc-500">{t.modeSelector.privacy}</span>{" "}
            {t.modeSelector.privacyDesc}{" "}
            <Link
              href="/privacy"
              className="underline underline-offset-2 hover:text-zinc-600 transition-colors"
            >
              {t.privacy.link}
            </Link>
            .
          </p>
        </div>
      </div>
    </div>
  );
}

function ModeCard({
  icon,
  title,
  description,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex flex-col items-start gap-4 rounded-xl border-2 border-zinc-200 p-6 text-left",
        "transition-all hover:border-zinc-900 hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900"
      )}
    >
      <div className="rounded-lg bg-zinc-100 p-3 text-zinc-700">{icon}</div>
      <div className="flex flex-col gap-1">
        <span className="text-sm font-semibold text-zinc-900">{title}</span>
        <span className="text-xs text-zinc-400 leading-relaxed">
          {description}
        </span>
      </div>
    </button>
  );
}
