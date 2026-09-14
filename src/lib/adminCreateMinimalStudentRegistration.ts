import type { SupabaseClient } from "@supabase/supabase-js";
import { REGISTRATION_PASSWORD_MIN_LENGTH } from "@/lib/registrationPassword";
import { markLeadCrmConvertedByEmail } from "@/lib/leadAssignment";
import {
  resolveEngineeringUniversityNames,
  resolveStudentTrack,
  type StudentTrack,
} from "@/lib/studentTrack";
import { parseJsonField } from "@/lib/parseJsonField";
import { siteApiUrl } from "@/lib/siteApi";

export type AdminAddRegistrationInput = {
  email: string;
  password: string;
  phone: string;
  fullName?: string;
  paymentId?: string;
  amountPaise?: number;
  registrationSource?: string;
  universityName?: string;
  collegeName?: string;
  course?: string;
  degree?: string;
  department?: string;
  subject?: string;
  /** Explicit track from Add Registration academic flow. */
  studentTrack?: StudentTrack;
  /** True when engineering BEU/details form was completed. */
  hasEngineeringDetails?: boolean;
};

export type AdminAddRegistrationResult = {
  userId: string;
  email: string;
  registrationId: string | null;
  paymentId: string;
  paid: boolean;
};

function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

function normalizePhone(raw: string): string {
  return raw.replace(/\D/g, "").slice(-10);
}

export function validateAdminAddRegistrationInput(input: AdminAddRegistrationInput): string | null {
  const email = normalizeEmail(input.email);
  if (!email.includes("@")) return "Enter a valid email address.";
  const phone = normalizePhone(input.phone);
  if (phone.length < 10) return "Enter a valid 10-digit mobile number.";
  const password = input.password.trim();
  if (password.length < REGISTRATION_PASSWORD_MIN_LENGTH) {
    return `Password must be at least ${REGISTRATION_PASSWORD_MIN_LENGTH} characters.`;
  }
  const payId = String(input.paymentId || "").trim();
  if (payId && !/^pay_/i.test(payId)) {
    return "Payment id must start with pay_ (Razorpay id), or leave blank.";
  }
  return null;
}

/**
 * Try the full 13-param version of the RPC (available after migration
 * 20260723120000_admin_create_registration_full_params.sql is applied).
 */
async function tryFullRpc(
  client: SupabaseClient,
  email: string,
  password: string,
  phone: string,
  fullName: string | undefined,
  paymentId: string | undefined,
  amountPaise: number | undefined,
  input: AdminAddRegistrationInput
) {
  return client.rpc("admin_create_minimal_student_registration", {
    p_email: email,
    p_password: password,
    p_phone: phone,
    p_full_name: fullName ?? null,
    p_payment_id: paymentId ?? null,
    p_amount_paise: amountPaise ?? null,
    p_registration_source: input.registrationSource ?? null,
    p_university_name: String(input.universityName || "").trim() || null,
    p_college_name: String(input.collegeName || "").trim() || null,
    p_course: String(input.course || "").trim() || null,
    p_degree: String(input.degree || "").trim() || null,
    p_department: String(input.department || "").trim() || null,
    p_subject: String(input.subject || "").trim() || null,
  });
}

/**
 * Fallback: call the original 6-param version (the one guaranteed to exist in DB).
 */
async function tryLegacyRpc(
  client: SupabaseClient,
  email: string,
  password: string,
  phone: string,
  fullName: string | undefined,
  paymentId: string | undefined,
  amountPaise: number | undefined
) {
  return client.rpc("admin_create_minimal_student_registration", {
    p_email: email,
    p_password: password,
    p_phone: phone,
    p_full_name: fullName ?? null,
    p_payment_id: paymentId ?? null,
    p_amount_paise: amountPaise ?? null,
  });
}

/**
 * After the legacy RPC creates the student, patch academic fields directly.
 * This is only needed when the full-param RPC isn't deployed yet.
 */
async function patchAcademicFields(
  client: SupabaseClient,
  email: string,
  input: AdminAddRegistrationInput
) {
  const patch: Record<string, string> = {};
  if (input.universityName?.trim()) patch.university_name = input.universityName.trim();
  if (input.collegeName?.trim())    patch.college_name    = input.collegeName.trim();
  if (input.course?.trim())         patch.course          = input.course.trim();
  if (input.degree?.trim())         patch.internship_domain = input.degree.trim();
  if (Object.keys(patch).length === 0) return; // nothing to patch

  const { error } = await client
    .from("students")
    .update(patch)
    .eq("email", email);

  if (error) {
    // Non-fatal: base registration succeeded, just log
    console.warn("[add-registration] academic patch failed:", error.message);
  }
}

