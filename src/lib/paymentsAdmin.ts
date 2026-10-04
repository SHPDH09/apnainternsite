import type { SupabaseClient } from "@supabase/supabase-js";
import type { PostgrestFilterBuilder } from "@supabase/postgrest-js";
import {
  fetchAllSupabaseRows,
  fetchSupabaseTablePage,
} from "@/lib/fetchAllSupabaseRows";

type Query = PostgrestFilterBuilder<any, any, any, any[], string, unknown, "GET">;

export const PAYMENTS_LIST_PAGE_SIZE = 20;
export const PAYMENTS_DASHBOARD_LOOKBACK_DAYS = 90;
export const LEADS_CANCELLED_PREFETCH = 500;

export type PaymentListFilters = {
  search?: string;
  college?: string;
  startDate?: string;
  endDate?: string;
  status?: "success" | "failed" | "all";
};

function applyPaymentListFilters(query: Query, filters: PaymentListFilters): Query {
  let q = query;
  if (filters.startDate) {
    q = q.gte("created_at", `${filters.startDate}T00:00:00`);
  }
  if (filters.endDate) {
    q = q.lte("created_at", `${filters.endDate}T23:59:59.999`);
  }
  if (filters.college && filters.college !== "all") {
    q = q.eq("college_name", filters.college);
  }
  const search = filters.search?.trim();
  if (search) {
    const s = search.replace(/"/g, '\\"');
    q = q.or(
      `full_name.ilike.%${s}%,email.ilike.%${s}%,payment_id.ilike.%${s}%,college_name.ilike.%${s}%`
    );
  }
  if (filters.status === "success") {
    q = q.or("status.eq.success,status.is.null");
  } else if (filters.status === "failed") {
    q = q.eq("status", "failed");
  }
  return q;
}

export function paymentDashboardSinceIso(): string {
  const d = new Date();
  d.setDate(d.getDate() - PAYMENTS_DASHBOARD_LOOKBACK_DAYS);
  return d.toISOString();
}

/** Slim rows for dashboard charts (bounded lookback, not full table scan). */
function normalizeAmountPaise(row: Record<string, unknown>): Record<string, unknown> {
  const raw = row.amount_paise ?? row.amount ?? 0;
  return { ...row, amount_paise: Number(raw) || 0 };
}

export async function fetchPaymentDashboardSample(
  client: SupabaseClient
): Promise<{ success: Record<string, unknown>[]; cancelled: Record<string, unknown>[] }> {
  const since = paymentDashboardSinceIso();
  let success: Record<string, unknown>[] = [];
  let cancelled: Record<string, unknown>[] = [];

  try {
    success = await fetchAllSupabaseRows(client, "payment_success", {
      select: "created_at,amount_paise,status",
      orderBy: "created_at",
      ascending: false,
      pageSize: 250,
      maxRows: 8_000,
      modify: (q) => q.gte("created_at", since),
    });
  } catch (err) {
    console.warn("[paymentsAdmin] payment_success dashboard sample:", err);
    try {
      success = await fetchAllSupabaseRows(client, "payment_success", {
        select: "created_at,amount,status",
        orderBy: "created_at",
        ascending: false,
        pageSize: 250,
        maxRows: 8_000,
        modify: (q) => q.gte("created_at", since),
      });
    } catch {
      success = [];
    }
  }

  try {
    cancelled = await fetchCancelledDashboardSample(client, since);
  } catch (err) {
    console.warn("[paymentsAdmin] payment_cancelled dashboard sample:", err);
    cancelled = [];
  }

  return {
    success: success.map(normalizeAmountPaise),
    cancelled: cancelled.map(normalizeAmountPaise),
  };
}

/** RDS `payment_cancelled` uses `amount` (BIGINT), not `amount_paise`. */
async function fetchCancelledDashboardSample(
  client: SupabaseClient,
  since: string
): Promise<Record<string, unknown>[]> {
  try {
    return await fetchAllSupabaseRows(client, "payment_cancelled", {
      select: "created_at,amount",
      orderBy: "created_at",
      ascending: false,
      pageSize: 250,
      maxRows: 4_000,
      modify: (q) => q.gte("created_at", since),
    });
  } catch {
    return fetchAllSupabaseRows(client, "payment_cancelled", {
      select: "created_at",
      orderBy: "created_at",
      ascending: false,
      pageSize: 250,
      maxRows: 4_000,
      modify: (q) => q.gte("created_at", since),
    });
  }
}

export async function fetchPaymentSuccessPage(
  client: SupabaseClient,
  page: number,
  pageSize: number,
  filters: PaymentListFilters = {}
): Promise<{ rows: Record<string, unknown>[]; total: number }> {
  return fetchSupabaseTablePage(client, "payment_success", {
    page,
    pageSize,
    orderBy: "created_at",
    ascending: false,
    modify: (q) =>
      applyPaymentListFilters(q, { ...filters, status: filters.status ?? "success" }),
  });
}

export async function fetchPaymentFailedPage(
  client: SupabaseClient,
  page: number,
  pageSize: number,
  filters: Omit<PaymentListFilters, "status"> = {}
): Promise<{ rows: Record<string, unknown>[]; total: number }> {
  return fetchSupabaseTablePage(client, "payment_success", {
    page,
    pageSize,
    orderBy: "created_at",
    ascending: false,
    modify: (q) => applyPaymentListFilters(q, { ...filters, status: "failed" }),
  });
}

export async function fetchPaymentCancelledPage(
  client: SupabaseClient,
  page: number,
  pageSize: number,
  filters: Omit<PaymentListFilters, "status"> = {}
): Promise<{ rows: Record<string, unknown>[]; total: number }> {
  return fetchSupabaseTablePage(client, "payment_cancelled", {
    page,
    pageSize,
    orderBy: "created_at",
    ascending: false,
    modify: (q) => {
      let qq = q;
      if (filters.startDate) qq = qq.gte("created_at", `${filters.startDate}T00:00:00`);
      if (filters.endDate) qq = qq.lte("created_at", `${filters.endDate}T23:59:59.999`);
      const search = filters.search?.trim();
      if (search) {
        const s = search.replace(/"/g, '\\"');
        qq = qq.or(
          `user_email.ilike.%${s}%,full_name.ilike.%${s}%,college_name.ilike.%${s}%`
        );
      }
      return qq;
    },
  });
}

/** Recent cancelled rows for Leads Hub merge (bounded). */
export async function fetchRecentCancelledForLeads(client: SupabaseClient) {
  return fetchAllSupabaseRows(client, "payment_cancelled", {
    orderBy: "created_at",
    ascending: false,
    pageSize: 250,
    maxRows: LEADS_CANCELLED_PREFETCH,
  });
}

export async function fetchRecentFailedForLeads(client: SupabaseClient) {
  return fetchAllSupabaseRows(client, "payment_success", {
    orderBy: "created_at",
    ascending: false,
    pageSize: 250,
    maxRows: LEADS_CANCELLED_PREFETCH,
    modify: (q) => q.eq("status", "failed"),
  });
}
