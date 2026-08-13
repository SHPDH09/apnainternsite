import { BRAND_LOGO_FULL, BRAND_NAME } from "@/lib/brand";

type Props = {
  /** Logo height on PDF / certificate pages */
  heightMm?: number;
  className?: string;
};

/** Fitted Apna Intern logo for certificates, offer letters, and PDF exports. */
export function DocumentBrandLogo({ heightMm = 14, className }: Props) {
  const maxWidthMm = Math.round(heightMm * 3.35);
  return (
    <img
      src={BRAND_LOGO_FULL}
      alt={BRAND_NAME}
      className={className}
      style={{
        display: "block",
        height: `${heightMm}mm`,
        width: "auto",
        maxWidth: `${maxWidthMm}mm`,
        objectFit: "contain",
      }}
      crossOrigin="anonymous"
      decoding="sync"
    />
  );
}