function isSignatureMismatch(code: string | undefined, msg: string): boolean {
  // PGRST202 = "Could not find the function" (wrong number/names of params)
  return (
    code === "PGRST202" ||
    /could not find the function/i.test(msg) ||
    /function.*does not exist/i.test(msg) ||
    /no function matches/i.test(msg)
  );
}

function isBrokenRdsRegistrationRpc(code: string | undefined, msg: string): boolean {
  return (
    code === "42883" ||
    /btrim\(uuid\)/i.test(msg) ||
    /needs a database update/i.test(msg)
  );
}

function rpcNeedsApiFallback(code: string | undefined, msg: string): boolean {
  return isSignatureMismatch(code, msg) || isBrokenRdsRegistrationRpc(code, msg);
}

/** REST fallback when Postgres RPC is missing or broken on RDS (works on deployed Lambda today). */
async function tryAdminRegisterApi(
  client: SupabaseClient,
  email: string,
  password: string,
  phone: string,
  fullName: string | undefined,
  paymentId: string | undefined,
  amountPaise: number | undefined,
  input: AdminAddRegistrationInput
): Promise<AdminAddRegistrationResult> {
  const {
    data: { session },
  } = await client.auth.getSession();
  const adminId = session?.user?.id;
  const token = session?.access_token;
  if (!adminId || !token) {
    throw new Error("Your session expired. Please sign in again and retry.");
  }

  const amountRupees =
    amountPaise != null && Number.isFinite(amountPaise)
      ? Math.round(amountPaise) / 100
      : 500;

  const res = await fetch(siteApiUrl("/api/admin-register"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      admin_id: adminId,
      student_data: {
        email,
        full_name: fullName || "Student",
        contact_number: phone,
        password,
        university_name: input.universityName?.trim() || null,
        college_name: input.collegeName?.trim() || null,
        course: input.course?.trim() || "Internship",
        internship_domain: input.degree?.trim() || input.course?.trim() || "Internship",
        degree: input.degree?.trim() || null,
        department: input.department?.trim() || null,
        subject: input.subject?.trim() || null,
        metadata: {
          source: input.registrationSource || "admin_add_registration",
          registration_source: input.registrationSource || "admin_add_registration",
        },
      },
      payment_amount: amountRupees,
      transaction_id: paymentId || undefined,
    }),
  });

  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok || body.success !== true) {
    const msg = String(body.message || body.error || "Admin registration API failed.");
    if (/already registered|duplicate/i.test(msg)) {
      throw new Error("A student with this email already exists. Use a different email.");
    }
    throw new Error(msg);
  }

  let userId = String(body.userId || body.user_id || "");
  let registrationId = body.registrationId ? String(body.registrationId) : null;
  let resolvedPaymentId = String(body.paymentId || paymentId || "");

  if (!userId || !registrationId) {
    const { data: studentRow, error: lookupErr } = await client
      .from("students")
      .select("id, registration_id, metadata")
      .eq("email", email)
      .maybeSingle();
    if (lookupErr) throw new Error(lookupErr.message);
    if (!studentRow) throw new Error("Registration succeeded but student record was not found.");
    if (!userId) userId = String((studentRow as { id?: string }).id || "");
    if (!registrationId) {
      registrationId = (studentRow as { registration_id?: string | null }).registration_id ?? null;
    }
    const meta = parseJsonField((studentRow as { metadata?: unknown }).metadata) || {};
    if (!resolvedPaymentId) {
      resolvedPaymentId = String(meta.razorpay_payment_id || meta.payment_id || paymentId || "");
    }
  }

  return {
    userId,
    email,
    registrationId,
    paymentId: resolvedPaymentId,
    paid: true,
  };
}

const REGISTRATION_SETUP_HINT =
  "Add Registration could not complete. Ask an admin to run: npm run aws:rds:admin-registration";

