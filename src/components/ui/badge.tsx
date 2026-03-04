import * as React from "react";
import { cn } from "@/lib/utils";

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "outline";
}

function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center rounded px-2 py-0.5 text-xs font-medium",
        variant === "default" && "bg-zinc-100 text-zinc-600",
        variant === "outline" && "border border-zinc-200 text-zinc-600",
        className
      )}
      {...props}
    />
  );
}

export { Badge };
