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

async function readAccessToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

function isMissingRpcError(msg: string): boolean {
  return /does not exist|42883|could not find the function|PGRST202|relation .* does not exist/i.test(msg);
}

function isApiUnavailableError(msg: string): boolean {
  return /404|500|503|not configured|fetch failed|Failed to fetch|network|FUNCTION_INVOCATION/i.test(msg);
}

async function ensureStaffOfficesSchema(): Promise<void> {
  if (typeof window === "undefined") return;
  const token = await readAccessToken();
  if (!token) return;
  const origin = window.location.origin.replace(/\/$/, "");
  await fetch(`${origin}/api/ensure-staff-attendance-offices`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  }).catch(() => undefined);
}

async function staffOfficeRpcViaApi<T>(
  name: string,
  args: Record<string, unknown> = {}
): Promise<T> {
  if (typeof window === "undefined") {
    throw new Error("Staff office API requires browser session");
  }

  const token = await readAccessToken();
  if (!token) throw new Error("Not signed in");

  const origin = window.location.origin.replace(/\/$/, "");
  await ensureStaffOfficesSchema();
  const res = await fetch(`${origin}/api/staff-office-rpc`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name, args }),
  });

  const json = (await res.json().catch(() => ({}))) as {
    data?: T;
    error?: { message?: string };
    message?: string;
  };

  if (!res.ok || json.error) {
    throw new Error(json.error?.message || json.message || `Staff office request failed (${res.status})`);
  }

  return json.data as T;
}

async function legacyStaffOfficeRpc<T>(name: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(name, args);
  if (error) throw new Error(rpcErrorMessage(error));
  return data as T;
}

async function callStaffOfficeRpc<T>(name: string, args: Record<string, unknown> = {}): Promise<T> {
  try {
    return await legacyStaffOfficeRpc<T>(name, args);
  } catch (directErr) {
    const directMsg = directErr instanceof Error ? directErr.message : String(directErr);
    if (!isMissingRpcError(directMsg)) {
      throw directErr;
    }
    return staffOfficeRpcViaApi<T>(name, args);
  }
}

async function listOfficesFromTable(activeOnly: boolean): Promise<StaffAttendanceOffice[]> {
  let q = supabase.from("staff_attendance_offices").select("*").order("name");
  if (activeOnly) q = q.eq("is_active", true);
  const { data, error } = await q;
  if (error) throw new Error(rpcErrorMessage(error));
  return (data || []) as StaffAttendanceOffice[];
}

async function listAssignmentsFromTable(): Promise<StaffOfficeAssignment[]> {
  const { data, error } = await supabase
    .from("staff_office_assignments")
    .select("*")
    .order("assigned_at", { ascending: false });
  if (error) throw new Error(rpcErrorMessage(error));
  return (data || []) as StaffOfficeAssignment[];
}

export async function listStaffAttendanceOffices(activeOnly = false): Promise<StaffAttendanceOffice[]> {
  try {
    const data = await callStaffOfficeRpc<StaffAttendanceOffice[]>("admin_list_staff_attendance_offices", {
      p_active_only: activeOnly,
    });
    return Array.isArray(data) ? data : [];
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (!isMissingRpcError(msg) && !isApiUnavailableError(msg)) {
      throw e;
    }
    return listOfficesFromTable(activeOnly);
  }
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
  return callStaffOfficeRpc<StaffAttendanceOffice>("admin_upsert_staff_attendance_office", {
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
}

export async function deleteStaffAttendanceOffice(id: string): Promise<void> {
  await callStaffOfficeRpc("admin_delete_staff_attendance_office", { p_id: id });
}

export async function listStaffOfficeAssignments(): Promise<StaffOfficeAssignment[]> {
  try {
    const data = await callStaffOfficeRpc<StaffOfficeAssignment[]>("admin_list_staff_office_assignments");
    return Array.isArray(data) ? data : [];
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (!isMissingRpcError(msg) && !isApiUnavailableError(msg)) {
      throw e;
    }
    return listAssignmentsFromTable();
  }
}

export async function assignStaffOffice(input: {
  employeeId: string;
  officeId: string;
  assignedBy?: string | null;
}): Promise<StaffOfficeAssignment> {
  void input.assignedBy;
  return callStaffOfficeRpc<StaffOfficeAssignment>("admin_assign_staff_office", {
    p_employee_id: input.employeeId,
    p_office_id: input.officeId,
  });
}

export async function removeStaffOfficeAssignment(employeeId: string): Promise<void> {
  await callStaffOfficeRpc("admin_remove_staff_office_assignment", {
    p_employee_id: employeeId,
  });
}
