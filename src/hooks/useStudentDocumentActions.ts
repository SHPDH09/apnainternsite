import { useCallback, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  downloadConsentLetterFile,
  getStudentConsentLetterUrl,
  saveStudentConsentLetter,
} from "@/lib/studentDocuments";
import {
  formatDocumentIssueDate,
  resolveStudentDocumentFields,
} from "@/lib/studentPortalDocuments";
import { downloadHtmlDocumentPdf } from "@/lib/studentDocumentPdf";
import type { LearningMaterialRow } from "@/lib/learningMaterialsApi";
import {
  downloadStorageFileWithFallback,
  pickWorkingStorageUrl,
} from "@/lib/storageUrl";
import { StudentLogbookDocument } from "@/components/student/StudentLogbookDocument";
import { StudentAttendanceReportDocument } from "@/components/student/StudentAttendanceReportDocument";
import { ProjectReportPreviewDocument } from "@/components/student/ProjectReportPreviewDocument";
import { fetchProjectReportDomainTemplate } from "@/lib/projectReportSettings";
import {
  PROJECT_REPORT_MODES,
  type ProjectReportMode,
} from "@/lib/projectReportDomainContent";
import { downloadProjectReportPdf } from "@/lib/projectReportPdf";
import { resolveProjectReportStudentSnapshot } from "@/lib/projectReportStudentSnapshot";
import { studentInternshipMode } from "@/lib/internshipMode";
import { createElement } from "react";

export type StudentDocumentId =
  | "consent"
  | "acceptance"
  | "logbook"
  | "certificate"
  | "attendance"
  | "project";

export type StudentDocumentMeta = {
  id: StudentDocumentId;
  title: string;
  description: string;
  ready: boolean;
  statusLabel: string;
  canUpload?: boolean;
};

type AttendanceRecord = { marked_at?: string | null };

type Options = {
  userId: string;
  profile: Record<string, unknown> | null;
  attendanceRecords: AttendanceRecord[];
  projectReports: LearningMaterialRow[];
  universityLogoUrl?: string | null;
  hasCertificate: boolean;
  onOpenAcceptanceLetter: () => void;
  onOpenCertificate: () => void;
  onProfileUpdated?: () => void | Promise<void>;
};

