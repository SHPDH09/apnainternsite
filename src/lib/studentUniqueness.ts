import type { SupabaseClient } from "@supabase/supabase-js";
import {
  normalizeEmail,
  normalizePhone,
  normalizeRegistrationNumber,
  normalizeRollNumber,
  normalizeUniversityKey,
} from "@/lib/studentFieldNormalize";

export type StudentUniquenessResult = {
  valid: boolean;
  message: string;
  emailTaken: boolean;
  phoneTaken: boolean;
  rollNumberTaken: boolean;
  registrationNumberTaken: boolean;
  universityRollNumberTaken: boolean;
};

function parseRpcResult(data: unknown): StudentUniquenessResult {
  const row = (data && typeof data === "object" ? data : {}) as Record<string, unknown>;
  return {
    valid: row.valid === true,
    message: String(row.message || "").trim(),
    emailTaken: row.email_taken === true,
    phoneTaken: row.phone_taken === true,
    rollNumberTaken: row.roll_number_taken === true,
    registrationNumberTaken: row.registration_number_taken === true,
    universityRollNumberTaken: row.university_roll_number_taken === true,
  };
}

export type ValidateStudentUniquenessInput = {
  email?: string;
  phone?: string;
  rollNumber?: string;
  registrationNumber?: string;
  universityName?: string;
  universityRollNumber?: string;
  excludeUserId?: string | null;
};

/** Server-side uniqueness check via RDS RPC — use before every create/update. */
export async function validateStudentUniqueness(
  client: SupabaseClient,
  input: ValidateStudentUniquenessInput
): Promise<StudentUniquenessResult> {
  const { data, error } = await client.rpc("validate_student_uniqueness", {
    p_email: input.email ? normalizeEmail(input.email) : null,
    p_phone: input.phone ? normalizePhone(input.phone) : null,
    p_roll_number: input.rollNumber ? normalizeRollNumber(input.rollNumber) : null,
    p_registration_number: input.registrationNumber
      ? normalizeRegistrationNumber(input.registrationNumber)
      : null,
    p_university_name: input.universityName
      ? normalizeUniversityKey(input.universityName)
      : null,
    p_university_roll_number: input.universityRollNumber
      ? normalizeRollNumber(input.universityRollNumber)
      : null,
    p_exclude_user_id: input.excludeUserId || null,
  });

  if (error) {
    const msg = error.message || "";
    if (/validate_student_uniqueness|does not exist|42883|PGRST202/i.test(msg)) {
      return {
        valid: false,
        message:
          "Student uniqueness validation is not deployed on the database yet. Apply migration 20260726120000_global_student_uniqueness.sql.",
        emailTaken: false,
        phoneTaken: false,
        rollNumberTaken: false,
        registrationNumberTaken: false,
        universityRollNumberTaken: false,
      };
    }
    return {
      valid: false,
      message: msg || "Could not validate student data.",
      emailTaken: false,
      phoneTaken: false,
      rollNumberTaken: false,
      registrationNumberTaken: false,
      universityRollNumberTaken: false,
    };
  }

  return parseRpcResult(data);
}

export async function assertStudentUniqueness(
  client: SupabaseClient,
  input: ValidateStudentUniquenessInput
): Promise<void> {
  const result = await validateStudentUniqueness(client, input);
  if (!result.valid) {
    throw new Error(result.message || "Duplicate student data.");
  }
}

/** Map Postgres unique-violation / RPC errors to user-friendly messages. */
export function formatStudentUniquenessError(raw: unknown): string {
  const msg = raw instanceof Error ? raw.message : String(raw ?? "");
  const lower = msg.toLowerCase();
  if (/email.*already|already registered.*email|uq_students_email/i.test(lower)) {
    return "This email address is already registered.";
  }
  if (/phone.*already|mobile.*already|uq_students_phone/i.test(lower)) {
    return "This phone number is already registered.";
  }
  if (/roll number.*already|uq_students_university_roll/i.test(lower)) {
    return "This university roll number is already registered.";
  }
  if (/registration number.*already|duplicate registration|uq_students_university_reg/i.test(lower)) {
    return "This university registration number is already registered.";
  }
  if (/23505|unique constraint|duplicate key/i.test(lower)) {
    return "This student record conflicts with an existing account. Check email, phone, roll, and registration number.";
  }
  return msg.trim() || "Could not save student record.";
}
