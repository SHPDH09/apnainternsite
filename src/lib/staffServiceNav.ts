import type { LucideIcon } from "lucide-react";
import {
  Award,
  Bell,
  BookOpen,
  Briefcase,
  CheckCircle2,
  CheckSquare,
  ClipboardList,
  Cog,
  CreditCard,
  FileSpreadsheet,
  FileText,
  GraduationCap,
  Image,
  IndianRupee,
  KeyRound,
  Mail,
  Phone,
  Search,
  Settings,
  Share2,
  Store,
  Target,
  UploadCloud,
  UserPlus,
  Users,
  Video,
  Wrench,
} from "lucide-react";
import type { StaffPermissionKey } from "@/lib/staffPermissions";

export type StaffServiceNavItem = {
  id: StaffPermissionKey;
  label: string;
  tab: string;
  icon: LucideIcon;
  color: string;
};

/** Sidebar entries for granted staff services — mirrors admin modules. */
export const STAFF_SERVICE_NAV: StaffServiceNavItem[] = [
  { id: "can_manage_students", label: "Students", icon: Users, color: "text-blue-500", tab: "students" },
  {
    id: "can_manage_student_data_upload",
    label: "Student Data Upload",
    icon: FileSpreadsheet,
    color: "text-blue-600",
    tab: "student-data-upload",
  },
  {
    id: "can_manage_engineering",
    label: "Engineering Directory",
    icon: Wrench,
    color: "text-teal-600",
    tab: "engineering",
  },
  {
    id: "can_manage_engineering",
    label: "Eng. Management",
    icon: Cog,
    color: "text-teal-700",
    tab: "engineering-management",
  },
  {
    id: "can_manage_non_engineering",
    label: "Non-Tech Management",
    icon: BookOpen,
    color: "text-sky-600",
    tab: "non-engineering-management",
  },
  {
    id: "can_manage_attendance",
    label: "Attendance Tracking",
    icon: CheckSquare,
    color: "text-violet-600",
    tab: "attendance",
  },
  {
    id: "can_manage_employee_attendance",
    label: "Employee Attendance",
    icon: CheckCircle2,
    color: "text-rose-600",
    tab: "employee-attendance",
  },
  { id: "can_manage_staff", label: "Staff Management", icon: Users, color: "text-indigo-600", tab: "staff-management" },
  {
    id: "can_manage_certificates",
    label: "Certificates",
    icon: Award,
    color: "text-amber-600",
    tab: "certificates",
  },
  { id: "can_manage_id_cards", label: "ID Cards", icon: KeyRound, color: "text-yellow-600", tab: "id-cards" },
  {
    id: "can_manage_uploads",
    label: "Learning Materials",
    icon: UploadCloud,
    color: "text-fuchsia-600",
    tab: "uploads",
  },
  { id: "can_manage_classes", label: "Live Classes", icon: Video, color: "text-red-500", tab: "classes" },
  {
    id: "can_manage_courses",
    label: "Course Management",
    icon: BookOpen,
    color: "text-indigo-600",
    tab: "courses",
  },
  {
    id: "can_manage_course_leads",
    label: "Course Leads",
    icon: Target,
    color: "text-indigo-500",
    tab: "course-leads",
  },
  {
    id: "can_manage_project_reports",
    label: "Auto Generate Report",
    icon: FileText,
    color: "text-purple-600",
    tab: "project-report-generate",
  },
  {
    id: "can_manage_assignments",
    label: "Assignments",
    icon: CheckSquare,
    color: "text-cyan-600",
    tab: "assignments",
  },
  { id: "can_view_payments", label: "Payments", icon: CreditCard, color: "text-emerald-500", tab: "payments" },
  { id: "can_check_payments", label: "Check Payment", icon: Search, color: "text-emerald-600", tab: "check-payment" },
  {
    id: "can_manage_unpaid_students",
    label: "Unpaid Students",
    icon: IndianRupee,
    color: "text-emerald-700",
    tab: "unpaid-students",
  },
  { id: "can_manage_leads", label: "Assigned Leads", icon: Target, color: "text-orange-500", tab: "leads" },
  {
    id: "can_assign_leads",
    label: "Lead Assignment",
    icon: ClipboardList,
    color: "text-orange-600",
    tab: "lead-assignment",
  },
  { id: "can_manage_fees", label: "Fees Management", icon: Store, color: "text-green-600", tab: "fees" },
  {
    id: "can_manage_notifications",
    label: "Notifications",
    icon: Bell,
    color: "text-purple-500",
    tab: "notifications",
  },
  {
    id: "can_manage_communications",
    label: "Communications",
    icon: Mail,
    color: "text-indigo-500",
    tab: "comms",
  },
  {
    id: "can_manage_partner_applications",
    label: "Partner Applications",
    icon: ClipboardList,
    color: "text-violet-500",
    tab: "partner-applications",
  },
  { id: "can_manage_cybercafe", label: "Cyber Cafes", icon: Store, color: "text-orange-600", tab: "cybercafe" },
  { id: "can_manage_referrals", label: "Referrals", icon: Share2, color: "text-pink-600", tab: "referrals" },
  {
    id: "can_manage_college_rosters",
    label: "College Rosters",
    icon: Briefcase,
    color: "text-cyan-600",
    tab: "college-rosters",
  },
  {
    id: "can_manage_institutions",
    label: "Academic Partners",
    icon: GraduationCap,
    color: "text-slate-600",
    tab: "institutions",
  },
  { id: "can_manage_gallery", label: "Gallery", icon: Image, color: "text-pink-500", tab: "gallery" },
  { id: "can_manage_blog", label: "Blog & Vlog", icon: BookOpen, color: "text-rose-500", tab: "blog" },
  {
    id: "can_manage_home_cms",
    label: "Home Page Content",
    icon: Settings,
    color: "text-sky-500",
    tab: "home-cms",
  },
  {
    id: "can_manage_consent_forms",
    label: "Consent Form",
    icon: FileText,
    color: "text-amber-500",
    tab: "consult-letter",
  },
  { id: "can_manage_popups", label: "Popups", icon: Bell, color: "text-yellow-500", tab: "popups" },
  {
    id: "can_manage_contact_details",
    label: "Contact Details",
    icon: Phone,
    color: "text-green-500",
    tab: "contact-details",
  },
  {
    id: "can_manage_whatsapp_links",
    label: "WhatsApp Links",
    icon: Share2,
    color: "text-emerald-500",
    tab: "whatsapp-links",
  },
  {
    id: "can_manage_service_keys",
    label: "Service Keys",
    icon: KeyRound,
    color: "text-slate-600",
    tab: "keys",
  },
  { id: "can_manage_settings", label: "Site Settings", icon: Settings, color: "text-slate-700", tab: "settings" },
];

export function staffTabPermission(tab: string): StaffPermissionKey | null {
  if (tab === "add-registration") return "can_manage_students";
  const match = STAFF_SERVICE_NAV.find((s) => s.tab === tab);
  return match?.id ?? null;
}

export function staffTabLabel(tab: string): string {
  if (tab === "add-registration") return "Add Registration";
  const match = STAFF_SERVICE_NAV.find((s) => s.tab === tab);
  return match?.label ?? "Staff Portal";
}
