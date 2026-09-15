import { supabase } from "@/integrations/supabase/client";

export type StaffSalaryPaymentMode = "bank_transfer" | "upi" | "cash";

export type StaffSalarySetupRow = {
  employee_id: string;
  basic_salary: number;
  hra: number;
  special_allowance: number;
  other_allowances: number;
  pf_deduction: number;
  tax_deduction: number;
  other_deductions: number;
  working_days_per_month: number;
  payment_mode: StaffSalaryPaymentMode;
  payment_notes: string | null;
  is_active: boolean;
  updated_at: string;
  updated_by: string | null;
};

export type StaffSalarySlipStatus = "draft" | "generated" | "paid" | "cancelled";

export type StaffSalarySlipRow = {
  id: string;
  employee_id: string;
  salary_month: string;
  present_days: number;
  absent_days: number;
  leave_days: number;
  half_days: number;
  gross_amount: number;
  attendance_deduction: number;
  total_deductions: number;
  net_amount: number;
  status: StaffSalarySlipStatus;
  breakdown: Record<string, unknown>;
  payment_reference: string | null;
  generated_at: string;
  generated_by: string | null;
  paid_at: string | null;
  paid_by: string | null;
  created_at: string;
  updated_at: string;
};

export const SALARY_STATUS_LABELS: Record<StaffSalarySlipStatus, string> = {
  draft: "Draft",
  generated: "Generated",
  paid: "Paid",
  cancelled: "Cancelled",
};

export const PAYMENT_MODE_LABELS: Record<StaffSalaryPaymentMode, string> = {
  bank_transfer: "Bank transfer",
  upi: "UPI",
  cash: "Cash",
};

export function monthStartIso(yearMonth: string): string {
  return `${yearMonth}-01`;
}

export function formatSalaryMonth(isoDate: string): string {
  try {
    return new Date(isoDate).toLocaleDateString("en-IN", { month: "long", year: "numeric" });
  } catch {
    return isoDate;
  }
}

export function calcGrossFromSetup(setup: Pick<
  StaffSalarySetupRow,
  "basic_salary" | "hra" | "special_allowance" | "other_allowances"
>): number {
  return (
    Number(setup.basic_salary || 0) +
    Number(setup.hra || 0) +
    Number(setup.special_allowance || 0) +
    Number(setup.other_allowances || 0)
  );
}

export async function listStaffSalarySetups(): Promise<StaffSalarySetupRow[]> {
  const { data, error } = await supabase.from("staff_salary_setup").select("*");
  if (error) throw error;
  return (data || []) as StaffSalarySetupRow[];
}

export async function upsertStaffSalarySetup(input: {
  employeeId: string;
  basicSalary: number;
  hra: number;
  specialAllowance: number;
  otherAllowances: number;
  pfDeduction: number;
  taxDeduction: number;
  otherDeductions: number;
  workingDaysPerMonth: number;
  paymentMode: StaffSalaryPaymentMode;
  paymentNotes?: string;
  updatedBy?: string | null;
}): Promise<StaffSalarySetupRow> {
  const payload = {
    employee_id: input.employeeId,
    basic_salary: input.basicSalary,
    hra: input.hra,
    special_allowance: input.specialAllowance,
    other_allowances: input.otherAllowances,
    pf_deduction: input.pfDeduction,
    tax_deduction: input.taxDeduction,
    other_deductions: input.otherDeductions,
    working_days_per_month: input.workingDaysPerMonth,
    payment_mode: input.paymentMode,
    payment_notes: input.paymentNotes?.trim() || null,
    is_active: true,
    updated_by: input.updatedBy ?? null,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("staff_salary_setup")
    .upsert(payload, { onConflict: "employee_id" })
    .select("*")
    .single();

  if (error) throw error;
  return data as StaffSalarySetupRow;
}

export async function listStaffSalarySlips(opts?: {
  salaryMonth?: string;
  employeeId?: string;
}): Promise<StaffSalarySlipRow[]> {
  let q = supabase
    .from("staff_salary_slips")
    .select("*")
    .order("salary_month", { ascending: false })
    .order("generated_at", { ascending: false });

  if (opts?.salaryMonth) q = q.eq("salary_month", monthStartIso(opts.salaryMonth));
  if (opts?.employeeId) q = q.eq("employee_id", opts.employeeId);

  const { data, error } = await q;
  if (error) throw error;
  return (data || []) as StaffSalarySlipRow[];
}

export async function generateStaffSalary(employeeId: string, salaryMonth: string) {
  const { data, error } = await supabase.rpc("admin_generate_staff_salary", {
    p_employee_id: employeeId,
    p_salary_month: monthStartIso(salaryMonth),
  });
  if (error) throw error;
  return data;
}

export async function markStaffSalaryPaid(slipId: string, paymentReference?: string) {
  const { data, error } = await supabase.rpc("admin_mark_staff_salary_paid", {
    p_slip_id: slipId,
    p_payment_reference: paymentReference?.trim() || null,
  });
  if (error) throw error;
  return data;
}
