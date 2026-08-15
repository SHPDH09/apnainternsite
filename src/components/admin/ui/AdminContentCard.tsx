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
};

export function AdminContentCard({
  title,
  description,
  action,
  children,
  className,
  bodyClassName,
  noPadding,
}: AdminContentCardProps) {
  const hasHeader = title || description || action;

  return (
    <section className={cn(adminCardClass, className)}>
      {hasHeader ? (
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border/60 px-5 py-4">
          <div className="min-w-0 space-y-0.5">
            {title ? (
              <h2 className="font-display text-base font-semibold tracking-tight text-foreground">
                {title}
              </h2>
            ) : null}
            {description ? (
              <p className="text-sm text-muted-foreground">{description}</p>
            ) : null}
          </div>
          {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
        </div>
      ) : null}
      <div className={cn(!noPadding && "p-5", bodyClassName)}>{children}</div>
    </section>
  );
}
