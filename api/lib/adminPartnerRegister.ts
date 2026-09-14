import { randomUUID } from "node:crypto";
import { query } from "../../aws/server/db.js";
import { ensurePartnerApplicationsTables } from "../../aws/server/partner-applications-bootstrap.js";
import { createStudentAuthWithChosenPassword, REGISTRATION_PASSWORD_MIN_LENGTH } from "./registrationPassword.js";
import type { ServerDbLike } from "./rdsAdapter.js";

const ALLOWED_KINDS = new Set(["cyber_cafe", "referral", "coupon"]);

export type AdminPartnerRegisterInput = {
  partner_kind: string;
  full_name: string;
  email: string;
  password: string;
  contact_number: string;
  payload: Record<string, unknown>;
};

function generateReferralCode(): string {
  const hex = randomUUID().replace(/-/g, "").slice(0, 12);
  return `ref_${hex}`.toLowerCase();
}

function generateCouponCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "CPN-";
  for (let i = 0; i < 8; i++) {
    s += chars[Math.floor(Math.random() * chars.length)];
  }
  return s;
}

function generateCouponCodeFromName(fullName: string): string {
  const parts = fullName
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, "")
    .split(/\s+/)
    .filter(Boolean);
  let base =
    parts.length >= 2 ? `${parts[0]}${parts[parts.length - 1]}` : parts[0] || "PARTNER";
  base = base.replace(/[^A-Z0-9]/g, "").slice(0, 14) || "PARTNER";
  return `CPN-${base}`;
}

function resolveAccessMode(partnerKind: string, payload: Record<string, unknown>): string {
  const explicit = String(payload.access_mode || "").trim();
  if (explicit === "referral_only" || explicit === "coupon_only" || explicit === "both") {
    return explicit;
  }
  if (partnerKind === "coupon") return "coupon_only";
  if (partnerKind === "referral") {
    const mode = String(payload.referral_apply_mode || "referral_only");
    if (mode === "coupon_only" || mode === "both") return mode;
    return "referral_only";
  }
  return "both";
}

function shouldCreateCoupon(partnerKind: string, payload: Record<string, unknown>): boolean {
  const mode = resolveAccessMode(partnerKind, payload);
  return mode === "coupon_only" || mode === "both";
}

function parseEmailList(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.map((x) => String(x).trim().toLowerCase()).filter(Boolean);
  }
  if (typeof raw === "string") {
    return raw
      .split(/[\n,;]+/)
      .map((x) => x.trim().toLowerCase())
      .filter(Boolean);
  }
  return [];
}

function resolveUniversityId(
  unis: Array<{ id: string; name: string }>,
  universityName: string
): string {
  const raw = universityName.trim();
  if (!raw) return "";
  const exact = unis.find((u) => u.name === raw);
  if (exact) return exact.id;
  const lower = raw.toLowerCase();
  const fuzzy = unis.find((u) => {
    const n = String(u.name || "").toLowerCase();
    return n === lower || n.includes(lower) || lower.includes(n);
  });
  return fuzzy?.id || "";
}

