import { useCallback, useEffect, useMemo, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  KeyRound,
  Loader2,
  Lock,
  LockOpen,
  Save,
  Search,
  Settings2,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { fetchAdminStudentDirectoryPage } from "@/lib/adminStudentDirectory";
import { fetchAllSupabaseRows } from "@/lib/fetchAllSupabaseRows";
import { paymentRowQualifiesAsPaid } from "@/lib/studentPaymentAccess";
import {
  STUDENT_SERVICE_KEYS,
  applyStudentServiceAccessBatch,
  fetchDashboardServiceKeys,
  formatPaiseAsRupees,
  getServiceKeyConfig,
  saveDashboardServiceKeys,
  type StudentServiceKey,
  type StudentServiceKeyConfig,
} from "@/lib/studentServiceKeys";

type Props = {
  client: SupabaseClient;
  currentUserId: string | null;
  isActive?: boolean;
};

type PaidFilter = "all" | "paid" | "unpaid";
type CertFilter = "all" | "yes" | "no";

function ServiceConfigEditor({
  serviceKey,
  config,
  onChange,
}: {
  serviceKey: StudentServiceKey;
  config: StudentServiceKeyConfig;
  onChange: (patch: Partial<StudentServiceKeyConfig>) => void;
}) {
  const total =
    config.feePaise + Math.round((config.feePaise * (config.gstPercent || 0)) / 100);

  return (
    <Card className="p-4 border-slate-200 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-bold text-slate-900">{config.label}</p>
          <p className="text-[10px] uppercase tracking-widest text-slate-400 font-black">
            {config.category} · {serviceKey}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor={`default-locked-${serviceKey}`} className="text-xs text-slate-600">
            Default locked
          </Label>
          <Switch
            id={`default-locked-${serviceKey}`}
            checked={config.defaultLocked}
            onCheckedChange={(v) => onChange({ defaultLocked: v })}
          />
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">
            Service fee (₹)
          </Label>
          <Input
            type="number"
            min={0}
            step={1}
            value={Math.round(config.feePaise / 100)}
            onChange={(e) =>
              onChange({ feePaise: Math.max(0, Math.round(Number(e.target.value || 0) * 100)) })
            }
            className="h-9 bg-slate-50"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">
            GST (%)
          </Label>
          <Input
            type="number"
            min={0}
            max={100}
            step={0.1}
            value={config.gstPercent}
            onChange={(e) => onChange({ gstPercent: Math.max(0, Number(e.target.value || 0)) })}
            className="h-9 bg-slate-50"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">
          Lock message (shown on student click)
        </Label>
        <Textarea
          value={config.lockMessage}
          onChange={(e) => onChange({ lockMessage: e.target.value })}
          rows={2}
          className="bg-slate-50 text-sm"
        />
      </div>

      <p className="text-xs text-slate-500">
        Total with GST:{" "}
        <span className="font-bold text-slate-800">{formatPaiseAsRupees(total)}</span>
      </p>
    </Card>
  );
}

export function StudentServiceKeysPanel({ client, currentUserId, isActive = true }: Props) {
  const [loading, setLoading] = useState(true);
  const [savingConfig, setSavingConfig] = useState(false);
  const [applyingAccess, setApplyingAccess] = useState(false);
  const [serviceConfigs, setServiceConfigs] = useState<
    Partial<Record<StudentServiceKey, StudentServiceKeyConfig>>
  >({});

  const [search, setSearch] = useState("");
  const [paidFilter, setPaidFilter] = useState<PaidFilter>("all");
  const [certFilter, setCertFilter] = useState<CertFilter>("all");
  const [uniFilter, setUniFilter] = useState("all");
  const [collegeFilter, setCollegeFilter] = useState("all");
  const [domainFilter, setDomainFilter] = useState("all");
  const [universities, setUniversities] = useState<string[]>([]);
  const [colleges, setColleges] = useState<string[]>([]);
  const [domains, setDomains] = useState<string[]>([]);

  const [students, setStudents] = useState<Record<string, unknown>[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [paidUserIds, setPaidUserIds] = useState<Set<string>>(new Set());
  const [certUserIds, setCertUserIds] = useState<Set<string>>(new Set());
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [actionKeys, setActionKeys] = useState<Set<StudentServiceKey>>(new Set());

  const reloadConfig = useCallback(async () => {
    setLoading(true);
    try {
      const row = await fetchDashboardServiceKeys(client);
      setServiceConfigs(row.services);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load service keys.");
    } finally {
      setLoading(false);
    }
  }, [client]);

  const loadFilterOptions = useCallback(async () => {
    try {
      const [uniRows, domainRows] = await Promise.all([
        fetchAllSupabaseRows<{ name: string }>(client, "universities", {
          select: "name",
          orderBy: "name",
          ascending: true,
        }),
        fetchAllSupabaseRows<{ name: string }>(client, "internship_domains", {
          select: "name",
          orderBy: "name",
          ascending: true,
        }),
      ]);
      setUniversities(uniRows.map((r) => r.name).filter(Boolean));
      setDomains(domainRows.map((r) => r.name).filter(Boolean));
    } catch {
      /* optional */
    }
  }, [client]);

  useEffect(() => {
    if (!isActive) return;
    void reloadConfig();
    void loadFilterOptions();
  }, [isActive, reloadConfig, loadFilterOptions]);

  useEffect(() => {
    if (!isActive || uniFilter === "all") {
      setColleges([]);
      return;
    }
    void (async () => {
      try {
        const rows = await fetchAllSupabaseRows<{ name: string; universities?: { name?: string } | { name?: string }[] }>(
          client,
          "colleges",
          {
            select: "name, universities(name)",
            orderBy: "name",
            ascending: true,
          }
        );
        const filtered = rows.filter((r) => {
          const uniRaw = r.universities;
          const uniName = Array.isArray(uniRaw)
            ? String(uniRaw[0]?.name || "")
            : String(uniRaw?.name || "");
          return uniName === uniFilter;
        });
        setColleges(filtered.map((r) => r.name).filter(Boolean));
      } catch {
        setColleges([]);
      }
    })();
  }, [client, isActive, uniFilter]);

  const getConfig = (key: StudentServiceKey): StudentServiceKeyConfig =>
    serviceConfigs[key] ?? getServiceKeyConfig(key);

  const patchConfig = (key: StudentServiceKey, patch: Partial<StudentServiceKeyConfig>) => {
    setServiceConfigs((prev) => ({
      ...prev,
      [key]: { ...getConfig(key), ...prev[key], ...patch },
    }));
  };

  const saveConfig = async () => {
    setSavingConfig(true);
    try {
      await saveDashboardServiceKeys(client, serviceConfigs, currentUserId);
      toast.success("Service key settings saved.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSavingConfig(false);
    }
  };

  const runStudentSearch = async () => {
    setLoadingStudents(true);
    setSelectedIds(new Set());
    try {
      const { rows } = await fetchAdminStudentDirectoryPage(client, 0, 500, {
        searchTerm: search.trim() || undefined,
        domainFilter,
        uniFilter,
        collegeFilter,
      });

      const ids = rows.map((r) => String(r.id)).filter(Boolean);

      const [payRows, certRows] = await Promise.all([
        ids.length
          ? client
              .from("payment_success")
              .select("user_id, email, payment_id, amount_paise, status")
              .in("user_id", ids)
          : Promise.resolve({ data: [], error: null }),
        ids.length
          ? client.from("certificates").select("user_id").in("user_id", ids)
          : Promise.resolve({ data: [], error: null }),
      ]);

      const paid = new Set<string>();
      for (const p of payRows.data || []) {
        if (p.user_id && paymentRowQualifiesAsPaid(p as Parameters<typeof paymentRowQualifiesAsPaid>[0])) {
          paid.add(String(p.user_id));
        }
      }

      const certSet = new Set<string>(
        (certRows.data || []).map((c) => String((c as { user_id: string }).user_id))
      );

      setPaidUserIds(paid);
      setCertUserIds(certSet);
      setStudents(rows);
      if (!rows.length) toast.message("No students matched your filters.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Student search failed.");
    } finally {
      setLoadingStudents(false);
    }
  };

  const filteredStudents = useMemo(() => {
    return students.filter((row) => {
      const id = String(row.id);
      const isPaid = paidUserIds.has(id);
      if (paidFilter === "paid" && !isPaid) return false;
      if (paidFilter === "unpaid" && isPaid) return false;
      const hasCert = certUserIds.has(id);
      if (certFilter === "yes" && !hasCert) return false;
      if (certFilter === "no" && hasCert) return false;
      return true;
    });
  }, [students, paidFilter, certFilter, paidUserIds, certUserIds]);

  const allVisibleSelected =
    filteredStudents.length > 0 &&
    filteredStudents.every((r) => selectedIds.has(String(r.id)));

  const toggleSelectAll = () => {
    if (allVisibleSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredStudents.map((r) => String(r.id))));
    }
  };

  const toggleStudent = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleActionKey = (key: StudentServiceKey) => {
    setActionKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const applyAccess = async (unlocked: boolean) => {
    const ids = [...selectedIds];
    const keys = [...actionKeys];
    if (!ids.length) {
      toast.error("Select at least one student.");
      return;
    }
    if (!keys.length) {
      toast.error("Select at least one service to lock or unlock.");
      return;
    }
    setApplyingAccess(true);
    try {
      await applyStudentServiceAccessBatch(client, ids, keys, unlocked);
      toast.success(
        `${unlocked ? "Unlocked" : "Locked"} ${keys.length} service(s) for ${ids.length} student(s).`
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update student access.");
    } finally {
      setApplyingAccess(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-slate-500 py-8">
        <Loader2 className="size-5 animate-spin" /> Loading service keys…
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
          <KeyRound className="size-5 text-primary" /> Keys — Dashboard Service Access
        </h2>
        <p className="text-sm text-slate-600 mt-1">
          Lock or unlock student dashboard sections, set per-service fees and lock messages, and apply
          access in bulk using filters.
        </p>
      </div>

      <Tabs defaultValue="settings" className="space-y-4">
        <TabsList className="flex flex-wrap h-auto gap-1 bg-slate-100 p-1">
          <TabsTrigger value="settings" className="gap-1.5">
            <Settings2 className="size-3.5" /> Service settings
          </TabsTrigger>
          <TabsTrigger value="students" className="gap-1.5">
            <Users className="size-3.5" /> Student access
          </TabsTrigger>
        </TabsList>

        <TabsContent value="settings" className="space-y-4">
          <p className="text-sm text-slate-600">
            Configure default lock state, fee (₹), GST, and the message shown when a student clicks a
            locked service.
          </p>
          <div className="grid lg:grid-cols-2 gap-4">
            {STUDENT_SERVICE_KEYS.map((key) => (
              <ServiceConfigEditor
                key={key}
                serviceKey={key}
                config={getConfig(key)}
                onChange={(patch) => patchConfig(key, patch)}
              />
            ))}
          </div>
          <Button className="font-black gap-2" disabled={savingConfig} onClick={() => void saveConfig()}>
            {savingConfig ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            Save all service settings
          </Button>
        </TabsContent>

        <TabsContent value="students" className="space-y-4">
          <Card className="p-4 border-none shadow-elegant space-y-4">
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
              <div className="space-y-1.5 xl:col-span-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                  Search
                </Label>
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Name, email, reg ID…"
                  className="h-9 bg-slate-50"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void runStudentSearch();
                  }}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                  Payment
                </Label>
                <Select value={paidFilter} onValueChange={(v) => setPaidFilter(v as PaidFilter)}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="paid">Paid only</SelectItem>
                    <SelectItem value="unpaid">Unpaid only</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                  Certificate
                </Label>
                <Select value={certFilter} onValueChange={(v) => setCertFilter(v as CertFilter)}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="yes">Generated</SelectItem>
                    <SelectItem value="no">Not generated</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                  University
                </Label>
                <Select
                  value={uniFilter}
                  onValueChange={(v) => {
                    setUniFilter(v);
                    setCollegeFilter("all");
                  }}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All universities</SelectItem>
                    {universities.map((u) => (
                      <SelectItem key={u} value={u}>
                        {u}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                  College
                </Label>
                <Select value={collegeFilter} onValueChange={setCollegeFilter} disabled={uniFilter === "all"}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder={uniFilter === "all" ? "Select university first" : "All"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All colleges</SelectItem>
                    {colleges.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                  Domain
                </Label>
                <Select value={domainFilter} onValueChange={setDomainFilter}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All domains</SelectItem>
                    {domains.map((d) => (
                      <SelectItem key={d} value={d}>
                        {d}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button
              type="button"
              className="font-black gap-2"
              disabled={loadingStudents}
              onClick={() => void runStudentSearch()}
            >
              {loadingStudents ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
              Apply filters & load students
            </Button>
          </Card>

          {filteredStudents.length > 0 ? (
            <>
              <Card className="p-4 border-none shadow-elegant space-y-3">
                <p className="text-sm font-bold text-slate-800">Services to lock / unlock</p>
                <div className="flex flex-wrap gap-2">
                  {STUDENT_SERVICE_KEYS.map((key) => {
                    const cfg = getConfig(key);
                    return (
                      <label
                        key={key}
                        className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs cursor-pointer transition-colors ${
                          actionKeys.has(key)
                            ? "border-primary bg-primary/5"
                            : "border-slate-200 bg-white hover:bg-slate-50"
                        }`}
                      >
                        <Checkbox
                          checked={actionKeys.has(key)}
                          onCheckedChange={() => toggleActionKey(key)}
                        />
                        <span className="font-semibold">{cfg.label}</span>
                        {cfg.feePaise > 0 ? (
                          <Badge variant="secondary" className="text-[9px] font-mono">
                            {formatPaiseAsRupees(
                              cfg.feePaise + Math.round((cfg.feePaise * cfg.gstPercent) / 100)
                            )}
                          </Badge>
                        ) : null}
                      </label>
                    );
                  })}
                </div>
                <div className="flex flex-wrap gap-2 pt-1">
                  <Button
                    type="button"
                    variant="destructive"
                    className="font-black gap-2"
                    disabled={applyingAccess}
                    onClick={() => void applyAccess(false)}
                  >
                    {applyingAccess ? <Loader2 className="size-4 animate-spin" /> : <Lock className="size-4" />}
                    Lock selected services
                  </Button>
                  <Button
                    type="button"
                    className="font-black gap-2"
                    disabled={applyingAccess}
                    onClick={() => void applyAccess(true)}
                  >
                    {applyingAccess ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <LockOpen className="size-4" />
                    )}
                    Unlock selected services
                  </Button>
                </div>
              </Card>

              <Card className="border-none shadow-elegant overflow-hidden">
                <ScrollArea className="max-h-[420px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10">
                          <Checkbox checked={allVisibleSelected} onCheckedChange={toggleSelectAll} />
                        </TableHead>
                        <TableHead>Student</TableHead>
                        <TableHead>Reg / Roll</TableHead>
                        <TableHead>University</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredStudents.map((row) => {
                        const id = String(row.id);
                        const isPaid = paidUserIds.has(id);
                        const hasCert = certUserIds.has(id);
                        return (
                          <TableRow key={id}>
                            <TableCell>
                              <Checkbox checked={selectedIds.has(id)} onCheckedChange={() => toggleStudent(id)} />
                            </TableCell>
                            <TableCell>
                              <p className="font-bold text-sm">{String(row.full_name || "—")}</p>
                              <p className="text-xs text-slate-500">{String(row.email || "—")}</p>
                            </TableCell>
                            <TableCell className="text-xs font-mono">
                              {String(row.registration_id || row.roll_number || "—")}
                            </TableCell>
                            <TableCell className="text-xs max-w-[140px] truncate">
                              {String(row.university_name || "—")}
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-wrap gap-1">
                                <Badge
                                  variant={isPaid ? "default" : "secondary"}
                                  className="text-[9px] font-black"
                                >
                                  {isPaid ? "Paid" : "Unpaid"}
                                </Badge>
                                {hasCert ? (
                                  <Badge variant="outline" className="text-[9px] font-black">
                                    Cert ✓
                                  </Badge>
                                ) : null}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </ScrollArea>
                <div className="px-4 py-2 border-t bg-slate-50 text-xs text-slate-600 flex justify-between">
                  <span>
                    {filteredStudents.length} student(s) · {selectedIds.size} selected
                  </span>
                  <button type="button" className="font-bold text-primary hover:underline" onClick={toggleSelectAll}>
                    {allVisibleSelected ? "Deselect all" : "Select all filtered"}
                  </button>
                </div>
              </Card>
            </>
          ) : students.length > 0 ? (
            <p className="text-sm text-slate-500 italic">
              No students match the payment/certificate filters. Adjust filters and search again.
            </p>
          ) : (
            <p className="text-sm text-slate-500 italic">
              Use filters above and click &quot;Apply filters & load students&quot; to list students.
            </p>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
