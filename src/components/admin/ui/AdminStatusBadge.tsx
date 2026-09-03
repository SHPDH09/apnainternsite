import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const toneClass: Record<string, string> = {
  default: "bg-muted text-muted-foreground border-transparent",
  success: "bg-emerald-50 text-emerald-700 border-emerald-200",
  warning: "bg-amber-50 text-amber-800 border-amber-200",
  danger: "bg-red-50 text-red-700 border-red-200",
  info: "bg-sky-50 text-sky-700 border-sky-200",
  neutral: "bg-slate-100 text-slate-700 border-slate-200",
};

type AdminStatusBadgeProps = {
  children: ReactNode;
  tone?: keyof typeof toneClass;
  className?: string;
};

export function AdminStatusBadge({
  children,
  tone = "default",
  className,
}: AdminStatusBadgeProps) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "rounded-md px-2 py-0.5 text-[11px] font-medium capitalize",
        toneClass[tone],
        className
      )}
    >
      {children}
    </Badge>
  );
}
