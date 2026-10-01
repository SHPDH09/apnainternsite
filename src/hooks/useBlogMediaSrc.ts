import { useEffect, useState } from "react";
import { extractBlogMediaAssetId, fetchBlogMediaBlobUrl, resolveBlogDisplayImageUrl } from "@/lib/blogMediaDisplay";

/** Public blog images stored in RDS — prefer blob URL from POST blog_get_media. */
export function useBlogMediaSrc(url: string | null | undefined): string | null {
  const staticSrc = resolveBlogDisplayImageUrl(url);
  const mediaId = extractBlogMediaAssetId(url) || extractBlogMediaAssetId(staticSrc);
  const [src, setSrc] = useState<string | null>(staticSrc);

  useEffect(() => {
    if (!mediaId) {
      setSrc(staticSrc);
      return;
    }
    let blobUrl: string | null = null;
    let cancelled = false;
    void (async () => {
      const fromApi = await fetchBlogMediaBlobUrl(mediaId);
      if (cancelled) return;
      if (fromApi) {
        blobUrl = fromApi;
        setSrc(fromApi);
      } else {
        setSrc(staticSrc);
      }
    })();
    return () => {
      cancelled = true;
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [url, mediaId, staticSrc]);

  return src;
}
