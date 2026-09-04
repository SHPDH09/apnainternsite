import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  Award,
  BookOpen,
  CheckSquare,
  ClipboardList,
  Download,
  Eye,
  FileCheck,
  FileText,
  Loader2,
  Lock,
  ScrollText,
  Sparkles,
  Upload,
  Video,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { LearningPanelTab } from "@/components/student/StudentLearningPanel";
import { StudentMyCoursesPanel } from "@/components/student/StudentMyCoursesPanel";
import type { StudentDocumentId, StudentDocumentMeta } from "@/hooks/useStudentDocumentActions";
import {
  documentIdToServiceKey,
  learningTabToServiceKey,
  type StudentServiceKey,
} from "@/lib/studentServiceKeys";
type Accent = {
  border: string;
  iconBg: string;
  iconColor: string;
  status: string;
  button: string;
  buttonHover: string;
  viewBtn: string;
};

type LearningModule = {
  id: LearningPanelTab;
  title: string;
  description: string;
  icon: LucideIcon;
  accent: Accent;
  statusLabel: string;
};

type DocumentVisual = {
  id: StudentDocumentId;
  icon: LucideIcon;
  accent: Accent;
};

const LEARNING_ACCENTS = {
  blue: {
    border: "border-t-blue-500",
    iconBg: "bg-blue-50",
    iconColor: "text-blue-600",
    status: "text-blue-600",
    button: "bg-blue-600",
    buttonHover: "hover:bg-blue-700",
    viewBtn: "text-blue-600 hover:bg-blue-50",
  },
  purple: {
    border: "border-t-violet-500",
    iconBg: "bg-violet-50",
    iconColor: "text-violet-600",
    status: "text-violet-600",
    button: "bg-violet-600",
    buttonHover: "hover:bg-violet-700",
    viewBtn: "text-violet-600 hover:bg-violet-50",
  },
  amber: {
    border: "border-t-amber-500",
    iconBg: "bg-amber-50",
    iconColor: "text-amber-600",
    status: "text-amber-600",
    button: "bg-amber-500",
    buttonHover: "hover:bg-amber-600",
    viewBtn: "text-amber-600 hover:bg-amber-50",
  },
  green: {
    border: "border-t-emerald-500",
    iconBg: "bg-emerald-50",
    iconColor: "text-emerald-600",
    status: "text-emerald-600",
    button: "bg-emerald-600",
    buttonHover: "hover:bg-emerald-700",
    viewBtn: "text-emerald-600 hover:bg-emerald-50",
  },
} as const;

const DOCUMENT_ACCENTS: Record<StudentDocumentId, Accent> = {
  consent: {
    border: "border-t-violet-500",
    iconBg: "bg-violet-50",
    iconColor: "text-violet-600",
    status: "text-violet-600",
    button: "bg-violet-600",
    buttonHover: "hover:bg-violet-700",
    viewBtn: "text-violet-600 hover:bg-violet-50",
  },
  acceptance: {
    border: "border-t-teal-500",
    iconBg: "bg-teal-50",
    iconColor: "text-teal-600",
    status: "text-teal-600",
    button: "bg-teal-600",
    buttonHover: "hover:bg-teal-700",
    viewBtn: "text-teal-600 hover:bg-teal-50",
  },
  logbook: {
    border: "border-t-orange-500",
    iconBg: "bg-orange-50",
    iconColor: "text-orange-600",
    status: "text-orange-600",
    button: "bg-orange-500",
    buttonHover: "hover:bg-orange-600",
    viewBtn: "text-orange-600 hover:bg-orange-50",
  },
  certificate: {
    border: "border-t-rose-500",
    iconBg: "bg-rose-50",
    iconColor: "text-rose-600",
    status: "text-rose-600",
    button: "bg-rose-600",
    buttonHover: "hover:bg-rose-700",
    viewBtn: "text-rose-600 hover:bg-rose-50",
  },
  attendance: {
    border: "border-t-emerald-500",
    iconBg: "bg-emerald-50",
    iconColor: "text-emerald-600",
    status: "text-emerald-600",
    button: "bg-emerald-600",
    buttonHover: "hover:bg-emerald-700",
    viewBtn: "text-emerald-600 hover:bg-emerald-50",
  },
  project: {
    border: "border-t-indigo-500",
    iconBg: "bg-indigo-50",
    iconColor: "text-indigo-600",
    status: "text-indigo-600",
    button: "bg-indigo-600",
    buttonHover: "hover:bg-indigo-700",
    viewBtn: "text-indigo-600 hover:bg-indigo-50",
  },
};

