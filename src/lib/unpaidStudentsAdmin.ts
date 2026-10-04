import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchAllSupabaseRows } from "@/lib/fetchAllSupabaseRows";
import { paymentRowQualifiesAsPaid } from "@/lib/studentPaymentAccess";
import {
  fetchRegistrationLeadsPage,
  type RegistrationLeadDraftRow,
} from "@/lib/registrationLeadsAdmin";

export type PaidEnrollmentKeys = {
  userIds: Set<string>;
  emails: Set<string>;
};

/** Paid user ids + emails from payment_success (best-effort; empty sets on timeout/RLS). */
export async function fetchPaidEnrollmentKeys(client: SupabaseClient): Promise<PaidEnrollmentKeys> {
  const userIds = new Set<string>();
  const emails = new Set<string>();

  try {
    const payments = await fetchAllSupabaseRows<{
      user_id?: string;
      email?: string;
      payment_id?: string;
      amount_paise?: number;
      status?: string;
    }>(client, "payment_success", {
      select: "user_id,email,payment_id,amount_paise,status",
      orderBy: "created_at",
      ascending: false,
      pageSize: 400,
      maxRows: 20_000,
    });

    for (const p of payments) {
      if (!paymentRowQualifiesAsPaid(p)) continue;
      const uid = String(p.user_id || "").trim();
      if (uid) userIds.add(uid);
      const email = String(p.email || "").trim().toLowerCase();
      if (email) emails.add(email);
    }
  } catch (err) {
    console.warn("[unpaid-students] payment_success scan failed, continuing with partial data:", err);
  }

  return { userIds, emails };
}

export function registrationLeadLooksUnpaid(
  row: RegistrationLeadDraftRow,
  paid: PaidEnrollmentKeys
): boolean {
  const email = String(row.email || "").trim().toLowerCase();
  if (email && paid.emails.has(email)) return false;

  const payload = row.payload && typeof row.payload === "object" ? row.payload : {};
  const stage = String(
    (payload as Record<string, unknown>).cart_stage ||
      (payload as Record<string, unknown>).cartStage ||
      ""
  ).toLowerCase();
  if (stage.includes("converted") || stage.includes("paid")) return false;

  const step = Number(row.step) || 0;
  if (step >= 99) return false;

  return true;
}

export function mapRegistrationLeadToUnpaidRow(row: RegistrationLeadDraftRow): {
  id: string;
  full_name: string | null;
  email: string | null;
  contact_number: string | null;
  university_name: string | null;
  college_name: string | null;
  status: string | null;
  created_at: string | null;
} {
  const payload = row.payload && typeof row.payload === "object" ? row.payload : {};
  const p = payload as Record<string, unknown>;
  const stage = String(p.cart_stage || p.cartStage || `step_${row.step ?? 1}`);

  return {
    id: String(row.id),
    full_name:
      row.full_name ||
      String(p.fullName || p.full_name || "").trim() ||
      null,
    email: row.email || null,
    contact_number:
      row.phone ||
      (row.contact ? String(row.contact).trim() : "") ||
      String(p.contact || "").trim() ||
      null,
    university_name:
      row.university_name || String(p.university || p.university_name || "").trim() || null,
    college_name: row.college_name || String(p.college || p.college_name || "").trim() || null,
    status: stage,
    created_at: row.updated_at || null,
  };
}

export async function fetchUnpaidRegistrationLeadsPage(
  client: SupabaseClient,
  opts: { page: number; pageSize: number; search?: string; paid: PaidEnrollmentKeys }
): Promise<{ rows: ReturnType<typeof mapRegistrationLeadToUnpaidRow>[]; total: number }> {
  const { rows: leadRows, total } = await fetchRegistrationLeadsPage(client, {
    page: opts.page,
    pageSize: opts.pageSize,
    search: opts.search,
  });

  const unpaid = leadRows
    .filter((r) => registrationLeadLooksUnpaid(r, opts.paid))
    .map(mapRegistrationLeadToUnpaidRow);

  return { rows: unpaid, total };
}
