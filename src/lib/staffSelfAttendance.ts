import { supabase } from "@/integrations/supabase/client";

export type StaffAttendanceOfficePayload = {
  id: string;
  name: string;
  address: string | null;
  latitude: number;
  longitude: number;
  radius_meters: number;
  max_gps_accuracy_m: number | null;
  require_face: boolean;
  require_geo: boolean;
};

export type StaffAttendanceStatusPayload = {
  attendance_date: string;
  ist_minutes: number;
  check_in_at: string | null;
  check_out_at: string | null;
  has_check_in: boolean;
  has_check_out: boolean;
  can_check_in: boolean;
  can_check_out: boolean;
  check_in_opens_at: string;
  check_out_opens_at: string;
  office_assigned: boolean;
  face_registered?: boolean;
  face_descriptor?: number[] | null;
  office: StaffAttendanceOfficePayload | null;
};

async function readAccessToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

/** Old Lambda RPC omits office_assigned; derive it from office.id when present. */
export function normalizeStaffAttendanceStatus(
  raw: StaffAttendanceStatusPayload | null | undefined
): StaffAttendanceStatusPayload | null {
  if (!raw) return null;
  const office = raw.office;
  const officeAssigned =
    typeof raw.office_assigned === "boolean"
      ? raw.office_assigned
      : Boolean(office && typeof office === "object" && "id" in office && office.id);
  const faceRegistered =
    typeof raw.face_registered === "boolean"
      ? raw.face_registered
      : Boolean(
          raw.face_descriptor &&
            Array.isArray(raw.face_descriptor) &&
            raw.face_descriptor.length >= 64
        );
  return {
    ...raw,
    office_assigned: officeAssigned,
    office: office ?? null,
    face_registered: faceRegistered,
  };
}

/** Staff self attendance must use Vercel /api/staff-office-rpc (per-employee office assignments on RDS). */
async function callStaffSelfRpc<T>(name: string, args: Record<string, unknown> = {}): Promise<T> {
  if (typeof window === "undefined") {
    throw new Error("Staff attendance API requires browser session");
  }

  const token = await readAccessToken();
  if (!token) throw new Error("Not signed in");

  const origin = window.location.origin.replace(/\/$/, "");
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
    throw new Error(json.error?.message || json.message || `Staff attendance request failed (${res.status})`);
  }

  return json.data as T;
}

export async function fetchStaffSelfAttendanceStatus(): Promise<StaffAttendanceStatusPayload> {
  const data = await callStaffSelfRpc<StaffAttendanceStatusPayload>("staff_self_attendance_status");
  return normalizeStaffAttendanceStatus(data)!;
}

export async function staffSelfCheckIn(input: {
  latitude: number;
  longitude: number;
  faceScore: number;
  gpsAccuracyM?: number | null;
}) {
  return callStaffSelfRpc("staff_self_check_in", {
    p_latitude: input.latitude,
    p_longitude: input.longitude,
    p_face_score: input.faceScore,
    p_gps_accuracy_m: input.gpsAccuracyM ?? null,
  });
}

export async function staffRegisterFace(input: {
  faceDescriptor: number[];
  photoUrl: string;
}): Promise<{ ok: boolean; profile_image_url?: string }> {
  return callStaffSelfRpc("staff_register_face", {
    p_face_descriptor: input.faceDescriptor,
    p_photo_url: input.photoUrl,
  });
}

export async function staffSelfCheckOut(input: {
  latitude: number;
  longitude: number;
  faceScore: number;
  gpsAccuracyM?: number | null;
}) {
  return callStaffSelfRpc("staff_self_check_out", {
    p_latitude: input.latitude,
    p_longitude: input.longitude,
    p_face_score: input.faceScore,
    p_gps_accuracy_m: input.gpsAccuracyM ?? null,
  });
}
