import { useCallback, useEffect, useMemo, useState } from "react";
import Papa from "papaparse";
import { CheckCircle2, Loader2, Mail, Shield, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MultiSelectCheckboxGroup } from "@/components/admin/MultiSelectCheckboxGroup";
import { InternshipModeFilterSelect } from "@/components/admin/InternshipModeFilterSelect";
import { fetchAllCollegesCatalog } from "@/lib/institutionCatalog";
import { fetchAdminStudentsLight } from "@/lib/adminStudentDirectory";
import { fetchAllSupabaseRows } from "@/lib/fetchAllSupabaseRows";
import {
  filterCommsRecipients,
  searchCommsRecipients,
  type CommsRecipient,
} from "@/lib/adminBulkComms";
import { collegesForUniversityNames, pruneCollegesForUniversities } from "@/lib/classLinkTargeting";
import { sendBulkCustomMail } from "@/lib/bulkCustomMailSend";
import { estimateBulkMailSeconds, formatBulkMailEta } from "@/lib/bulkCustomMailSend";
import { toastBulkMailResult } from "@/lib/bulkMailResultFeedback";

type Props = {
  isActive?: boolean;
};

export function CommsCenterPanel({ isActive = true }: Props) {
  const [unis, setUnis] = useState<{ id: string; name: string }[]>([]);
  const [colleges, setColleges] = useState<{ id: string; name: string; university_id: string }[]>([]);
  const [domains, setDomains] = useState<{ id: string; name: string }[]>([]);
  const [loadingCatalog, setLoadingCatalog] = useState(false);

  const [allStudentsComms, setAllStudentsComms] = useState<CommsRecipient[]>([]);
  const [allLeadsComms, setAllLeadsComms] = useState<CommsRecipient[]>([]);
  const [loadingRecipients, setLoadingRecipients] = useState(false);

  const [commRecipientType, setCommRecipientType] = useState<"enrolled" | "unenrolled">("enrolled");
  const [commUniFilters, setCommUniFilters] = useState<string[]>([]);
  const [commCollegeFilters, setCommCollegeFilters] = useState<string[]>([]);
  const [commDomainFilter, setCommDomainFilter] = useState("all");
  const [commModeFilter, setCommModeFilter] = useState("all");
  const [commSearchTerm, setCommSearchTerm] = useState("");
  const [commsSelectedIds, setCommsSelectedIds] = useState<string[]>([]);
  const [csvEmails, setCsvEmails] = useState<string[]>([]);

  const [bulkEmailSubject, setBulkEmailSubject] = useState("");
  const [bulkEmailBody, setBulkEmailBody] = useState("");
  const [isSendingBulk, setIsSendingBulk] = useState(false);
  const [bulkProgress, setBulkProgress] = useState(0);
  const [bulkTotal, setBulkTotal] = useState(0);

  const loadCatalog = useCallback(async () => {
    setLoadingCatalog(true);
    try {
      const [{ data: uniRows }, collegeRows, { data: domainRows }] = await Promise.all([
        supabase.from("universities").select("id,name").order("name"),
        fetchAllCollegesCatalog(supabase),
        supabase.from("internship_domains").select("id,name").order("name"),
      ]);
      setUnis((uniRows || []) as typeof unis);
      setColleges(collegeRows as typeof colleges);
      setDomains((domainRows || []) as typeof domains);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to load filters");
    } finally {
      setLoadingCatalog(false);
    }
  }, []);

  const loadRecipients = useCallback(async () => {
    setLoadingRecipients(true);
    try {
      const students = await fetchAdminStudentsLight(supabase, { force: true });
      const enrolled = students.map((s) => ({
        id: String(s.id),
        full_name: s.full_name,
        email: s.email,
        college_name: s.college_name,
        university_name: s.university_name,
        internship_domain: s.internship_domain,
        internship_mode: s.internship_mode,
        metadata: s.metadata as Record<string, unknown> | null,
      }));
      setAllStudentsComms(enrolled);

      const enrolledEmails = new Set(
        enrolled.map((s) => String(s.email || "").trim().toLowerCase()).filter(Boolean)
      );

      let cancelledRows: Record<string, unknown>[] = [];
      try {
        cancelledRows = await fetchAllSupabaseRows(supabase, "payment_cancelled", {
          orderBy: "created_at",
          ascending: false,
        });
      } catch {
        cancelledRows = [];
      }

      const leads = cancelledRows
        .filter((cp) => {
          const email = String(cp.email || cp.user_email || "").toLowerCase();
          return email && !enrolledEmails.has(email);
        })
        .map((cp, idx) => ({
          id: String(cp.id || `lead-${idx}`),
          full_name: cp.user_name || cp.full_name,
          user_name: cp.user_name,
          email: cp.email || cp.user_email,
          user_email: cp.user_email || cp.email,
          metadata: (cp.metadata || cp.payload || {}) as Record<string, unknown>,
        }));
      setAllLeadsComms(leads);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to load recipients");
    } finally {
      setLoadingRecipients(false);
    }
  }, []);

  useEffect(() => {
    if (!isActive) return;
    void loadCatalog();
    void loadRecipients();
  }, [isActive, loadCatalog, loadRecipients]);

  const commsBaseList = useMemo(
    () => (commRecipientType === "enrolled" ? allStudentsComms : allLeadsComms),
    [commRecipientType, allStudentsComms, allLeadsComms]
  );

  const commsFilteredList = useMemo(
    () =>
      filterCommsRecipients(commsBaseList, {
        uniFilters: commUniFilters,
        collegeFilters: commCollegeFilters,
        domainFilter: commDomainFilter,
        modeFilter: commModeFilter,
        colleges,
        unis,
        type: commRecipientType,
      }),
    [
      commsBaseList,
      commUniFilters,
      commCollegeFilters,
      commDomainFilter,
      commModeFilter,
      colleges,
      unis,
      commRecipientType,
    ]
  );

  const commsDisplayedList = useMemo(() => {
    const searched = searchCommsRecipients(commsFilteredList, commSearchTerm);
    return searched.slice(0, 500);
  }, [commsFilteredList, commSearchTerm]);

  const sendBulk = async () => {
    const activeList = commRecipientType === "enrolled" ? allStudentsComms : allLeadsComms;
    const resolveEmail = (s: { email?: string; user_email?: string }) =>
      String(s.email || s.user_email || "").trim().toLowerCase();

    const targets = [
      ...activeList
        .filter((s) => commsSelectedIds.includes(s.id))
        .map(resolveEmail),
      ...csvEmails.map((e) => String(e || "").trim().toLowerCase()),
    ];
    const uniqueTargets = Array.from(new Set(targets.filter((e) => e.includes("@"))));

    if (!uniqueTargets.length) {
      toast.error("No valid email addresses selected.");
      return;
    }

    setIsSendingBulk(true);
    setBulkTotal(uniqueTargets.length);
    setBulkProgress(0);

    try {
      const result = await sendBulkCustomMail(
        uniqueTargets,
        bulkEmailSubject,
        bulkEmailBody,
        (done) => setBulkProgress(done)
      );
      toastBulkMailResult(result, uniqueTargets.length, {
        onFullSuccess: () => {
          setBulkEmailSubject("");
          setBulkEmailBody("");
          setCommsSelectedIds([]);
          setCsvEmails([]);
        },
      });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to send bulk email");
    } finally {
      setIsSendingBulk(false);
    }
  };

  if (!isActive) return null;

  if (loadingCatalog && unis.length === 0) {
    return (
      <div className="py-16 text-center text-muted-foreground">
        <Loader2 className="size-6 animate-spin inline" />
      </div>
    );
  }

  return (
    <div className="grid lg:grid-cols-3 gap-6">
      <Card className="lg:col-span-2 p-6 shadow-soft border-slate-100">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Mail className="size-5 text-primary" />
              Compose Bulk Email
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Same Comms Center as Admin
              {loadingRecipients ? " — loading recipients…" : ""}
            </p>
          </div>
          {isSendingBulk && (
            <div className="flex items-center gap-3 bg-primary/5 px-4 py-2 rounded-full border border-primary/20">
              <Loader2 className="size-4 animate-spin text-primary" />
              <span className="text-sm font-bold text-primary">
                Sending {bulkProgress}/{bulkTotal}
                {bulkProgress < bulkTotal && (
                  <span className="font-normal text-muted-foreground ml-1">
                    ({formatBulkMailEta(estimateBulkMailSeconds(bulkTotal - bulkProgress))} left)
                  </span>
                )}
              </span>
            </div>
          )}
        </div>

        <div className="space-y-5">
          <div className="space-y-2">
            <Label>Email Subject</Label>
            <Input
              placeholder="Enter email subject"
              value={bulkEmailSubject}
              onChange={(e) => setBulkEmailSubject(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Message Content (Supports text & basic HTML)</Label>
            <textarea
              className="w-full min-h-[300px] p-4 rounded-xl border border-input bg-background focus:ring-2 focus:ring-primary/20 transition-all text-sm resize-y"
              placeholder="Write your message here..."
              value={bulkEmailBody}
              onChange={(e) => setBulkEmailBody(e.target.value)}
            />
          </div>

          <div className="flex items-center justify-between pt-4 border-t">
            <div className="text-sm">
              <span className="text-muted-foreground">Recipients selected: </span>
              <span className="font-bold text-primary">{commsSelectedIds.length + csvEmails.length}</span>
            </div>
            <Button
              variant="hero"
              size="lg"
              className="px-8 shadow-glow"
              disabled={
                isSendingBulk ||
                !bulkEmailSubject ||
                !bulkEmailBody ||
                (commsSelectedIds.length === 0 && csvEmails.length === 0)
              }
              onClick={() => void sendBulk()}
            >
              {isSendingBulk ? "Sending..." : "Send Bulk Email Now"}
            </Button>
          </div>
        </div>
      </Card>

      <div className="space-y-6">
        <Card className="p-5 shadow-soft border-slate-100">
          <h3 className="font-bold mb-4 flex items-center gap-2">
            <Users className="size-4 text-primary" />
            Target Selection
          </h3>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-[10px] uppercase font-black text-muted-foreground">Audience Type</Label>
              <Select
                value={commRecipientType}
                onValueChange={(v: "enrolled" | "unenrolled") => {
                  setCommRecipientType(v);
                  setCommUniFilters([]);
                  setCommCollegeFilters([]);
                  setCommDomainFilter("all");
                  setCommModeFilter("all");
                  setCommSearchTerm("");
                  setCommsSelectedIds([]);
                }}
              >
                <SelectTrigger className="h-10 bg-slate-50 border-none">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="enrolled">Enrolled Students ({allStudentsComms.length})</SelectItem>
                  <SelectItem value="unenrolled">Unenrolled Leads ({allLeadsComms.length})</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <MultiSelectCheckboxGroup
              label="University"
              options={unis}
              selectedValues={commUniFilters}
              onChange={(newUnis) => {
                setCommUniFilters(newUnis);
                setCommCollegeFilters((prev) =>
                  pruneCollegesForUniversities(colleges, unis, newUnis, prev)
                );
                setCommsSelectedIds([]);
              }}
              triggerClassName="h-10 bg-slate-50 border-none"
            />

            <MultiSelectCheckboxGroup
              label="College"
              options={collegesForUniversityNames(colleges, unis, commUniFilters)}
              selectedValues={commCollegeFilters}
              onChange={(newColleges) => {
                setCommCollegeFilters(newColleges);
                setCommsSelectedIds([]);
              }}
              triggerClassName="h-10 bg-slate-50 border-none"
            />

            <div className="space-y-2">
              <Label className="text-[10px] uppercase font-black text-muted-foreground">Internship Domain</Label>
              <Select
                value={commDomainFilter}
                onValueChange={(v) => {
                  setCommDomainFilter(v);
                  setCommsSelectedIds([]);
                }}
              >
                <SelectTrigger className="h-10 bg-slate-50 border-none">
                  <SelectValue placeholder="All Domains" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Domains</SelectItem>
                  {domains.map((d) => (
                    <SelectItem key={d.id} value={d.name}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-[10px] uppercase font-black text-muted-foreground">Internship Mode</Label>
              <InternshipModeFilterSelect
                value={commModeFilter}
                onValueChange={(v) => {
                  setCommModeFilter(v);
                  setCommsSelectedIds([]);
                }}
                className="h-10 bg-slate-50 border-none"
              />
            </div>

            <p className="text-[10px] text-muted-foreground">
              {commsFilteredList.length} match current filters
            </p>

            <Separator />

            <div className="p-4 rounded-xl bg-slate-50 border border-dashed border-slate-200">
              <p className="text-xs text-muted-foreground mb-3 text-center">Upload CSV with &apos;email&apos; column</p>
              <Input
                type="file"
                accept=".csv"
                className="bg-white"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  Papa.parse(file, {
                    header: true,
                    complete: (results) => {
                      const emails = results.data
                        .map((row: Record<string, string>) => row.email || row.Email || row.EMAIL)
                        .filter((email): email is string => Boolean(email && email.includes("@")));
                      setCsvEmails(emails);
                      toast.success(`Imported ${emails.length} emails from CSV`);
                    },
                  });
                }}
              />
              {csvEmails.length > 0 && (
                <div className="mt-3 flex items-center justify-between">
                  <Badge variant="outline" className="bg-white">
                    {csvEmails.length} from CSV
                  </Badge>
                  <Button variant="ghost" size="sm" className="h-7 text-xs text-red-500" onClick={() => setCsvEmails([])}>
                    Clear
                  </Button>
                </div>
              )}
            </div>

            <Separator />

            <div>
              <p className="text-xs font-bold text-muted-foreground uppercase mb-3">
                Filter & Select {commRecipientType === "enrolled" ? "Students" : "Leads"}
              </p>
              <Input
                placeholder="Search name or email..."
                value={commSearchTerm}
                onChange={(e) => setCommSearchTerm(e.target.value)}
                className="h-9 bg-white text-sm mb-2"
              />
              <div className="space-y-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start gap-2"
                  onClick={() => setCommsSelectedIds(commsFilteredList.map((s) => s.id))}
                >
                  <CheckCircle2 className="size-4" /> Select All Filtered ({commsFilteredList.length})
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start gap-2 text-red-500"
                  onClick={() => {
                    setCommsSelectedIds([]);
                    setCsvEmails([]);
                  }}
                >
                  <Trash2 className="size-4" /> Clear Selection
                </Button>
              </div>

              <div className="mt-4 border rounded-md bg-white">
                <div className="px-3 py-2 bg-slate-50 border-b text-[10px] font-black uppercase text-slate-500 flex justify-between">
                  <span>{commsSelectedIds.length} Selected</span>
                </div>
                <ScrollArea className="h-[200px]">
                  <div className="p-2 space-y-1">
                    {commsDisplayedList.map((item) => (
                      <label
                        key={item.id}
                        className="flex items-center gap-3 p-2 hover:bg-slate-50 rounded-lg cursor-pointer group"
                      >
                        <Checkbox
                          checked={commsSelectedIds.includes(item.id)}
                          onCheckedChange={(checked) => {
                            setCommsSelectedIds((prev) =>
                              checked
                                ? prev.includes(item.id)
                                  ? prev
                                  : [...prev, item.id]
                                : prev.filter((id) => id !== item.id)
                            );
                          }}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold truncate group-hover:text-primary transition-colors">
                            {item.full_name || item.user_name || "Unknown"}
                          </div>
                          <div className="text-[10px] text-muted-foreground truncate">
                            {item.email || item.user_email}
                          </div>
                        </div>
                      </label>
                    ))}
                    {commsDisplayedList.length === 0 && (
                      <div className="text-center p-4 text-xs text-muted-foreground">
                        No {commRecipientType === "enrolled" ? "students" : "leads"} match filters
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </div>
            </div>
          </div>
        </Card>

        <Card className="p-5 shadow-soft border-slate-100 bg-primary/5 border-primary/10">
          <h3 className="font-bold mb-2 flex items-center gap-2">
            <Shield className="size-4 text-primary" />
            Pro Tips
          </h3>
          <ul className="text-xs space-y-2 text-slate-600 list-disc pl-4">
            <li>You can use basic HTML like bold or italic tags.</li>
            <li>CSV upload is the fastest way for large groups.</li>
            <li>Do not close this window while sending is in progress.</li>
          </ul>
        </Card>
      </div>
    </div>
  );
}
