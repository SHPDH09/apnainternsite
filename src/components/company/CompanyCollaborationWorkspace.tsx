import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, Briefcase, Users, Upload, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import {
  completeCompanyHiring,
  fetchCompanyJobs,
  fetchJobCandidates,
  jobStatusLabel,
  type CompanyCandidateRow,
  type CompanyJobRow,
  type CompanyProfileRow,
} from "@/lib/companyCollaboration";
import { parseHiringImportFile } from "@/lib/companyHiringImport";

type Props = {
  company: CompanyProfileRow;
  readOnly?: boolean;
  allowAdminImport?: boolean;
};

export function CompanyCollaborationWorkspace({
  company,
  readOnly = false,
  allowAdminImport = false,
}: Props) {
  const [jobs, setJobs] = useState<CompanyJobRow[]>([]);
  const [jobsLoading, setJobsLoading] = useState(true);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<CompanyCandidateRow[]>([]);
  const [candidatesLoading, setCandidatesLoading] = useState(false);

  const [jobDialogOpen, setJobDialogOpen] = useState(false);
  const [jobTitle, setJobTitle] = useState("");
  const [jobDesc, setJobDesc] = useState("");
  const [jobLocation, setJobLocation] = useState("");
  const [jobRequired, setJobRequired] = useState("1");
  const [savingJob, setSavingJob] = useState(false);

  const [importBusy, setImportBusy] = useState(false);
  const [completeOpen, setCompleteOpen] = useState(false);
  const [completeRemark, setCompleteRemark] = useState("");
  const [completing, setCompleting] = useState(false);

  const selectedJob = useMemo(
    () => jobs.find((j) => j.id === selectedJobId) || null,
    [jobs, selectedJobId]
  );

  const hiredCount = useMemo(
    () => candidates.filter((c) => c.status === "hired").length,
    [candidates]
  );

  const loadJobs = useCallback(async () => {
    setJobsLoading(true);
    try {
      const rows = await fetchCompanyJobs(supabase, company.id);
      setJobs(rows);
      if (!selectedJobId && rows[0]) setSelectedJobId(rows[0].id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not load jobs");
    } finally {
      setJobsLoading(false);
    }
  }, [company.id, selectedJobId]);

  const loadCandidates = useCallback(async (jobId: string) => {
    setCandidatesLoading(true);
    try {
      setCandidates(await fetchJobCandidates(supabase, jobId));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not load candidates");
    } finally {
      setCandidatesLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadJobs();
  }, [loadJobs]);

  useEffect(() => {
    if (selectedJobId) void loadCandidates(selectedJobId);
    else setCandidates([]);
  }, [selectedJobId, loadCandidates]);

  const createJob = async () => {
    if (readOnly) return;
    const title = jobTitle.trim();
    const required = Number(jobRequired);
    if (title.length < 2) {
      toast.error("Enter a job title");
      return;
    }
    if (!Number.isFinite(required) || required < 1) {
      toast.error("Required students must be at least 1");
      return;
    }
    setSavingJob(true);
    try {
      const { error } = await supabase.from("company_job_postings").insert({
        company_id: company.id,
        title,
        description: jobDesc.trim() || null,
        location: jobLocation.trim() || null,
        required_students: required,
        status: "open",
      });
      if (error) throw error;
      toast.success("Job posted");
      setJobDialogOpen(false);
      setJobTitle("");
      setJobDesc("");
      setJobLocation("");
      setJobRequired("1");
      await loadJobs();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not create job");
    } finally {
      setSavingJob(false);
    }
  };

  const handleImportFile = async (file: File) => {
    if (!selectedJobId) return;
    setImportBusy(true);
    try {
      const rows = await parseHiringImportFile(file);
      const { data: { user } } = await supabase.auth.getUser();
      const payload = rows.map((r) => ({
        company_id: company.id,
        job_id: selectedJobId,
        full_name: r.full_name,
        email: r.email || null,
        phone: r.phone || null,
        college_name: r.college_name || null,
        department: r.department || null,
        status: "imported",
        imported_by: user?.id || null,
      }));
      const { error } = await supabase.from("company_hiring_candidates").insert(payload);
      if (error) throw error;

      await supabase
        .from("company_job_postings")
        .update({ status: "hiring_in_progress", updated_at: new Date().toISOString() })
        .eq("id", selectedJobId)
        .in("status", ["open", "draft"]);

      toast.success(`Imported ${rows.length} candidate(s)`);
      await loadCandidates(selectedJobId);
      await loadJobs();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Import failed");
    } finally {
      setImportBusy(false);
    }
  };

  const markHired = async (candidate: CompanyCandidateRow) => {
    if (readOnly && !allowAdminImport) return;
    try {
      const { error } = await supabase
        .from("company_hiring_candidates")
        .update({
          status: "hired",
          hired_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", candidate.id);
      if (error) throw error;
      if (selectedJobId) await loadCandidates(selectedJobId);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update failed");
    }
  };

  const submitCompleteHiring = async () => {
    if (!selectedJobId) return;
    setCompleting(true);
    try {
      await completeCompanyHiring(supabase, selectedJobId, completeRemark);
      toast.success("Hiring marked complete");
      setCompleteOpen(false);
      setCompleteRemark("");
      await loadJobs();
      await loadCandidates(selectedJobId);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not complete hiring");
    } finally {
      setCompleting(false);
    }
  };

  const canComplete =
    selectedJob &&
    selectedJob.status !== "completed" &&
    hiredCount >= selectedJob.required_students;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 justify-between">
        <div>
          <p className="font-bold text-lg">{company.company_name}</p>
          <p className="text-xs text-muted-foreground">
            {company.contact_name}
            {company.designation ? ` · ${company.designation}` : ""} · {company.email}
          </p>
        </div>
        {!readOnly ? (
          <Button size="sm" className="gap-2" onClick={() => setJobDialogOpen(true)}>
            <Briefcase className="size-4" /> Post job
          </Button>
        ) : null}
      </div>

      <Tabs defaultValue="jobs">
        <TabsList>
          <TabsTrigger value="jobs">Job postings</TabsTrigger>
          <TabsTrigger value="hiring">Hire candidates</TabsTrigger>
        </TabsList>

        <TabsContent value="jobs" className="mt-4">
          {jobsLoading ? (
            <Loader2 className="size-6 animate-spin mx-auto" />
          ) : jobs.length === 0 ? (
            <Card className="p-6 text-center text-sm text-muted-foreground">
              No job postings yet.
            </Card>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Required</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Location</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {jobs.map((j) => (
                  <TableRow
                    key={j.id}
                    className="cursor-pointer"
                    onClick={() => setSelectedJobId(j.id)}
                  >
                    <TableCell className="font-medium">{j.title}</TableCell>
                    <TableCell>{j.required_students}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{jobStatusLabel(j.status)}</Badge>
                    </TableCell>
                    <TableCell className="text-xs">{j.location || "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </TabsContent>

        <TabsContent value="hiring" className="mt-4 space-y-3">
          {jobs.length === 0 ? (
            <p className="text-sm text-muted-foreground">Create a job posting first.</p>
          ) : (
            <>
              <div className="flex flex-wrap gap-2 items-end">
                <div className="space-y-1 flex-1 min-w-[200px]">
                  <Label className="text-xs">Select job</Label>
                  <select
                    className="w-full h-10 rounded-md border px-3 text-sm bg-background"
                    value={selectedJobId || ""}
                    onChange={(e) => setSelectedJobId(e.target.value || null)}
                  >
                    {jobs.map((j) => (
                      <option key={j.id} value={j.id}>
                        {j.title} ({jobStatusLabel(j.status)})
                      </option>
                    ))}
                  </select>
                </div>
                {(allowAdminImport || !readOnly) && selectedJob && selectedJob.status !== "completed" ? (
                  <label className="inline-flex cursor-pointer">
                    <input
                      type="file"
                      accept=".csv,.txt"
                      className="hidden"
                      disabled={importBusy}
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) void handleImportFile(f);
                        e.target.value = "";
                      }}
                    />
                    <Button type="button" variant="outline" size="sm" className="gap-2 pointer-events-none" tabIndex={-1}>
                      {importBusy ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Upload className="size-4" />
                      )}
                      Import students
                    </Button>
                  </label>
                ) : null}
                {canComplete ? (
                  <Button size="sm" className="gap-2" onClick={() => setCompleteOpen(true)}>
                    <CheckCircle2 className="size-4" /> Complete hiring
                  </Button>
                ) : null}
              </div>

              {selectedJob ? (
                <p className="text-xs text-muted-foreground">
                  Hired {hiredCount} / {selectedJob.required_students} required
                  {selectedJob.completion_remark ? ` · Remark: ${selectedJob.completion_remark}` : ""}
                </p>
              ) : null}

              {candidatesLoading ? (
                <Loader2 className="size-6 animate-spin mx-auto" />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Student</TableHead>
                      <TableHead>College</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {candidates.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                          Import student CSV to start hiring for this job.
                        </TableCell>
                      </TableRow>
                    ) : (
                      candidates.map((c) => (
                        <TableRow key={c.id}>
                          <TableCell>
                            <div className="font-medium text-sm">{c.full_name}</div>
                            <div className="text-xs text-muted-foreground">{c.email || c.phone || "—"}</div>
                          </TableCell>
                          <TableCell className="text-xs">{c.college_name || "—"}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{c.status}</Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            {c.status !== "hired" && (allowAdminImport || !readOnly) ? (
                              <Button size="sm" variant="outline" onClick={() => void markHired(c)}>
                                Mark hired
                              </Button>
                            ) : null}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              )}
            </>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={jobDialogOpen} onOpenChange={setJobDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Post a job</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Job title</Label>
              <Input value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Description</Label>
              <Textarea value={jobDesc} onChange={(e) => setJobDesc(e.target.value)} rows={3} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Location</Label>
                <Input value={jobLocation} onChange={(e) => setJobLocation(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Students required</Label>
                <Input
                  type="number"
                  min={1}
                  value={jobRequired}
                  onChange={(e) => setJobRequired(e.target.value)}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setJobDialogOpen(false)}>
              Cancel
            </Button>
            <Button disabled={savingJob} onClick={() => void createJob()}>
              {savingJob ? <Loader2 className="size-4 animate-spin" /> : "Publish job"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={completeOpen} onOpenChange={setCompleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Complete hiring</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Remark</Label>
            <Textarea
              placeholder="Hiring summary, start dates, notes for admin…"
              value={completeRemark}
              onChange={(e) => setCompleteRemark(e.target.value)}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCompleteOpen(false)}>
              Cancel
            </Button>
            <Button disabled={completing} onClick={() => void submitCompleteHiring()}>
              {completing ? <Loader2 className="size-4 animate-spin" /> : "Complete hiring"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
