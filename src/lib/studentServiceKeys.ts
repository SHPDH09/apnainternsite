import type { SupabaseClient } from "@supabase/supabase-js";
import type { StudentDocumentId } from "@/hooks/useStudentDocumentActions";
import type { LearningPanelTab } from "@/components/student/StudentLearningPanel";
import { parseStudentMetadata } from "@/lib/studentPaymentAccess";

export const STUDENT_SERVICE_KEYS = [
  "classes",
  "notes",
  "assignments",
  "attendance_module",
  "live_classes",
  "my_courses",
  "offer_letter",
  "consent",
  "acceptance",
  "logbook",
  "certificate",
  "attendance_report",
  "project_report",
] as const;

export type StudentServiceKey = (typeof STUDENT_SERVICE_KEYS)[number];

export type StudentServiceKeyConfig = {
  label: string;
  category: "learning" | "documents" | "other";
  defaultLocked: boolean;
  lockMessage: string;
  /** Base service fee in paise (₹1 = 100 paise). */
  feePaise: number;
  gstPercent: number;
};

export type StudentServiceAccessEntry = {
  unlocked?: boolean;
  paidAt?: string | null;
};

export type StudentServiceAccessMap = Partial<Record<StudentServiceKey, StudentServiceAccessEntry>>;

export type DashboardServiceKeysRow = {
  id: number;
  services: Partial<Record<StudentServiceKey, StudentServiceKeyConfig>>;
  updated_at?: string | null;
  updated_by?: string | null;
};

export type ResolvedStudentServiceAccess = {
  key: StudentServiceKey;
  locked: boolean;
  config: StudentServiceKeyConfig;
  feeBreakdown: ServiceFeeBreakdown;
};

export type ServiceFeeBreakdown = {
  basePaise: number;
  gstPercent: number;
  gstPaise: number;
  totalPaise: number;
};

const DEFAULT_SERVICE_CONFIGS: Record<StudentServiceKey, StudentServiceKeyConfig> = {
  classes: {
    label: "Classes",
    category: "learning",
    defaultLocked: false,
    lockMessage: "Live and recorded classes are locked. Pay the unlock fee to access your class schedule.",
    feePaise: 0,
    gstPercent: 18,
  },
  notes: {
    label: "Notes",
    category: "learning",
    defaultLocked: false,
    lockMessage: "Study notes are locked for your account. Complete payment to download day-wise notes.",
    feePaise: 0,
    gstPercent: 18,
  },
  assignments: {
    label: "Assignments",
    category: "learning",
    defaultLocked: false,
    lockMessage: "Assignments are locked. Pay the fee below to submit and view assignment marks.",
    feePaise: 0,
    gstPercent: 18,
  },
  attendance_module: {
    label: "Attendance (Learning)",
    category: "learning",
    defaultLocked: false,
    lockMessage: "Attendance tracking is locked. Unlock to view your attendance summary in Learning.",
    feePaise: 0,
    gstPercent: 18,
  },
  live_classes: {
    label: "Live Classes (Dashboard)",
    category: "other",
    defaultLocked: false,
    lockMessage: "Live class join links are locked. Pay to unlock scheduled live sessions on your dashboard.",
    feePaise: 0,
    gstPercent: 18,
  },
  my_courses: {
    label: "My Courses",
    category: "other",
    defaultLocked: false,
    lockMessage: "My Courses is locked. Complete payment to access enrolled LMS courses.",
    feePaise: 0,
    gstPercent: 18,
  },
  offer_letter: {
    label: "Offer / Acceptance Letter",
    category: "documents",
    defaultLocked: false,
    lockMessage: "Your internship offer letter is locked. Pay the document fee to view and download.",
    feePaise: 0,
    gstPercent: 18,
  },
  consent: {
    label: "Consent Letter",
    category: "documents",
    defaultLocked: false,
    lockMessage: "Consent letter access is locked. Pay the document fee to upload, view, or download.",
    feePaise: 0,
    gstPercent: 18,
  },
  acceptance: {
    label: "Acceptance Letter",
    category: "documents",
    defaultLocked: false,
    lockMessage: "Acceptance letter is locked. Pay the document fee to view or download.",
    feePaise: 0,
    gstPercent: 18,
  },
  logbook: {
    label: "Logbook",
    category: "documents",
    defaultLocked: false,
    lockMessage: "Internship logbook is locked. Pay the document fee to generate and download your logbook.",
    feePaise: 0,
    gstPercent: 18,
  },
  certificate: {
    label: "Certificate",
    category: "documents",
    defaultLocked: false,
    lockMessage: "Your completion certificate is locked. Pay the certificate fee to view and download.",
    feePaise: 0,
    gstPercent: 18,
  },
  attendance_report: {
    label: "Attendance Report",
    category: "documents",
    defaultLocked: false,
    lockMessage: "Attendance report is locked. Pay the attendance report fee to download your PDF report.",
    feePaise: 0,
    gstPercent: 18,
  },
  project_report: {
    label: "Project Report",
    category: "documents",
    defaultLocked: false,
    lockMessage: "Project report is locked. Pay the project report fee to view or download.",
    feePaise: 0,
    gstPercent: 18,
  },
};

