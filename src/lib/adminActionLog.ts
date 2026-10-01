import type { SupabaseClient } from "@supabase/supabase-js";

export type ActorRoleTag =
  | "super_admin"
  | "admin"
  | "staff"
  | "referral"
  | "college_admin"
  | "cybercafe"
  | "registration"
  | "student"
  | "system";

export type ActorContext = {
  user_id: string;
  admin_email: string;
  actor_role: ActorRoleTag;
  actor_tag: string;
  actor_name: string;
  registration_source?: string | null;
};

export type AdminLogRow = {
  id: string;
  user_id: string | null;
  admin_email: string | null;
  action_type: string;
  entity_type: string;
  entity_id: string | null;
  description: string | null;
  metadata: Record<string, unknown> | null;
  actor_role: string | null;
  actor_name: string | null;
  actor_tag: string | null;
  registration_source: string | null;
  created_at: string;
};

export const ACTOR_TAG_LABELS: Record<string, string> = {
  super_admin: "Super Admin",
  admin: "Admin",
  staff: "Staff",
  referral: "Referral",
  college_admin: "College Admin",
  cybercafe: "Cyber Cafe",
  registration: "Registration",
  student: "Student",
  system: "System",
  self: "Self Registration",
  admin_add_registration: "Admin Registration",
  admin_bulk_upload: "Bulk Upload",
  admin_student_data_upload: "Student Data Upload",
};

const ROLE_PRIORITY: ActorRoleTag[] = [
  "super_admin",
  "admin",
  "staff",
  "college_admin",
  "referral",
  "cybercafe",
];

