import type { SupabaseClient } from "@supabase/supabase-js";
import { publicStorageObjectUrl } from "@/lib/storageUrl";

const FALLBACK_MARKER = "__apna_site_blog_v1__";
const FALLBACK_OBJECT_PATH = "blog/cms-posts.json";

export type FallbackBlogPost = {
  id: string;
  title: string;
  slug: string;
  excerpt?: string | null;
  content: string;
  cover_image_url?: string | null;
  cover_image_path?: string | null;
  author_name?: string | null;
  post_type: "blog" | "vlog";
  status: "draft" | "scheduled" | "published";
  published_at?: string | null;
  scheduled_at?: string | null;
  meta_title?: string | null;
  meta_description?: string | null;
  tags?: string[] | null;
  is_active: boolean;
  is_featured: boolean;
  sort_order: number;
  created_by?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type FallbackEnvelope = {
  [FALLBACK_MARKER]?: FallbackBlogPost[];
};

function blogErrorText(error: unknown): string {
  if (error && typeof error === "object") {
    const e = error as { message?: string; details?: string; code?: string };
    return [e.message, e.details, e.code].filter(Boolean).join(" — ");
  }
  return error instanceof Error ? error.message : String(error ?? "");
}

export function isSiteBlogTableMissingError(error: unknown): boolean {
  const msg = blogErrorText(error);
  return (
    /42P01|undefined_table/i.test(msg) ||
    /relation ["']?public\.site_blog_posts["']? does not exist/i.test(msg) ||
    /Could not find the table ['"]public\.site_blog_posts['"]/i.test(msg)
  );
}

let tableAvailable: boolean | null = null;
let fallbackReady: boolean | null = null;

export function resetSiteBlogStorageCache(): void {
  tableAvailable = null;
  fallbackReady = null;
}

export async function siteBlogTableAvailable(client: SupabaseClient): Promise<boolean> {
  if (tableAvailable != null) return tableAvailable;
  const { error } = await client.from("site_blog_posts").select("id").limit(1);
  if (!error) {
    tableAvailable = true;
    return true;
  }
  if (isSiteBlogTableMissingError(error)) {
    tableAvailable = false;
    return false;
  }
  throw error;
}

function normalizePost(raw: FallbackBlogPost): FallbackBlogPost {
  return {
    ...raw,
    post_type: raw.post_type === "vlog" ? "vlog" : "blog",
    status: raw.status === "published" || raw.status === "scheduled" ? raw.status : "draft",
    tags: Array.isArray(raw.tags) ? raw.tags.map((t) => String(t).trim()).filter(Boolean) : [],
    is_active: raw.is_active !== false,
    is_featured: raw.is_featured === true,
    sort_order: Number(raw.sort_order) || 0,
  };
}

function parseEnvelope(text: string): FallbackBlogPost[] {
  const raw = text.trim();
  if (!raw.startsWith("{")) return [];
  try {
    const parsed = JSON.parse(raw) as FallbackEnvelope;
    const rows = parsed[FALLBACK_MARKER];
    if (!Array.isArray(rows)) return [];
    return rows.map((row) => normalizePost(row));
  } catch {
    return [];
  }
}

function toEnvelope(posts: FallbackBlogPost[]): string {
  return JSON.stringify({ [FALLBACK_MARKER]: posts } satisfies FallbackEnvelope);
}

async function readEnvelope(client: SupabaseClient): Promise<FallbackBlogPost[]> {
  const publicUrl = publicStorageObjectUrl("logos", FALLBACK_OBJECT_PATH);
  if (publicUrl) {
    try {
      const res = await fetch(publicUrl, { cache: "no-store" });
      if (res.ok) return parseEnvelope(await res.text());
      if (res.status !== 404) {
        throw new Error(`Blog fallback read failed (HTTP ${res.status})`);
      }
    } catch (err) {
      const msg = blogErrorText(err);
      if (!/failed|404|not found|not implemented|not_found/i.test(msg)) throw err;
    }
  }

  const { data, error } = await client.storage.from("logos").download(FALLBACK_OBJECT_PATH);
  if (error) {
    const msg = error.message || "";
    if (/not found|404|does not exist|not implemented|not_found/i.test(msg)) return [];
    throw error;
  }
  const text = await data.text();
  return parseEnvelope(text);
}

async function writeEnvelope(client: SupabaseClient, posts: FallbackBlogPost[]): Promise<void> {
  const blob = new Blob([toEnvelope(posts)], { type: "application/json" });
  const { error } = await client.storage.from("logos").upload(FALLBACK_OBJECT_PATH, blob, {
    upsert: true,
    contentType: "application/json",
  });
  if (error) throw error;
}

export async function siteBlogFallbackAvailable(client: SupabaseClient): Promise<boolean> {
  if (fallbackReady != null) return fallbackReady;
  try {
    await readEnvelope(client);
    fallbackReady = true;
    return true;
  } catch (err) {
    const msg = blogErrorText(err);
    if (/bucket not found|403|401|permission/i.test(msg)) {
      fallbackReady = false;
      return false;
    }
    fallbackReady = true;
    return true;
  }
}

export async function fetchFallbackAdminBlogPosts(client: SupabaseClient): Promise<FallbackBlogPost[]> {
  const rows = await readEnvelope(client);
  return rows.sort((a, b) => String(b.updated_at || "").localeCompare(String(a.updated_at || "")));
}

export async function fetchFallbackPublicBlogPosts(client: SupabaseClient): Promise<FallbackBlogPost[]> {
  return fetchFallbackAdminBlogPosts(client);
}

export async function createFallbackBlogPost(
  client: SupabaseClient,
  post: FallbackBlogPost
): Promise<FallbackBlogPost> {
  const rows = await readEnvelope(client);
  const next = normalizePost({
    ...post,
    id: post.id || crypto.randomUUID(),
    created_at: post.created_at || new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
  rows.unshift(next);
  await writeEnvelope(client, rows);
  return next;
}

export async function updateFallbackBlogPost(
  client: SupabaseClient,
  id: string,
  patch: Partial<FallbackBlogPost>
): Promise<void> {
  const rows = await readEnvelope(client);
  const idx = rows.findIndex((r) => r.id === id);
  if (idx < 0) throw new Error("Blog post not found.");
  rows[idx] = normalizePost({
    ...rows[idx],
    ...patch,
    id,
    updated_at: new Date().toISOString(),
  });
  await writeEnvelope(client, rows);
}

export async function deleteFallbackBlogPost(client: SupabaseClient, id: string): Promise<void> {
  const rows = await readEnvelope(client);
  await writeEnvelope(
    client,
    rows.filter((r) => r.id !== id)
  );
}
