import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveSupabaseAnonKey, resolveSupabaseUrl } from "@/lib/supabaseEnv";
import {
  publicStorageObjectUrl,
  resolveBlogMarkdownAssetUrl,
  resolveStorageUrl,
  rewriteBlogMarkdownImageUrls,
} from "@/lib/storageUrl";
import {
  createFallbackBlogPost,
  deleteFallbackBlogPost,
  fetchFallbackAdminBlogPosts,
  fetchFallbackPublicBlogPosts,
  findFallbackBlogPostById,
  isSiteBlogTableMissingError,
  siteBlogFallbackAvailable,
  siteBlogTableAvailable,
  resetSiteBlogStorageCache,
  setSiteBlogTableAvailableKnown,
  updateFallbackBlogPost,
} from "@/lib/siteBlogFallbackStorage";

const BLOG_BUCKET = "logos";
/** Matches server BLOG_IMAGE_VERCEL_MAX_BYTES — base64 must fit Vercel request limits. */
const MAX_IMAGE_BYTES = 3_300_000;

function blogErrorText(error: unknown): string {
  if (error && typeof error === "object") {
    const e = error as { message?: string; details?: string; hint?: string; code?: string };
    return [e.message, e.details, e.hint, e.code].filter(Boolean).join(" — ");
  }
  return error instanceof Error ? error.message : String(error ?? "");
}

export function isSiteBlogTableMissing(error: unknown): boolean {
  return isSiteBlogTableMissingError(error);
}

export function formatSiteBlogError(error: unknown): string {
  if (isSiteBlogTableMissing(error)) {
    return "Blog table is not ready yet — saving to cloud storage instead. Retry if Save fails.";
  }
  const msg = blogErrorText(error);
  if (/row-level security|42501/i.test(msg)) {
    return "Permission denied — sign out, sign in again as admin, then retry Save.";
  }
  if (/foreign key|23503/i.test(msg) && /created_by/i.test(msg)) {
    return "Could not link author record. Retry Save — this has been fixed server-side.";
  }
  if (/duplicate key|23505/i.test(msg) && /slug/i.test(msg)) {
    return "This URL slug is already used. Change the slug and save again.";
  }
  if (/DATABASE_URL|ensure-blog-cms|503|Lambda blog bootstrap/i.test(msg)) {
    return "Blog cloud storage is unavailable. Check your connection and retry Save.";
  }
  return msg || "Blog save failed.";
}

/** Ensure blog storage — RDS table preferred; S3 JSON fallback when table bootstrap unavailable. */
export async function ensureSiteBlogStorage(client: SupabaseClient): Promise<void> {
  if (await siteBlogTableAvailable(client)) return;

  // S3 JSON fallback works without RDS bootstrap — use it when available.
  resetSiteBlogStorageCache();
  if (await siteBlogFallbackAvailable(client)) return;

  const { data: sessionData } = await client.auth.getSession();
  const token = sessionData.session?.access_token?.trim();
  const origin =
    typeof window !== "undefined" ? window.location.origin.replace(/\/$/, "") : "";

  const bootstrapErrors: string[] = [];

  const recheckTable = async (): Promise<boolean> => {
    resetSiteBlogStorageCache();
    return siteBlogTableAvailable(client);
  };

  if (token) {
    try {
      const { error } = await client.rpc("admin_ensure_site_cms_tables");
      if (!error) {
        await new Promise((r) => setTimeout(r, 500));
        if (await recheckTable()) return;
      } else {
        bootstrapErrors.push(blogErrorText(error));
      }
    } catch (err) {
      bootstrapErrors.push(err instanceof Error ? err.message : String(err));
    }
  }

  if (token && typeof fetch !== "undefined") {
    for (const [label, url, body] of [
      ["ensure-blog-cms", `${origin}/api/ensure-blog-cms`, undefined],
      [
        "send-mail ensure_blog_cms",
        `${origin}/api/send-mail`,
        JSON.stringify({ action: "ensure_blog_cms" }),
      ],
    ] as const) {
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          ...(body ? { body } : {}),
        });
        if (res.ok) {
          await new Promise((r) => setTimeout(r, 600));
          if (await recheckTable()) return;
        } else {
          const json = (await res.json().catch(() => ({}))) as { message?: string };
          bootstrapErrors.push(json.message || `${label} HTTP ${res.status}`);
        }
      } catch (err) {
        bootstrapErrors.push(err instanceof Error ? err.message : String(err));
      }
    }
  }

  if (await recheckTable()) return;
  resetSiteBlogStorageCache();
  if (await siteBlogFallbackAvailable(client)) return;

  throw new Error(
    bootstrapErrors.join("; ") ||
      "Blog storage is unavailable. Retry Save in a moment."
  );
}

