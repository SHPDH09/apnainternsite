import { cn } from "@/lib/utils";

/** Shared admin shell surface — sidebar, header, page canvas */
export const adminSurface = "border-border/60 bg-background";

/** Primary navigation item (sidebar tabs + external links) */
export const adminNavItemClass = cn(
  "group flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] font-medium text-muted-foreground",
  "transition-colors hover:bg-muted/80 hover:text-foreground",
  "data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:font-semibold",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
);

export const adminNavButtonClass = cn(
  adminNavItemClass,
  "border-0 bg-transparent shadow-none"
);

/** Section labels in sidebar groups */
export const adminNavSectionClass =
  "px-2.5 pb-1 pt-4 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/80 first:pt-1";

/** Standard admin page padding */
export const adminPageClass = "flex-1 overflow-y-auto p-4 md:p-6 lg:p-8";

/** Content card used across admin modules */
export const adminCardClass =
  "rounded-xl border border-border/60 bg-card text-card-foreground shadow-sm";

/** Table container with consistent padding */
export const adminTableWrapClass = "overflow-x-auto rounded-lg border border-border/60";
