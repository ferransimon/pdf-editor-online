"use client";

import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useI18n } from "@/i18n";

interface Section {
  start: number;
  end: number;
}

interface SectionListProps {
  sections: Section[];
  sectionNames: string[];
  activeSection: number;
  onRenameSection: (index: number, name: string) => void;
  onSelectSection: (index: number) => void;
}

export function SectionList({
  sections,
  sectionNames,
  activeSection,
  onRenameSection,
  onSelectSection,
}: SectionListProps) {
  const { t } = useI18n();
  return (
    <div className="flex flex-col h-full border-l border-zinc-200 bg-white w-72 shrink-0">
      <div className="px-4 py-3 border-b border-zinc-200 shrink-0">
        <p className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
          {t.sectionList.sections} ({sections.length})
        </p>
      </div>

      <ScrollArea className="flex-1">
        <div className="flex flex-col p-3 gap-2">
          {sections.map((section, i) => {
            const pageLabel =
              section.start === section.end
                ? `${t.sectionList.pageSingular} ${section.start + 1}`
                : `${t.sectionList.pagePlural} ${section.start + 1}–${section.end + 1}`;

            return (
              <div
                key={i}
                onClick={() => onSelectSection(i)}
                className={cn(
                  "flex flex-col gap-2.5 rounded-lg border p-3 cursor-pointer transition-colors",
                  activeSection === i
                    ? "border-zinc-900 bg-zinc-50"
                    : "border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50"
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-zinc-500">
                    {t.sectionList.section} {i + 1}
                  </span>
                  <Badge>{pageLabel}</Badge>
                </div>
                <Input
                  value={sectionNames[i] ?? ""}
                  onChange={(e) => {
                    e.stopPropagation();
                    onRenameSection(i, e.target.value);
                  }}
                  onClick={(e) => e.stopPropagation()}
                  placeholder={`${t.sectionList.section} ${i + 1}`}
                  className="h-7 text-xs"
                />
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
