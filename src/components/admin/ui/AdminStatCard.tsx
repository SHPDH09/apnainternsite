import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { adminStatCardClass } from "./adminStyles";

type Trend = {
  value: number;
  label: string;
};

type Accent = "brand" | "emerald" | "amber" | "violet" | "rose";

const accentStyles: Record<
  Accent,
  { ring: string; icon: string; glow: string; bar: string }
> = {
  brand: {
    ring: "ring-[#5AA3E6]/20",
    icon: "bg-[#5AA3E6]/15 text-[#2B7CD3]",
    glow: "from-[#5AA3E6]/10 to-transparent",
    bar: "bg-[#5AA3E6]",
  },
  emerald: {
    ring: "ring-emerald-500/20",
    icon: "bg-emerald-500/15 text-emerald-600",
    glow: "from-emerald-500/10 to-transparent",
    bar: "bg-emerald-500",
  },
  amber: {
    ring: "ring-amber-500/20",
    icon: "bg-amber-500/15 text-amber-600",
    glow: "from-amber-500/10 to-transparent",
    bar: "bg-amber-500",
  },
  violet: {
    ring: "ring-violet-500/20",
    icon: "bg-violet-500/15 text-violet-600",
    glow: "from-violet-500/10 to-transparent",
    bar: "bg-violet-500",
  },
  rose: {
    ring: "ring-rose-500/20",
    icon: "bg-rose-500/15 text-rose-600",
    glow: "from-rose-500/10 to-transparent",
    bar: "bg-rose-500",
  },
};

type AdminStatCardProps = {
  label: string;
  value: ReactNode;
  hint?: string;
  icon?: LucideIcon;
  trend?: Trend;
  loading?: boolean;
  accent?: Accent;
  className?: string;
};

export function AdminStatCard({
  label,
  value,
  hint,
  icon: Icon,
  trend,
  loading,
  accent = "brand",
  className,
}: AdminStatCardProps) {
  const trendUp = trend ? trend.value >= 0 : null;
  const styles = accentStyles[accent];

  return (
    <div className={cn(adminStatCardClass, "ring-1", styles.ring, className)}>
      <div
        className={cn(
          "pointer-events-none absolute inset-0 bg-gradient-to-br opacity-80",
          styles.glow
        )}
        aria-hidden
      />
      <div className={cn("absolute left-0 top-0 h-full w-1 rounded-l-2xl", styles.bar)} aria-hidden />

      <div className="relative flex items-start justify-between gap-3 p-5">
        <div className="min-w-0 space-y-1.5">
          <p className="text-xs font-medium text-slate-500">{label}</p>
          <div
            className={cn(
              "text-xl font-semibold tabular-nums tracking-tight text-slate-900 md:text-2xl",
              loading && "animate-pulse text-slate-400"
            )}
          >
            {loading ? "—" : value}
          </div>
          {hint ? <p className="text-xs text-slate-500">{hint}</p> : null}
          {trend ? (
            <p
              className={cn(
                "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold",
                trendUp
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-red-50 text-red-700"
              )}
            >
              {trendUp ? "+" : ""}
              {trend.value.toFixed(1)}% {trend.label}
            </p>
          ) : null}
        </div>
        {Icon ? (
          <div
            className={cn(
              "flex size-12 shrink-0 items-center justify-center rounded-2xl",
              styles.icon
            )}
          >
            <Icon className="size-5" aria-hidden />
          </div>
        ) : null}
      </div>
    </div>
  );
}
