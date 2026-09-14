import { cn } from "@/lib/utils";

type HomeSectionHeaderProps = {
  pill?: string;
  title: string;
  description?: string;
  align?: "center" | "left";
  className?: string;
};

export function HomeSectionHeader({
  pill,
  title,
  description,
  align = "center",
  className,
}: HomeSectionHeaderProps) {
  const centered = align === "center";

  return (
    <div
      className={cn(
        "reveal-on-scroll mb-12 max-w-3xl",
        centered ? "mx-auto text-center" : "text-left",
        className
      )}
    >
      {pill ? (
        <span className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#5AA3E6]/25 bg-gradient-to-r from-white to-[#eef6ff] px-4 py-1.5 text-xs font-bold uppercase tracking-[0.14em] text-[#2B7CD3] shadow-sm">
          <span className="size-1.5 rounded-full bg-[#F7941D]" aria-hidden />
          {pill}
        </span>
      ) : null}
      <h2 className="font-display text-3xl font-extrabold tracking-tight text-slate-900 md:text-4xl">
        {title}
      </h2>
      {description ? (
        <p
          className={cn(
            "mt-4 text-base leading-relaxed text-slate-500 md:text-lg",
            centered && "mx-auto max-w-2xl"
          )}
        >
          {description}
        </p>
      ) : null}
      <div
        className={cn(
          "mt-5 h-1 w-16 rounded-full bg-gradient-to-r from-[#2B7CD3] to-[#F7941D]",
          centered && "mx-auto"
        )}
        aria-hidden
      />
    </div>
  );
}
