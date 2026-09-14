import { cn } from "@/lib/utils";
import { BRAND_LOGO_FULL, BRAND_LOGO_ICON, BRAND_NAME } from "@/lib/brand";

/** Horizontal lockup ~3.3:1 after trim */
const FULL_SIZE = {
  xs: "h-7 max-w-[min(100%,150px)]",
  sm: "h-9 max-w-[min(100%,180px)]",
  md: "h-10 max-w-[min(100%,220px)] sm:h-11 sm:max-w-[min(100%,260px)]",
  lg: "h-12 max-w-[min(100%,260px)] sm:h-14 sm:max-w-[min(100%,320px)]",
  xl: "h-16 max-w-[min(100%,300px)] sm:h-[4.5rem] sm:max-w-[min(100%,380px)]",
} as const;

const ICON_SIZE = {
  xs: "h-5 w-5 max-h-5 max-w-5",
  sm: "h-9 w-9 max-h-9 max-w-9",
  md: "h-10 w-10 max-h-10 max-w-10",
  lg: "h-12 w-12 max-h-12 max-w-12",
  xl: "h-16 w-16 max-h-16 max-w-16",
} as const;

export type BrandLogoProps = {
  /** Full horizontal lockup or shield icon only */
  variant?: "full" | "icon";
  size?: keyof typeof FULL_SIZE;
  className?: string;
};

/** Company logo — always object-contain so nothing is cropped. */
export function BrandLogo({ variant = "full", size = "md", className }: BrandLogoProps) {
  const src = variant === "icon" ? BRAND_LOGO_ICON : BRAND_LOGO_FULL;
  return (
    <img
      src={src}
      alt={BRAND_NAME}
      className={cn(
        "block shrink-0 object-contain object-left",
        variant === "icon" ? ICON_SIZE[size] : FULL_SIZE[size],
        className
      )}
      decoding="async"
    />
  );
}
