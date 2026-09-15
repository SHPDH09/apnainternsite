import { cn } from "@/lib/utils";

/** Dark branded sidebar — aligned with Admin panel */
export const staffSidebarClass =
  "border-slate-800/80 bg-[#0a101c] text-slate-300 shadow-xl";

export const staffNavItemClass = cn(
  "group flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-[13px] font-medium text-slate-400",
  "transition-all duration-200 hover:bg-white/[0.06] hover:text-slate-100",
  "data-[active=true]:bg-[#5AA3E6]/15 data-[active=true]:text-white data-[active=true]:font-semibold",
  "data-[active=true]:shadow-[inset_0_0_0_1px_rgba(90,163,230,0.35)]",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5AA3E6]/50"
);

export const staffNavSectionClass =
  "px-3 pb-1.5 pt-5 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500 first:pt-2";

export const staffPageClass =
  "flex-1 overflow-y-auto bg-[#f4f7fb] p-4 md:p-6 lg:p-8 staff-page-canvas";

export const staffStatCardClass = cn(
  "portal-dash-card relative overflow-hidden rounded-xl border border-slate-200 bg-white",
  "shadow-[0_1px_2px_rgb(15_23_42/0.04)] transition-all duration-200",
  "hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-[0_8px_24px_rgba(15,23,42,0.08)]"
);

export const staffHeroClass =
  "relative overflow-hidden rounded-xl border border-slate-200 bg-white p-6 text-slate-900 shadow-[0_1px_3px_rgb(15_23_42/0.04)] md:p-8";
