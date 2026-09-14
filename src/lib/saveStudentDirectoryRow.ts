import type { SupabaseClient } from "@supabase/supabase-js";
import {
  assertStudentUniqueness,
  formatStudentUniquenessError,
} from "@/lib/studentUniqueness";

type StudentDirectoryPatch = Record<string, unknown>;

function metaUniversityRoll(meta: unknown): string {
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) return "";
  const m = meta as Record<string, unknown>;
  return String(m.university_roll_number || m.universityRollNumber || "").trim();
}

/** Admin/staff save with centralized duplicate checks (DB trigger is the final guard). */
export async function saveStudentDirectoryUpdate(
  client: SupabaseClient,
  userId: string,
  patch: StudentDirectoryPatch
) {
  await assertStudentUniqueness(client, {
    email: String(patch.email || ""),
    phone: String(patch.contact_number || ""),
    rollNumber: String(patch.roll_number || ""),
    registrationNumber: String(patch.registration_id || ""),
    universityName: String(patch.university_name || ""),
    universityRollNumber: metaUniversityRoll(patch.metadata),
    excludeUserId: userId,
  }).catch((err) => {
    throw new Error(formatStudentUniquenessError(err));
  });

  const { data, error } = await client
    .from("students")
    .update(patch)
    .eq("id", userId)
    .select("id, email")
    .maybeSingle();

  if (error) {
    throw new Error(formatStudentUniquenessError(error));
  }
  return data;
}
