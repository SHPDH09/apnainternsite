import { useModuleStudentsLight } from "@/hooks/useModuleStudentsLight";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AssignmentManagementPanel } from "@/components/admin/AssignmentManagementPanel";
import { CertificateManagementPanel } from "@/components/admin/CertificateManagementPanel";
import { ClassLinkManagementPanel } from "@/components/admin/ClassLinkManagementPanel";
import { EngineeringDirectoryPanel } from "@/components/admin/EngineeringDirectoryPanel";
import { NotificationManagementPanel } from "@/components/admin/NotificationManagementPanel";
import { IdCardManagementPanel } from "@/components/admin/IdCardManagementPanel";
import { LearningMaterialsPanel } from "@/components/admin/LearningMaterialsPanel";
import { FeesManagementPanel } from "@/components/admin/FeesManagementPanel";
import { CourseManagementPanel } from "@/components/admin/CourseManagementPanel";
import { ReferralsPanel } from "@/components/admin/ReferralsPanel";
import { CollegeRostersPanel } from "@/components/admin/CollegeRostersPanel";
import { StaffAttendanceAdminPanel } from "@/components/admin/StaffAttendanceAdminPanel";
import { StaffManagementPanel } from "@/components/admin/StaffManagementPanel";
import { CommsCenterPanel } from "@/components/admin/CommsCenterPanel";
import { CybercafeManagementPanel } from "@/components/admin/CybercafeManagementPanel";
import { InstitutionsManagementPanel } from "@/components/admin/InstitutionsManagementPanel";
import { DocumentCustomizationPanel } from "@/components/admin/DocumentCustomizationPanel";
import { StudentDataUploadPanel } from "@/components/admin/StudentDataUploadPanel";
import { AutoGenerateProjectReportPanel } from "@/components/admin/AutoGenerateProjectReportPanel";
import { CheckPaymentPanel } from "@/components/admin/CheckPaymentPanel";
import { UnpaidStudentsDirectoryPanel } from "@/components/admin/UnpaidStudentsDirectoryPanel";
import { LeadAssignmentPanel } from "@/components/admin/LeadAssignmentPanel";
import { PartnerApplicationsPanel } from "@/components/admin/PartnerApplicationsPanel";
import { GalleryManagementPanel } from "@/components/admin/GalleryManagementPanel";
import { BlogManagementPanel } from "@/components/admin/BlogManagementPanel";
import { HomeCmsManagementPanel } from "@/components/admin/HomeCmsManagementPanel";
import { ConsultLetterManagementPanel } from "@/components/admin/ConsultLetterManagementPanel";
import { PopupManagementPanel } from "@/components/admin/PopupManagementPanel";
import { ContactDetailsManagementPanel } from "@/components/admin/ContactDetailsManagementPanel";
import { WhatsAppLinksManagementPanel } from "@/components/admin/WhatsAppLinksManagementPanel";
import { StudentServiceKeysPanel } from "@/components/admin/StudentServiceKeysPanel";
import { StudentAttendancePanel } from "@/components/admin/StudentAttendancePanel";
import AIAssignmentBuilder from "@/components/AIAssignmentBuilder";
import type { AdminStaffProfile } from "@/lib/staffProfile";
import type { StudentDirectoryStudent } from "@/components/admin/StudentDirectoryActionsMenu";
import EngineeringManagement from "@/pages/EngineeringManagement";
import NonEngineeringManagement from "@/pages/NonEngineeringManagement";
import { fetchAllCollegesCatalog } from "@/lib/institutionCatalog";
import {
  fetchAllAttendanceCountsMap,
} from "@/lib/attendanceAdmin";
import {
  calcAttendancePercentage,
  getStudentRecordId,
  normalizeStudentId,
} from "@/lib/attendanceStats";
import { programmeAttendanceDayBasis } from "@/lib/internshipProgramme";
import type { ClassLinkRow } from "@/lib/classLinkTargeting";
import { Badge } from "@/components/ui/badge";
import { StudentProfileViewDialog } from "@/components/admin/StudentProfileViewDialog";
import { enrichStudentProfileForDisplay, studentMetadataOf } from "@/lib/studentProfileDisplay";
import { parseJsonField } from "@/lib/parseJsonField";
import { Building2, Loader2, Mail, Settings, Store, Users } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Catalog = {
  unis: { id: string; name: string }[];
  colleges: { id: string; name: string; university_id: string }[];
  domains: { id: string; name: string }[];
};

