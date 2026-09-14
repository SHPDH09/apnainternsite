import { useCallback, useEffect, useMemo, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  Ban,
  BookOpen,
  CheckCircle2,
  Download,
  Edit,
  ExternalLink,
  Eye,
  FileText,
  GraduationCap,
  Loader2,
  LogIn,
  Mail,
  Phone,
  Shield,
  Trash2,
  Upload,
  User,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { resolveBnmuUniversityRollNumber } from "@/lib/certificateFormat";
import { isBnmuStudent } from "@/lib/feeRules";
import { getStudentConsentLetterUrl } from "@/lib/studentDocuments";
import { getStudentDirectoryPassword } from "@/lib/studentCredentials";
import { studentMetadataOf } from "@/lib/studentProfileDisplay";
import {
  downloadAdminStudentCertificatePdf,
  downloadAdminStudentConsentLetter,
  downloadAdminStudentLogbookPdf,
  downloadAdminStudentProjectReport,
  downloadStudentAttendanceReportPdf,
  fetchAdminStudentCertificate,
  fetchAdminStudentProjectReports,
  openAdminStudentProjectReport,
} from "@/lib/adminStudentDocumentDownloads";
import type { StudentDirectoryStudent } from "@/components/admin/StudentDirectoryActionsMenu";

const IMPERSONATE_KEY = "impersonate_id";

type DocumentKey =
  | "consent"
  | "acceptance"
  | "logbook"
  | "certificate"
  | "attendance"
  | "project"
  | "offer";

const DOCUMENTS: Array<{
  id: DocumentKey;
  title: string;
  description: string;
}> = [
  { id: "consent", title: "Consent Letter", description: "Signed college consent form" },
  { id: "acceptance", title: "Acceptance Letter", description: "Programme acceptance (offer letter)" },
  { id: "logbook", title: "Logbook", description: "Auto-generated internship logbook PDF" },
  { id: "certificate", title: "Certificate", description: "Completion certificate (if issued)" },
  { id: "attendance", title: "Attendance Report", description: "Present / absent day summary PDF" },
  { id: "project", title: "Project Report", description: "Shared domain project report" },
  { id: "offer", title: "Offer Letter", description: "Official internship offer letter PDF" },
];

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedUser: Record<string, unknown> | null;
  client: SupabaseClient;
  onEdit: (student: StudentDirectoryStudent) => void;
  onResetPassword: (student: StudentDirectoryStudent) => void;
  onResendCredentials: (student: StudentDirectoryStudent) => void;
  onUploadConsentLetter: (student: StudentDirectoryStudent) => void;
  onViewLogbook: (student: StudentDirectoryStudent) => void;
  onDownloadOfferLetter: (student: StudentDirectoryStudent) => void;
  onToggleBlock: (student: StudentDirectoryStudent) => void;
  onDelete: (student: StudentDirectoryStudent) => void;
  onTransferLead?: (user: Record<string, unknown>) => void;
};

