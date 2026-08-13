import { cn } from "@/lib/utils";
import { BRAND_LOGO_FULL, BRAND_LOGO_ICON, BRAND_NAME } from "@/lib/brand";

const HEIGHT = {
  xs: "h-7",
  sm: "h-9",
  md: "h-10 sm:h-11",
  lg: "h-12 sm:h-14",
  xl: "h-16 sm:h-20",
} as const;

export type BrandLogoProps = {
  /** Full horizontal lockup or shield icon only */
  variant?: "full" | "icon";
  size?: keyof typeof HEIGHT;
  className?: string;
};

/** Company logo image — full lockup or shield icon. */
export function BrandLogo({ variant = "full", size = "md", className }: BrandLogoProps) {
  const src = variant === "icon" ? BRAND_LOGO_ICON : BRAND_LOGO_FULL;
  return (
    <img
      src={src}
      alt={BRAND_NAME}
      className={cn(
        "w-auto shrink-0 object-contain",
        variant === "icon" ? "aspect-square" : "",
        HEIGHT[size],
        className
      )}
    />
  );
}
