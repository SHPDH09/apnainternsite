import type { ReactNode } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { AdminContentCard } from "./AdminContentCard";
import { adminTableWrapClass } from "./adminStyles";

type AdminTableShellProps = {
  title?: string;
  description?: string;
  actions?: ReactNode;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  filters?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  empty?: boolean;
  emptyMessage?: string;
  className?: string;
};

export function AdminTableShell({
  title,
  description,
  actions,
  searchValue,
  onSearchChange,
  searchPlaceholder = "Search records…",
  filters,
  footer,
  children,
  empty,
  emptyMessage = "No records found.",
  className,
}: AdminTableShellProps) {
  const showToolbar = onSearchChange || filters;

  return (
    <AdminContentCard
      title={title}
      description={description}
      action={actions}
      className={className}
      noPadding
      bodyClassName="p-0"
    >
      {showToolbar ? (
        <div className="flex flex-col gap-3 border-b border-border/60 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          {onSearchChange ? (
            <div className="relative w-full sm:max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchValue ?? ""}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder={searchPlaceholder}
                className="h-9 pl-9"
                aria-label={searchPlaceholder}
              />
            </div>
          ) : (
            <div />
          )}
          {filters ? (
            <div className="flex flex-wrap items-center gap-2">{filters}</div>
          ) : null}
        </div>
      ) : null}

      {empty ? (
        <div className="flex min-h-[12rem] flex-col items-center justify-center gap-2 px-5 py-12 text-center">
          <p className="text-sm font-medium text-muted-foreground">{emptyMessage}</p>
        </div>
      ) : (
        <div className={cn(adminTableWrapClass, "border-0 rounded-none")}>{children}</div>
      )}

      {footer ? (
        <div className="border-t border-border/60 px-5 py-3">{footer}</div>
      ) : null}
    </AdminContentCard>
  );
}