async function savePartnerAssignments(
  db: ServerDbLike,
  partnerId: string,
  universityNames: string[],
  collegeNames: string[]
): Promise<void> {
  if (!universityNames.length) return;

  const { data: uniData } = await db.from("universities").select("id, name").order("name");
  const unis = (uniData || []) as Array<{ id: string; name: string }>;
  const universityIds = universityNames
    .map((n) => resolveUniversityId(unis, n))
    .filter(Boolean);
  if (!universityIds.length) return;

  const { data: collegeRows } = await db
    .from("colleges")
    .select("id, name, university_id")
    .order("name");
  const colleges = (collegeRows || []) as Array<{ id: string; name: string; university_id: string }>;

  const collegeIds = colleges
    .filter((c) => {
      const name = String(c.name || "");
      return collegeNames.some((cn) => cn === name || name.includes(cn) || cn.includes(name));
    })
    .filter((c) => universityIds.includes(String(c.university_id)))
    .map((c) => String(c.id));

  const collegeByUni = new Map<string, string[]>();
  for (const cid of collegeIds) {
    const col = colleges.find((c) => String(c.id) === String(cid));
    if (!col) continue;
    const uid = String(col.university_id);
    const list = collegeByUni.get(uid) || [];
    list.push(String(col.id));
    collegeByUni.set(uid, list);
  }

  const rows: Array<{ partner_id: string; university_id: string; college_id: string | null }> = [];
  for (const uid of universityIds) {
    const specific = collegeByUni.get(uid) || [];
    if (!specific.length) {
      rows.push({ partner_id: partnerId, university_id: uid, college_id: null });
    } else {
      for (const collegeId of specific) {
        rows.push({ partner_id: partnerId, university_id: uid, college_id: collegeId });
      }
    }
  }

  if (!rows.length) return;

  const { error } = await db.from("referral_partner_assignments").insert(rows[0]);
  if (error && !/42P01|does not exist/i.test(error.message || "")) {
    throw new Error(error.message || "Could not save partner assignments");
  }
  for (let i = 1; i < rows.length; i++) {
    const { error: rowErr } = await db.from("referral_partner_assignments").insert(rows[i]);
    if (rowErr && !/42P01|does not exist/i.test(rowErr.message || "")) {
      throw new Error(rowErr.message || "Could not save partner assignments");
    }
  }
}

async function provisionReferralPartnerPortal(
  userId: string,
  partnerId: string,
  email: string,
  fullName: string,
  loginSecret: string
): Promise<void> {
  await query(
    `DELETE FROM public.user_roles
     WHERE user_id = $1::uuid
       AND role IN (
         'student'::public.app_role,
         'admin'::public.app_role,
         'staff'::public.app_role,
         'college_admin'::public.app_role,
         'referral_partner'::public.app_role
       )`,
    [userId]
  );

  await query(
    `INSERT INTO public.user_roles (user_id, role)
     VALUES ($1::uuid, 'referral_partner'::public.app_role)
     ON CONFLICT (user_id, role) DO NOTHING`,
    [userId]
  );

  await query(
    `UPDATE public.referral_partners
     SET auth_user_id = $1::uuid,
         partner_login_secret = $2,
         full_name = COALESCE(NULLIF(trim($3), ''), full_name),
         email = lower(trim($4)),
         updated_at = now()
     WHERE id = $5::uuid`,
    [userId, loginSecret.trim(), fullName, email, partnerId]
  );

  await query(
    `INSERT INTO public.profiles (id, full_name, email, contact_number)
     VALUES ($1::uuid, $2, lower(trim($3)), '')
     ON CONFLICT (id) DO UPDATE SET
       full_name = COALESCE(NULLIF(EXCLUDED.full_name, ''), public.profiles.full_name),
       email = EXCLUDED.email`,
    [userId, fullName.trim() || email, email]
  );
}

async function insertApprovedApplication(
  authUserId: string,
  reviewerId: string,
  input: AdminPartnerRegisterInput,
  approvedRecordId: string | null
): Promise<string> {
  const { rows } = await query<{ id: string }>(
    `INSERT INTO public.partner_applications (
       auth_user_id, partner_kind, status, full_name, email, contact_number, payload,
       reviewed_by, reviewed_at, approved_record_id, updated_at
     ) VALUES (
       $1::uuid, $2, 'approved', $3, lower(trim($4)), $5, $6::jsonb,
       $7::uuid, now(), $8::uuid, now()
     )
     RETURNING id`,
    [
      authUserId,
      input.partner_kind,
      input.full_name.trim(),
      input.email.trim(),
      input.contact_number.trim(),
      JSON.stringify(input.payload || {}),
      reviewerId,
      approvedRecordId,
    ]
  );
  const id = rows[0]?.id;
  if (!id) throw new Error("Partner application record could not be saved.");
  return id;
}