async function withBlogStorageRetry<T>(
  client: SupabaseClient,
  run: () => Promise<T>
): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      if (attempt > 0) {
        await ensureSiteBlogStorage(client);
        await new Promise((r) => setTimeout(r, 600 * attempt));
      }
      return await run();
    } catch (err) {
      lastErr = err;
      if (!isSiteBlogTableMissing(err)) throw err;
      await ensureSiteBlogStorage(client);
    }
  }
  throw lastErr;
}

export type BlogPostStatus = "draft" | "scheduled" | "published";
export type BlogPostType = "blog" | "vlog";

export type SiteBlogPost = {
  id: string;
  title: string;
  slug: string;
  excerpt?: string | null;
  content: string;
  cover_image_url?: string | null;
  cover_image_path?: string | null;
  author_name?: string | null;
  post_type: BlogPostType;
  status: BlogPostStatus;
  published_at?: string | null;
  scheduled_at?: string | null;
  meta_title?: string | null;
  meta_description?: string | null;
  tags?: string[] | null;
  is_active: boolean;
  is_featured: boolean;
  sort_order: number;
  view_count?: number;
  created_by?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type SiteBlogPostInput = {
  title: string;
  slug?: string;
  excerpt?: string | null;
  content: string;
  author_name?: string | null;
  post_type?: BlogPostType;
  status?: BlogPostStatus;
  published_at?: string | null;
  scheduled_at?: string | null;
  meta_title?: string | null;
  meta_description?: string | null;
  tags?: string[] | null;
  is_active?: boolean;
  is_featured?: boolean;
  sort_order?: number;
};

/** Listing cards — omit full body to keep /rest GET reliable on slow networks. */
const BLOG_SELECT_LIST_PUBLIC =
  "id, title, slug, excerpt, cover_image_url, cover_image_path, author_name, post_type, status, published_at, scheduled_at, meta_title, meta_description, tags, is_active, is_featured, sort_order, created_by, created_at, updated_at";

const BLOG_SELECT_LEGACY =
  `${BLOG_SELECT_LIST_PUBLIC}, content`;

const BLOG_SELECT =
  `${BLOG_SELECT_LEGACY.slice(0, BLOG_SELECT_LEGACY.indexOf(", created_by"))}, view_count, created_by, created_at, updated_at`;

function isMissingBlogViewCountColumn(error: unknown): boolean {
  const msg = blogErrorText(error);
  if (/view_count/i.test(msg) && /column|does not exist|42703/i.test(msg)) return true;
  if (error && typeof error === "object" && (error as { code?: string }).code === "42703") {
    return /view_count/i.test(msg);
  }
  return false;
}

function attachDefaultViewCount<T extends SiteBlogPost | SiteBlogPost[] | null>(data: T): T {
  if (!data) return data;
  if (Array.isArray(data)) {
    return (data as SiteBlogPost[]).map((row) => ({ ...row, view_count: row.view_count ?? 0 })) as T;
  }
  if (typeof data === "object") {
    return { ...(data as SiteBlogPost), view_count: (data as SiteBlogPost).view_count ?? 0 } as T;
  }
  return data;
}

/** Public RDS reads: legacy columns first (production RDS may lack view_count). */
async function runBlogSelectQuery<T extends SiteBlogPost | SiteBlogPost[] | null>(
  client: SupabaseClient,
  build: (columns: string) => PromiseLike<{ data: T; error: unknown | null }>
): Promise<{ data: T; error: unknown | null }> {
  let { data, error } = await build(BLOG_SELECT_LEGACY);
  if (!error) {
    return { data: attachDefaultViewCount(data), error: null };
  }

  if (error && isMissingBlogViewCountColumn(error)) {
    ({ data, error } = await build(BLOG_SELECT_LEGACY));
    if (!error) return { data: attachDefaultViewCount(data), error: null };
  }

  ({ data, error } = await build(BLOG_SELECT));
  if (error && isMissingBlogViewCountColumn(error)) {
    ({ data, error } = await build(BLOG_SELECT_LEGACY));
  }
  if (!error && data) {
    return { data: attachDefaultViewCount(data), error: null };
  }
  return { data, error };
}

function normalizeTags(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map((t) => String(t).trim()).filter(Boolean);
  return [];
}

function mapCoverUrl(row: SiteBlogPost): SiteBlogPost {
  const fromPath =
    row.cover_image_path != null && String(row.cover_image_path).trim() !== ""
      ? publicStorageObjectUrl(BLOG_BUCKET, String(row.cover_image_path))
      : null;
  return {
    ...row,
    tags: normalizeTags(row.tags),
    cover_image_url:
      fromPath ||
      (row.cover_image_url ? resolveStorageUrl(row.cover_image_url) || row.cover_image_url : null),
  };
}

function mapPublicBlogPost(row: SiteBlogPost): SiteBlogPost {
  const mapped = mapCoverUrl(row);
  const coverRaw = mapped.cover_image_url || row.cover_image_url;
  return {
    ...mapped,
    content: rewriteBlogMarkdownImageUrls(mapped.content),
    cover_image_url: coverRaw
      ? resolveBlogMarkdownAssetUrl(coverRaw) || resolveStorageUrl(coverRaw) || coverRaw
      : null,
  };
}

function sortBlogPosts(rows: SiteBlogPost[]): SiteBlogPost[] {
  return [...rows].sort((a, b) => {
    const featured = Number(b.is_featured) - Number(a.is_featured);
    if (featured !== 0) return featured;
    const sort = (a.sort_order ?? 0) - (b.sort_order ?? 0);
    if (sort !== 0) return sort;
    const pub = String(b.published_at || b.scheduled_at || b.created_at || "").localeCompare(
      String(a.published_at || a.scheduled_at || a.created_at || "")
    );
    if (pub !== 0) return pub;
    return String(b.created_at || "").localeCompare(String(a.created_at || ""));
  });
}

function blogInstantMs(value: unknown): number | null {
  if (value == null || value === "") return null;
  const t = new Date(typeof value === "string" || typeof value === "number" ? value : String(value)).getTime();
  return Number.isFinite(t) ? t : null;
}

/** Whether a post should appear on the public site right now. */
export function isBlogPostPublic(post: SiteBlogPost, now: Date = new Date()): boolean {
  const nowDate = now instanceof Date && !Number.isNaN(now.getTime()) ? now : new Date();
  if (post.is_active === false || post.is_active === "false") return false;
  const status = String(post.status || "").toLowerCase();
  if (status === "draft") return false;
  if (!status && post.is_active !== false) {
    const pub = blogInstantMs(post.published_at);
    if (pub != null && pub <= nowDate.getTime()) return true;
  }
  const ts = nowDate.getTime();
  if (status === "scheduled") {
    const at = blogInstantMs(post.scheduled_at);
    if (at == null) return false;
    return at <= ts;
  }
  if (status === "published") {
    const pub = blogInstantMs(post.published_at);
    if (pub != null && pub > ts) return false;
    return true;
  }
  return false;
}

export function slugifyBlogTitle(title: string): string {
  return title
    .trim()
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function estimateReadMinutes(content?: string | null): number {
  const words = String(content ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 200));
}

async function ensureUniqueSlug(
  client: SupabaseClient,
  baseSlug: string,
  excludeId?: string
): Promise<string> {
  let slug = baseSlug || "post";
  let suffix = 0;
  while (suffix < 100) {
    const candidate = suffix === 0 ? slug : `${slug}-${suffix}`;
    if (!(await siteBlogTableAvailable(client))) {
      const rows = await fetchFallbackAdminBlogPosts(client);
      if (!rows.some((r) => r.slug === candidate && r.id !== excludeId)) return candidate;
    } else {
      let query = client.from("site_blog_posts").select("id").eq("slug", candidate).limit(1);
      if (excludeId) query = query.neq("id", excludeId);
      const { data, error } = await query;
      if (error) throw error;
      if (!data?.length) return candidate;
    }
    suffix += 1;
  }
  return `${slug}-${Date.now()}`;
}

function applyPublicBlogListOpts(
  rows: SiteBlogPost[],
  opts?: { featuredOnly?: boolean; limit?: number; postType?: BlogPostType }
): SiteBlogPost[] {
  let out = rows;
  if (opts?.featuredOnly) out = out.filter((p) => p.is_featured);
  if (opts?.postType) out = out.filter((p) => p.post_type === opts.postType);
  if (opts?.limit && opts.limit > 0) out = out.slice(0, opts.limit);
  return out;
}

/** Reliable public read when supabase-js select fails (e.g. missing view_count on RDS). */
async function fetchPublicBlogPostsViaDirectRest(
  opts?: { featuredOnly?: boolean; postType?: BlogPostType }
): Promise<SiteBlogPost[]> {
  if (typeof window === "undefined") return [];
  const base = resolveSupabaseUrl().replace(/\/$/, "");
  if (!base) return [];

  const buildParams = (cacheBust: boolean) => {
    const params = new URLSearchParams({
      select: BLOG_SELECT_LIST_PUBLIC,
      is_active: "eq.true",
      status: "in.(published,scheduled)",
    });
    if (opts?.featuredOnly) params.set("is_featured", "eq.true");
    if (opts?.postType) params.set("post_type", `eq.${opts.postType}`);
    if (cacheBust) params.set("_", String(Date.now()));
    return params;
  };

  const key = resolveSupabaseAnonKey();
  const parseRows = async (res: Response): Promise<SiteBlogPost[]> => {
    if (res.status === 304) return [];
    if (!res.ok) return [];
    const data = (await res.json()) as SiteBlogPost[] | { message?: string };
    if (!Array.isArray(data)) return [];
    return sortBlogPosts(
      data.map((row) => mapCoverUrl({ ...row, view_count: row.view_count ?? 0 }))
    ).filter((post) => isBlogPostPublic(post));
  };

  const headers = {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Cache-Control": "no-cache",
    Pragma: "no-cache",
  };

  try {
    for (const cacheBust of [false, true]) {
      const res = await fetch(`${base}/rest/v1/site_blog_posts?${buildParams(cacheBust).toString()}`, {
        cache: "no-store",
        headers,
      });
      const rows = await parseRows(res);
      if (rows.length > 0) return rows;
    }
    return [];
  } catch {
    return [];
  }
}

async function loadPublicBlogFallbackRows(client: SupabaseClient): Promise<SiteBlogPost[]> {
  try {
    return sortBlogPosts((await fetchFallbackPublicBlogPosts(client)).map(mapCoverUrl)).filter(
      (post) => isBlogPostPublic(post)
    );
  } catch {
    return [];
  }
}

/** Read published posts from RDS without admin bootstrap or stale "table missing" cache. */
async function queryPublicBlogPostsFromRds(
  client: SupabaseClient,
  opts?: { featuredOnly?: boolean; postType?: BlogPostType }
): Promise<{ rows: SiteBlogPost[] } | { missingTable: true } | null> {
  try {
    const filters = opts;
    const listColumns = BLOG_SELECT_LIST_PUBLIC;
    const { data, error } = await runBlogSelectQuery(client, (columns) => {
      const cols = columns.includes("content") ? listColumns : columns;
      let query = client.from("site_blog_posts").select(cols).eq("is_active", true);
      if (filters?.featuredOnly) query = query.eq("is_featured", true);
      if (filters?.postType) query = query.eq("post_type", filters.postType);
      return query;
    });
    if (error) {
      if (isSiteBlogTableMissing(error)) {
        setSiteBlogTableAvailableKnown(false);
        return { missingTable: true };
      }
      return null;
    }
    setSiteBlogTableAvailableKnown(true);
    const rows = sortBlogPosts(((data || []) as SiteBlogPost[]).map(mapCoverUrl)).filter((post) =>
      isBlogPostPublic(post)
    );
    return { rows };
  } catch {
    return null;
  }
}

export async function fetchPublicBlogPosts(
  client: SupabaseClient,
  opts?: { featuredOnly?: boolean; limit?: number; postType?: BlogPostType }
): Promise<SiteBlogPost[]> {
  try {
    resetSiteBlogStorageCache();

    const directRows = await fetchPublicBlogPostsViaDirectRest(opts);
    if (directRows.length > 0) {
      const fallbackRows = await loadPublicBlogFallbackRows(client);
      const rds = await queryPublicBlogPostsFromRds(client, opts);
      const rdsRows = rds && "rows" in rds ? rds.rows : [];
      return applyPublicBlogListOpts(
        mergeBlogPostsById(directRows, rdsRows, fallbackRows),
        opts
      );
    }

    const fallbackRows = await loadPublicBlogFallbackRows(client);
    const rds = await queryPublicBlogPostsFromRds(client, opts);
    if (rds && "rows" in rds) {
      return applyPublicBlogListOpts(
        mergeBlogPostsById(fallbackRows, rds.rows),
        opts
      );
    }

    if (rds && "missingTable" in rds) {
      return applyPublicBlogListOpts(fallbackRows, opts);
    }

    resetSiteBlogStorageCache();
    const retryDirect = await fetchPublicBlogPostsViaDirectRest(opts);
    if (retryDirect.length > 0) {
      return applyPublicBlogListOpts(retryDirect, opts);
    }

    return applyPublicBlogListOpts(fallbackRows, opts);
  } catch (err) {
    console.warn("[fetchPublicBlogPosts]", err);
    const direct = await fetchPublicBlogPostsViaDirectRest(opts).catch(() => [] as SiteBlogPost[]);
    return applyPublicBlogListOpts(direct, opts);
  }
}

function findPublicBlogPostInFallback(
  client: SupabaseClient,
  normalizedSlug: string
): Promise<SiteBlogPost | null> {
  return fetchFallbackPublicBlogPosts(client)
    .then((rows) =>
      rows
        .map(mapPublicBlogPost)
        .find((p) => p.slug.toLowerCase() === normalizedSlug) ?? null
    )
    .then((post) => (post && isBlogPostPublic(post) ? post : null))
    .catch(() => null);
}

async function fetchPublicBlogPostBySlugViaDirectRest(normalizedSlug: string): Promise<SiteBlogPost | null> {
  if (typeof window === "undefined") return null;
  const base = resolveSupabaseUrl().replace(/\/$/, "");
  if (!base) return null;

  const params = new URLSearchParams({
    select: BLOG_SELECT_LEGACY,
    is_active: "eq.true",
    slug: `eq.${normalizedSlug}`,
    limit: "1",
  });
  const key = resolveSupabaseAnonKey();
  try {
    const res = await fetch(`${base}/rest/v1/site_blog_posts?${params.toString()}`, {
      cache: "no-store",
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as SiteBlogPost[];
    if (!Array.isArray(data) || !data[0]) return null;
    const post = mapPublicBlogPost({ ...data[0], view_count: data[0].view_count ?? 0 });
    return isBlogPostPublic(post) ? post : null;
  } catch {
    return null;
  }
}

export async function fetchPublicBlogPostBySlug(
  client: SupabaseClient,
  slug: string
): Promise<SiteBlogPost | null> {
  const normalized = slug.trim().toLowerCase();
  if (!normalized) return null;

  resetSiteBlogStorageCache();

  const directPost = await fetchPublicBlogPostBySlugViaDirectRest(normalized);
  if (directPost) return directPost;

  const { data, error } = await runBlogSelectQuery(client, (columns) =>
    client.from("site_blog_posts").select(columns).eq("is_active", true).eq("slug", normalized).maybeSingle()
  );

  if (!error && data) {
    setSiteBlogTableAvailableKnown(true);
    const post = mapPublicBlogPost(data as SiteBlogPost);
    if (isBlogPostPublic(post)) return post;
  } else if (error && isSiteBlogTableMissing(error)) {
    setSiteBlogTableAvailableKnown(false);
  }

  const fromFallback = await findPublicBlogPostInFallback(client, normalized);
  if (fromFallback) return fromFallback;

  if (!error && !data) return null;

  if (error && !isSiteBlogTableMissing(error)) {
    resetSiteBlogStorageCache();
    const { data: retryData, error: retryErr } = await runBlogSelectQuery(client, (columns) =>
      client
        .from("site_blog_posts")
        .select(columns)
        .eq("is_active", true)
        .eq("slug", normalized)
        .maybeSingle()
    );
    if (!retryErr && retryData) {
      const post = mapPublicBlogPost(retryData as SiteBlogPost);
      if (isBlogPostPublic(post)) return post;
    }
  }

  return null;
}

async function locateBlogPost(
  client: SupabaseClient,
  id: string
): Promise<"rds" | "fallback" | null> {
  resetSiteBlogStorageCache();
  if (await siteBlogTableAvailable(client)) {
    const { data, error } = await client.from("site_blog_posts").select("id").eq("id", id).maybeSingle();
    if (error && !isSiteBlogTableMissing(error)) throw error;
    if (data?.id) return "rds";
  }
  const fallback = await findFallbackBlogPostById(client, id);
  if (fallback) return "fallback";
  return null;
}

async function fetchRdsAdminBlogPosts(client: SupabaseClient): Promise<SiteBlogPost[]> {
  const { data, error } = await withBlogStorageRetry(client, () =>
    client.from("site_blog_posts").select("*").order("updated_at", { ascending: false })
  );
  if (error) throw error;
  return ((data || []) as SiteBlogPost[]).map(mapCoverUrl);
}

function mergeBlogPostsById(...groups: SiteBlogPost[][]): SiteBlogPost[] {
  const byId = new Map<string, SiteBlogPost>();
  for (const group of groups) {
    for (const row of group) {
      const existing = byId.get(row.id);
      if (!existing) {
        byId.set(row.id, row);
        continue;
      }
      const existingTs = new Date(existing.updated_at || existing.created_at || 0).getTime();
      const nextTs = new Date(row.updated_at || row.created_at || 0).getTime();
      if (nextTs >= existingTs) byId.set(row.id, row);
    }
  }
  return sortBlogPosts([...byId.values()]);
}

export async function fetchAdminBlogPosts(client: SupabaseClient): Promise<SiteBlogPost[]> {
  await ensureSiteBlogStorage(client);

  const fallbackRows = sortBlogPosts((await fetchFallbackAdminBlogPosts(client)).map(mapCoverUrl));
  if (!(await siteBlogTableAvailable(client))) {
    return fallbackRows;
  }

  try {
    const rdsRows = await fetchRdsAdminBlogPosts(client);
    return mergeBlogPostsById(fallbackRows, rdsRows);
  } catch (err) {
    if (isSiteBlogTableMissing(err)) {
      resetSiteBlogStorageCache();
      return fallbackRows;
    }
    throw err;
  }
}

function resolvePublishFields(input: SiteBlogPostInput): {
  status: BlogPostStatus;
  published_at: string | null;
  scheduled_at: string | null;
} {
  const status = input.status || "draft";
  if (status === "published") {
    return {
      status: "published",
      published_at: input.published_at || new Date().toISOString(),
      scheduled_at: null,
    };
  }
  if (status === "scheduled") {
    return {
      status: "scheduled",
      published_at: null,
      scheduled_at: input.scheduled_at || null,
    };
  }
  return { status: "draft", published_at: null, scheduled_at: null };
}

export async function createBlogPost(
  client: SupabaseClient,
  _createdBy: string,
  input: SiteBlogPostInput
): Promise<SiteBlogPost> {
  const title = input.title.trim();
  if (!title) throw new Error("Title is required.");
  const content = input.content.trim();
  if (!content) throw new Error("Content is required.");

  const baseSlug = slugifyBlogTitle(input.slug?.trim() || title);
  const slug = await ensureUniqueSlug(client, baseSlug);
  const now = new Date().toISOString();
  const publish = resolvePublishFields(input);

  await ensureSiteBlogStorage(client);

  if (!(await siteBlogTableAvailable(client))) {
    const created = await createFallbackBlogPost(client, {
      id: crypto.randomUUID(),
      title,
      slug,
      excerpt: input.excerpt?.trim() || null,
      content,
      author_name: input.author_name?.trim() || "Apna Intern",
      post_type: input.post_type || "blog",
      status: publish.status,
      published_at: publish.published_at,
      scheduled_at: publish.scheduled_at,
      meta_title: input.meta_title?.trim() || null,
      meta_description: input.meta_description?.trim() || null,
      tags: normalizeTags(input.tags),
      is_active: input.is_active !== false,
      is_featured: input.is_featured === true,
      sort_order: input.sort_order ?? 0,
      created_by: null,
      created_at: now,
      updated_at: now,
    });
    return mapCoverUrl(created);
  }

  const { data, error } = await withBlogStorageRetry(client, () =>
    client
      .from("site_blog_posts")
      .insert({
        title,
        slug,
        excerpt: input.excerpt?.trim() || null,
        content,
        author_name: input.author_name?.trim() || "Apna Intern",
        post_type: input.post_type || "blog",
        status: publish.status,
        published_at: publish.published_at,
        scheduled_at: publish.scheduled_at,
        meta_title: input.meta_title?.trim() || null,
        meta_description: input.meta_description?.trim() || null,
        tags: normalizeTags(input.tags),
        is_active: input.is_active !== false,
        is_featured: input.is_featured === true,
        sort_order: input.sort_order ?? 0,
        // Plain uuid column (no FK) — avoids save failures when auth.users row is absent.
        created_by: null,
        updated_at: now,
      })
      .select("*")
      .single()
  );

  if (error) throw error;
  return mapCoverUrl(data as SiteBlogPost);
}

export async function updateBlogPost(
  client: SupabaseClient,
  id: string,
  patch: Partial<SiteBlogPostInput> & {
    cover_image_url?: string | null;
    cover_image_path?: string | null;
  }
): Promise<void> {
  const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (patch.title !== undefined) payload.title = patch.title.trim();
  if (patch.excerpt !== undefined) payload.excerpt = patch.excerpt?.trim() || null;
  if (patch.content !== undefined) payload.content = patch.content.trim();
  if (patch.author_name !== undefined) payload.author_name = patch.author_name?.trim() || null;
  if (patch.post_type !== undefined) payload.post_type = patch.post_type;
  if (patch.meta_title !== undefined) payload.meta_title = patch.meta_title?.trim() || null;
  if (patch.meta_description !== undefined) payload.meta_description = patch.meta_description?.trim() || null;
  if (patch.tags !== undefined) payload.tags = normalizeTags(patch.tags);
  if (patch.is_active !== undefined) payload.is_active = patch.is_active;
  if (patch.is_featured !== undefined) payload.is_featured = patch.is_featured;
  if (patch.sort_order !== undefined) payload.sort_order = patch.sort_order;
  if (patch.cover_image_url !== undefined) payload.cover_image_url = patch.cover_image_url;
  if (patch.cover_image_path !== undefined) payload.cover_image_path = patch.cover_image_path;

  if (patch.status !== undefined) {
    const publish = resolvePublishFields({
      ...patch,
      title: patch.title || "",
      content: patch.content || "x",
      status: patch.status,
    });
    payload.status = publish.status;
    payload.published_at = publish.published_at;
    payload.scheduled_at = publish.scheduled_at;
  } else {
    if (patch.published_at !== undefined) payload.published_at = patch.published_at;
    if (patch.scheduled_at !== undefined) payload.scheduled_at = patch.scheduled_at;
  }

  if (patch.slug !== undefined || patch.title !== undefined) {
    const base = slugifyBlogTitle(patch.slug?.trim() || String(patch.title || ""));
    if (base) payload.slug = await ensureUniqueSlug(client, base, id);
  }

  await ensureSiteBlogStorage(client);

  const location = await locateBlogPost(client, id);
  const fallbackPatch = payload as Partial<SiteBlogPost>;

  if (location === "fallback") {
    await updateFallbackBlogPost(client, id, fallbackPatch);
    return;
  }

  if (location === "rds") {
    const { data, error } = await withBlogStorageRetry(client, () =>
      client.from("site_blog_posts").update(payload).eq("id", id).select("id").maybeSingle()
    );
    if (error) throw error;
    if (data?.id) return;
    // Post disappeared from RDS — fall back to cloud JSON if present.
    if (await findFallbackBlogPostById(client, id)) {
      await updateFallbackBlogPost(client, id, fallbackPatch);
      return;
    }
    throw new Error("Blog post not found.");
  }

  if (!(await siteBlogTableAvailable(client))) {
    await updateFallbackBlogPost(client, id, fallbackPatch);
    return;
  }

  const { data, error } = await withBlogStorageRetry(client, () =>
    client.from("site_blog_posts").update(payload).eq("id", id).select("id").maybeSingle()
  );
  if (error) {
    if (isSiteBlogTableMissing(error)) {
      resetSiteBlogStorageCache();
      await updateFallbackBlogPost(client, id, fallbackPatch);
      return;
    }
    throw error;
  }
  if (data?.id) return;

  if (await findFallbackBlogPostById(client, id)) {
    await updateFallbackBlogPost(client, id, fallbackPatch);
    return;
  }

  if (fallbackPatch.title && fallbackPatch.content) {
    await updateFallbackBlogPost(client, id, fallbackPatch);
    return;
  }

  throw new Error("Blog post not found. Save as draft first, then publish.");
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Could not read image file."));
    reader.readAsDataURL(file);
  });
}

/** Vercel + S3 direct upload — Lambda /storage often returns 503 in production. */
async function uploadBlogImageViaAdminApi(
  client: SupabaseClient,
  postId: string,
  file: File,
  subfolder: "cover" | "content"
): Promise<{ url: string; path: string }> {
  if (typeof window === "undefined" || typeof fetch === "undefined") {
    throw new Error("Image upload is only available in the browser.");
  }

  const { data: sessionData } = await client.auth.getSession();
  const token = sessionData.session?.access_token?.trim();
  if (!token) {
    throw new Error("Sign in as admin to upload images.");
  }

  const origin = window.location.origin.replace(/\/$/, "");
  const image_base64 = await readFileAsDataUrl(file);
  const res = await fetch(`${origin}/api/send-mail`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      action: "blog_upload_image",
      post_id: postId,
      subfolder,
      file_name: file.name,
      content_type: file.type || "image/jpeg",
      image_base64,
    }),
  });
  const rawText = await res.text().catch(() => "");
  let json: {
    ok?: boolean;
    url?: string;
    path?: string;
    message?: string;
    error?: string;
  } = {};
  try {
    json = rawText ? (JSON.parse(rawText) as typeof json) : {};
  } catch {
    /* non-JSON (e.g. Vercel FUNCTION_INVOCATION_FAILED) */
  }
  const serverMsg = String(json.message || json.error || "").trim();
  if (res.status === 401 || res.status === 403) {
    throw new Error(serverMsg || "Sign in as admin to upload images.");
  }
  if (!res.ok || !json.ok || !json.url || !json.path) {
    if (/FUNCTION_INVOCATION_FAILED/i.test(rawText)) {
      throw new Error(
        "Image upload service failed to start on the server. Deploy the latest fix or retry in a minute."
      );
    }
    const msg =
      serverMsg ||
      (res.status === 503
        ? "Image upload service is temporarily unavailable. Retry in a moment."
        : `Image upload failed (${res.status}).`);
    throw new Error(msg);
  }
  return { url: json.url, path: json.path };
}

