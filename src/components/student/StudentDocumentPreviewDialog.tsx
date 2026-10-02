import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollableDialogBody, scrollableDialogShellClass } from "@/components/ui/scrollable-dialog";
import { StudentLogbookDocument } from "@/components/student/StudentLogbookDocument";
import { StudentAttendanceReportDocument } from "@/components/student/StudentAttendanceReportDocument";
import { ProjectReportPreviewDocument } from "@/components/student/ProjectReportPreviewDocument";
import type { StudentDocumentId } from "@/hooks/useStudentDocumentActions";
import type { ProjectReportMode } from "@/lib/projectReportDomainContent";
import type { StudentDocumentFields } from "@/lib/studentPortalDocuments";

type AttendanceRecord = { marked_at?: string | null };

const TITLES: Partial<Record<StudentDocumentId, string>> = {
  logbook: "Internship Logbook",
  attendance: "Attendance Report",
  project: "Project Report",
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentId: StudentDocumentId | null;
  fields: StudentDocumentFields;
  attendanceRecords: AttendanceRecord[];
  issueDate?: string;
  programmeProfile?: Record<string, unknown> | null;
  projectPreview?: {
    universityName: string;
    universityLogoUrl?: string | null;
    domain: string;
    mode: ProjectReportMode;
  } | null;
};

export function StudentDocumentPreviewDialog({
  open,
  onOpenChange,
  documentId,
  fields,
  attendanceRecords,
  issueDate,
  programmeProfile,
  projectPreview,
}: Props) {
  const title = documentId ? TITLES[documentId] || "Document preview" : "Document preview";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={`max-w-4xl border-none shadow-2xl ${scrollableDialogShellClass}`}
        closeClassName="text-white hover:text-white opacity-90 hover:opacity-100"
      >
        <DialogHeader className="p-5 pr-14 bg-slate-900 text-white border-b border-white/10 shrink-0">
          <DialogTitle className="text-xl font-bold">{title}</DialogTitle>
          <DialogDescription className="text-white/70">
            Preview only — use Download on the card to save a PDF.
          </DialogDescription>
        </DialogHeader>
        <ScrollableDialogBody className="bg-slate-100" innerClassName="p-4 flex justify-center">
          {documentId === "logbook" ? (
            <StudentLogbookDocument fields={fields} issueDate={issueDate} />
          ) : documentId === "attendance" ? (
            <StudentAttendanceReportDocument
              fields={fields}
              attendanceRecords={attendanceRecords}
              issueDate={issueDate}
              programmeProfile={programmeProfile}
            />
          ) : documentId === "project" && projectPreview ? (
            <ProjectReportPreviewDocument
              universityName={projectPreview.universityName}
              universityLogoUrl={projectPreview.universityLogoUrl}
              domain={projectPreview.domain}
              mode={projectPreview.mode}
              issueDate={issueDate}
            />
          ) : null}
        </ScrollableDialogBody>
      </DialogContent>
    </Dialog>
  );
}