const DOCUMENT_ICONS: Record<StudentDocumentId, LucideIcon> = {
  consent: FileCheck,
  acceptance: ScrollText,
  logbook: ClipboardList,
  certificate: Award,
  attendance: CheckSquare,
  project: FileText,
};

function SectionHeader({
  title,
  subtitle,
  countLabel,
  icon: Icon,
}: {
  title: string;
  subtitle: string;
  countLabel: string;
  icon?: LucideIcon;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6">
      <div className="flex items-start gap-3 min-w-0">
        {Icon ? (
          <div className="size-10 rounded-xl bg-gradient-to-br from-[#5AA3E6] to-[#6366f1] flex items-center justify-center shrink-0 shadow-lg shadow-[#5AA3E6]/20">
            <Icon className="size-5 text-white" />
          </div>
        ) : null}
        <div className="min-w-0">
          <h2 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">{title}</h2>
          <p className="text-sm text-slate-500 max-w-2xl mt-0.5 leading-relaxed">{subtitle}</p>
        </div>
      </div>
      <Badge
        variant="secondary"
        className="self-start sm:self-auto font-bold text-[10px] tracking-wider uppercase bg-slate-100 text-slate-600 border-slate-200/80"
      >
        {countLabel}
      </Badge>
    </div>
  );
}

function StatChip({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: string;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm px-3 py-2.5 min-w-0">
      <p className={`text-lg md:text-xl font-black tabular-nums truncate ${accent}`}>{value}</p>
      <p className="text-[10px] font-bold uppercase tracking-wider text-white/50 mt-0.5 truncate">
        {label}
      </p>
    </div>
  );
}

function LearningCard({
  module,
  onOpen,
  locked,
  serviceLocked,
}: {
  module: LearningModule;
  onOpen: () => void;
  locked?: boolean;
  serviceLocked?: boolean;
}) {
  const Icon = module.icon;
  const a = module.accent;
  const showLocked = locked || serviceLocked;
  return (
    <button
      type="button"
      onClick={onOpen}
      className={`group student-dash-card text-left p-5 flex flex-col min-h-[228px] ${
        showLocked ? "opacity-95" : ""
      }`}
    >
      <div
        className={`size-12 rounded-2xl ${a.iconBg} ${a.iconColor} flex items-center justify-center mb-4 relative ring-1 ring-black/[0.04] group-hover:scale-105 transition-transform duration-300`}
      >
        <Icon className="size-5" />
        {showLocked ? (
          <span className="absolute -right-1.5 -top-1.5 size-5 rounded-full bg-amber-500 text-white flex items-center justify-center shadow-md">
            <Lock className="size-3" />
          </span>
        ) : (
          <span className="absolute -right-1 -top-1 size-2 rounded-full bg-emerald-400 ring-2 ring-white opacity-0 group-hover:opacity-100 transition-opacity" />
        )}
      </div>
      <h3 className="font-bold text-slate-900 text-base mb-1.5 group-hover:text-[#5AA3E6] transition-colors">
        {module.title}
      </h3>
      <p className="text-sm text-slate-500 leading-relaxed flex-1">{module.description}</p>
      <div className="mt-5 pt-4 border-t border-slate-100/80 flex items-center justify-between gap-3">
        <span
          className={`text-[10px] font-black uppercase tracking-wider ${showLocked ? "text-amber-600" : a.status}`}
        >
          {locked ? "Locked · Pay to unlock" : serviceLocked ? "Locked · Contact admin" : module.statusLabel}
        </span>
        <span
          className={`size-9 rounded-xl ${a.button} ${a.buttonHover} text-white flex items-center justify-center shrink-0 shadow-md group-hover:shadow-lg transition-all group-hover:translate-x-0.5`}
        >
          {showLocked ? <Lock className="size-3.5" /> : <ArrowRight className="size-4" />}
        </span>
      </div>
    </button>
  );
}