export async function adminCreateMinimalStudentRegistration(
  client: SupabaseClient,
  input: AdminAddRegistrationInput
): Promise<AdminAddRegistrationResult> {
  const validationError = validateAdminAddRegistrationInput(input);
  if (validationError) throw new Error(validationError);

  const email       = normalizeEmail(input.email);
  const phone       = normalizePhone(input.phone);
  const password    = input.password.trim();
  const fullName    = String(input.fullName || "").trim() || undefined;
  const paymentId   = String(input.paymentId || "").trim() || undefined;
  const amountPaise =
    input.amountPaise != null && Number.isFinite(input.amountPaise)
      ? Math.round(input.amountPaise)
      : undefined;

  // 1️⃣  Try the full 13-param RPC first (works after migration is applied)
  let result = await tryFullRpc(client, email, password, phone, fullName, paymentId, amountPaise, input);

  // 2️⃣  If the DB doesn't know the extra params yet, fall back to the 6-param version
  if (result.error && isSignatureMismatch(result.error.code, String(result.error.message || ""))) {
    console.info("[add-registration] Full RPC not deployed yet, falling back to 6-param version.");
    result = await tryLegacyRpc(client, email, password, phone, fullName, paymentId, amountPaise);

    if (!result.error) {
      await patchAcademicFields(client, email, input);
    }
  }

  const { data, error } = result;

  if (error) {
    const msg = String(error.message || "");
    if (rpcNeedsApiFallback(error.code, msg)) {
      console.info("[add-registration] RPC unavailable on RDS, using /api/admin-register fallback.");
      try {
        const apiResult = await tryAdminRegisterApi(
          client,
          email,
          password,
          phone,
          fullName,
          paymentId,
          amountPaise,
          input
        );
        return finalizeAdminRegistration(client, apiResult, input, email);
      } catch (apiErr) {
        const apiMsg = apiErr instanceof Error ? apiErr.message : String(apiErr);
        throw new Error(`${apiMsg} (${REGISTRATION_SETUP_HINT})`);
      }
    }
    if (/access denied/i.test(msg)) {
      throw new Error("You do not have permission to add registrations. Please contact the admin.");
    }
    if (/already exists|duplicate/i.test(msg)) {
      throw new Error("A student with this email already exists. Use a different email.");
    }
    throw new Error(msg || "Could not create student registration.");
  }

  const row = (data || {}) as Record<string, unknown>;
  if (row.ok !== true) {
    throw new Error("Registration could not be completed. Please try again.");
  }

  return finalizeAdminRegistration(
    client,
    {
      userId: String(row.user_id || ""),
      email: String(row.email || email),
      registrationId: row.registration_id ? String(row.registration_id) : null,
      paymentId: String(row.payment_id || paymentId || ""),
      paid: row.paid === true,
    },
    input,
    email
  );
}

async function finalizeAdminRegistration(
  client: SupabaseClient,
  result: AdminAddRegistrationResult,
  input: AdminAddRegistrationInput,
  email: string
): Promise<AdminAddRegistrationResult> {
  const userId = result.userId;
  const engNames = await resolveEngineeringUniversityNames(client);
  const track: StudentTrack =
    input.studentTrack ||
    (input.hasEngineeringDetails
      ? "engineering"
      : resolveStudentTrack(
          {
            university_name: input.universityName,
            department: input.degree || input.department,
            beu_course: input.hasEngineeringDetails ? input.degree : undefined,
            beu_branch: input.hasEngineeringDetails ? input.department : undefined,
            metadata: {
              registration_source: input.registrationSource,
              source: input.registrationSource,
            },
          },
          engNames
        ));

  if (userId) {
    try {
      const { data: existing } = await client
        .from("students")
        .select("metadata")
        .eq("id", userId)
        .maybeSingle();
      const prevMeta =
        parseJsonField((existing as { metadata?: unknown } | null)?.metadata) || {};
      await client
        .from("students")
        .update({
          metadata: {
            ...prevMeta,
            student_track: track,
            source: prevMeta.source || input.registrationSource || null,
            registration_source:
              prevMeta.registration_source || input.registrationSource || null,
          },
        })
        .eq("id", userId);
    } catch (e) {
      console.warn("[add-registration] student_track metadata skipped:", e);
    }

    // Non-Technical only — Engineering students belong in Engineering Directory.
    if (track !== "engineering") {
      try {
        await client.rpc("mark_student_directory_visible", { p_user_id: userId });
      } catch (e) {
        console.warn("[add-registration] mark_student_directory_visible skipped:", e);
      }
    }
  }

  await markLeadCrmConvertedByEmail(
    client,
    String(result.email || email),
    "Auto-converted: added to registration"
  );

  return result;
}