async function waitForPaint(): Promise<void> {
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

export function useStudentDocumentActions({
  userId,
  profile,
  attendanceRecords,
  projectReports,
  universityLogoUrl,
  hasCertificate,
  onOpenAcceptanceLetter,
  onOpenCertificate,
  onProfileUpdated,
}: Options) {
  const logbookRef = useRef<HTMLDivElement>(null);
  const attendanceRef = useRef<HTMLDivElement>(null);
  const projectReportRef = useRef<HTMLDivElement>(null);
  const consentInputRef = useRef<HTMLInputElement>(null);
  const [downloading, setDownloading] = useState<StudentDocumentId | null>(null);
  const [uploadingConsent, setUploadingConsent] = useState(false);
  const [previewId, setPreviewId] = useState<StudentDocumentId | null>(null);
  const [documentIssueDate, setDocumentIssueDate] = useState(() => formatDocumentIssueDate());

  const fields = useMemo(() => resolveStudentDocumentFields(profile), [profile]);
  const consentUrl = useMemo(
    () => getStudentConsentLetterUrl({ metadata: (profile?.metadata as Record<string, unknown>) || null }),
    [profile]
  );
  const projectReport = projectReports[0] ?? null;
  const projectUrlCandidates = useMemo(
    () =>
      projectReport?.file_url_candidates?.length
        ? projectReport.file_url_candidates
        : projectReport?.file_url
          ? [projectReport.file_url]
          : [],
    [projectReport]
  );

  const projectGenerateInput = useMemo(() => {
    const pick = (...values: unknown[]) => {
      for (const v of values) {
        const s = String(v ?? "").trim();
        if (s && s !== "—") return s;
      }
      return "";
    };
    const domain = pick(
      profile?.internship_domain,
      profile?.course,
      profile?.subject,
      fields.domain
    );
    const universityName = pick(profile?.university_name, fields.university);
    if (!domain || !universityName) return null;
    const modeRaw = studentInternshipMode({
      university_name: universityName,
      internship_mode: profile?.internship_mode,
      metadata: profile?.metadata,
    });
    const mode = (
      PROJECT_REPORT_MODES.includes(modeRaw as ProjectReportMode) ? modeRaw : "Online"
    ) as ProjectReportMode;
    return {
      universityName,
      universityLogoUrl: universityLogoUrl ?? null,
      domain,
      mode,
      student: resolveProjectReportStudentSnapshot(profile),
    };
  }, [profile, fields.domain, fields.university, universityLogoUrl]);

  const projectUploadedReady = projectUrlCandidates.length > 0;
  const projectAutoReady = projectGenerateInput != null;
  const projectReady = projectUploadedReady || projectAutoReady;

  const documents: StudentDocumentMeta[] = useMemo(
    () => [
      {
        id: "consent",
        title: "Consent Letter",
        description:
          "Upload your signed consent letter from college, then view or download it anytime.",
        ready: !!consentUrl,
        canUpload: true,
        statusLabel: consentUrl ? "Ready" : "Upload required",
      },
      {
        id: "acceptance",
        title: "Acceptance Letter",
        description:
          "Official confirmation that you have been accepted into the Apna Intern programme.",
        ready: true,
        statusLabel: "Ready",
      },
      {
        id: "logbook",
        title: "Logbook",
        description:
          "Your day-wise internship record. Auto-generated from your profile — no typing needed.",
        ready: true,
        statusLabel: "Auto-generated",
      },
      {
        id: "certificate",
        title: "Certificate",
        description:
          "Your official internship completion certificate, issued after programme completion.",
        ready: hasCertificate,
        statusLabel: hasCertificate ? "Ready" : "Available after completion",
      },
      {
        id: "attendance",
        title: "Attendance Report",
        description:
          "A detailed report showing your present and absent days throughout the internship.",
        ready: true,
        statusLabel: "Ready",
      },
      {
        id: "project",
        title: "Project Report",
        description:
          "Your domain-specific project report, uploaded by the Apna Intern team for your batch.",
        ready: projectReady,
        statusLabel: projectReady
          ? projectUploadedReady
            ? "Ready"
            : "Auto-generated"
          : "Complete profile (domain & university)",
      },
    ],
    [consentUrl, hasCertificate, projectReady, projectUploadedReady]
  );

  const generateStudentProjectReport = useCallback(async () => {
    if (!projectGenerateInput) {
      throw new Error("Add your university and internship domain in Profile to generate your project report.");
    }
    const template = await fetchProjectReportDomainTemplate(supabase, projectGenerateInput.domain);
    return { template, input: projectGenerateInput };
  }, [projectGenerateInput]);

  const refreshIssueDate = useCallback(() => {
    setDocumentIssueDate(formatDocumentIssueDate());
  }, []);

  const downloadLogbook = async () => {
    if (!logbookRef.current) return;
    refreshIssueDate();
    await waitForPaint();
    setDownloading("logbook");
    try {
      await downloadHtmlDocumentPdf(
        logbookRef.current,
        `Logbook_${fields.studentName.replace(/\s+/g, "_")}.pdf`
      );
      toast.success("Logbook downloaded.");
    } catch {
      toast.error("Could not generate logbook PDF.");
    } finally {
      setDownloading(null);
    }
  };

  const downloadAttendanceReport = async () => {
    if (!attendanceRef.current) return;
    refreshIssueDate();
    await waitForPaint();
    setDownloading("attendance");
    try {
      await downloadHtmlDocumentPdf(
        attendanceRef.current,
        `Attendance_Report_${fields.studentName.replace(/\s+/g, "_")}.pdf`
      );
      toast.success("Attendance report downloaded.");
    } catch {
      toast.error("Could not generate attendance report PDF.");
    } finally {
      setDownloading(null);
    }
  };

  const handleConsentFileChange = async (file: File | null | undefined) => {
    if (!file || !userId) return;
    setUploadingConsent(true);
    try {
      await saveStudentConsentLetter(supabase, userId, profile, file);
      toast.success("Consent letter uploaded.");
      await onProfileUpdated?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not upload consent letter.");
    } finally {
      setUploadingConsent(false);
      if (consentInputRef.current) consentInputRef.current.value = "";
    }
  };

  const triggerConsentUpload = () => {
    consentInputRef.current?.click();
  };

  const viewDocument = (id: StudentDocumentId) => {
    switch (id) {
      case "consent":
        if (consentUrl) window.open(consentUrl, "_blank", "noopener,noreferrer");
        else toast.error("Upload your consent letter first.");
        break;
      case "acceptance":
        onOpenAcceptanceLetter();
        break;
      case "logbook":
        refreshIssueDate();
        setPreviewId("logbook");
        break;
      case "certificate":
        if (hasCertificate) onOpenCertificate();
        else toast.info("Certificate will be available once issued by the admin.");
        break;
      case "attendance":
        refreshIssueDate();
        setPreviewId("attendance");
        break;
      case "project":
        if (projectReady) {
          refreshIssueDate();
          setPreviewId("project");
        } else {
          toast.info("Add your university and internship domain in Profile to view your project report.");
        }
        break;
      default:
        break;
    }
  };

  const downloadDocument = async (id: StudentDocumentId) => {
    switch (id) {
      case "consent":
        if (consentUrl) {
          setDownloading("consent");
          try {
            await downloadConsentLetterFile(consentUrl, fields.studentName);
            toast.success("Consent letter downloaded.");
          } catch {
            toast.error("Could not download consent letter.");
          } finally {
            setDownloading(null);
          }
        } else {
          toast.error("Upload your consent letter first.");
        }
        break;
      case "acceptance":
        onOpenAcceptanceLetter();
        break;
      case "logbook":
        await downloadLogbook();
        break;
      case "certificate":
        if (hasCertificate) onOpenCertificate();
        else toast.info("Certificate will be available once issued by the admin.");
        break;
      case "attendance":
        await downloadAttendanceReport();
        break;
      case "project":
        if (projectUrlCandidates.length > 0) {
          setDownloading("project");
          try {
            await downloadStorageFileWithFallback(
              projectUrlCandidates,
              projectReport?.file_name || "Project_Report.pdf"
            );
            toast.success("Project report downloaded.");
          } catch {
            toast.error("Could not download project report. Please try View instead.");
          } finally {
            setDownloading(null);
          }
        } else if (projectAutoReady) {
          setDownloading("project");
          try {
            refreshIssueDate();
            await waitForPaint();
            const { template, input } = await generateStudentProjectReport();
            await downloadProjectReportPdf(template, input, projectReportRef.current);
            toast.success("Project report downloaded.");
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "Could not generate project report PDF.");
          } finally {
            setDownloading(null);
          }
        } else {
          toast.info("Add your university and internship domain in Profile to download your project report.");
        }
        break;
      default:
        break;
    }
  };

  const uploadDocument = (id: StudentDocumentId) => {
    if (id === "consent") triggerConsentUpload();
  };

  const hiddenPdfNodes = createElement(
    "div",
    { className: "fixed -left-[9999px] top-0 pointer-events-none", "aria-hidden": true },
    createElement(StudentLogbookDocument, { ref: logbookRef, fields, issueDate: documentIssueDate }),
    createElement(StudentAttendanceReportDocument, {
      ref: attendanceRef,
      fields,
      attendanceRecords,
      issueDate: documentIssueDate,
      programmeProfile: profile,
    }),
    projectGenerateInput
      ? createElement(ProjectReportPreviewDocument, {
          ref: projectReportRef,
          universityName: projectGenerateInput.universityName,
          universityLogoUrl: projectGenerateInput.universityLogoUrl,
          domain: projectGenerateInput.domain,
          mode: projectGenerateInput.mode,
        })
      : null,
    createElement("input", {
      ref: consentInputRef,
      type: "file",
      className: "hidden",
      accept: ".pdf,.png,.jpg,.jpeg,.webp,.gif,application/pdf,image/*",
      onChange: (e: { target: HTMLInputElement }) => {
        void handleConsentFileChange(e.target.files?.[0]);
      },
    })
  );

  return {
    documents,
    downloading,
    uploadingConsent,
    previewId,
    setPreviewId,
    viewDocument,
    downloadDocument,
    uploadDocument,
    fields,
    attendanceRecords,
    documentIssueDate,
    hiddenPdfNodes,
    projectGenerateInput,
    projectUrlCandidates,
  };
}
