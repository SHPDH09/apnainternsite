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
  paid_leaves_per_month: number;
  standard_hours_per_day: number;
  overtime_multiplier: number;
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
  overtime_hours: number;
  overtime_amount: number;
  festival_days: number;
  unpaid_leave_days: number;
  half_day_deduction: number;
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

export type StaffSalaryHoliday = {
  id: string;
  holiday_date: string;
  name: string;
  is_paid: boolean;
  created_at: string;
  created_by: string | null;
};

export type StaffPaidLeaveGrant = {
  id: string;
  employee_id: string;
  salary_month: string;
  extra_paid_days: number;
  reason: string | null;
  granted_by: string | null;
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

function rpcError(error: { message?: string; details?: string; hint?: string } | null): string {
  if (!error) return "Unknown error";
  return [error.message, error.details, error.hint].filter(Boolean).join(" — ") || "Request failed";
}

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
  if (error) throw new Error(rpcError(error));
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
  paidLeavesPerMonth?: number;
  standardHoursPerDay?: number;
  overtimeMultiplier?: number;
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
    paid_leaves_per_month: input.paidLeavesPerMonth ?? 1,
    standard_hours_per_day: input.standardHoursPerDay ?? 8,
    overtime_multiplier: input.overtimeMultiplier ?? 1.5,
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

  if (error) throw new Error(rpcError(error));
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
  if (error) throw new Error(rpcError(error));
  return (data || []) as StaffSalarySlipRow[];
}

export async function generateStaffSalary(employeeId: string, salaryMonth: string) {
  const { data, error } = await supabase.rpc("admin_generate_staff_salary", {
    p_employee_id: employeeId,
    p_salary_month: monthStartIso(salaryMonth),
  });
  if (error) throw new Error(rpcError(error));
  return data;
}

export async function markStaffSalaryPaid(slipId: string, paymentReference?: string) {
  const { data, error } = await supabase.rpc("admin_mark_staff_salary_paid", {
    p_slip_id: slipId,
    p_payment_reference: paymentReference?.trim() || null,
  });
  if (error) throw new Error(rpcError(error));
  return data;
}

export async function listStaffSalaryHolidays(salaryMonth?: string): Promise<StaffSalaryHoliday[]> {
  const { data, error } = await supabase.rpc("admin_list_staff_salary_holidays", {
    p_salary_month: salaryMonth ? monthStartIso(salaryMonth) : null,
  });
  if (error) throw new Error(rpcError(error));
  return (Array.isArray(data) ? data : []) as StaffSalaryHoliday[];
}

export async function upsertStaffSalaryHoliday(input: {
  id?: string;
  holidayDate: string;
  name: string;
  isPaid?: boolean;
}): Promise<StaffSalaryHoliday> {
  const { data, error } = await supabase.rpc("admin_upsert_staff_salary_holiday", {
    p_id: input.id ?? null,
    p_holiday_date: input.holidayDate,
    p_name: input.name.trim(),
    p_is_paid: input.isPaid ?? true,
  });
  if (error) throw new Error(rpcError(error));
  return data as StaffSalaryHoliday;
}

export async function deleteStaffSalaryHoliday(id: string): Promise<void> {
  const { error } = await supabase.rpc("admin_delete_staff_salary_holiday", { p_id: id });
  if (error) throw new Error(rpcError(error));
}

export async function listStaffPaidLeaveGrants(salaryMonth: string): Promise<StaffPaidLeaveGrant[]> {
  const { data, error } = await supabase.rpc("admin_list_staff_paid_leave_grants", {
    p_salary_month: monthStartIso(salaryMonth),
  });
  if (error) throw new Error(rpcError(error));
  return (Array.isArray(data) ? data : []) as StaffPaidLeaveGrant[];
}

export async function upsertStaffPaidLeaveGrant(input: {
  employeeId: string;
  salaryMonth: string;
  extraPaidDays: number;
  reason?: string;
}): Promise<StaffPaidLeaveGrant> {
  const { data, error } = await supabase.rpc("admin_upsert_staff_paid_leave_grant", {
    p_employee_id: input.employeeId,
    p_salary_month: monthStartIso(input.salaryMonth),
    p_extra_paid_days: input.extraPaidDays,
    p_reason: input.reason?.trim() || null,
  });
  if (error) throw new Error(rpcError(error));
  return data as StaffPaidLeaveGrant;
}
