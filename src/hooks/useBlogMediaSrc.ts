import { useMemo } from "react";
import { resolveBlogDisplayImageUrl } from "@/lib/blogMediaDisplay";

/** Resolve blog cover/inline image URL (GET /api/send-mail?id=… or S3). No POST base64 round-trip. */
export function useBlogMediaSrc(url: string | null | undefined): string | null {
  return useMemo(() => resolveBlogDisplayImageUrl(url), [url]);
}
