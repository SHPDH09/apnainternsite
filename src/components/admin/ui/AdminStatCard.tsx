import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { adminCardClass } from "./adminStyles";

type Trend = {
  value: number;
  label: string;
};

type AdminStatCardProps = {
  label: string;
  value: ReactNode;
  hint?: string;
  icon?: LucideIcon;
  trend?: Trend;
  loading?: boolean;
  className?: string;
};

export function AdminStatCard({
  label,
  value,
  hint,
  icon: Icon,
  trend,
  loading,
  className,
}: AdminStatCardProps) {
  const trendUp = trend ? trend.value >= 0 : null;

  return (
    <div className={cn(adminCardClass, "p-5", className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <div
            className={cn(
              "font-display text-2xl font-semibold tracking-tight text-foreground",
              loading && "animate-pulse text-muted-foreground"
            )}
          >
            {loading ? "—" : value}
          </div>
          {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
          {trend ? (
            <p
              className={cn(
                "text-xs font-medium",
                trendUp ? "text-emerald-600" : "text-red-600"
              )}
            >
              {trendUp ? "+" : ""}
              {trend.value.toFixed(1)}% {trend.label}
            </p>
          ) : null}
        </div>
        {Icon ? (
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Icon className="size-4" aria-hidden />
          </div>
        ) : null}
      </div>
    </div>
  );
}
