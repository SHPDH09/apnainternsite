import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Bell,
  BookOpen,
  CheckSquare,
  ChevronDown,
  ClipboardList,
  Cog,
  DollarSign,
  FileSpreadsheet,
  FileText,
  GraduationCap,
  Image,
  IdCard,
  IndianRupee,
  LayoutDashboard,
  Mail,
  Phone,
  Search,
  Settings,
  Share2,
  Store,
  UploadCloud,
  UserPlus,
  Users,
  Wrench,
  Award,
} from "lucide-react";
import { TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { adminNavButtonClass, adminNavItemClass } from "@/components/admin/ui/adminStyles";

const STORAGE_KEY = "apnaintern_admin_nav_groups";

type NavTabItem = {
  kind: "tab";
  value: string;
  label: string;
  icon: LucideIcon;
  enabled?: boolean;
};

type NavActionItem = {
  kind: "action";
  label: string;
  icon: LucideIcon;
  onClick: () => void;
  enabled?: boolean;
};

type NavItem = NavTabItem | NavActionItem;

type NavGroup = {
  id: string;
  label: string;
  icon: LucideIcon;
  accent: string;
  items: NavItem[];
};

type AdminSidebarNavProps = {
  activeTab: string;
  isServiceEnabled: (key: string) => boolean;
  onNavigateEngineering: () => void;
  onNavigateNonEngineering: () => void;
};

function readStoredOpenGroups(): Record<string, boolean> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.sessionStorage.getItem(STORAGE_KEY) || "{}") as Record<string, boolean>;
  } catch {
    return {};
  }
}

function writeStoredOpenGroups(open: Record<string, boolean>) {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(open));
}

function NavTabTrigger({ value, label, icon: Icon, nested }: NavTabItem & { nested?: boolean }) {
  return (
    <TabsTrigger value={value} className={cn(adminNavItemClass, nested && "ml-2 py-2 pl-9")}>
      <Icon className="size-4 shrink-0 opacity-70 group-data-[state=active]:opacity-100 group-data-[state=active]:text-[#5AA3E6]" />
      <span className="truncate">{label}</span>
    </TabsTrigger>
  );
}

function NavActionButton({
  label,
  icon: Icon,
  onClick,
  nested,
}: NavActionItem & { nested?: boolean }) {
  return (
    <button type="button" onClick={onClick} className={cn(adminNavButtonClass, nested && "ml-2 py-2 pl-9")}>
      <Icon className="size-4 shrink-0 opacity-70" />
      <span className="truncate">{label}</span>
    </button>
  );
}

function NavGroupSection({
  group,
  isOpen,
  isActiveInGroup,
  onToggle,
  children,
}: {
  group: NavGroup;
  isOpen: boolean;
  isActiveInGroup: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  const Icon = group.icon;

  return (
    <div className="mb-1">
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          "flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left transition-all duration-200",
          "hover:bg-white/[0.06]",
          isOpen || isActiveInGroup ? "bg-white/[0.04]" : "",
          isActiveInGroup && "ring-1 ring-[#5AA3E6]/25"
        )}
      >
        <div
          className={cn(
            "flex size-8 shrink-0 items-center justify-center rounded-lg transition-colors",
            isActiveInGroup ? "bg-[#5AA3E6]/20 text-[#5AA3E6]" : "bg-white/[0.06] text-slate-400"
          )}
        >
          <Icon className="size-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p
            className={cn(
              "truncate text-[13px] font-semibold",
              isActiveInGroup ? "text-white" : "text-slate-300"
            )}
          >
            {group.label}
          </p>
          <p className="truncate text-[10px] text-slate-500">
            {group.items.filter((i) => i.enabled !== false).length} modules
          </p>
        </div>
        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-slate-500 transition-transform duration-200",
            isOpen ? "rotate-180" : ""
          )}
        />
      </button>

      <div
        className={cn(
          "grid transition-all duration-200 ease-out",
          isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        )}
      >
        <div className="overflow-hidden">
          <div className="space-y-0.5 py-1 pl-1">{children}</div>
        </div>
      </div>
    </div>
  );
}