async function loadCatalog(): Promise<Catalog> {
  const [{ data: unis }, colleges, { data: domains }] = await Promise.all([
    supabase.from("universities").select("id,name").order("name"),
    fetchAllCollegesCatalog(supabase),
    supabase.from("internship_domains").select("id,name").order("name"),
  ]);
  return {
    unis: (unis || []) as Catalog["unis"],
    colleges: (colleges || []) as Catalog["colleges"],
    domains: (domains || []) as Catalog["domains"],
  };
}

function useStaffCatalog(active: boolean) {
  const [catalog, setCatalog] = useState<Catalog>({ unis: [], colleges: [], domains: [] });
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    (async () => {
      try {
        const c = await loadCatalog();
        if (!cancelled) {
          setCatalog(c);
          setReady(true);
        }
      } catch (e: any) {
        if (!cancelled) toast.error(e?.message || "Failed to load catalog");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [active]);

  return { catalog, ready };
}

export function StaffAssignmentsPanel({
  currentUserId,
  isActive,
}: {
  currentUserId: string | null;
  isActive: boolean;
}) {
  const { catalog, ready } = useStaffCatalog(isActive);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [aiBuilderOpen, setAiBuilderOpen] = useState(false);

  const refresh = useCallback(async () => {
    const { data, error } = await supabase
      .from("assignments")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    setAssignments(data || []);
  }, []);

  useEffect(() => {
    if (isActive) void refresh().catch((e) => toast.error(e.message));
  }, [isActive, refresh]);

  if (!ready) {
    return (
      <div className="py-16 text-center text-muted-foreground">
        <Loader2 className="size-6 animate-spin inline" />
      </div>
    );
  }

  return (
    <>
      <AssignmentManagementPanel
        assignments={assignments}
        unis={catalog.unis}
        colleges={catalog.colleges}
        domains={catalog.domains}
        currentUserId={currentUserId || undefined}
        onRefresh={refresh}
        onOpenAiBuilder={() => setAiBuilderOpen(true)}
        isActive={isActive}
      />
      <AIAssignmentBuilder
        open={aiBuilderOpen}
        onClose={() => setAiBuilderOpen(false)}
        onSaved={() => void refresh()}
        currentUserId={currentUserId || undefined}
        unis={catalog.unis}
        colleges={catalog.colleges}
        domains={catalog.domains}
      />
    </>
  );
}

export function StaffCertificatesPanel({ isActive }: { isActive: boolean }) {
  const { catalog, ready } = useStaffCatalog(isActive);
  const { students, loading: studentsLoading, reload } = useModuleStudentsLight(supabase, isActive);
  const [certs, setCerts] = useState<any[]>([]);
  const retriedEmptyRef = useRef(false);

  const refreshCerts = useCallback(async () => {
    const { data } = await supabase.from("certificates").select("*").order("created_at", { ascending: false }).limit(500);
    setCerts(data || []);
  }, []);

  useEffect(() => {
    if (!isActive) {
      retriedEmptyRef.current = false;
      return;
    }
    void refreshCerts();
  }, [isActive, refreshCerts]);

  useEffect(() => {
    if (!isActive || studentsLoading || students.length > 0 || retriedEmptyRef.current) return;
    retriedEmptyRef.current = true;
    void reload().catch((err) => {
      toast.error(
        err instanceof Error ? err.message : "Could not load students for certificate generation"
      );
    });
  }, [isActive, students.length, studentsLoading, reload]);

  if (!ready) {
    return (
      <div className="py-16 text-center text-muted-foreground">
        <Loader2 className="size-6 animate-spin inline" />
      </div>
    );
  }

  return (
    <CertificateManagementPanel
      students={students as any[]}
      certificates={certs}
      domains={catalog.domains}
      unis={catalog.unis}
      colleges={catalog.colleges}
      onRefreshCertificates={refreshCerts}
      onLogAction={async () => {}}
      isActive={isActive}
      studentsLoading={studentsLoading}
      onRequestStudents={() =>
        void reload().catch((err) => {
          toast.error(
            err instanceof Error ? err.message : "Could not load students for certificates"
          );
        })
      }
    />
  );
}

export function StaffClassesPanel({
  currentUserId,
  isActive,
}: {
  currentUserId: string | null;
  isActive: boolean;
}) {
  const { catalog, ready } = useStaffCatalog(isActive);
  const { students } = useModuleStudentsLight(supabase, isActive);
  const [classesList, setClassesList] = useState<ClassLinkRow[]>([]);

  const refresh = useCallback(async () => {
    const { data, error } = await supabase.from("classes").select("*").order("created_at", { ascending: false });
    if (error) throw error;
    setClassesList((data || []) as ClassLinkRow[]);
  }, []);

  useEffect(() => {
    if (isActive) void refresh().catch((e) => toast.error(e.message));
  }, [isActive, refresh]);

  if (!ready) {
    return (
      <div className="py-16 text-center text-muted-foreground">
        <Loader2 className="size-6 animate-spin inline" />
      </div>
    );
  }

  return (
    <ClassLinkManagementPanel
      classesList={classesList}
      domains={catalog.domains}
      unis={catalog.unis}
      colleges={catalog.colleges}
      studentsForTargeting={students as any[]}
      currentUserId={currentUserId || undefined}
      onRefresh={refresh}
      onLogAction={async () => {}}
    />
  );
}

export function StaffNotificationsServicePanel({
  currentUserId,
  isActive,
}: {
  currentUserId: string | null;
  isActive: boolean;
}) {
  const { catalog, ready } = useStaffCatalog(isActive);
  const { students } = useModuleStudentsLight(supabase, isActive);
  const [notifications, setNotifications] = useState<any[]>([]);

  const refresh = useCallback(async () => {
    const { data } = await supabase.from("notifications").select("*").order("created_at", { ascending: false }).limit(100);
    setNotifications(data || []);
  }, []);

  useEffect(() => {
    if (isActive) void refresh();
  }, [isActive, refresh]);

  if (!ready) {
    return (
      <div className="py-16 text-center text-muted-foreground">
        <Loader2 className="size-6 animate-spin inline" />
      </div>
    );
  }

  return (
    <NotificationManagementPanel
      notifications={notifications}
      unis={catalog.unis}
      colleges={catalog.colleges}
      domains={catalog.domains}
      studentsForTargeting={students as any[]}
      currentUserId={currentUserId || undefined}
      onRefresh={refresh}
      isActive={isActive}
    />
  );
}

export function StaffEngineeringPanel({
  isActive,
  actions,
}: {
  isActive: boolean;
  actions?: {
    onViewDetails: (student: StudentDirectoryStudent) => void;
    onEditDetails: (student: StudentDirectoryStudent) => void;
    onResetPassword: (student: StudentDirectoryStudent) => void;
    onResendCredentials: (student: StudentDirectoryStudent) => void;
    onViewConsentLetter: (student: StudentDirectoryStudent) => void;
    onUploadConsentLetter: (student: StudentDirectoryStudent) => void;
    onViewLogbook: (student: StudentDirectoryStudent) => void;
    onDownloadAttendanceReport: (student: StudentDirectoryStudent) => void;
    onDownloadOfferLetter: (student: StudentDirectoryStudent) => void;
    onToggleBlock: (student: StudentDirectoryStudent) => void;
    onDelete: (student: StudentDirectoryStudent) => void;
  };
}) {
  const { catalog } = useStaffCatalog(isActive);
  const [viewOpen, setViewOpen] = useState(false);
  const [viewUser, setViewUser] = useState<Record<string, unknown> | null>(null);

  const openStudentViewDialog = async (student: Record<string, unknown>) => {
    if (actions?.onViewDetails) {
      actions.onViewDetails(student as StudentDirectoryStudent);
      return;
    }
    let row: Record<string, unknown> = { ...student };
    const id = String(row.id || "");
    if (id && !id.startsWith("reg-draft-") && !(row as { _isPreview?: boolean })._isPreview) {
      try {
        const { data } = await supabase.from("students").select("*").eq("id", id).maybeSingle();
        if (data) row = data as Record<string, unknown>;
      } catch {
        /* use partial row */
      }
    }
    const enriched = enrichStudentProfileForDisplay(row) || row;
    const meta =
      studentMetadataOf(enriched) ||
      parseJsonField(row.metadata) ||
      parseJsonField((row as { payload?: unknown }).payload);
    setViewUser({ ...enriched, metadata: meta });
    setViewOpen(true);
  };

  const stub = async () => {
    toast.message("Open the Students service for full student actions");
  };
  return (
    <>
      <EngineeringDirectoryPanel
        isActive={isActive}
        unis={catalog.unis}
        colleges={catalog.colleges}
        domains={catalog.domains}
        actions={
          actions || {
            onViewDetails: (s) => {
              void openStudentViewDialog(s as Record<string, unknown>);
            },
            onEditDetails: stub,
            onResetPassword: stub,
            onResendCredentials: stub,
            onViewConsentLetter: stub,
            onUploadConsentLetter: stub,
            onViewLogbook: stub,
            onDownloadAttendanceReport: stub,
            onDownloadOfferLetter: stub,
            onToggleBlock: stub,
            onDelete: stub,
          }
        }
      />
      <StudentProfileViewDialog
        open={viewOpen}
        onOpenChange={setViewOpen}
        selectedUser={viewUser}
      />
    </>
  );
}

export function StaffInstitutionsPanel({ isActive }: { isActive: boolean }) {
  return <InstitutionsManagementPanel isActive={isActive} />;
}

export function StaffCommsPanel({ isActive }: { isActive: boolean }) {
  return <CommsCenterPanel isActive={isActive} />;
}

export function StaffIdCardsPanel({ isActive }: { isActive: boolean }) {
  if (!isActive) return null;
  return <IdCardManagementPanel />;
}

export function StaffUploadsPanel({
  currentUserId,
  isActive,
}: {
  currentUserId: string | null;
  isActive: boolean;
}) {
  const { catalog, ready } = useStaffCatalog(isActive);
  const { students } = useModuleStudentsLight(supabase, isActive);

  if (!ready) {
    return (
      <div className="py-16 text-center text-muted-foreground">
        <Loader2 className="size-6 animate-spin inline" />
      </div>
    );
  }

  return (
    <LearningMaterialsPanel
      unis={catalog.unis}
      colleges={catalog.colleges}
      domains={catalog.domains}
      currentUserId={currentUserId || undefined}
      isActive={isActive}
      studentsForTargeting={students as any[]}
    />
  );
}

export function StaffFeesPanel({ isActive }: { isActive: boolean }) {
  if (!isActive) return null;
  return <FeesManagementPanel onLogAction={async () => {}} />;
}

export function StaffCoursesPanel({ isActive }: { isActive: boolean }) {
  if (!isActive) return null;
  return <CourseManagementPanel onLogAction={async () => {}} />;
}

export function StaffReferralsPanel({ isActive }: { isActive: boolean }) {
  if (!isActive) return null;
  return <ReferralsPanel />;
}

export function StaffCollegeRostersPanel({ isActive }: { isActive: boolean }) {
  if (!isActive) return null;
  return <CollegeRostersPanel />;
}

export function StaffEmployeeAttendanceStandalonePanel({
  currentUserId,
  isActive,
}: {
  currentUserId: string | null;
  isActive: boolean;
}) {
  const [employees, setEmployees] = useState<
    { id: string; email: string; full_name: string | null }[]
  >([]);

  useEffect(() => {
    if (!isActive) return;
    (async () => {
      try {
        const { data } = await supabase
          .from("admin_staff")
          .select("id,email,full_name")
          .order("full_name");
        setEmployees((data || []) as typeof employees);
      } catch {
        /* ignore */
      }
    })();
  }, [isActive]);

  return (
    <StaffAttendanceAdminPanel
      employees={employees}
      currentUserId={currentUserId}
      isActive={isActive}
    />
  );
}

export function StaffManagementServicePanel({
  currentUserId,
  isActive,
}: {
  currentUserId: string | null;
  isActive: boolean;
}) {
  const [staff, setStaff] = useState<AdminStaffProfile[]>([]);

  const refresh = useCallback(async () => {
    const { data } = await supabase
      .from("admin_staff")
      .select("*")
      .order("created_at", { ascending: false });
    setStaff((data || []) as AdminStaffProfile[]);
  }, []);

  useEffect(() => {
    if (!isActive) return;
    void refresh();
  }, [isActive, refresh]);

  const handleDeleteStaff = async (staffId: string) => {
    if (!confirm("Remove this staff member?")) return;
    const { error } = await supabase.from("admin_staff").delete().eq("id", staffId);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Staff removed");
    await refresh();
  };

  if (!isActive) return null;

  return (
    <StaffManagementPanel
      staff={staff}
      currentUserId={currentUserId}
      isActive={isActive}
      onRefresh={refresh}
      onDeleteStaff={handleDeleteStaff}
    />
  );
}

export function StaffSettingsPanel({
  isActive,
  currentUserId,
}: {
  isActive: boolean;
  currentUserId: string | null;
}) {
  if (!isActive) return null;
  return (
    <DocumentCustomizationPanel
      client={supabase}
      currentUserId={currentUserId}
      isActive={isActive}
    />
  );
}

export function StaffStudentDataUploadPanel({ isActive }: { isActive: boolean }) {
  if (!isActive) return null;
  return <StudentDataUploadPanel client={supabase} />;
}

export function StaffProjectReportPanel({
  currentUserId,
  isActive,
}: {
  currentUserId: string | null;
  isActive: boolean;
}) {
  const { catalog, ready } = useStaffCatalog(isActive);
  if (!isActive) return null;
  if (!ready) {
    return (
      <div className="py-16 text-center text-muted-foreground">
        <Loader2 className="size-6 animate-spin inline" />
      </div>
    );
  }
  return (
    <AutoGenerateProjectReportPanel
      unis={catalog.unis}
      domains={catalog.domains}
      currentUserId={currentUserId}
      isActive={isActive}
    />
  );
}

export function StaffCheckPaymentPanel({ isActive }: { isActive: boolean }) {
  if (!isActive) return null;
  return <CheckPaymentPanel />;
}

export function StaffUnpaidStudentsPanel({ isActive }: { isActive: boolean }) {
  if (!isActive) return null;
  return <UnpaidStudentsDirectoryPanel client={supabase} />;
}

export function StaffLeadAssignmentPanel({ isActive }: { isActive: boolean }) {
  if (!isActive) return null;
  return <LeadAssignmentPanel client={supabase} isActive={isActive} />;
}

export function StaffPartnerApplicationsPanel({ isActive }: { isActive: boolean }) {
  if (!isActive) return null;
  return <PartnerApplicationsPanel />;
}

export function StaffGalleryPanel({
  currentUserId,
  isActive,
}: {
  currentUserId: string | null;
  isActive: boolean;
}) {
  if (!isActive) return null;
  return <GalleryManagementPanel client={supabase} currentUserId={currentUserId} />;
}

export function StaffBlogPanel({
  currentUserId,
  isActive,
}: {
  currentUserId: string | null;
  isActive: boolean;
}) {
  if (!isActive) return null;
  return <BlogManagementPanel client={supabase} currentUserId={currentUserId} />;
}

export function StaffHomeCmsPanel({
  currentUserId,
  isActive,
}: {
  currentUserId: string | null;
  isActive: boolean;
}) {
  if (!isActive) return null;
  return <HomeCmsManagementPanel client={supabase} currentUserId={currentUserId} />;
}

export function StaffConsentFormPanel({
  currentUserId,
  isActive,
}: {
  currentUserId: string | null;
  isActive: boolean;
}) {
  if (!isActive) return null;
  return <ConsultLetterManagementPanel client={supabase} currentUserId={currentUserId} />;
}

export function StaffPopupsPanel({
  currentUserId,
  isActive,
}: {
  currentUserId: string | null;
  isActive: boolean;
}) {
  if (!isActive) return null;
  return <PopupManagementPanel client={supabase} currentUserId={currentUserId} />;
}

export function StaffContactDetailsPanel({ isActive }: { isActive: boolean }) {
  if (!isActive) return null;
  return <ContactDetailsManagementPanel client={supabase} />;
}

export function StaffWhatsAppLinksPanel({ isActive }: { isActive: boolean }) {
  if (!isActive) return null;
  return <WhatsAppLinksManagementPanel client={supabase} />;
}

export function StaffServiceKeysPanel({
  currentUserId,
  isActive,
}: {
  currentUserId: string | null;
  isActive: boolean;
}) {
  if (!isActive) return null;
  return <StudentServiceKeysPanel client={supabase} currentUserId={currentUserId} isActive={isActive} />;
}

export function StaffCourseLeadsPanel({ isActive }: { isActive: boolean }) {
  if (!isActive) return null;
  return <CourseManagementPanel onLogAction={async () => {}} />;
}

export function StaffEngineeringManagementPanel({ isActive }: { isActive: boolean }) {
  if (!isActive) return null;
  return <EngineeringManagement embedded backTo="/staff-dashboard" />;
}

export function StaffNonEngineeringManagementPanel({ isActive }: { isActive: boolean }) {
  if (!isActive) return null;
  return <NonEngineeringManagement embedded backTo="/staff-dashboard" />;
}

/** Staff attendance uses the same Admin StudentAttendancePanel UI + student light list. */
export function StaffAttendanceTrackingPanel({
  currentUserId,
  isActive,
}: {
  currentUserId: string | null;
  isActive: boolean;
}) {
  return <StudentAttendancePanel currentUserId={currentUserId} isActive={isActive} />;
}

export function StaffCybercafePanel({ isActive }: { isActive: boolean }) {
  return <CybercafeManagementPanel isActive={isActive} />;
}

