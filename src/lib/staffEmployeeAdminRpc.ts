import { supabase } from "@/integrations/supabase/client";
import type { EmployeeAttendanceRow, EmployeeAttendanceStatus } from "@/lib/employeeAttendance";

function isMissingRpc(error: unknown): boolean {
  const msg =
    error && typeof error === "object"
      ? String((error as { message?: string }).message || "")
      : error instanceof Error
        ? error.message
        : String(error ?? "");
  return /42883|does not exist|PGRST202|Could not find the function/i.test(msg);
}

export async function setStaffBlockedRpc(staffId: string, isBlocked: boolean): Promise<void> {
  const { data, error } = await supabase.rpc("admin_set_staff_blocked", {
    p_staff_id: staffId,
    p_is_blocked: isBlocked,
  });
  if (error) throw error;
  const ok = data && typeof data === "object" && (data as { ok?: boolean }).ok;
  if (!ok) throw new Error("Could not update staff block status.");
}

export async function upsertEmployeeAttendanceRpc(input: {
  employeeId: string;
  attendanceDate: string;
  status: EmployeeAttendanceStatus;
  notes?: string;
  checkInAt?: string | null;
  checkOutAt?: string | null;
}): Promise<EmployeeAttendanceRow> {
  const { data, error } = await supabase.rpc("admin_upsert_employee_attendance", {
    p_employee_id: input.employeeId,
    p_attendance_date: input.attendanceDate,
    p_status: input.status,
    p_notes: input.notes?.trim() || null,
    p_check_in_at: input.checkInAt ?? null,
    p_check_out_at: input.checkOutAt ?? null,
  });
  if (error) throw error;
  const row = (data as { row?: EmployeeAttendanceRow } | null)?.row;
  if (!row?.id) throw new Error("Attendance save did not return a row.");
  return row;
}

export async function deleteEmployeeAttendanceRpc(id: string): Promise<void> {
  const { data, error } = await supabase.rpc("admin_delete_employee_attendance", {
    p_id: id,
  });
  if (error) throw error;
  const ok = data && typeof data === "object" && (data as { ok?: boolean }).ok;
  if (!ok) throw new Error("Could not delete attendance record.");
}

export async function listEmployeeAttendanceRpc(opts?: {
  employeeId?: string;
  fromDate?: string;
  toDate?: string;
  status?: EmployeeAttendanceStatus | "all";
  limit?: number;
}): Promise<EmployeeAttendanceRow[]> {
  const { data, error } = await supabase.rpc("admin_list_employee_attendance", {
    p_employee_id: opts?.employeeId || null,
    p_from_date: opts?.fromDate || null,
    p_to_date: opts?.toDate || null,
    p_status: opts?.status && opts.status !== "all" ? opts.status : null,
    p_limit: opts?.limit ?? 500,
  });
  if (error) throw error;
  return (data || []) as EmployeeAttendanceRow[];
}

export type EmployeeAttendanceCsvRow = {
  employee_email?: string;
  employee_id?: string;
  attendance_date: string;
  status: string;
  check_in?: string;
  check_out?: string;
  notes?: string;
};

export async function importEmployeeAttendanceCsvRows(
  rows: EmployeeAttendanceCsvRow[]
): Promise<{ imported: number; skipped: number; errors: unknown[] }> {
  const { data, error } = await supabase.rpc("admin_import_employee_attendance_rows", {
    p_rows: rows,
  });
  if (error) throw error;
  const payload = data as {
    ok?: boolean;
    imported?: number;
    skipped?: number;
    errors?: unknown[];
  };
  if (!payload?.ok) throw new Error("CSV import failed.");
  return {
    imported: Number(payload.imported ?? 0),
    skipped: Number(payload.skipped ?? 0),
    errors: Array.isArray(payload.errors) ? payload.errors : [],
  };
}

export const EMPLOYEE_ATTENDANCE_CSV_TEMPLATE = [
  "employee_email,attendance_date,status,check_in,check_out,notes",
  "staff@example.com,2026-10-13,present,09:30,18:00,Optional note",
].join("\n");

export function downloadEmployeeAttendanceCsvTemplate(): void {
  const blob = new Blob([EMPLOYEE_ATTENDANCE_CSV_TEMPLATE + "\n"], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "employee-attendance-import-template.csv";
  a.click();
  URL.revokeObjectURL(url);
}

export { isMissingRpc };
