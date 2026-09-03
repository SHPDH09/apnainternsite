import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { adminCardClass } from "./adminStyles";

type AdminContentCardProps = {
  title?: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  noPadding?: boolean;
  variant?: "default" | "dark";
};

export function AdminContentCard({
  title,
  description,
  action,
  children,
  className,
  bodyClassName,
  noPadding,
  variant = "default",
}: AdminContentCardProps) {
  const hasHeader = title || description || action;
  const isDark = variant === "dark";

  return (
    <section
      className={cn(
        isDark
          ? "rounded-2xl border border-slate-700/50 bg-gradient-to-br from-[#0f172a] to-[#1e293b] text-white shadow-lg"
          : adminCardClass,
        className
      )}
    >
      {hasHeader ? (
        <div
          className={cn(
            "flex flex-wrap items-start justify-between gap-3 px-5 py-4",
            isDark ? "border-b border-white/10" : "border-b border-slate-100"
          )}
        >
          <div className="min-w-0 space-y-0.5">
            {title ? (
              <h2
                className={cn(
                  "font-display text-base font-bold tracking-tight",
                  isDark ? "text-white" : "text-slate-900"
                )}
              >
                {title}
              </h2>
            ) : null}
            {description ? (
              <p className={cn("text-sm", isDark ? "text-slate-400" : "text-slate-500")}>
                {description}
              </p>
            ) : null}
          </div>
          {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
        </div>
      ) : null}
      <div className={cn(!noPadding && "p-5", bodyClassName)}>{children}</div>
    </section>
  );
}
