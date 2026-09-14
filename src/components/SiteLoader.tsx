import { cn } from "@/lib/utils";
import { BrandLogo } from "@/components/brand/BrandLogo";

export type SiteLoaderProps = {
  /** Shown below the logo. Defaults to "Loading..." */
  message?: string;
  /** full = min-h-screen centered; inline = compact block */
  variant?: "full" | "inline";
  className?: string;
};

/**
 * Branded loading indicator — Apna Intern logo with a rotating ring.
 */
export function SiteLoader({ message = "Loading...", variant = "full", className }: SiteLoaderProps) {
  const text = typeof message === "string" && message.trim() ? message.trim() : "Loading...";

  const content = (
    <div className={cn("flex flex-col items-center justify-center gap-5", className)}>
      <div className="relative flex items-center justify-center">
        <div
          className="absolute size-[4.75rem] sm:size-[5.25rem] rounded-full border-[3px] border-transparent border-t-primary border-r-primary/30 animate-spin"
          aria-hidden
        />
        <div className="relative z-10 flex size-[3.75rem] sm:size-[4.25rem] items-center justify-center rounded-full bg-white shadow-md ring-1 ring-slate-100">
          <BrandLogo variant="icon" size="md" />
        </div>
      </div>
      <p className="text-sm font-semibold tracking-wide text-slate-500">{text}</p>
    </div>
  );

  if (variant === "inline") {
    return <div className={cn("py-12", className)}>{content}</div>;
  }

  return (
    <div className={cn("min-h-screen flex items-center justify-center bg-slate-50", className)}>
      {content}
    </div>
  );
}
