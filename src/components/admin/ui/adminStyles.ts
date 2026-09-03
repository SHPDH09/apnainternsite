import { cn } from "@/lib/utils";

/** Shared admin shell surface — sidebar, header, page canvas */
export const adminSurface = "border-border/60 bg-background";

/** Dark branded sidebar (Apna Intern blue accents) */
export const adminSidebarClass =
  "border-slate-800/80 bg-[#0a101c] text-slate-300 shadow-xl";

/** Primary navigation item — dark sidebar */
export const adminNavItemClass = cn(
  "group flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-[13px] font-medium text-slate-400",
  "transition-all duration-200 hover:bg-white/[0.06] hover:text-slate-100",
  "data-[state=active]:bg-[#5AA3E6]/15 data-[state=active]:text-white data-[state=active]:font-semibold",
  "data-[state=active]:shadow-[inset_0_0_0_1px_rgba(90,163,230,0.35)]",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5AA3E6]/50"
);

export const adminNavButtonClass = cn(
  adminNavItemClass,
  "border-0 bg-transparent shadow-none"
);

/** Section labels in sidebar groups */
export const adminNavSectionClass =
  "px-3 pb-1.5 pt-5 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500 first:pt-2";

/** Standard admin page padding + subtle branded canvas */
export const adminPageClass =
  "flex-1 overflow-y-auto bg-[#f4f7fb] p-4 md:p-6 lg:p-8 admin-page-canvas";

/** Premium content card */
export const adminCardClass = cn(
  "rounded-2xl border border-slate-200/80 bg-white text-card-foreground",
  "shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_rgba(15,23,42,0.06)]"
);

/** Elevated KPI stat card */
export const adminStatCardClass = cn(
  adminCardClass,
  "relative overflow-hidden transition-shadow duration-200 hover:shadow-[0_4px_20px_rgba(15,23,42,0.08)]"
);

/** Table container with consistent padding */
export const adminTableWrapClass = "overflow-x-auto rounded-xl border border-slate-200/80";

/** Branded dashboard hero gradient */
export const adminHeroClass =
  "relative overflow-hidden rounded-2xl border border-[#5AA3E6]/20 bg-gradient-to-br from-[#0f172a] via-[#1e3a5f] to-[#2B7CD3] p-6 text-white shadow-lg md:p-8";
