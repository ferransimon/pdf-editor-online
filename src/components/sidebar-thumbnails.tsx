"use client";

import { Scissors } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useI18n } from "@/i18n";

interface Section {
  start: number;
  end: number;
}

interface SidebarThumbnailsProps {
  thumbnails: string[];
  splitPoints: Set<number>;
  activeSection: number;
  sections: Section[];
  onToggleSplit: (index: number) => void;
  onSelectSection: (index: number) => void;
}

export function SidebarThumbnails({
  thumbnails,
  splitPoints,
  activeSection,
  sections,
  onToggleSplit,
  onSelectSection,
}: SidebarThumbnailsProps) {
  const { t } = useI18n();
  const getSectionIndex = (pageIdx: number) =>
    sections.findIndex((s) => pageIdx >= s.start && pageIdx <= s.end);

  return (
    <div className="flex flex-col h-full border-r border-zinc-200 bg-white w-56 shrink-0">
      <div className="px-4 py-3 border-b border-zinc-200 shrink-0">
        <p className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
          {t.sidebar.pages(thumbnails.length)}
        </p>
      </div>

      <ScrollArea className="flex-1">
        <div className="flex flex-col p-2">
          {thumbnails.map((src, idx) => {
            const sectionIdx = getSectionIndex(idx);
            const isActive = sectionIdx === activeSection;
            const hasSplitBefore = splitPoints.has(idx);

            return (
              <div key={idx} className="flex flex-col">
                {/* Split divider between pages */}
                {idx > 0 && (
                  <button
                    onClick={() => onToggleSplit(idx)}
                    className={cn(
                      "group relative flex items-center justify-center h-6 mx-2 my-0.5 rounded transition-all",
                      hasSplitBefore
                        ? "bg-zinc-900"
                        : "hover:bg-zinc-100"
                    )}
                    title={hasSplitBefore ? t.sidebar.removeSplit : t.sidebar.splitHere}
                  >
                    {hasSplitBefore ? (
                      <div className="flex items-center gap-1.5 px-2">
                        <Scissors className="h-3 w-3 text-white shrink-0" />
                        <div className="h-px flex-1 bg-white/40" />
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 px-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Scissors className="h-3 w-3 text-zinc-400 shrink-0" />
                        <span className="text-[10px] text-zinc-400 leading-none">
                          {t.sidebar.splitHere}
                        </span>
                      </div>
                    )}
                  </button>
                )}

                {/* Page thumbnail */}
                <button
                  onClick={() => onSelectSection(sectionIdx)}
                  className={cn(
                    "flex flex-col items-center gap-1 p-1.5 rounded-lg transition-colors w-full",
                    isActive ? "bg-zinc-100" : "hover:bg-zinc-50"
                  )}
                >
                  <div
                    className={cn(
                      "w-full rounded overflow-hidden border-2 transition-colors",
                      isActive ? "border-zinc-900" : "border-zinc-200"
                    )}
                  >
                    {src ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={src}
                        alt={t.sidebar.pageAlt(idx + 1)}
                        className="w-full h-auto block"
                      />
                    ) : (
                      <div className="w-full aspect-3/4 bg-zinc-100 animate-pulse" />
                    )}
                  </div>
                  <span className="text-[10px] text-zinc-400 leading-none">
                    {idx + 1}
                  </span>
                </button>
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