export function buildAdminNavGroups(
  isServiceEnabled: (key: string) => boolean,
  onNavigateEngineering: () => void,
  onNavigateNonEngineering: () => void
): NavGroup[] {
  const groups: NavGroup[] = [
    {
      id: "overview",
      label: "Overview",
      icon: LayoutDashboard,
      accent: "#5AA3E6",
      items: [
        { kind: "tab", value: "dashboard", label: "Dashboard", icon: LayoutDashboard },
        { kind: "tab", value: "popups", label: "Popup Msg Manage", icon: Bell },
      ],
    },
  ];

  if (isServiceEnabled("students")) {
    groups.push({
      id: "students",
      label: "Students & Directory",
      icon: Users,
      accent: "#5AA3E6",
      items: [
        { kind: "tab", value: "students", label: "Directory", icon: Users },
        { kind: "tab", value: "engineering-directory", label: "Engineering", icon: Wrench },
        { kind: "action", label: "Eng. Management", icon: Cog, onClick: onNavigateEngineering },
        {
          kind: "action",
          label: "Non-Tech Management",
          icon: BookOpen,
          onClick: onNavigateNonEngineering,
        },
        { kind: "tab", value: "add-registration", label: "Add Registration", icon: UserPlus },
        {
          kind: "tab",
          value: "student-data-upload",
          label: "Student Data Upload",
          icon: FileSpreadsheet,
        },
      ],
    });
  }

  const academicItems: NavItem[] = [
    { kind: "tab", value: "attendance", label: "Attendance", icon: CheckSquare },
    { kind: "tab", value: "staff-management", label: "Staff Management", icon: Users },
  ];
  if (isServiceEnabled("bulk")) {
    academicItems.push(
      { kind: "tab", value: "bulk", label: "Certificates", icon: Award },
      { kind: "tab", value: "id-cards", label: "ID Cards", icon: IdCard }
    );
  }
  if (isServiceEnabled("classes")) {
    academicItems.push(
      { kind: "tab", value: "uploads", label: "Uploads", icon: UploadCloud },
      { kind: "tab", value: "classes", label: "Live Classes", icon: BookOpen }
    );
  }
  academicItems.push(
    { kind: "tab", value: "course-management", label: "Course Management", icon: GraduationCap }
  );
  if (isServiceEnabled("assignments")) {
    academicItems.push({
      kind: "tab",
      value: "assignments",
      label: "Assignments",
      icon: FileText,
    });
  }

  groups.push({
    id: "academics",
    label: "Academics & LMS",
    icon: GraduationCap,
    accent: "#8B5CF6",
    items: academicItems,
  });

  const revenueItems: NavItem[] = [];
  if (isServiceEnabled("payments")) {
    revenueItems.push(
      { kind: "tab", value: "payments", label: "Payments", icon: DollarSign },
      { kind: "tab", value: "check-payment", label: "Check Payment", icon: Search },
      { kind: "tab", value: "unpaid-students", label: "Unpaid Students", icon: IndianRupee }
    );
  }
  revenueItems.push({ kind: "tab", value: "fees-management", label: "Fees Management", icon: IndianRupee });
  if (isServiceEnabled("leads")) {
    revenueItems.push(
      { kind: "tab", value: "leads", label: "Leads Hub", icon: UserPlus },
      { kind: "tab", value: "lead-assignment", label: "Lead Assignment", icon: ClipboardList }
    );
  }
  if (revenueItems.length > 0) {
    groups.push({
      id: "revenue",
      label: "Revenue & Leads",
      icon: DollarSign,
      accent: "#10B981",
      items: revenueItems,
    });
  }

  const commItems: NavItem[] = [];
  if (isServiceEnabled("notifications")) {
    commItems.push({ kind: "tab", value: "notifications", label: "Notifications", icon: Bell });
  }
  if (isServiceEnabled("comms")) {
    commItems.push({ kind: "tab", value: "comms", label: "Comms Center", icon: Mail });
  }
  if (commItems.length > 0) {
    groups.push({
      id: "communications",
      label: "Communications",
      icon: Mail,
      accent: "#F7941D",
      items: commItems,
    });
  }

  groups.push({
    id: "partners",
    label: "Partners & Rosters",
    icon: Store,
    accent: "#6366F1",
    items: [
      { kind: "tab", value: "cybercafe", label: "Cyber Cafes", icon: Store },
      { kind: "tab", value: "referrals", label: "Referrals", icon: Share2 },
      { kind: "tab", value: "college-rosters", label: "College Rosters", icon: FileSpreadsheet },
    ],
  });

  groups.push({
    id: "website",
    label: "Website & CMS",
    icon: Image,
    accent: "#EC4899",
    items: [
      { kind: "tab", value: "gallery", label: "Gallery", icon: Image },
      { kind: "tab", value: "home-cms", label: "Home Page Content", icon: LayoutDashboard },
      { kind: "tab", value: "consult-letter", label: "Consent Form", icon: FileText },
      { kind: "tab", value: "popups", label: "Popups", icon: Bell },
      { kind: "tab", value: "contact-details", label: "Contact Details", icon: Phone },
      { kind: "tab", value: "whatsapp-links", label: "WhatsApp Links", icon: Share2 },
    ],
  });

  groups.push({
    id: "system",
    label: "System",
    icon: Settings,
    accent: "#64748B",
    items: [{ kind: "tab", value: "settings", label: "Settings", icon: Settings }],
  });

  return groups;
}

