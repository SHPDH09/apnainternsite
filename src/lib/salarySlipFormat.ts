import { formatSalaryMonth, type StaffSalarySlipRow } from "@/lib/staffSalary";
import { BRAND_CONTACT_EMAIL, BRAND_WEBSITE_URL } from "@/lib/brand";

export const SALARY_SLIP_LOGO = "/salary-slip/xpert-intern-logo.png";
export const SALARY_SLIP_COMPANY = "XpertIntern";
export const SALARY_SLIP_COMPANY_TAGLINE = "Empowering Careers Through Excellence";

/** A4 @ 96dpi — matches offer letter / certificate capture width. */
export const SALARY_SLIP_CAPTURE_WIDTH_PX = 794;

export type SalarySlipEmployeeInfo = {
  fullName: string;
  email?: string | null;
  employeeCode?: string | null;
  mobile?: string | null;
  bankName?: string | null;
  accountNumber?: string | null;
  ifscCode?: string | null;
  panNumber?: string | null;
};

export type SalarySlipBreakdown = {
  basicSalary: number;
  hra: number;
  specialAllowance: number;
  otherAllowances: number;
  pfDeduction: number;
  taxDeduction: number;
  otherDeductions: number;
  workingDaysPerMonth: number;
  perDayRate: number;
  paymentMode: string;
  overtimeHours: number;
  overtimeAmount: number;
  halfDayDeduction: number;
  absentDeduction: number;
  unpaidLeaveDeduction: number;
};

export function formatSalaryMoney(n: number | null | undefined): string {
  return `₹${Number(n || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatSalaryPaidAt(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return iso;
  }
}

export function maskAccountNumber(account: string | null | undefined): string {
  const raw = (account || "").replace(/\s/g, "");
  if (!raw) return "—";
  if (raw.length <= 4) return raw;
  return `•••• ${raw.slice(-4)}`;
}

export function parseSalaryBreakdown(
  slip: StaffSalarySlipRow,
  raw: Record<string, unknown> = slip.breakdown || {}
): SalarySlipBreakdown {
  const num = (k: string, fallback = 0) => {
    const v = raw[k];
    return typeof v === "number" ? v : Number(v) || fallback;
  };
  return {
    basicSalary: num("basic_salary"),
    hra: num("hra"),
    specialAllowance: num("special_allowance"),
    otherAllowances: num("other_allowances"),
    pfDeduction: num("pf_deduction"),
    taxDeduction: num("tax_deduction"),
    otherDeductions: num("other_deductions"),
    workingDaysPerMonth: num("working_days_per_month", 26),
    perDayRate: num("per_day_rate"),
    paymentMode: String(raw.payment_mode || "bank_transfer"),
    overtimeHours: num("overtime_hours", slip.overtime_hours ?? 0),
    overtimeAmount: num("overtime_amount", slip.overtime_amount ?? 0),
    halfDayDeduction: num("half_day_deduction", slip.half_day_deduction ?? 0),
    absentDeduction: num("absent_deduction"),
    unpaidLeaveDeduction: num("unpaid_leave_deduction"),
  };
}

export function salarySlipFileName(slip: StaffSalarySlipRow, employeeName: string): string {
  const month = formatSalaryMonth(slip.salary_month).replace(/\s+/g, "-");
  const safeName = employeeName.replace(/[^\w\-]+/g, "_").slice(0, 40) || "employee";
  return `Salary-Slip-${safeName}-${month}.pdf`;
}

export const SALARY_SLIP_FOOTER = {
  website: BRAND_WEBSITE_URL,
  email: BRAND_CONTACT_EMAIL,
};

export function employeeInfoFromStaffProfile(
  profile: {
    full_name?: string | null;
    email?: string | null;
    employee_code?: string | null;
    mobile_number?: string | null;
    bank_name?: string | null;
    account_number?: string | null;
    ifsc_code?: string | null;
    pan_number?: string | null;
  } | null | undefined,
  fallbackEmail?: string
): SalarySlipEmployeeInfo {
  return {
    fullName: profile?.full_name?.trim() || profile?.email || fallbackEmail || "Staff member",
    email: profile?.email || fallbackEmail || null,
    employeeCode: profile?.employee_code || null,
    mobile: profile?.mobile_number || null,
    bankName: profile?.bank_name || null,
    accountNumber: profile?.account_number || null,
    ifscCode: profile?.ifsc_code || null,
    panNumber: profile?.pan_number || null,
  };
}