let cachedServiceKeys: DashboardServiceKeysRow | null = null;

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function mergeServiceConfig(
  defaults: StudentServiceKeyConfig,
  raw: unknown
): StudentServiceKeyConfig {
  const patch = asObject(raw);
  return {
    label: String(patch.label ?? defaults.label).trim() || defaults.label,
    category:
      patch.category === "learning" || patch.category === "documents" || patch.category === "other"
        ? patch.category
        : defaults.category,
    defaultLocked:
      typeof patch.defaultLocked === "boolean" ? patch.defaultLocked : defaults.defaultLocked,
    lockMessage: String(patch.lockMessage ?? defaults.lockMessage).trim() || defaults.lockMessage,
    feePaise: Number.isFinite(Number(patch.feePaise))
      ? Math.max(0, Math.round(Number(patch.feePaise)))
      : defaults.feePaise,
    gstPercent: Number.isFinite(Number(patch.gstPercent))
      ? Math.max(0, Math.min(100, Number(patch.gstPercent)))
      : defaults.gstPercent,
  };
}

export function normalizeDashboardServiceKeysRow(
  raw: Record<string, unknown> | null
): DashboardServiceKeysRow {
  const servicesRaw = asObject(raw?.services);
  const services = {} as Partial<Record<StudentServiceKey, StudentServiceKeyConfig>>;
  for (const key of STUDENT_SERVICE_KEYS) {
    services[key] = mergeServiceConfig(DEFAULT_SERVICE_CONFIGS[key], servicesRaw[key]);
  }
  return {
    id: 1,
    services,
    updated_at: raw?.updated_at ? String(raw.updated_at) : null,
    updated_by: raw?.updated_by ? String(raw.updated_by) : null,
  };
}

export function getCachedDashboardServiceKeys(): DashboardServiceKeysRow {
  return cachedServiceKeys || normalizeDashboardServiceKeysRow(null);
}

export function setCachedDashboardServiceKeys(row: DashboardServiceKeysRow | null) {
  cachedServiceKeys = row;
}

export function getServiceKeyConfig(key: StudentServiceKey): StudentServiceKeyConfig {
  return getCachedDashboardServiceKeys().services[key] || DEFAULT_SERVICE_CONFIGS[key];
}

export function computeServiceFeeBreakdown(config: StudentServiceKeyConfig): ServiceFeeBreakdown {
  const basePaise = Math.max(0, Math.round(config.feePaise || 0));
  const gstPercent = Math.max(0, Math.min(100, config.gstPercent || 0));
  const gstPaise = Math.round((basePaise * gstPercent) / 100);
  return {
    basePaise,
    gstPercent,
    gstPaise,
    totalPaise: basePaise + gstPaise,
  };
}

export function readStudentServiceAccess(metadata: unknown): StudentServiceAccessMap {
  const meta = parseStudentMetadata(metadata);
  const raw = meta.service_access ?? meta.serviceAccess;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  return raw as StudentServiceAccessMap;
}

export function isStudentServiceLocked(
  key: StudentServiceKey,
  metadata: unknown
): boolean {
  const access = readStudentServiceAccess(metadata)[key];
  if (access?.unlocked === true) return false;
  if (access?.unlocked === false) return true;
  return getServiceKeyConfig(key).defaultLocked;
}

