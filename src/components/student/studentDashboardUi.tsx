import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export function StudentSectionHeader({
  title,
  subtitle,
  countLabel,
  icon: Icon,
  action,
}: {
  title: string;
  subtitle?: string;
  countLabel?: string;
  icon?: LucideIcon;
  action?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 border-b border-slate-200 pb-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex min-w-0 items-start gap-3">
        {Icon ? (
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-100">
            <Icon className="size-4 text-slate-600" />
          </div>
        ) : null}
        <div className="min-w-0">
          <h2 className="text-lg font-semibold tracking-tight text-slate-900 md:text-xl">{title}</h2>
          {subtitle ? (
            <p className="mt-0.5 max-w-2xl text-sm leading-relaxed text-slate-500">{subtitle}</p>
          ) : null}
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

export function StudentPageHero({
  initial,
  title,
  subtitle,
  actions,
}: {
  initial: string;
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <section className="student-dash-hero relative mb-8 overflow-hidden rounded-xl p-6 md:p-8 student-dash-animate-in">
      <div className="student-dash-hero-accent absolute bottom-0 left-0 top-0 w-1 rounded-l-xl" />
      <div className="relative z-10 flex flex-col gap-6 pl-2 md:flex-row md:items-center md:justify-between md:pl-3">
        <div className="flex min-w-0 items-center gap-4">
          <div className="flex size-14 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-100 text-xl font-semibold text-slate-700 md:size-16">
            {initial}
          </div>
          <div className="min-w-0">
            <p className="mb-1 text-[11px] font-medium uppercase tracking-wider text-slate-500">
              Student portal
            </p>
            <h1 className="truncate text-2xl font-semibold tracking-tight text-slate-900 md:text-3xl">
              {title}
            </h1>
            {subtitle ? <div className="mt-1.5 text-sm text-slate-500">{subtitle}</div> : null}
          </div>
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </section>
  );
}

export function StudentProfileField({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="text-sm font-medium text-slate-900">{value || "—"}</p>
    </div>
  );
}

export function StudentOutlineButton({
  children,
  onClick,
  className = "",
}: {
  children: ReactNode;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      size="default"
      className={`h-10 gap-2 rounded-lg border-slate-300 px-5 font-medium text-slate-800 hover:bg-slate-50 ${className}`}
      onClick={onClick}
    >
      {children}
    </Button>
  );
}

export function StudentPrimaryButton({
  children,
  onClick,
  disabled,
  className = "",
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <Button
      type="button"
      size="default"
      disabled={disabled}
      className={`h-10 gap-2 rounded-lg bg-slate-800 px-5 font-medium hover:bg-slate-900 ${className}`}
      onClick={onClick}
    >
      {children}
    </Button>
  );
}

export function StudentEmptyState({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
}) {
  return (
    <div className="student-dash-card flex flex-col items-center justify-center px-6 py-16 text-center">
      <div className="mb-4 flex size-14 items-center justify-center rounded-full bg-slate-100">
        <Icon className="size-7 text-slate-300" />
      </div>
      <p className="text-sm font-medium text-slate-700">{title}</p>
      {description ? <p className="mt-1 max-w-sm text-xs text-slate-400">{description}</p> : null}
    </div>
  );
}
