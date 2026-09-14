import { useEffect, useMemo, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { displayCollegeName } from "@/lib/collegeDisplay";
import { isBeuStudent } from "@/lib/feeRules";
import { BEU_SESSIONS } from "@/lib/beuRegistration";
import {
  fetchEngineeringConfigMap,
  resolveEngineeringOptions,
  type EngineeringUniversityConfig,
} from "@/lib/engineeringConfig";
import {
  fetchNonEngineeringConfigMap,
  resolveNonEngineeringOptions,
  type NonEngineeringUniversityConfig,
} from "@/lib/nonEngineeringConfig";
import {
  fetchRegistrationColleges,
  fetchRegistrationUniversities,
  type RegistrationCollege,
  type RegistrationUniversity,
} from "@/lib/registrationCatalog";
import {
  emptyStudentDataUploadContext,
  isStudentDataUploadContextComplete,
  type StudentDataUploadContext,
} from "@/lib/studentDataUpload";

const SESSION_OPTIONS = [
  ...BEU_SESSIONS,
  "2022-26",
  "2023-27",
  "2024-28",
  "2025-29",
  "2026-30",
];

type Props = {
  client: SupabaseClient;
  value: StudentDataUploadContext;
  onChange: (value: StudentDataUploadContext) => void;
  disabled?: boolean;
};

export function StudentDataUploadContextForm({
  client,
  value,
  onChange,
  disabled = false,
}: Props) {
  const [unis, setUnis] = useState<RegistrationUniversity[]>([]);
  const [colleges, setColleges] = useState<RegistrationCollege[]>([]);
  const [domains, setDomains] = useState<Array<{ name: string }>>([]);
  const [engineeringByUni, setEngineeringByUni] = useState<
    Map<string, EngineeringUniversityConfig>
  >(new Map());
  const [nonTechByUni, setNonTechByUni] = useState<
    Map<string, NonEngineeringUniversityConfig>
  >(new Map());
  const [universityId, setUniversityId] = useState("");

  useEffect(() => {
    void fetchRegistrationUniversities(client).then(setUnis).catch(() => setUnis([]));
    void client
      .from("internship_domains")
      .select("name")
      .order("name")
      .then(({ data }) => setDomains((data as Array<{ name: string }>) || []));
    void fetchEngineeringConfigMap(client)
      .then(setEngineeringByUni)
      .catch(() => setEngineeringByUni(new Map()));
    void fetchNonEngineeringConfigMap(client)
      .then(setNonTechByUni)
      .catch(() => setNonTechByUni(new Map()));
  }, [client]);

  useEffect(() => {
    if (!universityId) {
      setColleges([]);
      return;
    }
    void fetchRegistrationColleges(client, universityId)
      .then(setColleges)
      .catch(() => setColleges([]));
  }, [client, universityId]);

  useEffect(() => {
    if (!value.university || !unis.length) return;
    const match = unis.find((u) => u.name === value.university);
    if (match && match.id !== universityId) setUniversityId(match.id);
  }, [value.university, unis, universityId]);

  const selectedUni = unis.find((u) => u.id === universityId);
  const engConfig = universityId ? engineeringByUni.get(universityId) : undefined;
  const nonTechConfig = universityId ? nonTechByUni.get(universityId) || null : null;
  const isEngineering =
    Boolean(engConfig) || isBeuStudent(selectedUni?.name);

  const engOptions = useMemo(
    () => resolveEngineeringOptions(engConfig || null),
    [engConfig]
  );
  const nonTechOptions = useMemo(
    () => resolveNonEngineeringOptions(nonTechConfig),
    [nonTechConfig]
  );

  const courseOptions = useMemo(() => {
    if (isEngineering) {
      return engOptions.courses.filter((c) => c !== "Other");
    }
    return nonTechOptions.courses.filter((c) => c !== "Other");
  }, [isEngineering, engOptions.courses, nonTechOptions.courses]);

  const branchOptions = useMemo(() => {
    if (!value.course) return [];
    if (isEngineering) {
      const list = (engOptions.branchesByCourse[value.course] || []).filter((b) => b !== "Other");
      return list.length > 0 ? list : ["General"];
    }
    const list = (nonTechOptions.branchesByCourse[value.course] || []).filter((b) => b !== "Other");
    return list.length > 0 ? list : ["General"];
  }, [isEngineering, engOptions.branchesByCourse, nonTechOptions.branchesByCourse, value.course]);

  useEffect(() => {
    if (!value.course || value.branch) return;
    if (branchOptions.length === 1) {
      onChange({ ...value, branch: branchOptions[0]! });
    }
  }, [value, branchOptions, onChange]);

  const domainOptions = useMemo(() => {
    if (isEngineering && engConfig?.domains?.length) {
      return engConfig.domains.filter((d) => d !== "Other");
    }
    return domains.map((d) => d.name).filter(Boolean);
  }, [isEngineering, engConfig, domains]);

  const patch = (partial: Partial<StudentDataUploadContext>) =>
    onChange({ ...value, ...partial });

  const contextReady = isStudentDataUploadContextComplete(value);

  return (
    <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-4">
      <div>
        <p className="text-sm font-bold text-slate-900">Step 1 — Select batch details</p>
        <p className="text-xs text-slate-600 mt-1">
          Choose university, college, domain, session, course, and branch once. Every row in your
          CSV/Excel file will use these values.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold">University *</Label>
          <Select
            value={universityId || undefined}
            disabled={disabled}
            onValueChange={(id) => {
              setUniversityId(id);
              const uni = unis.find((u) => u.id === id);
              onChange({
                ...emptyStudentDataUploadContext(),
                university: uni?.name || "",
              });
            }}
          >
            <SelectTrigger className="h-9 text-xs bg-white">
              <SelectValue placeholder="Select university" />
            </SelectTrigger>
            <SelectContent>
              {unis.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs font-semibold">College *</Label>
          <Select
            value={
              colleges.find((c) => c.name === value.college)?.id || undefined
            }
            disabled={disabled || !universityId}
            onValueChange={(id) => {
              const college = colleges.find((c) => c.id === id);
              patch({ college: college?.name || "" });
            }}
          >
            <SelectTrigger className="h-9 text-xs bg-white">
              <SelectValue placeholder={universityId ? "Select college" : "Pick university first"} />
            </SelectTrigger>
            <SelectContent>
              {colleges.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {displayCollegeName(c.name)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs font-semibold">Internship domain *</Label>
          <Select
            value={value.internshipDomain || undefined}
            disabled={disabled || !universityId}
            onValueChange={(internshipDomain) => patch({ internshipDomain })}
          >
            <SelectTrigger className="h-9 text-xs bg-white">
              <SelectValue placeholder="Select domain" />
            </SelectTrigger>
            <SelectContent>
              {domainOptions.map((d) => (
                <SelectItem key={d} value={d}>
                  {d}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs font-semibold">Session *</Label>
          <Select
            value={value.session || undefined}
            disabled={disabled}
            onValueChange={(session) => patch({ session })}
          >
            <SelectTrigger className="h-9 text-xs bg-white">
              <SelectValue placeholder="Select session" />
            </SelectTrigger>
            <SelectContent>
              {SESSION_OPTIONS.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs font-semibold">Course *</Label>
          <Select
            value={value.course || undefined}
            disabled={disabled || !universityId}
            onValueChange={(course) => patch({ course, branch: "" })}
          >
            <SelectTrigger className="h-9 text-xs bg-white">
              <SelectValue placeholder="Select course" />
            </SelectTrigger>
            <SelectContent>
              {courseOptions.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs font-semibold">Branch *</Label>
          <Select
            value={value.branch || undefined}
            disabled={disabled || !value.course}
            onValueChange={(branch) => patch({ branch })}
          >
            <SelectTrigger className="h-9 text-xs bg-white">
              <SelectValue placeholder={value.course ? "Select branch" : "Pick course first"} />
            </SelectTrigger>
            <SelectContent>
              {branchOptions.length > 0 ? (
                branchOptions.map((b) => (
                  <SelectItem key={b} value={b}>
                    {b}
                  </SelectItem>
                ))
              ) : (
                <SelectItem value="General">General</SelectItem>
              )}
            </SelectContent>
          </Select>
        </div>
      </div>

      {contextReady ? (
        <p className="text-xs text-emerald-700 font-medium">
          Batch ready: {value.university} · {value.college} · {value.course} · {value.branch} ·{" "}
          {value.internshipDomain} · {value.session}
        </p>
      ) : (
        <p className="text-xs text-amber-700">
          Complete all fields above before downloading the template or uploading a file.
        </p>
      )}
    </div>
  );
}
