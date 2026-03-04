"use client";

import { Scissors, Merge } from "lucide-react";
import { cn } from "@/lib/utils";

interface ModeSelectorProps {
  onSplit: () => void;
  onMerge: () => void;
}

export function ModeSelector({ onSplit, onMerge }: ModeSelectorProps) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-white">
      <div className="flex flex-col items-center gap-10 max-w-lg w-full px-8">
        <div className="flex flex-col items-center gap-2 text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
            PDF Editor
          </h1>
          <p className="text-sm text-zinc-400">
            ¿Qué quieres hacer con tus PDFs?
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4 w-full">
          <ModeCard
            icon={<Scissors className="h-6 w-6" />}
            title="Dividir"
            description="Separa un PDF en múltiples archivos independientes"
            onClick={onSplit}
          />
          <ModeCard
            icon={<Merge className="h-6 w-6" />}
            title="Unir"
            description="Combina varios PDFs en uno y reordena sus páginas"
            onClick={onMerge}
          />
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