export function StudentDirectoryDetailDialog({
  open,
  onOpenChange,
  selectedUser,
  client,
  onEdit,
  onResetPassword,
  onResendCredentials,
  onUploadConsentLetter,
  onViewLogbook,
  onDownloadOfferLetter,
  onToggleBlock,
  onDelete,
  onTransferLead,
}: Props) {
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [downloading, setDownloading] = useState<DocumentKey | null>(null);
  const [hasCertificate, setHasCertificate] = useState(false);
  const [certificateRow, setCertificateRow] = useState<Record<string, unknown> | null>(null);
  const [projectReports, setProjectReports] = useState<
    Awaited<ReturnType<typeof fetchAdminStudentProjectReports>>
  >([]);

  const student = selectedUser;
  const studentAsMenu = student as StudentDirectoryStudent;
  const isBlocked = student?.status === "Blocked";
  const consentUrl = student ? getStudentConsentLetterUrl(student) : null;

  const loadDocumentMeta = useCallback(async () => {
    if (!student?.id || !open) return;
    setLoadingDocs(true);
    try {
      const id = String(student.id);
      const cert = await fetchAdminStudentCertificate(client, id);
      setCertificateRow(cert);
      setHasCertificate(!!cert);
      const reports = await fetchAdminStudentProjectReports(client, student);
      setProjectReports(reports);
    } catch (e) {
      console.warn("[student-detail] document meta:", e);
    } finally {
      setLoadingDocs(false);
    }
  }, [client, open, student]);

  useEffect(() => {
    void loadDocumentMeta();
  }, [loadDocumentMeta]);

  const docReady = useMemo(
    () => ({
      consent: !!consentUrl,
      acceptance: true,
      logbook: true,
      certificate: hasCertificate,
      attendance: true,
      project: projectReports.length > 0,
      offer: true,
    }),
    [consentUrl, hasCertificate, projectReports.length]
  );

  const handleDownload = async (id: DocumentKey) => {
    if (!student) return;
    setDownloading(id);
    try {
      switch (id) {
        case "consent":
          await downloadAdminStudentConsentLetter(student);
          toast.success("Consent letter downloaded.");
          break;
        case "acceptance":
        case "offer":
          onDownloadOfferLetter(studentAsMenu);
          break;
        case "logbook":
          await downloadAdminStudentLogbookPdf(client, student);
          toast.success("Logbook downloaded.");
          break;
        case "certificate":
          if (!certificateRow) throw new Error("Certificate not issued yet.");
          await downloadAdminStudentCertificatePdf(client, student, certificateRow);
          toast.success("Certificate downloaded.");
          break;
        case "attendance":
          await downloadStudentAttendanceReportPdf(client, student);
          toast.success("Attendance report downloaded.");
          break;
        case "project":
          await downloadAdminStudentProjectReport(projectReports);
          toast.success("Project report downloaded.");
          break;
        default:
          break;
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Download failed.");
    } finally {
      setDownloading(null);
    }
  };

  const handleView = async (id: DocumentKey) => {
    if (!student) return;
    try {
      switch (id) {
        case "consent":
          if (consentUrl) window.open(consentUrl, "_blank", "noopener,noreferrer");
          else toast.error("No consent letter on file.");
          break;
        case "acceptance":
        case "offer":
          onDownloadOfferLetter(studentAsMenu);
          break;
        case "logbook":
          onViewLogbook(studentAsMenu);
          break;
        case "certificate":
          if (!certificateRow) {
            toast.info("Certificate not issued yet.");
            return;
          }
          await downloadAdminStudentCertificatePdf(client, student, certificateRow);
          break;
        case "attendance":
          await downloadStudentAttendanceReportPdf(client, student);
          break;
        case "project":
          await openAdminStudentProjectReport(projectReports);
          break;
        default:
          break;
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not open document.");
    }
  };

  const handleOpenStudentDashboard = () => {
    if (!student?.id) return;
    localStorage.setItem(IMPERSONATE_KEY, String(student.id));
    window.open("/dashboard", "_blank", "noopener,noreferrer");
    toast.success("Opening student dashboard in a new tab (admin preview mode).");
  };

  if (!student) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl p-0 overflow-hidden rounded-3xl border-none shadow-elegant">
        <DialogDescription className="sr-only">
          Full student profile, admin actions, and downloadable documents.
        </DialogDescription>
        <div className="bg-primary p-6 text-white">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div>
              <DialogTitle className="text-2xl font-black flex items-center gap-2 flex-wrap">
                {String(student.full_name || student.metadata?.fullName || "Student Profile")}
                {isBlocked ? (
                  <Badge variant="destructive" className="text-[10px] uppercase">
                    Blocked
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="text-[10px] uppercase bg-white/20 text-white border-0">
                    {String(student.status || "Active")}
                  </Badge>
                )}
              </DialogTitle>
              <p className="text-primary-foreground/80 text-xs mt-1">
                {student.registration_id
                  ? `Reg ID: ${String(student.registration_id)}`
                  : "Lead / Pending Registration"}
              </p>
            </div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="gap-2 font-bold shrink-0"
              onClick={handleOpenStudentDashboard}
            >
              <LogIn className="size-4" />
              Open Student Dashboard
            </Button>
          </div>
        </div>

        <ScrollArea className="max-h-[78vh]">
          <div className="p-6 md:p-8 space-y-8">
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="default"
                size="sm"
                className="gap-2 font-bold"
                onClick={() => onEdit(studentAsMenu)}
              >
                <Edit className="size-4" /> Edit / Update
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => onResetPassword(studentAsMenu)}
              >
                <LogIn className="size-4" /> Reset Password
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => onResendCredentials(studentAsMenu)}
              >
                <Mail className="size-4" /> Resend Credentials
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => onUploadConsentLetter(studentAsMenu)}
              >
                <Upload className="size-4" /> Upload Consent
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className={`gap-2 ${isBlocked ? "text-green-700" : "text-destructive"}`}
                onClick={() => onToggleBlock(studentAsMenu)}
              >
                {isBlocked ? (
                  <>
                    <CheckCircle2 className="size-4" /> Unblock
                  </>
                ) : (
                  <>
                    <Ban className="size-4" /> Block
                  </>
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-2 text-destructive border-destructive/30"
                onClick={() => onDelete(studentAsMenu)}
              >
                <Trash2 className="size-4" /> Delete
              </Button>
            </div>

            <Separator />

            <div className="space-y-4">
              <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-primary flex items-center gap-2">
                <FileText className="size-3" /> Documents (same as student dashboard)
              </h4>
              {loadingDocs ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                  <Loader2 className="size-4 animate-spin" /> Loading documents…
                </div>
              ) : (
                <div className="grid sm:grid-cols-2 gap-3">
                  {DOCUMENTS.map((doc) => {
                    const ready = docReady[doc.id];
                    const busy = downloading === doc.id;
                    return (
                      <div
                        key={doc.id}
                        className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 space-y-3"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-sm font-bold text-slate-900">{doc.title}</p>
                            <p className="text-[11px] text-muted-foreground">{doc.description}</p>
                          </div>
                          <Badge variant={ready ? "default" : "secondary"} className="text-[9px] shrink-0">
                            {ready ? "Ready" : "N/A"}
                          </Badge>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="gap-1.5 h-8 text-xs font-bold"
                            disabled={!ready || busy}
                            onClick={() => void handleView(doc.id)}
                          >
                            <Eye className="size-3.5" /> View
                          </Button>
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            className="gap-1.5 h-8 text-xs font-bold"
                            disabled={!ready || busy}
                            onClick={() => void handleDownload(doc.id)}
                          >
                            {busy ? (
                              <Loader2 className="size-3.5 animate-spin" />
                            ) : (
                              <Download className="size-3.5" />
                            )}
                            Download
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <Separator />

            <div className="space-y-4">
              <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-primary flex items-center gap-2">
                <User className="size-3" /> Personal Information
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                <Field label="Gender" value={student.gender || student.metadata?.gender} />
                <Field label="Email" value={student.email || student.user_email} />
                <Field
                  label="Contact"
                  value={
                    student.contact_number ||
                    student.user_phone ||
                    student.metadata?.contact_number ||
                    student.metadata?.contact
                  }
                />
                <div className="md:col-span-2">
                  <Field label="Parent / Guardian" value={student.parent_name || student.metadata?.parentName} />
                </div>
              </div>
            </div>

            <Separator />

            <div className="space-y-4">
              <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-primary flex items-center gap-2">
                <GraduationCap className="size-3" /> Academic Details
              </h4>
              <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                <div className="col-span-2">
                  <Field
                    label="University"
                    value={
                      student.university_name ||
                      student.metadata?.university_name ||
                      student.metadata?.university
                    }
                  />
                </div>
                <div className="col-span-2">
                  <Field
                    label="College"
                    value={student.college_name || student.metadata?.college_name || student.metadata?.college}
                  />
                </div>
                <Field label="Degree" value={student.degree || student.metadata?.degree} />
                <Field label="Department" value={student.department || student.metadata?.department} />
                <Field label="Subject" value={student.metadata?.subject} />
                <Field label="Session" value={student.academic_session || student.metadata?.session} />
                <Field
                  label="Semester"
                  value={student.class_semester || student.metadata?.semester || student.metadata?.classSem}
                />
                <Field label="Registration No." value={student.roll_number || student.metadata?.rollNo} />
                {isBnmuStudent(String(student.university_name || student.metadata?.university_name || "")) ? (
                  <Field
                    label="Roll No."
                    value={
                      student.university_roll_number ||
                      student.metadata?.university_roll_number ||
                      resolveBnmuUniversityRollNumber(student)
                    }
                  />
                ) : null}
                <div className="col-span-2 p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <Label className="text-[9px] uppercase text-primary font-bold">Internship Domain</Label>
                  <p className="text-base font-black text-slate-900">
                    {String(
                      student.internship_domain ||
                        student.metadata?.course ||
                        student.metadata?.internship_domain ||
                        "—"
                    )}
                  </p>
                </div>
              </div>
            </div>

            <Separator />

            <div className="space-y-4">
              <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-primary flex items-center gap-2">
                <Phone className="size-3" /> Emergency Contacts
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                <Field label="Contact Name" value={student.emergency_name || student.metadata?.emName} />
                <Field label="Relationship" value={student.emergency_relation || student.metadata?.emRel} />
                <Field label="Contact Phone" value={student.emergency_contact || student.metadata?.emPhone} />
              </div>
            </div>

            {consentUrl ? (
              <>
                <Separator />
                <div className="rounded-2xl border border-primary/20 bg-primary/[0.06] p-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-primary flex items-center gap-2">
                      <ExternalLink className="size-3" /> Consent letter on file
                    </h4>
                  </div>
                  <Button variant="outline" size="sm" className="font-bold" asChild>
                    <a href={consentUrl} target="_blank" rel="noopener noreferrer">
                      Open consent letter
                    </a>
                  </Button>
                </div>
              </>
            ) : null}

            {(student.reason || student.failure_reason) && (
              <>
                <Separator />
                <div className="p-4 bg-red-50 rounded-2xl border border-red-100">
                  <Label className="text-[9px] uppercase text-red-600 font-bold">Lead Status / Payment Issue</Label>
                  <p className="text-sm font-bold text-red-700">
                    {String(student.reason || student.failure_reason)}
                  </p>
                </div>
              </>
            )}

            <div className="space-y-4 pt-4 border-t border-slate-100 bg-slate-50 p-6 rounded-2xl">
              <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-orange-600 flex items-center gap-2">
                <Shield className="size-3" /> Account & Metadata
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <Label className="text-[9px] uppercase text-orange-400 font-bold">
                    Login password (directory)
                  </Label>
                  <p className="text-sm font-mono font-bold text-orange-700 bg-orange-100 px-2 py-1 rounded inline-block mt-1">
                    {getStudentDirectoryPassword(student) ||
                      "Not stored — use Reset Password or Resend Credentials"}
                  </p>
                </div>
                <Field label="Address" value={student.metadata?.address} />
              </div>
              <div>
                <Label className="text-[9px] uppercase text-slate-400 font-bold">Raw JSON Metadata</Label>
                <pre className="text-[9px] bg-slate-900 text-slate-300 p-4 rounded-xl mt-2 overflow-x-auto max-h-40">
                  {JSON.stringify(studentMetadataOf(student), null, 2)}
                </pre>
              </div>
            </div>

            <div className="flex flex-wrap justify-end gap-3 pt-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Close
              </Button>
              {!student.registration_id && onTransferLead ? (
                <Button
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                  onClick={() => {
                    onOpenChange(false);
                    onTransferLead(student);
                  }}
                >
                  Transfer to Student
                </Button>
              ) : null}
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, value }: { label: string; value: unknown }) {
  const text = value == null || String(value).trim() === "" ? "—" : String(value);
  return (
    <div>
      <Label className="text-[9px] uppercase text-muted-foreground font-bold">{label}</Label>
      <p className="text-sm font-bold break-words">{text}</p>
    </div>
  );
}
