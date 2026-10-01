import { apiUrl } from "@/lib/siteApi";
import { extractBlogMediaAssetId, resolveBlogMarkdownAssetUrl } from "@/lib/storageUrl";

/** Load RDS-stored blog image via POST (works when GET /api/send-mail is not deployed yet). */
export async function fetchBlogMediaBlobUrl(mediaId: string): Promise<string | null> {
  if (typeof window === "undefined") return null;
  try {
    const res = await fetch(apiUrl("/api/send-mail"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "blog_get_media", media_id: mediaId }),
    });
    const json = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      content_type?: string;
      data_base64?: string;
      message?: string;
    };
    if (!res.ok || !json.ok || !json.data_base64) return null;
    const binary = atob(json.data_base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const blob = new Blob([bytes], { type: json.content_type || "image/jpeg" });
    return URL.createObjectURL(blob);
  } catch {
    return null;
  }
}

export function resolveBlogDisplayImageUrl(url: string | null | undefined): string | null {
  return resolveBlogMarkdownAssetUrl(url);
}

export { extractBlogMediaAssetId };