async function createReferralPartnerRecord(
  db: ServerDbLike,
  input: AdminPartnerRegisterInput,
  userId: string,
  password: string,
  reviewerId: string
): Promise<{ partnerId: string; applicationId: string }> {
  const payload = input.payload || {};
  const accessMode = resolveAccessMode(input.partner_kind, payload);
  const email = input.email.trim().toLowerCase();

  const { data: existing } = await db
    .from("referral_partners")
    .select("id")
    .eq("email", email)
    .maybeSingle();
  if (existing?.id) {
    throw new Error("A referral partner with this email already exists.");
  }

  let code = generateReferralCode();
  let partnerId = "";
  for (let attempt = 0; attempt < 10; attempt++) {
    try {
      const { rows } = await query<{ id: string }>(
        `INSERT INTO public.referral_partners (
           full_name, email, contact_number, city, college_name, referral_type,
           referral_code, auth_user_id, partner_login_secret, active, access_mode
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::uuid, $9, true, $10)
         RETURNING id`,
        [
          input.full_name.trim(),
          email,
          input.contact_number.trim(),
          String(payload.city || "").trim() || null,
          String(payload.college_name || payload.colleges?.[0] || "").trim() || null,
          String(payload.referral_type || "partner"),
          code,
          userId,
          password.trim(),
          accessMode,
        ]
      );
      partnerId = rows[0]?.id || "";
      if (partnerId) break;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (/23505|referral_code|duplicate/i.test(msg)) {
        code = generateReferralCode();
        continue;
      }
      throw err;
    }
  }

  if (!partnerId) throw new Error("Could not create referral partner record.");

  await provisionReferralPartnerPortal(userId, partnerId, email, input.full_name.trim(), password);

  const universities = Array.isArray(payload.universities)
    ? payload.universities.map(String).filter(Boolean)
    : payload.university_name
      ? [String(payload.university_name)]
      : [];
  const colleges = Array.isArray(payload.colleges)
    ? payload.colleges.map(String).filter(Boolean)
    : payload.college_name
      ? [String(payload.college_name)]
      : [];

  if (universities.length) {
    await savePartnerAssignments(db, partnerId, universities, colleges);
  }

  const applicationId = await insertApprovedApplication(userId, reviewerId, input, partnerId);

  if (shouldCreateCoupon(input.partner_kind, payload)) {
    const couponCode = String(
      payload.coupon_code || generateCouponCodeFromName(input.full_name.trim()) || generateCouponCode()
    ).trim().toUpperCase();
    const allowedEmails = parseEmailList(payload.allowed_student_emails ?? payload.student_emails);
    const couponAmount =
      payload.coupon_amount != null && String(payload.coupon_amount).trim() !== ""
        ? Number(payload.coupon_amount)
        : null;
    await query(
      `INSERT INTO public.referral_coupons (
         referral_partner_id, coupon_code, university_name, college_name,
         internship_domain, max_students, allowed_student_emails,
         valid_from, valid_to, active, application_id, coupon_amount
       ) VALUES (
         $1::uuid, $2, $3, $4, $5, $6, $7::jsonb, $8::timestamptz, $9::timestamptz, true, $10::uuid, $11
       )`,
      [
        partnerId,
        couponCode,
        String(payload.university_name || payload.universities?.[0] || "").trim() || null,
        String(payload.college_name || payload.colleges?.[0] || "").trim() || null,
        String(payload.internship_domain || payload.domain || "").trim() || null,
        payload.max_students != null ? Number(payload.max_students) : null,
        JSON.stringify(allowedEmails),
        payload.valid_from ? String(payload.valid_from) : null,
        payload.valid_to ? String(payload.valid_to) : null,
        applicationId,
        couponAmount,
      ]
    );
  }

  return { partnerId, applicationId };
}

