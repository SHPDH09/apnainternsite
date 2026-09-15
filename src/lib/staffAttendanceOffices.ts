import { supabase } from "@/integrations/supabase/client";
import type { SupabaseClient } from "@supabase/supabase-js";

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

function isStaffOfficeRpcMissing(msg: string): boolean {
  return /admin_(list|upsert|delete)_staff_attendance_office|admin_(assign|remove)_staff_office|admin_list_staff_office_assignments|does not exist on RDS|42883|could not find the function/i.test(
    msg
  );
}

async function readAccessToken(client: SupabaseClient): Promise<string | null> {
  const { data } = await client.auth.getSession();
  return data.session?.access_token ?? null;
}

/** Create staff office tables + admin RPCs on RDS when missing. Never throws. */
async function tryBootstrapStaffAttendanceOffices(client: SupabaseClient = supabase): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    const token = await readAccessToken(client);
    if (!token) return;
    const origin = window.location.origin.replace(/\/$/, "");
    await fetch(`${origin}/api/ensure-staff-attendance-offices`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    });
  } catch {
    /* optional bootstrap */
  }
}

async function withStaffOfficeBootstrap<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (!isStaffOfficeRpcMissing(msg)) throw e;
    await tryBootstrapStaffAttendanceOffices();
    return await run();
  }
}

export async function listStaffAttendanceOffices(activeOnly = false): Promise<StaffAttendanceOffice[]> {
  await tryBootstrapStaffAttendanceOffices();
  return withStaffOfficeBootstrap(async () => {
    const { data, error } = await supabase.rpc("admin_list_staff_attendance_offices", {
      p_active_only: activeOnly,
    });
    if (error) throw new Error(rpcErrorMessage(error));
    return (Array.isArray(data) ? data : []) as StaffAttendanceOffice[];
  });
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
  await tryBootstrapStaffAttendanceOffices();
  return withStaffOfficeBootstrap(async () => {
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
  });
}

export async function deleteStaffAttendanceOffice(id: string): Promise<void> {
  await tryBootstrapStaffAttendanceOffices();
  return withStaffOfficeBootstrap(async () => {
    const { error } = await supabase.rpc("admin_delete_staff_attendance_office", { p_id: id });
    if (error) throw new Error(rpcErrorMessage(error));
  });
}

export async function listStaffOfficeAssignments(): Promise<StaffOfficeAssignment[]> {
  await tryBootstrapStaffAttendanceOffices();
  return withStaffOfficeBootstrap(async () => {
    const { data, error } = await supabase.rpc("admin_list_staff_office_assignments");
    if (error) throw new Error(rpcErrorMessage(error));
    return (Array.isArray(data) ? data : []) as StaffOfficeAssignment[];
  });
}

export async function assignStaffOffice(input: {
  employeeId: string;
  officeId: string;
  assignedBy?: string | null;
}): Promise<StaffOfficeAssignment> {
  void input.assignedBy;
  await tryBootstrapStaffAttendanceOffices();
  return withStaffOfficeBootstrap(async () => {
    const { data, error } = await supabase.rpc("admin_assign_staff_office", {
      p_employee_id: input.employeeId,
      p_office_id: input.officeId,
    });
    if (error) throw new Error(rpcErrorMessage(error));
    return data as StaffOfficeAssignment;
  });
}

export async function removeStaffOfficeAssignment(employeeId: string): Promise<void> {
  await tryBootstrapStaffAttendanceOffices();
  return withStaffOfficeBootstrap(async () => {
    const { error } = await supabase.rpc("admin_remove_staff_office_assignment", {
      p_employee_id: employeeId,
    });
    if (error) throw new Error(rpcErrorMessage(error));
  });
}
