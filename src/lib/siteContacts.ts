export type ContactType = "phone" | "email" | "address" | "social" | "other";
export type WhatsAppLinkType = "group" | "channel" | "number";

export type DisplayContext =
  | "footer"
  | "registration"
  | "contact_page"
  | "all";

export const CONTACT_DISPLAY_CONTEXT_OPTIONS: { key: DisplayContext; label: string }[] = [
  { key: "footer", label: "Website footer" },
  { key: "registration", label: "Registration page" },
  { key: "contact_page", label: "Contact page" },
  { key: "all", label: "All pages" },
];

export const WHATSAPP_DISPLAY_CONTEXT_OPTIONS = CONTACT_DISPLAY_CONTEXT_OPTIONS.filter(
  (o) => o.key === "footer" || o.key === "registration" || o.key === "all"
);

export const CONTACT_TYPE_OPTIONS: { key: ContactType; label: string }[] = [
  { key: "phone", label: "Phone" },
  { key: "email", label: "Email" },
  { key: "address", label: "Address" },
  { key: "social", label: "Social link" },
  { key: "other", label: "Other" },
];

export const WHATSAPP_LINK_TYPE_OPTIONS: { key: WhatsAppLinkType; label: string }[] = [
  { key: "channel", label: "WhatsApp channel" },
  { key: "group", label: "WhatsApp group" },
  { key: "number", label: "WhatsApp number" },
];

export type SiteContactDetail = {
  id: string;
  contact_type: ContactType;
  label: string;
  value: string;
  href: string | null;
  icon: string | null;
  display_contexts: string[];
  is_active: boolean;
  sort_order: number;
  created_at?: string;
  updated_at?: string;
};

export type SiteWhatsAppLink = {
  id: string;
  title: string;
  link_type: WhatsAppLinkType;
  url: string;
  description: string | null;
  display_contexts: string[];
  is_active: boolean;
  sort_order: number;
  created_at?: string;
  updated_at?: string;
};

export function normalizeDisplayContexts(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const list = raw.map((v) => String(v).trim()).filter(Boolean);
  if (list.includes("all")) return ["all"];
  return list;
}

export function matchesDisplayContext(contexts: string[] | undefined, target: DisplayContext): boolean {
  if (!contexts?.length) return false;
  if (contexts.includes("all")) return true;
  return contexts.includes(target);
}

export function defaultHrefForContact(type: ContactType, value: string): string | null {
  const v = value.trim();
  if (!v) return null;
  if (type === "email") return `mailto:${v}`;
  if (type === "phone") {
    const digits = v.replace(/\D/g, "");
    return digits ? `tel:+${digits.startsWith("91") ? digits : `91${digits}`}` : null;
  }
  if (type === "social" && /^https?:\/\//i.test(v)) return v;
  return null;
}