function DocumentCard({
  doc,
  accent,
  icon: Icon,
  downloading,
  uploading,
  onView,
  onDownload,
  onUpload,
  serviceLocked,
}: {
  doc: StudentDocumentMeta;
  accent: Accent;
  icon: LucideIcon;
  downloading: boolean;
  uploading?: boolean;
  onView: () => void;
  onDownload: () => void;
  onUpload?: () => void;
  serviceLocked?: boolean;
}) {
  const busy = downloading || uploading;
  const blocked = serviceLocked || (!doc.ready && !doc.canUpload);

  return (
    <div
      className={`student-dash-card p-5 flex flex-col min-h-[268px] ${blocked ? "opacity-95" : ""}`}
    >
      <div
        className={`size-12 rounded-2xl ${accent.iconBg} ${accent.iconColor} flex items-center justify-center mb-4 relative ring-1 ring-black/[0.04]`}
      >
        <Icon className="size-5" />
        {serviceLocked ? (
          <span className="absolute -right-1.5 -top-1.5 size-5 rounded-full bg-amber-500 text-white flex items-center justify-center shadow-md">
            <Lock className="size-3" />
          </span>
        ) : doc.ready ? (
          <span className="absolute -right-1 -top-1 size-2 rounded-full bg-emerald-400 ring-2 ring-white" />
        ) : null}
      </div>
      <h3 className="font-bold text-slate-900 text-base mb-1.5">{doc.title}</h3>
      <p className="text-sm text-slate-500 leading-relaxed flex-1">{doc.description}</p>
      <p
        className={`text-[10px] font-black uppercase tracking-wider mt-4 mb-3 ${serviceLocked ? "text-amber-600" : accent.status}`}
      >
        {serviceLocked ? "Locked" : doc.statusLabel}
      </p>
      {doc.canUpload ? (
        <div className="grid grid-cols-3 gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={!doc.ready || busy}
            className={`gap-1 font-bold text-[10px] px-1 rounded-lg ${accent.viewBtn}`}
            onClick={onView}
          >
            <Eye className="size-3.5 shrink-0" />
            View
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={!doc.ready || busy}
            className={`gap-1 font-bold text-[10px] px-1 text-white rounded-lg ${accent.button} ${accent.buttonHover}`}
            onClick={onDownload}
          >
            {downloading ? (
              <Loader2 className="size-3.5 shrink-0 animate-spin" />
            ) : (
              <Download className="size-3.5 shrink-0" />
            )}
            Download
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy}
            className="gap-1 font-bold text-[10px] px-1 rounded-lg border-slate-200"
            onClick={onUpload}
          >
            {uploading ? (
              <Loader2 className="size-3.5 shrink-0 animate-spin" />
            ) : (
              <Upload className="size-3.5 shrink-0" />
            )}
            Upload
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={!doc.ready || busy}
            className={`gap-1.5 font-bold text-xs rounded-lg ${accent.viewBtn}`}
            onClick={onView}
          >
            <Eye className="size-3.5" />
            View
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={!doc.ready || busy}
            className={`gap-1.5 font-bold text-xs text-white rounded-lg ${accent.button} ${accent.buttonHover}`}
            onClick={onDownload}
          >
            {downloading ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Download className="size-3.5" />
            )}
            Download
          </Button>
        </div>
      )}
    </div>
  );
}

