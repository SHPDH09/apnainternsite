import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type AdminPageHeaderProps = {
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
};

export function AdminPageHeader({
  title,
  description,
  actions,
  className,
  icon: Icon,
}: AdminPageHeaderProps & { icon?: import("lucide-react").LucideIcon }) {
  return (
    <div
      className={cn(
        "mb-6 flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-4",
        className
      )}
    >
      <div className="flex min-w-0 items-start gap-3">
        {Icon ? (
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-100">
            <Icon className="size-4 text-slate-600" />
          </div>
        ) : null}
        <div className="min-w-0 space-y-1">
          <h1 className="text-lg font-semibold tracking-tight text-slate-900 md:text-xl">{title}</h1>
          {description ? (
            <p className="max-w-2xl text-sm text-slate-500">{description}</p>
          ) : null}
        </div>
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}
