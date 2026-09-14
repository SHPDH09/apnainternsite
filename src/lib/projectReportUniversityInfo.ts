import { isBnmuStudent, isBrabuStudent, isLnmuStudent } from "@/lib/feeRules";

export type UniversityDisplayInfo = {
  name: string;
  address: string;
  shortName?: string;
};

const UNIVERSITY_ADDRESSES: Record<string, string> = {
  "b.n. mandal university, madhepura":
    "Laloo Nagar, Madhepura, Bihar 852113",
  "bhupendra narayan mandal university":
    "Laloo Nagar, Madhepura, Bihar 852113",
  "lalit narayan mithila university":
    "Kameshwar Nagar, Darbhanga, Bihar 846004",
  "babasaheb bhimrao ambedkar bihar university":
    "Raja Bazar, Vaishali Road, Muzaffarpur, Bihar 842001",
};

function normalizeUniKey(name: string): string {
  return String(name || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

export function resolveUniversityAddress(universityName?: string | null): string {
  const key = normalizeUniKey(universityName || "");
  if (UNIVERSITY_ADDRESSES[key]) return UNIVERSITY_ADDRESSES[key]!;
  const fuzzy = Object.entries(UNIVERSITY_ADDRESSES).find(
    ([k]) => key.includes(k) || k.includes(key)
  );
  if (fuzzy) return fuzzy[1];
  if (isBnmuStudent(universityName)) return UNIVERSITY_ADDRESSES["b.n. mandal university, madhepura"]!;
  if (isLnmuStudent(universityName)) return UNIVERSITY_ADDRESSES["lalit narayan mithila university"]!;
  if (isBrabuStudent(universityName)) return UNIVERSITY_ADDRESSES["babasaheb bhimrao ambedkar bihar university"]!;
  return "Bihar, India";
}

export function resolveUniversityDisplayName(universityName?: string | null): string {
  const name = String(universityName || "").trim();
  if (!name) return "University";
  if (isBnmuStudent(name) && !/bhupendra/i.test(name)) {
    return "Bhupendra Narayan Mandal University";
  }
  return name;
}

export function resolveUniversityLogoFromList(
  universityName: string | null | undefined,
  universities: Array<{ name: string; logo_url?: string | null }>
): string | null {
  const target = normalizeUniKey(universityName || "");
  if (!target) return null;
  const exact = universities.find((u) => normalizeUniKey(u.name) === target);
  if (exact?.logo_url) return exact.logo_url;
  const fuzzy = universities.find((u) => {
    const k = normalizeUniKey(u.name);
    return k.includes(target) || target.includes(k);
  });
  return fuzzy?.logo_url || null;
}