async function uploadBlogImage(
  client: SupabaseClient,
  postId: string,
  file: File,
  subfolder: "cover" | "content"
): Promise<{ url: string; path: string }> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Please upload an image file (JPG, PNG, WebP, etc.).");
  }
  if (file.size > MAX_IMAGE_BYTES) {
    throw new Error("Image must be about 3 MB or smaller (compress if needed).");
  }

  return uploadBlogImageViaAdminApi(client, postId, file, subfolder);
}

export async function uploadBlogCoverImage(
  client: SupabaseClient,
  postId: string,
  file: File
): Promise<{ cover_image_url: string; cover_image_path: string }> {
  const { url, path } = await uploadBlogImage(client, postId, file, "cover");
  await updateBlogPost(client, postId, { cover_image_url: url, cover_image_path: path });
  return { cover_image_url: url, cover_image_path: path };
}

/** Upload inline image for markdown body — returns public URL to insert as ![alt](url). */
export async function uploadBlogContentImage(
  client: SupabaseClient,
  postId: string,
  file: File
): Promise<string> {
  const { url } = await uploadBlogImage(client, postId, file, "content");
  return url;
}

export async function deleteBlogPost(client: SupabaseClient, row: SiteBlogPost): Promise<void> {
  if (row.cover_image_path) {
    await client.storage.from(BLOG_BUCKET).remove([row.cover_image_path]);
  }
  await ensureSiteBlogStorage(client);

  const location = await locateBlogPost(client, row.id);
  if (location === "fallback" || location === null) {
    try {
      await deleteFallbackBlogPost(client, row.id);
    } catch {
      /* ignore missing fallback row */
    }
  }
  if (location === "rds" || location === null) {
    if (await siteBlogTableAvailable(client)) {
      const { error } = await withBlogStorageRetry(client, () =>
        client.from("site_blog_posts").delete().eq("id", row.id)
      );
      if (error && !isSiteBlogTableMissing(error)) throw error;
    }
  }
}

export function formatBlogViewCount(value?: number | null): string {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n) || n <= 0) return "0";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (n >= 10_000) return `${Math.round(n / 1000)}k`;
  if (n >= 1_000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k`;
  return String(Math.floor(n));
}

export function formatBlogDate(value?: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function blogStatusLabel(status: BlogPostStatus): string {
  switch (status) {
    case "published":
      return "Published";
    case "scheduled":
      return "Scheduled";
    default:
      return "Draft";
  }
}
