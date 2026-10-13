import type { SupabaseClient } from "@supabase/supabase-js";

export type CompanyProfileRow = {
  id: string;
  contact_name: string;
  designation: string | null;
  email: string;
  phone: string | null;
  company_name: string;
  gst_number: string | null;
  company_address: string | null;
  status: "pending_approval" | "approved" | "rejected" | "suspended";
  rejection_reason: string | null;
  email_verified_at: string | null;
  approved_at: string | null;
  created_at: string;
};

export type CompanyJobRow = {
  id: string;
  company_id: string;
  title: string;
  description: string | null;
  location: string | null;
  required_students: number;
  status: "draft" | "open" | "hiring_in_progress" | "completed" | "closed";
  completion_remark: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type CompanyCandidateRow = {
  id: string;
  company_id: string;
  job_id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  college_name: string | null;
  department: string | null;
  status: string;
  remark: string | null;
  hired_at: string | null;
  created_at: string;
};

export async function fetchCompanyProfile(
  client: SupabaseClient,
  companyId: string
): Promise<CompanyProfileRow | null> {
  const { data, error } = await client
    .from("company_profiles")
    .select("*")
    .eq("id", companyId)
    .maybeSingle();
  if (error && !/42P01|does not exist/i.test(error.message || "")) throw error;
  return (data as CompanyProfileRow) || null;
}

export async function fetchAllCompanies(client: SupabaseClient): Promise<CompanyProfileRow[]> {
  const { data, error } = await client
    .from("company_profiles")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) {
    if (/42P01|does not exist/i.test(error.message || "")) return [];
    throw error;
  }
  return (data || []) as CompanyProfileRow[];
}

export async function fetchCompanyJobs(
  client: SupabaseClient,
  companyId: string
): Promise<CompanyJobRow[]> {
  const { data, error } = await client
    .from("company_job_postings")
    .select("*")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []) as CompanyJobRow[];
}

export async function fetchJobCandidates(
  client: SupabaseClient,
  jobId: string
): Promise<CompanyCandidateRow[]> {
  const { data, error } = await client
    .from("company_hiring_candidates")
    .select("*")
    .eq("job_id", jobId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []) as CompanyCandidateRow[];
}

export async function approveCompany(
  client: SupabaseClient,
  companyId: string,
  reviewerId: string
): Promise<void> {
  const { error } = await client.rpc("admin_approve_company_partner", {
    p_company_id: companyId,
    p_reviewer_id: reviewerId,
  });
  if (error) throw error;
}

export async function rejectCompany(
  client: SupabaseClient,
  companyId: string,
  reason: string
): Promise<void> {
  const { error } = await client.rpc("admin_reject_company_partner", {
    p_company_id: companyId,
    p_reason: reason,
  });
  if (error) throw error;
}

export async function completeCompanyHiring(
  client: SupabaseClient,
  jobId: string,
  remark: string
): Promise<void> {
  const { error } = await client.rpc("company_complete_hiring", {
    p_job_id: jobId,
    p_remark: remark.trim() || null,
  });
  if (error) throw error;
}

export function companyStatusLabel(status: string): string {
  switch (status) {
    case "pending_approval":
      return "Pending review";
    case "approved":
      return "Approved";
    case "rejected":
      return "Rejected";
    case "suspended":
      return "Suspended";
    default:
      return status;
  }
}

export function jobStatusLabel(status: string): string {
  switch (status) {
    case "open":
      return "Open";
    case "hiring_in_progress":
      return "Hiring in progress";
    case "completed":
      return "Completed";
    case "closed":
      return "Closed";
    case "draft":
      return "Draft";
    default:
      return status;
  }
}