type Props = {
  profile: Record<string, unknown> | null;
  registrationLabel: string;
  onOfferLetter: () => void;
  onOpenLearning: (tab: LearningPanelTab) => void;
  liveClassCount: number;
  notesCount: number;
  activeAssignments: number;
  attendanceMarked: number;
  attendancePercentage: number;
  attendanceProgrammeDays: number;
  attendanceMarkedToday: boolean;
  documents: StudentDocumentMeta[];
  downloadingDoc: StudentDocumentId | null;
  uploadingConsent?: boolean;
  onViewDocument: (id: StudentDocumentId) => void;
  onDownloadDocument: (id: StudentDocumentId) => void;
  onUploadDocument?: (id: StudentDocumentId) => void;
  studentId?: string | null;
  onOpenMyCourses?: () => void;
  /** When false, internship learning/docs stay locked and clicks go to payment. */
  internshipUnlocked?: boolean;
  onLockedInternshipClick?: () => void;
  isServiceLocked?: (key: StudentServiceKey) => boolean;
  onServiceLockedClick?: (key: StudentServiceKey) => void;
};

export function StudentHomeView({
  profile,
  registrationLabel,
  onOfferLetter,
  onOpenLearning,
  liveClassCount,
  notesCount,
  activeAssignments,
  attendanceMarked,
  attendancePercentage,
  attendanceProgrammeDays,
  attendanceMarkedToday,
  documents,
  downloadingDoc,
  uploadingConsent = false,
  onViewDocument,
  onDownloadDocument,
  onUploadDocument,
  studentId,
  onOpenMyCourses,
  internshipUnlocked = true,
  onLockedInternshipClick,
  isServiceLocked,
  onServiceLockedClick,
}: Props) {
  const firstName = String(profile?.full_name || "Student").split(" ")[0];
  const initial = String(profile?.full_name || "S").charAt(0).toUpperCase();
  const learningModules: LearningModule[] = [
    {
      id: "classes",
      title: "Classes",
      description:
        "Watch every live class in order — Day 1, Day 2, and so on. Join live or replay the recording.",
      icon: Video,
      accent: LEARNING_ACCENTS.blue,
      statusLabel: `${liveClassCount} SCHEDULED`,
    },
    {
      id: "notes",
      title: "Notes",
      description:
        "Download study notes arranged day-wise — Day 1 Notes, Day 2 Notes, and so on.",
      icon: BookOpen,
      accent: LEARNING_ACCENTS.purple,
      statusLabel:
        notesCount > 0
          ? `${notesCount} note${notesCount === 1 ? "" : "s"} available`
          : "No notes yet",
    },
    {
      id: "assignments",
      title: "Assignments",
      description:
        "Complete your active assignments and review marks on submitted work.",
      icon: FileText,
      accent: LEARNING_ACCENTS.amber,
      statusLabel:
        activeAssignments > 0
          ? `${activeAssignments} active`
          : "All submitted",
    },
    {
      id: "attendance",
      title: "Attendance",
      description:
        "See how regular you are — total days marked, programme days, and attendance percentage.",
      icon: CheckSquare,
      accent: LEARNING_ACCENTS.green,
      statusLabel: `${attendanceMarked} / ${attendanceProgrammeDays} days · ${attendancePercentage.toFixed(0)}%${
        attendanceMarkedToday ? " · marked today" : ""
      }`,
    },
  ];

  const guardService = (key: StudentServiceKey, action: () => void) => {
    if (isServiceLocked?.(key)) {
      onServiceLockedClick?.(key);
      return;
    }
    action();
  };

  const guardLearning = (tab: LearningPanelTab, action: () => void) => {
    if (!internshipUnlocked) {
      onLockedInternshipClick?.();
      return;
    }
    guardService(learningTabToServiceKey(tab), action);
  };

  const guardDocument = (id: StudentDocumentId, action: () => void) => {
    if (!internshipUnlocked) {
      onLockedInternshipClick?.();
      return;
    }
    guardService(documentIdToServiceKey(id), action);
  };

  const domainLabel = String(profile?.internship_domain || profile?.course || "").trim();
  const docsReady = documents.filter((d) => d.ready).length;

  return (
    <div className="space-y-8 md:space-y-10 student-dash-animate-in">
      <section className="student-dash-hero relative overflow-hidden rounded-3xl text-white p-6 md:p-8 lg:p-10">
        <div className="absolute inset-0 student-dash-grid opacity-[0.07] pointer-events-none" />
        <div className="absolute -top-24 -right-16 size-64 student-dash-hero-glow blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 -left-10 size-48 rounded-full bg-violet-500/20 blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col gap-8">
          <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-6">
            <div className="flex items-center gap-5 min-w-0">
              <div className="relative shrink-0">
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-[#5AA3E6] to-violet-500 blur-md opacity-60" />
                <div className="relative size-16 md:size-[4.5rem] rounded-2xl bg-slate-900/40 border border-white/20 flex items-center justify-center text-2xl md:text-3xl font-black backdrop-blur-sm">
                  {initial}
                </div>
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1.5">
                  <Badge className="bg-[#5AA3E6]/20 text-sky-200 border-sky-400/30 font-bold text-[10px] uppercase tracking-wider">
                    <Sparkles className="size-3 mr-1 inline" />
                    Student Portal
                  </Badge>
                  {domainLabel ? (
                    <Badge variant="outline" className="border-white/20 text-white/80 font-semibold text-[10px] max-w-[200px] truncate">
                      {domainLabel}
                    </Badge>
                  ) : null}
                </div>
                <h1 className="text-3xl md:text-4xl lg:text-[2.75rem] font-black tracking-tight truncate leading-tight">
                  Welcome back, {firstName}
                </h1>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-sm text-white/55">
                  <span className="flex items-center gap-1">
                    <Zap className="size-3.5 text-amber-300" />
                    Your internship command centre
                  </span>
                  {registrationLabel ? (
                    <>
                      <span className="size-1 rounded-full bg-white/25 hidden sm:inline" />
                      <span className="font-mono text-xs text-white/45">{registrationLabel}</span>
                    </>
                  ) : null}
                </div>
              </div>
            </div>

            <Button
              size="lg"
              className="shrink-0 self-start xl:self-center rounded-xl font-bold gap-2 bg-white text-slate-900 hover:bg-white/90 shadow-lg shadow-black/20 border-0 h-11 px-6"
              onClick={() => {
                if (!internshipUnlocked) {
                  onLockedInternshipClick?.();
                  return;
                }
                guardService("offer_letter", () => onOfferLetter());
              }}
            >
              {!internshipUnlocked || isServiceLocked?.("offer_letter") ? (
                <Lock className="size-4" />
              ) : (
                <FileText className="size-4" />
              )}
              Offer Letter
            </Button>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatChip label="Attendance" value={`${attendancePercentage.toFixed(0)}%`} accent="text-sky-300" />
            <StatChip label="Classes" value={String(liveClassCount)} accent="text-violet-300" />
            <StatChip
              label="Assignments"
              value={activeAssignments > 0 ? String(activeAssignments) : "Done"}
              accent="text-amber-300"
            />
            <StatChip label="Docs ready" value={`${docsReady}/${documents.length}`} accent="text-emerald-300" />
          </div>
        </div>
      </section>

      {!internshipUnlocked ? (
        <div className="rounded-2xl border border-amber-200/80 bg-gradient-to-r from-amber-50 to-orange-50 px-4 py-3.5 text-sm text-amber-950 flex gap-3 items-start shadow-sm">
          <div className="size-8 rounded-lg bg-amber-500/15 flex items-center justify-center shrink-0">
            <Lock className="size-4 text-amber-700" />
          </div>
          <p className="leading-relaxed pt-0.5">
            You have course access only. Internship modules stay locked until you complete the
            internship registration payment.
          </p>
        </div>
      ) : null}

      {studentId ? (
        <div className="relative">
          <StudentMyCoursesPanel
            studentId={studentId}
            compact
            onViewAll={onOpenMyCourses}
          />
          {isServiceLocked?.("my_courses") ? (
            <button
              type="button"
              className="absolute inset-0 rounded-2xl bg-white/60 backdrop-blur-[2px] flex items-center justify-center z-10"
              onClick={() => onServiceLockedClick?.("my_courses")}
            >
              <span className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-xs font-black text-white shadow-lg">
                <Lock className="size-3.5" /> My Courses locked
              </span>
            </button>
          ) : null}
        </div>
      ) : null}

      <section className="student-dash-animate-in" style={{ animationDelay: "0.05s" }}>
        <SectionHeader
          icon={BookOpen}
          title="Learning Hub"
          subtitle={
            internshipUnlocked
              ? "Classes, notes, assignments and attendance — everything for daily progress."
              : "Internship learning modules — unlock with college registration payment."
          }
          countLabel="4 modules"
        />
        <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {learningModules.map((module) => (
            <LearningCard
              key={module.id}
              module={module}
              locked={!internshipUnlocked}
              serviceLocked={
                internshipUnlocked ? isServiceLocked?.(learningTabToServiceKey(module.id)) : false
              }
              onOpen={() => guardLearning(module.id, () => onOpenLearning(module.id))}
            />
          ))}
        </div>
      </section>

      <section className="student-dash-animate-in" style={{ animationDelay: "0.1s" }}>
        <SectionHeader
          icon={FileText}
          title="Document Vault"
          subtitle={
            internshipUnlocked
              ? "Official internship papers — view in browser or download as PDF anytime."
              : "Internship documents unlock after the internship registration payment."
          }
          countLabel={`${documents.length} documents`}
        />
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {documents.map((doc) => {
            const serviceKey = documentIdToServiceKey(doc.id);
            const docServiceLocked = internshipUnlocked ? isServiceLocked?.(serviceKey) : false;
            return (
            <div key={doc.id} className="relative">
              <DocumentCard
                doc={doc}
                accent={DOCUMENT_ACCENTS[doc.id]}
                icon={DOCUMENT_ICONS[doc.id]}
                downloading={downloadingDoc === doc.id}
                uploading={doc.id === "consent" && uploadingConsent}
                serviceLocked={!!docServiceLocked}
                onView={() => guardDocument(doc.id, () => onViewDocument(doc.id))}
                onDownload={() => guardDocument(doc.id, () => onDownloadDocument(doc.id))}
                onUpload={
                  onUploadDocument
                    ? () => guardDocument(doc.id, () => onUploadDocument(doc.id))
                    : undefined
                }
              />
              {!internshipUnlocked ? (
                <button
                  type="button"
                  className="absolute inset-0 rounded-2xl bg-white/65 backdrop-blur-[2px] flex items-center justify-center"
                  onClick={() => onLockedInternshipClick?.()}
                >
                  <span className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-xs font-black text-white shadow-lg">
                    <Lock className="size-3.5" /> Pay to unlock
                  </span>
                </button>
              ) : docServiceLocked ? (
                <button
                  type="button"
                  className="absolute inset-0 rounded-2xl bg-white/65 backdrop-blur-[2px] flex items-center justify-center"
                  onClick={() => onServiceLockedClick?.(serviceKey)}
                >
                  <span className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-xs font-black text-white shadow-lg">
                    <Lock className="size-3.5" /> Service locked
                  </span>
                </button>
              ) : null}
            </div>
          );})}
        </div>
      </section>

      <footer className="text-center text-[11px] text-slate-400 pb-2 pt-2 border-t border-slate-200/60">
        Apna Intern · SDP Technology Pvt Ltd · Patna, Bihar
      </footer>
    </div>
  );
}
