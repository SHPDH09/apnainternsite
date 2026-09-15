import { supabase } from "@/integrations/supabase/client";

export type StaffAttendanceOffice = {
  id: string;
  name: string;
  address: string | null;
  latitude: number;
  longitude: number;
  radius_meters: number;
  max_gps_accuracy_m: number | null;
  require_face: boolean;
  require_geo: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type StaffOfficeAssignment = {
  employee_id: string;
  office_id: string;
  assigned_by: string | null;
  assigned_at: string;
};

function rpcErrorMessage(error: { message?: string; details?: string; hint?: string } | null): string {
  if (!error) return "Unknown error";
  return [error.message, error.details, error.hint].filter(Boolean).join(" — ") || "Request failed";
}

export async function listStaffAttendanceOffices(activeOnly = false): Promise<StaffAttendanceOffice[]> {
  let q = supabase.from("staff_attendance_offices").select("*").order("name");
  if (activeOnly) q = q.eq("is_active", true);
  const { data, error } = await q;
  if (error) throw new Error(rpcErrorMessage(error));
  return (data || []) as StaffAttendanceOffice[];
}

export async function upsertStaffAttendanceOffice(input: {
  id?: string;
  name: string;
  address?: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  maxGpsAccuracyM?: number | null;
  requireFace?: boolean;
  requireGeo?: boolean;
  isActive?: boolean;
}): Promise<StaffAttendanceOffice> {
  const { data, error } = await supabase.rpc("admin_upsert_staff_attendance_office", {
    p_id: input.id ?? null,
    p_name: input.name.trim(),
    p_address: input.address?.trim() || null,
    p_latitude: input.latitude,
    p_longitude: input.longitude,
    p_radius_meters: input.radiusMeters,
    p_max_gps_accuracy_m: input.maxGpsAccuracyM ?? 100,
    p_require_face: input.requireFace ?? true,
    p_require_geo: input.requireGeo ?? true,
    p_is_active: input.isActive ?? true,
  });

  if (error) throw new Error(rpcErrorMessage(error));
  return data as StaffAttendanceOffice;
}

export async function deleteStaffAttendanceOffice(id: string): Promise<void> {
  const { error } = await supabase.rpc("admin_delete_staff_attendance_office", { p_id: id });
  if (error) throw new Error(rpcErrorMessage(error));
}

export async function listStaffOfficeAssignments(): Promise<StaffOfficeAssignment[]> {
  const { data, error } = await supabase.from("staff_office_assignments").select("*");
  if (error) throw new Error(rpcErrorMessage(error));
  return (data || []) as StaffOfficeAssignment[];
}

export async function assignStaffOffice(input: {
  employeeId: string;
  officeId: string;
  assignedBy?: string | null;
}): Promise<StaffOfficeAssignment> {
  void input.assignedBy;
  const { data, error } = await supabase.rpc("admin_assign_staff_office", {
    p_employee_id: input.employeeId,
    p_office_id: input.officeId,
  });
  if (error) throw new Error(rpcErrorMessage(error));
  return data as StaffOfficeAssignment;
}

export async function removeStaffOfficeAssignment(employeeId: string): Promise<void> {
  const { error } = await supabase.rpc("admin_remove_staff_office_assignment", {
    p_employee_id: employeeId,
  });
  if (error) throw new Error(rpcErrorMessage(error));
}