function roleToTag(role: string): string {
  return ACTOR_TAG_LABELS[role] || role.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function pickPrimaryRole(roles: string[]): ActorRoleTag {
  for (const r of ROLE_PRIORITY) {
    if (roles.includes(r)) return r;
  }
  if (roles.includes("referral_partner")) return "referral";
  return "admin";
}

export async function resolveActorContext(
  supabase: SupabaseClient,
  userId: string,
  email: string
): Promise<ActorContext> {
  const normalizedEmail = (email || "").trim().toLowerCase();

  const [rolesRes, staffRes, profileRes, referralRes] = await Promise.all([
    supabase.from("user_roles").select("role").eq("user_id", userId),
    supabase
      .from("admin_staff")
      .select("id, full_name, email, role_tag")
      .or(`id.eq.${userId},email.ilike.${normalizedEmail}`)
      .maybeSingle(),
    supabase.from("profiles").select("full_name, email").eq("id", userId).maybeSingle(),
    normalizedEmail
      ? supabase
          .from("referral_partners")
          .select("full_name, email")
          .ilike("email", normalizedEmail)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);

  const roles = (rolesRes.data || []).map((r) => String(r.role || ""));
  const staff = staffRes.data;
  const profile = profileRes.data;
  const referral = referralRes.data;

  let actor_role: ActorRoleTag = pickPrimaryRole(roles);
  let actor_name =
    staff?.full_name?.trim() ||
    profile?.full_name?.trim() ||
    referral?.full_name?.trim() ||
    normalizedEmail.split("@")[0] ||
    "User";

  if (staff && !roles.includes("admin") && !roles.includes("super_admin")) {
    actor_role = "staff";
  }

  if (roles.includes("referral_partner") || referral) {
    actor_role = "referral";
    if (referral?.full_name) actor_name = referral.full_name.trim();
  }

  if (staff?.role_tag?.trim() && actor_role === "staff") {
    actor_name = staff.full_name?.trim() || actor_name;
  }

  return {
    user_id: userId,
    admin_email: email || staff?.email || profile?.email || "",
    actor_role,
    actor_tag: roleToTag(actor_role),
    actor_name,
    registration_source: null,
  };
}

export function formatActorLabel(log: Partial<AdminLogRow>): string {
  const tag =
    log.actor_tag ||
    (log.actor_role ? roleToTag(log.actor_role) : "") ||
    (log.metadata && typeof log.metadata.actor_tag === "string" ? log.metadata.actor_tag : "") ||
    "User";
  const name =
    log.actor_name ||
    (log.metadata && typeof log.metadata.actor_name === "string" ? log.metadata.actor_name : "") ||
    "";
  const email =
    log.admin_email ||
    (log.metadata && typeof log.metadata.actor_email === "string" ? log.metadata.actor_email : "") ||
    "";

  const parts = [tag];
  if (name) parts.push(name);
  if (email) parts.push(`(${email})`);
  return parts.join(" · ");
}

export function resolveRegistrationSourceLabel(
  source: string | null | undefined,
  metadata?: Record<string, unknown> | null
): string | null {
  const raw =
    source ||
    (metadata?.registration_source as string) ||
    (metadata?.added_by_role as string) ||
    (metadata?.source as string) ||
    null;
  if (!raw) return null;
  const key = raw.toLowerCase().replace(/\s+/g, "_");
  return ACTOR_TAG_LABELS[key] || raw;
}

export async function logAdminAction(
  supabase: SupabaseClient,
  params: {
    action_type: string;
    entity_type: string;
    description: string;
    entity_id?: string;
    metadata?: Record<string, unknown>;
    registration_source?: string;
  },
  cachedActor?: ActorContext | null
): Promise<void> {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const session = sessionData.session;
    if (!session?.user) return;

    const actor =
      cachedActor ||
      (await resolveActorContext(supabase, session.user.id, session.user.email || ""));

    const registration_source =
      params.registration_source ||
      (params.metadata?.registration_source as string | undefined) ||
      (params.metadata?.added_by as string | undefined) ||
      actor.registration_source ||
      null;

    const enrichedMetadata = {
      ...(params.metadata || {}),
      actor_role: actor.actor_role,
      actor_tag: actor.actor_tag,
      actor_name: actor.actor_name,
      actor_email: actor.admin_email,
      ...(registration_source ? { registration_source } : {}),
    };

    await supabase.from("admin_logs").insert({
      user_id: session.user.id,
      admin_email: session.user.email,
      action_type: params.action_type,
      entity_type: params.entity_type,
      entity_id: params.entity_id || null,
      description: params.description,
      metadata: enrichedMetadata,
      actor_role: actor.actor_role,
      actor_name: actor.actor_name,
      actor_tag: actor.actor_tag,
      registration_source,
      created_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error("Log Action Error:", err);
  }
}

export type AdminLogUserSummary = {
  user_id: string;
  admin_email: string;
  actor_name: string;
  actor_tag: string;
  actor_role: string;
  log_count: number;
  last_activity_at: string;
};

export async function fetchAdminLogUserSummaries(
  supabase: SupabaseClient,
  limit = 2000
): Promise<AdminLogUserSummary[]> {
  const { data, error } = await supabase
    .from("admin_logs")
    .select("user_id, admin_email, actor_name, actor_tag, actor_role, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;

  const byUser = new Map<string, AdminLogUserSummary>();

  for (const row of data || []) {
    const uid = row.user_id || row.admin_email || "unknown";
    const existing = byUser.get(uid);
    if (!existing) {
      byUser.set(uid, {
        user_id: row.user_id || "",
        admin_email: row.admin_email || "",
        actor_name: row.actor_name || "",
        actor_tag: row.actor_tag || ACTOR_TAG_LABELS.admin,
        actor_role: row.actor_role || "admin",
        log_count: 1,
        last_activity_at: row.created_at,
      });
    } else {
      existing.log_count += 1;
      if (!existing.actor_name && row.actor_name) existing.actor_name = row.actor_name;
      if (!existing.actor_tag && row.actor_tag) existing.actor_tag = row.actor_tag;
    }
  }

  return Array.from(byUser.values()).sort(
    (a, b) => new Date(b.last_activity_at).getTime() - new Date(a.last_activity_at).getTime()
  );
}

export async function fetchAdminLogsForUser(
  supabase: SupabaseClient,
  userId: string,
  email?: string,
  limit = 200
): Promise<AdminLogRow[]> {
  let query = supabase
    .from("admin_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (userId) {
    query = query.eq("user_id", userId);
  } else if (email) {
    query = query.eq("admin_email", email);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data || []) as AdminLogRow[];
}
