import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchSupabaseTablePage } from "@/lib/fetchAllSupabaseRows";
import { apiUrl } from "@/lib/siteApi";

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

type LeadFetchOpts = {
  page: number;
  pageSize: number;
  phoneSearch?: string;
  textSearch?: string;
  dateFrom?: string;
  dateTo?: string;
  exportAll?: boolean;
};

function parseLeadsApiResponse(json: {
  ok?: boolean;
  data?: AdminBlogLeadRow[];
  total?: number;
  message?: string;
  error?: string;
}): { rows: AdminBlogLeadRow[]; total: number } {
  if (!json?.ok || !Array.isArray(json.data)) {
    const msg = String(json.message || json.error || "").trim();
    throw new Error(msg || "Blog leads API returned an invalid response.");
  }
  return { rows: json.data, total: json.total ?? json.data.length };
}

/** Primary path — same Vercel RDS handler as public blog actions (Cloudflare always proxies). */
async function fetchAdminBlogLeadsViaSendMail(
  accessToken: string,
  opts: LeadFetchOpts
): Promise<{ rows: AdminBlogLeadRow[]; total: number }> {
  const res = await fetchWithTimeout(
    apiUrl("/api/send-mail"),
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action: "blog_admin_list_leads",
        page: opts.page,
        pageSize: opts.pageSize,
        phoneSearch: opts.phoneSearch,
        textSearch: opts.textSearch,
        dateFrom: opts.dateFrom,
        dateTo: opts.dateTo,
        export: opts.exportAll ? "1" : undefined,
        exportAll: opts.exportAll ? true : undefined,
      }),
    },
    LEADS_API_TIMEOUT_MS
  );
  const json = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    data?: AdminBlogLeadRow[];
    total?: number;
    message?: string;
    error?: string;
  };
  if (!res.ok) {
    throw new Error(String(json.message || json.error || `Blog leads failed (${res.status})`));
  }
  return parseLeadsApiResponse(json);
}

async function fetchAdminBlogLeadsViaGetApi(
  accessToken: string,
  opts: LeadFetchOpts
): Promise<{ rows: AdminBlogLeadRow[]; total: number }> {
  if (typeof window === "undefined") {
    throw new Error("Blog leads load is only available in the browser.");
  }
  const params = new URLSearchParams();
  params.set("page", String(opts.page));
  params.set("pageSize", String(opts.pageSize));
  if (opts.phoneSearch?.trim()) params.set("phoneSearch", opts.phoneSearch.trim());
  if (opts.textSearch?.trim()) params.set("textSearch", opts.textSearch.trim());
  if (opts.dateFrom) params.set("dateFrom", opts.dateFrom);
  if (opts.dateTo) params.set("dateTo", opts.dateTo);
  if (opts.exportAll) params.set("export", "1");

  const origin = window.location.origin.replace(/\/$/, "");
  const res = await fetchWithTimeout(`${origin}/api/admin-blog-leads?${params.toString()}`, {
    method: "GET",
    headers: { Authorization: `Bearer ${accessToken}` },
  }, LEADS_API_TIMEOUT_MS);
  const json = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    data?: AdminBlogLeadRow[];
    total?: number;
    message?: string;
    error?: string;
  };
  if (!res.ok) {
    throw new Error(String(json.message || json.error || `Blog leads failed (${res.status})`));
  }
  return parseLeadsApiResponse(json);
}

async function fetchAdminBlogLeadsFromServer(
  accessToken: string,
  opts: LeadFetchOpts
): Promise<{ rows: AdminBlogLeadRow[]; total: number }> {
  try {
    return await fetchAdminBlogLeadsViaSendMail(accessToken, opts);
  } catch (sendMailErr) {
    console.warn("[blogLeadsAdmin] send-mail leads load failed, trying GET API:", sendMailErr);
    return fetchAdminBlogLeadsViaGetApi(accessToken, opts);
  }
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
      return await fetchAdminBlogLeadsFromServer(token, { ...opts, page, pageSize });
    } catch (err) {
      console.warn("[blogLeadsAdmin] server leads load failed:", err);
      if (err instanceof Error && /sign in|authorization|privileges|session/i.test(err.message)) {
        throw err;
      }
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
      const viaApi = await fetchAdminBlogLeadsFromServer(token, {
        page: 0,
        pageSize: 15_000,
        exportAll: true,
        ...filters,
      });
      return viaApi.rows;
    } catch (err) {
      console.warn("[blogLeadsAdmin] export via API failed:", err);
      if (err instanceof Error && /sign in|authorization|privileges|session/i.test(err.message)) {
        throw err;
      }
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
