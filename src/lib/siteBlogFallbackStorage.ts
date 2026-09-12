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

function isStorageReadUnavailable(error: unknown): boolean {
  const msg = blogErrorText(error);
  return /not found|404|does not exist|not implemented|not_found|storage route not implemented|403|401|forbidden|permission denied/i.test(
    msg
  );
}

async function fetchJsonText(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { cache: "no-store", redirect: "follow" });
    if (res.ok) return await res.text();
    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location")?.trim();
      if (location) {
        const follow = await fetch(location, { cache: "no-store" });
        if (follow.ok) return await follow.text();
      }
    }
  } catch {
    /* try next candidate */
  }
  return null;
}

async function readEnvelope(client: SupabaseClient): Promise<FallbackBlogPost[]> {
  if (typeof window !== "undefined") {
    const origin = window.location.origin.replace(/\/$/, "");
    try {
      const res = await fetch(`${origin}/api/public-blog-posts`, { cache: "no-store" });
      if (res.ok) {
        const json = (await res.json()) as { ok?: boolean; posts?: FallbackBlogPost[] };
        if (json.ok && Array.isArray(json.posts)) return json.posts.map((row) => normalizePost(row));
      }
    } catch {
      /* fall through */
    }
  }

  const candidates: string[] = [];
  if (typeof window !== "undefined") {
    const origin = window.location.origin.replace(/\/$/, "");
    candidates.push(`${origin}/storage/v1/object/public/logos/${FALLBACK_OBJECT_PATH}`);
  }
  const viaHelper = publicStorageObjectUrl("logos", FALLBACK_OBJECT_PATH);
  if (viaHelper && !candidates.includes(viaHelper)) candidates.push(viaHelper);

  const s3Bucket =
    import.meta.env.VITE_S3_BUCKET_LOGOS || "apnaintern-308946946129-staging-logos";
  const s3Region = import.meta.env.VITE_AWS_REGION || "ap-south-1";
  const directS3 = `https://${s3Bucket}.s3.${s3Region}.amazonaws.com/${FALLBACK_OBJECT_PATH}`;
  if (!candidates.includes(directS3)) candidates.push(directS3);

  for (const publicUrl of candidates) {
    const text = await fetchJsonText(publicUrl);
    if (text) {
      const rows = parseEnvelope(text);
      if (rows.length) return rows;
    }
  }

  const { data, error } = await client.storage.from("logos").download(FALLBACK_OBJECT_PATH);
  if (error) {
    if (isStorageReadUnavailable(error)) return [];
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
    if (/bucket not found/i.test(msg)) {
      fallbackReady = false;
      return false;
    }
    // If read fails but upload works, blog CMS can still save via S3 JSON fallback.
    try {
      const probe = new Blob(['{"__apna_site_blog_probe__":true}'], { type: "application/json" });
      const { error } = await client.storage
        .from("logos")
        .upload(`${FALLBACK_OBJECT_PATH}.probe`, probe, { upsert: true, contentType: "application/json" });
      if (!error) {
        await client.storage.from("logos").remove([`${FALLBACK_OBJECT_PATH}.probe`]).catch(() => undefined);
        fallbackReady = true;
        return true;
      }
    } catch {
      /* ignore probe errors */
    }
    fallbackReady = false;
    return false;
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
  if (idx < 0) {
    const title = String(patch.title || "").trim();
    const content = String(patch.content || "").trim();
    if (!title || !content) {
      throw new Error("Blog post not found.");
    }
    await createFallbackBlogPost(client, {
      id,
      title,
      slug: String(patch.slug || slugifyFallbackSlug(title, id)),
      excerpt: patch.excerpt ?? null,
      content,
      cover_image_url: patch.cover_image_url ?? null,
      cover_image_path: patch.cover_image_path ?? null,
      author_name: patch.author_name ?? "Apna Intern",
      post_type: patch.post_type === "vlog" ? "vlog" : "blog",
      status:
        patch.status === "published" || patch.status === "scheduled" ? patch.status : "draft",
      published_at: patch.published_at ?? null,
      scheduled_at: patch.scheduled_at ?? null,
      meta_title: patch.meta_title ?? null,
      meta_description: patch.meta_description ?? null,
      tags: Array.isArray(patch.tags) ? patch.tags : [],
      is_active: patch.is_active !== false,
      is_featured: patch.is_featured === true,
      sort_order: Number(patch.sort_order) || 0,
      created_by: patch.created_by ?? null,
      created_at: patch.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    return;
  }
  rows[idx] = normalizePost({
    ...rows[idx],
    ...patch,
    id,
    updated_at: new Date().toISOString(),
  });
  await writeEnvelope(client, rows);
}

function slugifyFallbackSlug(title: string, id: string): string {
  const base = title
    .trim()
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return base || id.slice(0, 8);
}

export async function findFallbackBlogPostById(
  client: SupabaseClient,
  id: string
): Promise<FallbackBlogPost | null> {
  const rows = await readEnvelope(client);
  return rows.find((r) => r.id === id) || null;
}

export async function deleteFallbackBlogPost(client: SupabaseClient, id: string): Promise<void> {
  const rows = await readEnvelope(client);
  await writeEnvelope(
    client,
    rows.filter((r) => r.id !== id)
  );
}
