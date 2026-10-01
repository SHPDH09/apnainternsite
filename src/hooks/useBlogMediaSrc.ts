import { useEffect, useState } from "react";
import { extractBlogMediaAssetId, fetchBlogMediaBlobUrl, resolveBlogDisplayImageUrl } from "@/lib/blogMediaDisplay";

/** Public blog images stored in RDS — load via POST blog_get_media when needed. */
export function useBlogMediaSrc(url: string | null | undefined): string | null {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    const staticSrc = resolveBlogDisplayImageUrl(url);
    const mediaId = extractBlogMediaAssetId(url) || extractBlogMediaAssetId(staticSrc);

    if (!mediaId) {
      setSrc(staticSrc);
      return;
    }

    setSrc(staticSrc);
    let blobUrl: string | null = null;
    let cancelled = false;

    void (async () => {
      const fromApi = await fetchBlogMediaBlobUrl(mediaId);
      if (cancelled) return;
      if (fromApi) {
        blobUrl = fromApi;
        setSrc(fromApi);
      }
    })();

    return () => {
      cancelled = true;
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [url]);

  return src;
}