function groupContainsTab(group: NavGroup, tab: string): boolean {
  return group.items.some((item) => item.kind === "tab" && item.value === tab);
}

export function AdminSidebarNav({
  activeTab,
  isServiceEnabled,
  onNavigateEngineering,
  onNavigateNonEngineering,
}: AdminSidebarNavProps) {
  const groups = useMemo(
    () => buildAdminNavGroups(isServiceEnabled, onNavigateEngineering, onNavigateNonEngineering),
    [isServiceEnabled, onNavigateEngineering, onNavigateNonEngineering]
  );

  const activeGroupId = useMemo(
    () => groups.find((g) => groupContainsTab(g, activeTab))?.id ?? "overview",
    [groups, activeTab]
  );

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    const stored = readStoredOpenGroups();
    return { overview: true, ...stored };
  });

  useEffect(() => {
    setOpenGroups((prev) => {
      const next = { ...prev, [activeGroupId]: true };
      writeStoredOpenGroups(next);
      return next;
    });
  }, [activeGroupId]);

  const toggleGroup = useCallback((id: string) => {
    setOpenGroups((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      writeStoredOpenGroups(next);
      return next;
    });
  }, []);

  return (
    <>
      {groups.map((group) => {
        const visibleItems = group.items.filter((item) => item.enabled !== false);
        if (visibleItems.length === 0) return null;

        const isOpen = openGroups[group.id] ?? group.id === "overview";
        const isActiveInGroup = groupContainsTab(group, activeTab);

        return (
          <NavGroupSection
            key={group.id}
            group={group}
            isOpen={isOpen}
            isActiveInGroup={isActiveInGroup}
            onToggle={() => toggleGroup(group.id)}
          >
            {visibleItems.map((item) =>
              item.kind === "tab" ? (
                <NavTabTrigger key={`${group.id}-${item.value}`} {...item} nested />
              ) : (
                <NavActionButton key={`${group.id}-${item.label}`} {...item} nested />
              )
            )}
          </NavGroupSection>
        );
      })}
    </>
  );
}

/** Grouped entries for ⌘K command palette */
export function buildAdminNavSearchGroups(
  isServiceEnabled: (key: string) => boolean,
  onNavigateEngineering: () => void,
  onNavigateNonEngineering: () => void
) {
  return buildAdminNavGroups(isServiceEnabled, onNavigateEngineering, onNavigateNonEngineering).map(
    (g) => ({
      heading: g.label,
      entries: g.items
        .filter((i) => i.enabled !== false)
        .map((i) =>
          i.kind === "tab"
            ? { value: i.value, label: i.label }
            : { value: `action:${i.label}`, label: i.label, action: i.onClick }
        ),
    })
  );
}
