import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchSupabaseTablePage } from "@/lib/fetchAllSupabaseRows";

function isBlogLeadsTableMissing(error: unknown): boolean {
  const msg =
    error && typeof error === "object"
      ? [(error as { message?: string }).message, (error as { code?: string }).code]
          .filter(Boolean)
          .join(" ")
      : error instanceof Error
        ? error.message
        : String(error ?? "");
  return (
    /42P01|undefined_table|PGRST205/i.test(msg) ||
    (/site_blog_leads/i.test(msg) && /does not exist|Could not find/i.test(msg))
  );
}

export type AdminBlogLeadRow = {
  id: string;
  post_id?: string | null;
  post_slug?: string | null;
  post_title?: string | null;
  full_name: string;
  email: string;
  phone: string;
  college_name?: string | null;
  created_at?: string | null;
};

const LEAD_COLUMNS =
  "id,post_id,post_slug,post_title,full_name,email,phone,college_name,created_at";

const LEADS_API_TIMEOUT_MS = 14_000;

async function fetchWithTimeout(url: string, init: RequestInit, ms: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function leadsQueryString(opts: {
  page: number;
  pageSize: number;
  phoneSearch?: string;
  textSearch?: string;
  dateFrom?: string;
  dateTo?: string;
  exportAll?: boolean;
}): string {
  const params = new URLSearchParams();
  params.set("page", String(opts.page));
  params.set("pageSize", String(opts.pageSize));
  if (opts.phoneSearch?.trim()) params.set("phoneSearch", opts.phoneSearch.trim());
  if (opts.textSearch?.trim()) params.set("textSearch", opts.textSearch.trim());
  if (opts.dateFrom) params.set("dateFrom", opts.dateFrom);
  if (opts.dateTo) params.set("dateTo", opts.dateTo);
  if (opts.exportAll) params.set("export", "1");
  return params.toString();
}

async function fetchAdminBlogLeadsViaApi(
  accessToken: string,
  opts: {
    page: number;
    pageSize: number;
    phoneSearch?: string;
    textSearch?: string;
    dateFrom?: string;
    dateTo?: string;
    exportAll?: boolean;
  }
): Promise<{ rows: AdminBlogLeadRow[]; total: number } | null> {
  if (typeof window === "undefined") return null;
  const origin = window.location.origin.replace(/\/$/, "");
  const qs = leadsQueryString(opts);
  const res = await fetchWithTimeout(`${origin}/api/admin-blog-leads?${qs}`, {
    method: "GET",
    headers: { Authorization: `Bearer ${accessToken}` },
  }, LEADS_API_TIMEOUT_MS);
  if (!res.ok) return null;
  const json = (await res.json().catch(() => null)) as {
    ok?: boolean;
    data?: AdminBlogLeadRow[];
    total?: number;
  } | null;
  if (!json?.ok || !Array.isArray(json.data)) return null;
  return { rows: json.data, total: json.total ?? json.data.length };
}

export async function fetchAdminBlogLeadsPage(
  client: SupabaseClient,
  opts: {
    page: number;
    pageSize: number;
    phoneSearch?: string;
    textSearch?: string;
    dateFrom?: string;
    dateTo?: string;
  }
): Promise<{ rows: AdminBlogLeadRow[]; total: number }> {
  const pageSize = Math.max(1, Math.min(opts.pageSize, 100));
  const page = Math.max(0, opts.page);

  const { data: sessionData } = await client.auth.getSession();
  const token = sessionData.session?.access_token?.trim();
  if (token) {
    try {
      const viaApi = await fetchAdminBlogLeadsViaApi(token, { ...opts, page, pageSize });
      if (viaApi) return viaApi;
    } catch (err) {
      console.warn("[blogLeadsAdmin] API load failed:", err);
    }
  }

  try {
    return await fetchSupabaseTablePage<AdminBlogLeadRow>(client, "site_blog_leads", {
      page,
      pageSize,
      select: LEAD_COLUMNS,
      orderBy: "created_at",
      ascending: false,
      modify: (q) => applyBlogLeadFilters(q, opts),
    });
  } catch (firstErr) {
    if (isBlogLeadsTableMissing(firstErr)) {
      return { rows: [], total: 0 };
    }
    console.warn("[blogLeadsAdmin] paginated load failed, retrying simple select:", firstErr);
    const from = page * pageSize;
    const to = from + pageSize - 1;
    const { data, error, count } = await client
      .from("site_blog_leads")
      .select(LEAD_COLUMNS, { count: "exact" })
      .order("created_at", { ascending: false })
      .range(from, to);
    if (error) {
      if (isBlogLeadsTableMissing(error)) return { rows: [], total: 0 };
      throw error;
    }
    let rows = (data || []) as AdminBlogLeadRow[];
    rows = applyBlogLeadFiltersClientSide(rows, opts);
    return { rows, total: count ?? rows.length };
  }
}

/** CSV export — prefers single RDS API call. */
export async function fetchAllAdminBlogLeads(
  client: SupabaseClient,
  filters?: {
    phoneSearch?: string;
    textSearch?: string;
    dateFrom?: string;
    dateTo?: string;
  }
): Promise<AdminBlogLeadRow[]> {
  const { data: sessionData } = await client.auth.getSession();
  const token = sessionData.session?.access_token?.trim();
  if (token) {
    try {
      const viaApi = await fetchAdminBlogLeadsViaApi(token, {
        page: 0,
        pageSize: 15_000,
        exportAll: true,
        ...filters,
      });
      if (viaApi) return viaApi.rows;
    } catch {
      /* REST fallback below */
    }
  }

  const { fetchAllSupabaseRows } = await import("@/lib/fetchAllSupabaseRows");
  return fetchAllSupabaseRows<AdminBlogLeadRow>(client, "site_blog_leads", {
    select: LEAD_COLUMNS,
    orderBy: "created_at",
    ascending: false,
    pageSize: 250,
    maxRows: 15_000,
    modify: filters ? (q) => applyBlogLeadFilters(q, filters) : undefined,
  });
}

function applyBlogLeadFiltersClientSide(
  rows: AdminBlogLeadRow[],
  opts: {
    phoneSearch?: string;
    textSearch?: string;
    dateFrom?: string;
    dateTo?: string;
  }
): AdminBlogLeadRow[] {
  const phoneQ = (opts.phoneSearch || "").replace(/\D/g, "");
  const textQ = (opts.textSearch || "").trim().toLowerCase();
  return rows.filter((row) => {
    if (opts.dateFrom && row.created_at && row.created_at < `${opts.dateFrom}T00:00:00`) return false;
    if (opts.dateTo && row.created_at && row.created_at > `${opts.dateTo}T23:59:59.999`) return false;
    if (phoneQ && !String(row.phone || "").replace(/\D/g, "").includes(phoneQ)) return false;
    if (textQ) {
      const hay = [row.full_name, row.email, row.college_name, row.post_title, row.post_slug]
        .map((v) => String(v || "").toLowerCase())
        .join(" ");
      if (!hay.includes(textQ)) return false;
    }
    return true;
  });
}

function applyBlogLeadFilters(
  q: {
    gte: (c: string, v: string) => typeof q;
    lte: (c: string, v: string) => typeof q;
    ilike: (c: string, v: string) => typeof q;
    or: (f: string) => typeof q;
  },
  opts: {
    phoneSearch?: string;
    textSearch?: string;
    dateFrom?: string;
    dateTo?: string;
  }
) {
  let query = q;
  const phoneQ = (opts.phoneSearch || "").replace(/\D/g, "");
  const textQ = (opts.textSearch || "").trim();
  if (opts.dateFrom) query = query.gte("created_at", `${opts.dateFrom}T00:00:00`);
  if (opts.dateTo) query = query.lte("created_at", `${opts.dateTo}T23:59:59.999`);
  if (phoneQ) query = query.ilike("phone", `%${phoneQ}%`);
  if (textQ) {
    const s = textQ.replace(/"/g, '\\"');
    query = query.or(
      `full_name.ilike.%${s}%,email.ilike.%${s}%,college_name.ilike.%${s}%,post_title.ilike.%${s}%,post_slug.ilike.%${s}%`
    );
  }
  return query;
}
