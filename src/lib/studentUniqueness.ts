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
  let parsed: unknown = data;
  if (typeof data === "string") {
    try {
      parsed = JSON.parse(data) as unknown;
    } catch {
      parsed = data;
    }
  }
  const row = (parsed && typeof parsed === "object" ? parsed : {}) as Record<string, unknown>;
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

function buildRpcArgs(input: ValidateStudentUniquenessInput) {
  return {
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
  };
}

function shouldUseUniquenessApiFallback(msg: string): boolean {
  return (
    /validate_student_uniqueness|does not exist on RDS|does not exist|42883|PGRST202/i.test(msg) ||
    /btrim\(uuid\)|invalid input syntax for type uuid|cannot cast|22P02|42846/i.test(msg) ||
    /could not validate student data/i.test(msg) ||
    /student validation could not be initialized/i.test(msg)
  );
}

function isInfrastructureValidationFailure(msg: string): boolean {
  const m = msg.trim();
  if (!m) return true;
  return (
    shouldUseUniquenessApiFallback(m) ||
    /method not allowed/i.test(m) ||
    /DATABASE_URL is not configured/i.test(m) ||
    /authorization bearer token required/i.test(m)
  );
}

async function bootstrapStudentUniquenessSchema(client: SupabaseClient): Promise<boolean> {
  try {
    const { error } = await client.rpc("student_ensure_uniqueness_schema");
    if (!error) return true;
    if (!shouldUseUniquenessApiFallback(error.message || "")) return false;
  } catch {
    /* fall through to HTTP ensure */
  }

  if (typeof window === "undefined") return false;

  const { data: sessionData } = await client.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) return false;

  const origin = window.location.origin.replace(/\/$/, "");
  for (const path of ["/api/ensure-student-uniqueness", "/api/student-uniqueness"]) {
    const res = await fetch(`${origin}${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: "bootstrap@invalid.local",
        excludeUserId: sessionData.session?.user?.id,
      }),
    }).catch(() => null);
    if (res?.ok) return true;
  }
  return false;
}

function shouldRetryUniquenessViaRpc(status: number, msg: string): boolean {
  return status === 405 || status === 404 || status === 503 || /method not allowed/i.test(msg);
}

async function validateStudentUniquenessViaRpc(
  client: SupabaseClient,
  input: ValidateStudentUniquenessInput
): Promise<StudentUniquenessResult> {
  const args = buildRpcArgs(input);
  const { data, error } = await client.rpc("validate_student_uniqueness", args);
  if (error) {
    const msg = error.message || "";
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

async function validateStudentUniquenessViaApi(
  client: SupabaseClient,
  input: ValidateStudentUniquenessInput
): Promise<StudentUniquenessResult> {
  if (typeof window === "undefined") {
    return {
      valid: false,
      message: "Student uniqueness validation requires a browser session.",
      emailTaken: false,
      phoneTaken: false,
      rollNumberTaken: false,
      registrationNumberTaken: false,
      universityRollNumberTaken: false,
    };
  }

  const { data: sessionData } = await client.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) {
    return {
      valid: false,
      message: "Not signed in",
      emailTaken: false,
      phoneTaken: false,
      rollNumberTaken: false,
      registrationNumberTaken: false,
      universityRollNumberTaken: false,
    };
  }

  const origin = window.location.origin.replace(/\/$/, "");
  const res = await fetch(`${origin}/api/student-uniqueness`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: buildRpcArgs(input).p_email,
      phone: buildRpcArgs(input).p_phone,
      rollNumber: buildRpcArgs(input).p_roll_number,
      registrationNumber: buildRpcArgs(input).p_registration_number,
      universityName: buildRpcArgs(input).p_university_name,
      universityRollNumber: buildRpcArgs(input).p_university_roll_number,
      excludeUserId: buildRpcArgs(input).p_exclude_user_id,
    }),
  });

  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const message = String(json.message || "Could not validate student data.");
    if (shouldRetryUniquenessViaRpc(res.status, message)) {
      const rpcResult = await validateStudentUniquenessViaRpc(client, input);
      if (rpcResult.valid || !shouldUseUniquenessApiFallback(rpcResult.message)) {
        return rpcResult;
      }
    }
    return {
      valid: false,
      message,
      emailTaken: false,
      phoneTaken: false,
      rollNumberTaken: false,
      registrationNumberTaken: false,
      universityRollNumberTaken: false,
    };
  }

  return parseRpcResult(json);
}

async function validateWithBootstrapRetry(
  client: SupabaseClient,
  input: ValidateStudentUniquenessInput
): Promise<StudentUniquenessResult> {
  let rpcResult = await validateStudentUniquenessViaRpc(client, input);
  if (rpcResult.valid || !shouldUseUniquenessApiFallback(rpcResult.message)) {
    return rpcResult;
  }

  if (await bootstrapStudentUniquenessSchema(client)) {
    rpcResult = await validateStudentUniquenessViaRpc(client, input);
    if (rpcResult.valid || !shouldUseUniquenessApiFallback(rpcResult.message)) {
      return rpcResult;
    }
  }

  const apiResult = await validateStudentUniquenessViaApi(client, input);
  if (apiResult.valid || !isInfrastructureValidationFailure(apiResult.message)) {
    return apiResult;
  }

  if (await bootstrapStudentUniquenessSchema(client)) {
    return validateStudentUniquenessViaRpc(client, input);
  }

  return apiResult;
}

/** Browser: RDS RPC + bootstrap; `/api/student-uniqueness` when RPC schema is stale. Server: direct RPC. */
export async function validateStudentUniqueness(
  client: SupabaseClient,
  input: ValidateStudentUniquenessInput
): Promise<StudentUniquenessResult> {
  if (typeof window !== "undefined") {
    return validateWithBootstrapRetry(client, input);
  }

  const args = buildRpcArgs(input);
  let data: unknown;
  let error: { message?: string } | null = null;
  try {
    const res = await client.rpc("validate_student_uniqueness", args);
    data = res.data;
    error = res.error;
  } catch (rpcErr) {
    const msg = rpcErr instanceof Error ? rpcErr.message : String(rpcErr);
    if (shouldUseUniquenessApiFallback(msg)) {
      return validateStudentUniquenessViaApi(client, input);
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

  if (error) {
    const msg = error.message || "";
    if (shouldUseUniquenessApiFallback(msg)) {
      return validateStudentUniquenessViaApi(client, input);
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
    if (isInfrastructureValidationFailure(result.message)) {
      console.warn(
        "[student-uniqueness] Pre-save validation unavailable; continuing save:",
        result.message
      );
      return;
    }
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
