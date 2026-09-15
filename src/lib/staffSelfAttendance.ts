import { supabase } from "@/integrations/supabase/client";

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
  office: {
    latitude: number;
    longitude: number;
    radius_meters: number;
    label: string | null;
  } | null;
};

export async function fetchStaffSelfAttendanceStatus(): Promise<StaffAttendanceStatusPayload> {
  const { data, error } = await supabase.rpc("staff_self_attendance_status");
  if (error) throw error;
  return data as StaffAttendanceStatusPayload;
}

export async function staffSelfCheckIn(input: {
  latitude: number;
  longitude: number;
  faceScore: number;
}) {
  const { data, error } = await supabase.rpc("staff_self_check_in", {
    p_latitude: input.latitude,
    p_longitude: input.longitude,
    p_face_score: input.faceScore,
  });
  if (error) throw error;
  return data;
}

export async function staffSelfCheckOut(input: {
  latitude: number;
  longitude: number;
  faceScore: number;
}) {
  const { data, error } = await supabase.rpc("staff_self_check_out", {
    p_latitude: input.latitude,
    p_longitude: input.longitude,
    p_face_score: input.faceScore,
  });
  if (error) throw error;
  return data;
}
