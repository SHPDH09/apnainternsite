import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/** Premium portal card — matches student-dash-card aesthetic */
export const portalDashCardClass =
  "portal-dash-card relative overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_1px_2px_rgb(15_23_42/0.04)]";

export const portalStatTileClass =
  "portal-stat-tile rounded-lg border border-slate-200 bg-slate-50/80 px-4 py-3";

export const portalNavItemClass = cn(
  "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-slate-600 transition-colors",
  "hover:bg-slate-50 hover:text-slate-900",
  "data-[active=true]:bg-[#5AA3E6]/10 data-[active=true]:text-[#2B7CD3] data-[active=true]:font-semibold"
);

export const portalNavSectionClass =
  "px-3 pb-1.5 pt-5 text-[10px] font-semibold uppercase tracking-wider text-slate-400 first:pt-2";

export function PortalSectionHeader({
  title,
  subtitle,
  countLabel,
  icon: Icon,
  action,
  className,
}: {
  title: string;
  subtitle?: string;
  countLabel?: string;
  icon?: LucideIcon;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mb-6 flex flex-col gap-4 border-b border-slate-200 pb-4 sm:flex-row sm:items-end sm:justify-between",
        className
      )}
    >
      <div className="flex min-w-0 items-start gap-3">
        {Icon ? (
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-100">
            <Icon className="size-4 text-slate-600" />
          </div>
        ) : null}
        <div className="min-w-0">
          <h2 className="text-lg font-semibold tracking-tight text-slate-900 md:text-xl">{title}</h2>
          {subtitle ? <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p> : null}
        </div>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2 self-start sm:self-auto">
        {countLabel ? (
          <Badge variant="outline" className="border-slate-200 bg-white text-[11px] font-medium text-slate-600">
            {countLabel}
          </Badge>
        ) : null}
        {action}
      </div>
    </div>
  );
}

export function PortalPageHero({
  eyebrow,
  title,
  subtitle,
  actions,
  accent = "brand",
}: {
  eyebrow?: string;
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
  accent?: "brand" | "emerald" | "violet";
}) {
  const accentBar =
    accent === "emerald"
      ? "bg-emerald-500"
      : accent === "violet"
        ? "bg-violet-500"
        : "student-dash-hero-accent";

  return (
    <section className="portal-dash-hero relative mb-6 overflow-hidden rounded-xl border border-slate-200 bg-white p-6 md:p-8">
      <div className={cn("absolute bottom-0 left-0 top-0 w-1 rounded-l-xl", accentBar)} />
      <div className="relative flex flex-col gap-4 pl-2 md:flex-row md:items-center md:justify-between md:pl-3">
        <div className="min-w-0">
          {eyebrow ? (
            <p className="mb-1 text-[11px] font-medium uppercase tracking-wider text-slate-500">{eyebrow}</p>
          ) : null}
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 md:text-3xl">{title}</h1>
          {subtitle ? <div className="mt-1.5 text-sm text-slate-500">{subtitle}</div> : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </section>
  );
}

export function PortalStatTile({
  label,
  value,
  hint,
  valueClassName,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  valueClassName?: string;
}) {
  return (
    <div className={portalStatTileClass}>
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className={cn("mt-1 text-xl font-semibold tabular-nums text-slate-900 md:text-2xl", valueClassName)}>
        {value}
      </p>
      {hint ? <p className="mt-0.5 text-[11px] text-slate-400">{hint}</p> : null}
    </div>
  );
}

export function PortalContentCard({
  children,
  className,
  padding = true,
}: {
  children: ReactNode;
  className?: string;
  padding?: boolean;
}) {
  return (
    <div className={cn(portalDashCardClass, padding && "p-5 md:p-6", className)}>{children}</div>
  );
}

export function PortalTableCard({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn(portalDashCardClass, "overflow-hidden", className)}>{children}</div>
  );
}

export function PortalField({ label, value }: { label: string; value?: ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="text-sm font-medium text-slate-900 break-all">{value ?? "—"}</p>
    </div>
  );
}