async function createCybercafePartnerRecord(
  input: AdminPartnerRegisterInput,
  userId: string,
  reviewerId: string
): Promise<{ profileId: string; applicationId: string }> {
  const payload = input.payload || {};
  const email = input.email.trim().toLowerCase();
  const shopName = String(payload.shop_name || "").trim();
  const location = String(payload.location || payload.address || "").trim();

  if (!shopName) {
    throw new Error("Shop name is required for cyber cafe partners.");
  }

  const { rows: existing } = await query<{ id: string; status: string }>(
    `SELECT id, status FROM public.cybercafe_profiles WHERE lower(trim(email)) = $1 LIMIT 1`,
    [email]
  );
  if (existing[0]?.id && existing[0].status === "approved") {
    throw new Error("An approved cyber cafe partner with this email already exists.");
  }

  await query(
    `INSERT INTO public.profiles (id, full_name, email, contact_number)
     VALUES ($1::uuid, $2, $3, $4)
     ON CONFLICT (id) DO UPDATE SET
       full_name = COALESCE(NULLIF(EXCLUDED.full_name, ''), public.profiles.full_name),
       email = EXCLUDED.email,
       contact_number = COALESCE(NULLIF(EXCLUDED.contact_number, ''), public.profiles.contact_number)`,
    [userId, input.full_name.trim() || "Partner", email, input.contact_number.trim()]
  );

  await query(
    `INSERT INTO public.cybercafe_profiles (
       id, owner_name, email, phone, shop_name, location, status
     ) VALUES ($1::uuid, $2, $3, $4, $5, $6, 'approved')
     ON CONFLICT (id) DO UPDATE SET
       owner_name = EXCLUDED.owner_name,
       email = EXCLUDED.email,
       phone = EXCLUDED.phone,
       shop_name = EXCLUDED.shop_name,
       location = EXCLUDED.location,
       status = 'approved',
       rejection_reason = NULL`,
    [userId, input.full_name.trim() || "Owner", email, input.contact_number.trim(), shopName, location]
  );

  const applicationId = await insertApprovedApplication(userId, reviewerId, input, userId);
  return { profileId: userId, applicationId };
}

export async function adminRegisterPartner(
  db: ServerDbLike,
  reviewerId: string,
  rawInput: AdminPartnerRegisterInput
): Promise<{ ok: true; recordId: string; applicationId: string; partnerKind: string }> {
  const partnerKind = String(rawInput.partner_kind || "").trim();
  if (!ALLOWED_KINDS.has(partnerKind)) {
    throw new Error("Invalid partner type.");
  }

  const fullName = String(rawInput.full_name || "").trim();
  const email = String(rawInput.email || "").trim().toLowerCase();
  const contactNumber = String(rawInput.contact_number || "").trim();
  const password = String(rawInput.password || "").trim();

  if (!fullName || !email || !contactNumber || !password) {
    throw new Error("Name, email, phone, and password are required.");
  }
  if (password.length < REGISTRATION_PASSWORD_MIN_LENGTH) {
    throw new Error(`Password must be at least ${REGISTRATION_PASSWORD_MIN_LENGTH} characters.`);
  }

  const payload =
    rawInput.payload && typeof rawInput.payload === "object" && !Array.isArray(rawInput.payload)
      ? rawInput.payload
      : {};

  await ensurePartnerApplicationsTables();

  const { userId } = await createStudentAuthWithChosenPassword(db, {
    email,
    password,
    fullName,
  });

  const input: AdminPartnerRegisterInput = {
    partner_kind: partnerKind,
    full_name: fullName,
    email,
    password,
    contact_number: contactNumber,
    payload,
  };

  if (partnerKind === "cyber_cafe") {
    const { profileId, applicationId } = await createCybercafePartnerRecord(input, userId, reviewerId);
    return { ok: true, recordId: profileId, applicationId, partnerKind };
  }

  const { partnerId, applicationId } = await createReferralPartnerRecord(
    db,
    input,
    userId,
    password,
    reviewerId
  );
  return { ok: true, recordId: partnerId, applicationId, partnerKind };
}
