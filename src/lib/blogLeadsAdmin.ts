import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchSupabaseTablePage } from "@/lib/fetchAllSupabaseRows";

function isBlogLeadsTableMissing(error: unknown): boolean {
  const msg =
    error && typeof error === "object"
      ? [ (error as { message?: string }).message, (error as { code?: string }).code ]
          .filter(Boolean)
          .join(" ")
      : error instanceof Error
        ? error.message
        : String(error ?? "");
  return (
    /42P01|undefined_table|PGRST205/i.test(msg) ||
    /site_blog_leads/i.test(msg) && /does not exist|Could not find/i.test(msg)
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
      const hay = [
        row.full_name,
        row.email,
        row.college_name,
        row.post_title,
        row.post_slug,
      ]
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
