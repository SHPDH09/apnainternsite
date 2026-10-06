import { useEffect, useMemo, useState } from "react";
import {
  extractBlogMediaAssetId,
  fetchBlogMediaBlobUrl,
  resolveBlogDisplayImageUrl,
} from "@/lib/blogMediaDisplay";

/**
 * Resolve blog cover/inline image URL.
 * RDS assets use POST `blog_get_media` (Cloudflare → Vercel); direct GET works after worker proxy too.
 */
export function useBlogMediaSrc(url: string | null | undefined): string | null {
  const resolved = useMemo(() => resolveBlogDisplayImageUrl(url), [url]);
  const mediaId = useMemo(() => extractBlogMediaAssetId(resolved || url || ""), [resolved, url]);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!mediaId) {
      setBlobUrl(null);
      return;
    }
    let cancelled = false;
    let objectUrl: string | null = null;
    void (async () => {
      const next = await fetchBlogMediaBlobUrl(mediaId);
      if (cancelled) {
        if (next) URL.revokeObjectURL(next);
        return;
      }
      objectUrl = next;
      setBlobUrl(next);
    })();
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [mediaId]);

  if (mediaId) return blobUrl ?? resolved;
  return resolved;
}
