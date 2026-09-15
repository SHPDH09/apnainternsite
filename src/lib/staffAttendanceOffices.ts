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

export async function listStaffAttendanceOffices(activeOnly = false): Promise<StaffAttendanceOffice[]> {
  let q = supabase.from("staff_attendance_offices").select("*").order("name");
  if (activeOnly) q = q.eq("is_active", true);
  const { data, error } = await q;
  if (error) throw error;
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
  const payload = {
    ...(input.id ? { id: input.id } : {}),
    name: input.name.trim(),
    address: input.address?.trim() || null,
    latitude: input.latitude,
    longitude: input.longitude,
    radius_meters: input.radiusMeters,
    max_gps_accuracy_m: input.maxGpsAccuracyM ?? 100,
    require_face: input.requireFace ?? true,
    require_geo: input.requireGeo ?? true,
    is_active: input.isActive ?? true,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = input.id
    ? await supabase.from("staff_attendance_offices").update(payload).eq("id", input.id).select("*").single()
    : await supabase.from("staff_attendance_offices").insert(payload).select("*").single();

  if (error) throw error;
  return data as StaffAttendanceOffice;
}

export async function deleteStaffAttendanceOffice(id: string): Promise<void> {
  const { error } = await supabase.from("staff_attendance_offices").delete().eq("id", id);
  if (error) throw error;
}

export async function listStaffOfficeAssignments(): Promise<StaffOfficeAssignment[]> {
  const { data, error } = await supabase.from("staff_office_assignments").select("*");
  if (error) throw error;
  return (data || []) as StaffOfficeAssignment[];
}

export async function assignStaffOffice(input: {
  employeeId: string;
  officeId: string;
  assignedBy?: string | null;
}): Promise<StaffOfficeAssignment> {
  const { data, error } = await supabase
    .from("staff_office_assignments")
    .upsert(
      {
        employee_id: input.employeeId,
        office_id: input.officeId,
        assigned_by: input.assignedBy ?? null,
        assigned_at: new Date().toISOString(),
      },
      { onConflict: "employee_id" }
    )
    .select("*")
    .single();

  if (error) throw error;
  return data as StaffOfficeAssignment;
}

export async function removeStaffOfficeAssignment(employeeId: string): Promise<void> {
  const { error } = await supabase.from("staff_office_assignments").delete().eq("employee_id", employeeId);
  if (error) throw error;
}