export function resolveStudentServiceAccess(
  key: StudentServiceKey,
  metadata: unknown
): ResolvedStudentServiceAccess {
  const config = getServiceKeyConfig(key);
  return {
    key,
    locked: isStudentServiceLocked(key, metadata),
    config,
    feeBreakdown: computeServiceFeeBreakdown(config),
  };
}

export function resolveAllStudentServiceAccess(
  metadata: unknown
): Record<StudentServiceKey, ResolvedStudentServiceAccess> {
  const out = {} as Record<StudentServiceKey, ResolvedStudentServiceAccess>;
  for (const key of STUDENT_SERVICE_KEYS) {
    out[key] = resolveStudentServiceAccess(key, metadata);
  }
  return out;
}

export function documentIdToServiceKey(id: StudentDocumentId): StudentServiceKey {
  const map: Record<StudentDocumentId, StudentServiceKey> = {
    consent: "consent",
    acceptance: "acceptance",
    logbook: "logbook",
    certificate: "certificate",
    attendance: "attendance_report",
    project: "project_report",
  };
  return map[id];
}

export function learningTabToServiceKey(tab: LearningPanelTab): StudentServiceKey {
  const map: Record<LearningPanelTab, StudentServiceKey> = {
    classes: "classes",
    notes: "notes",
    assignments: "assignments",
    attendance: "attendance_module",
  };
  return map[tab];
}

export function mergeStudentServiceAccessPatch(
  current: StudentServiceAccessMap,
  patch: StudentServiceAccessMap
): StudentServiceAccessMap {
  return { ...current, ...patch };
}

export function buildServiceAccessPatch(
  keys: StudentServiceKey[],
  unlocked: boolean
): StudentServiceAccessMap {
  const patch: StudentServiceAccessMap = {};
  const stamp = unlocked ? new Date().toISOString() : null;
  for (const key of keys) {
    patch[key] = { unlocked, paidAt: unlocked ? stamp : null };
  }
  return patch;
}

export async function fetchDashboardServiceKeys(
  client: SupabaseClient
): Promise<DashboardServiceKeysRow> {
  const { data, error } = await client
    .from("dashboard_service_keys")
    .select("*")
    .eq("id", 1)
    .maybeSingle();
  if (error) throw error;
  const normalized = normalizeDashboardServiceKeysRow((data as Record<string, unknown>) || null);
  cachedServiceKeys = normalized;
  return normalized;
}

export async function saveDashboardServiceKeys(
  client: SupabaseClient,
  services: Partial<Record<StudentServiceKey, StudentServiceKeyConfig>>,
  updatedBy: string | null
): Promise<DashboardServiceKeysRow> {
  const current = await fetchDashboardServiceKeys(client);
  const merged = { ...current.services } as Partial<Record<StudentServiceKey, StudentServiceKeyConfig>>;
  for (const key of STUDENT_SERVICE_KEYS) {
    if (services[key]) {
      merged[key] = mergeServiceConfig(DEFAULT_SERVICE_CONFIGS[key], services[key]);
    }
  }
  const payload = {
    id: 1,
    services: merged,
    updated_by: updatedBy,
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await client
    .from("dashboard_service_keys")
    .upsert(payload)
    .select("*")
    .single();
  if (error) throw error;
  const normalized = normalizeDashboardServiceKeysRow(data as Record<string, unknown>);
  cachedServiceKeys = normalized;
  return normalized;
}

export async function applyStudentServiceAccessBatch(
  client: SupabaseClient,
  studentIds: string[],
  keys: StudentServiceKey[],
  unlocked: boolean
): Promise<void> {
  if (!studentIds.length || !keys.length) return;

  const { data: rows, error } = await client
    .from("students")
    .select("id, metadata")
    .in("id", studentIds);
  if (error) throw error;

  const patch = buildServiceAccessPatch(keys, unlocked);
  for (const row of rows || []) {
    const id = String((row as { id: string }).id);
    const meta = parseStudentMetadata((row as { metadata?: unknown }).metadata);
    const current = readStudentServiceAccess(meta);
    const nextMeta = {
      ...meta,
      service_access: mergeStudentServiceAccessPatch(current, patch),
    };
    const { error: upErr } = await client.from("students").update({ metadata: nextMeta }).eq("id", id);
    if (upErr) throw upErr;
  }
}

export function formatPaiseAsRupees(paise: number): string {
  const rupees = paise / 100;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: rupees % 1 === 0 ? 0 : 2,
  }).format(rupees);
}
