import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Bell,
  BookOpen,
  CheckSquare,
  ChevronLeft,
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
  LogOut,
  Mail,
  Menu,
  PanelLeft,
  Phone,
  Search,
  Settings,
  Share2,
  Store,
  UploadCloud,
  User,
  UserPlus,
  Users,
  Wrench,
  Award,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { BrandLogo } from "@/components/brand/BrandLogo";
import {
  adminNavButtonClass,
  adminNavItemClass,
  adminNavSectionClass,
  adminSurface,
} from "@/components/admin/ui/adminStyles";

export const ADMIN_TAB_LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  students: "Students Directory",
  "engineering-directory": "Engineering Directory",
  attendance: "Attendance",
  "employee-attendance": "Employee Attendance",
  "staff-management": "Staff Management",
  bulk: "Certificates",
  "id-cards": "ID Cards",
  uploads: "Uploads",
  classes: "Live Classes",
  payments: "Payments",
  "check-payment": "Check Payment",
  "unpaid-students": "Unpaid Students",
  leads: "Leads",
  "lead-assignment": "Lead Assignment",
  notifications: "Notifications",
  assignments: "Assignments",
  comms: "Communications",
  cybercafe: "Cyber Cafes",
  referrals: "Referrals",
  "college-rosters": "College Rosters",
  "fees-management": "Fees Management",
  "course-management": "Course Management",
  "add-registration": "Add Registration",
  "student-data-upload": "Student Data Upload",
  gallery: "Gallery",
  "home-cms": "Home Page Content",
  "consult-letter": "Consent Form",
  popups: "Popup Messages",
  "contact-details": "Contact Details",
  "whatsapp-links": "WhatsApp Links",
  settings: "Settings",
};

const NAV_SEARCH_ENTRIES = Object.entries(ADMIN_TAB_LABELS).map(([value, label]) => ({
  value,
  label,
}));

type AdminNavProps = {
  isServiceEnabled: (key: string) => boolean;
  onNavigateEngineering: () => void;
  onNavigateNonEngineering: () => void;
};

function AdminNavItems({
  isServiceEnabled,
  onNavigateEngineering,
  onNavigateNonEngineering,
}: AdminNavProps) {
  return (
    <>
      <div className={adminNavSectionClass}>Overview</div>
      <TabsTrigger value="dashboard" className={adminNavItemClass}>
        <LayoutDashboard className="size-4 shrink-0 opacity-70 group-data-[state=active]:opacity-100" />
        Dashboard
      </TabsTrigger>
      <TabsTrigger value="popups" className={adminNavItemClass}>
        <Bell className="size-4 shrink-0 opacity-70 group-data-[state=active]:opacity-100" />
        Popup Msg Manage
      </TabsTrigger>

      {isServiceEnabled("students") && (
        <>
          <div className={adminNavSectionClass}>Students</div>
          <TabsTrigger value="students" className={adminNavItemClass}>
            <Users className="size-4 shrink-0 opacity-70 group-data-[state=active]:opacity-100" />
            Directory
          </TabsTrigger>
          <TabsTrigger value="engineering-directory" className={adminNavItemClass}>
            <Wrench className="size-4 shrink-0 opacity-70 group-data-[state=active]:opacity-100" />
            Engineering
          </TabsTrigger>
          <button type="button" onClick={onNavigateEngineering} className={adminNavButtonClass}>
            <Cog className="size-4 shrink-0 opacity-70" />
            Eng. Management
          </button>
          <button type="button" onClick={onNavigateNonEngineering} className={adminNavButtonClass}>
            <BookOpen className="size-4 shrink-0 opacity-70" />
            Non-Tech Management
          </button>
          <TabsTrigger value="add-registration" className={adminNavItemClass}>
            <UserPlus className="size-4 shrink-0 opacity-70 group-data-[state=active]:opacity-100" />
            Add Registration
          </TabsTrigger>
          <TabsTrigger value="student-data-upload" className={adminNavItemClass}>
            <FileSpreadsheet className="size-4 shrink-0 opacity-70 group-data-[state=active]:opacity-100" />
            Student Data Upload
          </TabsTrigger>
        </>
      )}

      <div className={adminNavSectionClass}>Academics</div>
      <TabsTrigger value="attendance" className={adminNavItemClass}>
        <CheckSquare className="size-4 shrink-0 opacity-70 group-data-[state=active]:opacity-100" />
        Attendance
      </TabsTrigger>
      <TabsTrigger value="staff-management" className={adminNavItemClass}>
        <Users className="size-4 shrink-0 opacity-70 group-data-[state=active]:opacity-100" />
        Staff Management
      </TabsTrigger>
      {isServiceEnabled("bulk") && (
        <TabsTrigger value="bulk" className={adminNavItemClass}>
          <Award className="size-4 shrink-0 opacity-70 group-data-[state=active]:opacity-100" />
          Certificates
        </TabsTrigger>
      )}
      {isServiceEnabled("bulk") && (
        <TabsTrigger value="id-cards" className={adminNavItemClass}>
          <IdCard className="size-4 shrink-0 opacity-70 group-data-[state=active]:opacity-100" />
          ID Cards
        </TabsTrigger>
      )}
      {isServiceEnabled("classes") && (
        <>
          <TabsTrigger value="uploads" className={adminNavItemClass}>
            <UploadCloud className="size-4 shrink-0 opacity-70 group-data-[state=active]:opacity-100" />
            Uploads
          </TabsTrigger>
          <TabsTrigger value="classes" className={adminNavItemClass}>
            <BookOpen className="size-4 shrink-0 opacity-70 group-data-[state=active]:opacity-100" />
            Live Classes
          </TabsTrigger>
        </>
      )}
      <TabsTrigger value="course-management" className={adminNavItemClass}>
        <GraduationCap className="size-4 shrink-0 opacity-70 group-data-[state=active]:opacity-100" />
        Course Management
      </TabsTrigger>

      {(isServiceEnabled("payments") || isServiceEnabled("leads")) && (
        <div className={adminNavSectionClass}>Revenue</div>
      )}
      {isServiceEnabled("payments") && (
        <>
          <TabsTrigger value="payments" className={adminNavItemClass}>
            <DollarSign className="size-4 shrink-0 opacity-70 group-data-[state=active]:opacity-100" />
            Payments
          </TabsTrigger>
          <TabsTrigger value="check-payment" className={adminNavItemClass}>
            <Search className="size-4 shrink-0 opacity-70 group-data-[state=active]:opacity-100" />
            Check Payment
          </TabsTrigger>
          <TabsTrigger value="unpaid-students" className={adminNavItemClass}>
            <IndianRupee className="size-4 shrink-0 opacity-70 group-data-[state=active]:opacity-100" />
            Unpaid Students
          </TabsTrigger>
        </>
      )}
      {isServiceEnabled("leads") && (
        <TabsTrigger value="leads" className={adminNavItemClass}>
          <UserPlus className="size-4 shrink-0 opacity-70 group-data-[state=active]:opacity-100" />
          Leads
        </TabsTrigger>
      )}
      {isServiceEnabled("leads") && (
        <TabsTrigger value="lead-assignment" className={adminNavItemClass}>
          <ClipboardList className="size-4 shrink-0 opacity-70 group-data-[state=active]:opacity-100" />
          Lead Assignment
        </TabsTrigger>
      )}
      <TabsTrigger value="fees-management" className={adminNavItemClass}>
        <IndianRupee className="size-4 shrink-0 opacity-70 group-data-[state=active]:opacity-100" />
        Fees
      </TabsTrigger>

      {(isServiceEnabled("notifications") ||
        isServiceEnabled("assignments") ||
        isServiceEnabled("comms")) && <div className={adminNavSectionClass}>Communications</div>}
      {isServiceEnabled("notifications") && (
        <TabsTrigger value="notifications" className={adminNavItemClass}>
          <Bell className="size-4 shrink-0 opacity-70 group-data-[state=active]:opacity-100" />
          Notifications
        </TabsTrigger>
      )}
      {isServiceEnabled("assignments") && (
        <TabsTrigger value="assignments" className={adminNavItemClass}>
          <FileText className="size-4 shrink-0 opacity-70 group-data-[state=active]:opacity-100" />
          Assignments
        </TabsTrigger>
      )}
      {isServiceEnabled("comms") && (
        <TabsTrigger value="comms" className={adminNavItemClass}>
          <Mail className="size-4 shrink-0 opacity-70 group-data-[state=active]:opacity-100" />
          Comms Center
        </TabsTrigger>
      )}

      <div className={adminNavSectionClass}>Partners</div>
      <TabsTrigger value="cybercafe" className={adminNavItemClass}>
        <Store className="size-4 shrink-0 opacity-70 group-data-[state=active]:opacity-100" />
        Cyber Cafes
      </TabsTrigger>
      <TabsTrigger value="referrals" className={adminNavItemClass}>
        <Share2 className="size-4 shrink-0 opacity-70 group-data-[state=active]:opacity-100" />
        Referrals
      </TabsTrigger>
      <TabsTrigger value="college-rosters" className={adminNavItemClass}>
        <FileSpreadsheet className="size-4 shrink-0 opacity-70 group-data-[state=active]:opacity-100" />
        Rosters
      </TabsTrigger>

      <div className={adminNavSectionClass}>Website</div>
      <TabsTrigger value="gallery" className={adminNavItemClass}>
        <Image className="size-4 shrink-0 opacity-70 group-data-[state=active]:opacity-100" />
        Gallery
      </TabsTrigger>
      <TabsTrigger value="home-cms" className={adminNavItemClass}>
        <LayoutDashboard className="size-4 shrink-0 opacity-70 group-data-[state=active]:opacity-100" />
        Home Content
      </TabsTrigger>
      <TabsTrigger value="consult-letter" className={adminNavItemClass}>
        <FileText className="size-4 shrink-0 opacity-70 group-data-[state=active]:opacity-100" />
        Consent Form
      </TabsTrigger>
      <TabsTrigger value="popups" className={adminNavItemClass}>
        <Bell className="size-4 shrink-0 opacity-70 group-data-[state=active]:opacity-100" />
        Popups
      </TabsTrigger>
      <TabsTrigger value="contact-details" className={adminNavItemClass}>
        <Phone className="size-4 shrink-0 opacity-70 group-data-[state=active]:opacity-100" />
        Contact Details
      </TabsTrigger>
      <TabsTrigger value="whatsapp-links" className={adminNavItemClass}>
        <Share2 className="size-4 shrink-0 opacity-70 group-data-[state=active]:opacity-100" />
        WhatsApp Links
      </TabsTrigger>

      <div className={adminNavSectionClass}>System</div>
      <TabsTrigger value="settings" className={adminNavItemClass}>
        <Settings className="size-4 shrink-0 opacity-70 group-data-[state=active]:opacity-100" />
        Settings
      </TabsTrigger>
    </>
  );
}

type AdminSidebarFooterProps = {
  onLogout: () => void;
  userEmail?: string;
};

function AdminSidebarFooter({ onLogout, userEmail }: AdminSidebarFooterProps) {
  const initials = useMemo(() => {
    if (!userEmail) return "AD";
    const local = userEmail.split("@")[0] || "admin";
    return local.slice(0, 2).toUpperCase();
  }, [userEmail]);

  return (
    <div className={cn("mt-auto shrink-0 border-t p-3", adminSurface)}>
      <div className="mb-2 flex items-center gap-2 rounded-lg bg-muted/50 px-2.5 py-2">
        <Avatar className="size-8">
          <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
            {initials}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-medium text-foreground">Administrator</p>
          <p className="truncate text-[11px] text-muted-foreground">{userEmail || "Signed in"}</p>
        </div>
      </div>
      <Button
        variant="ghost"
        size="sm"
        className="h-9 w-full justify-start gap-2 text-destructive hover:bg-destructive/10 hover:text-destructive"
        onClick={onLogout}
      >
        <LogOut className="size-4" />
        Sign out
      </Button>
    </div>
  );
}

type AdminSidebarProps = AdminNavProps &
  AdminSidebarFooterProps & {
    onCollapse: () => void;
    className?: string;
  };

export function AdminSidebar({
  isServiceEnabled,
  onNavigateEngineering,
  onNavigateNonEngineering,
  onCollapse,
  className,
  ...footer
}: AdminSidebarProps) {
  return (
    <aside
      className={cn(
        "admin-sidebar hidden lg:flex w-[16.5rem] shrink-0 flex-col border-r sticky top-0 h-screen",
        adminSurface,
        className
      )}
    >
      <div className="flex items-center justify-between gap-2 border-b px-4 py-3.5">
        <div className="flex min-w-0 items-center gap-2.5">
          <BrandLogo size="sm" />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">Admin</p>
            <p className="truncate text-[11px] text-muted-foreground">Apna Intern</p>
          </div>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8 shrink-0 text-muted-foreground"
          onClick={onCollapse}
          title="Collapse sidebar"
        >
          <ChevronLeft className="size-4" />
        </Button>
      </div>

      <TabsList className="flex h-auto min-h-0 flex-1 flex-col items-stretch justify-start gap-0.5 overflow-y-auto rounded-none border-0 bg-transparent p-2 shadow-none">
        <AdminNavItems
          isServiceEnabled={isServiceEnabled}
          onNavigateEngineering={onNavigateEngineering}
          onNavigateNonEngineering={onNavigateNonEngineering}
        />
      </TabsList>

      <AdminSidebarFooter {...footer} />
    </aside>
  );
}

type AdminMobileNavProps = AdminNavProps &
  AdminSidebarFooterProps & {
    open: boolean;
    onOpenChange: (open: boolean) => void;
  };

export function AdminMobileNav({
  open,
  onOpenChange,
  isServiceEnabled,
  onNavigateEngineering,
  onNavigateNonEngineering,
  ...footer
}: AdminMobileNavProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="flex w-[18rem] flex-col p-0 sm:max-w-[18rem]">
        <SheetHeader className="border-b px-4 py-3.5 text-left">
          <SheetTitle className="text-sm font-semibold">Navigation</SheetTitle>
        </SheetHeader>
        <TabsList className="flex h-auto min-h-0 flex-1 flex-col items-stretch justify-start gap-0.5 overflow-y-auto rounded-none border-0 bg-transparent p-2 shadow-none">
          <AdminNavItems
            isServiceEnabled={isServiceEnabled}
            onNavigateEngineering={() => {
              onNavigateEngineering();
              onOpenChange(false);
            }}
            onNavigateNonEngineering={() => {
              onNavigateNonEngineering();
              onOpenChange(false);
            }}
          />
        </TabsList>
        <AdminSidebarFooter {...footer} />
      </SheetContent>
    </Sheet>
  );
}

type AdminTopBarProps = {
  activeTab: string;
  showSidebar: boolean;
  onOpenMenu: () => void;
  onShowSidebar: () => void;
  onOpenPopups?: () => void;
  onNavigateTab?: (tab: string) => void;
  onOpenNotifications?: () => void;
  visitorCount: number;
  uniqueVisitorCount: number;
  notificationCount?: number;
  userEmail?: string;
  onLogout?: () => void;
  toolbar?: ReactNode;
};

function AdminNavSearch({
  open,
  onOpenChange,
  onSelect,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (tab: string) => void;
}) {
  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Search modules…" />
      <CommandList>
        <CommandEmpty>No module found.</CommandEmpty>
        <CommandGroup heading="Admin modules">
          {NAV_SEARCH_ENTRIES.map(({ value, label }) => (
            <CommandItem
              key={value}
              value={`${label} ${value}`}
              onSelect={() => {
                onSelect(value);
                onOpenChange(false);
              }}
            >
              {label}
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}

export function AdminTopBar({
  activeTab,
  showSidebar,
  onOpenMenu,
  onShowSidebar,
  onOpenPopups,
  onNavigateTab,
  onOpenNotifications,
  visitorCount,
  uniqueVisitorCount,
  notificationCount = 0,
  userEmail,
  onLogout,
  toolbar,
}: AdminTopBarProps) {
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    if (!onNavigateTab) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onNavigateTab]);

  const initials = useMemo(() => {
    if (!userEmail) return "AD";
    const local = userEmail.split("@")[0] || "admin";
    return local.slice(0, 2).toUpperCase();
  }, [userEmail]);

  const pageTitle = ADMIN_TAB_LABELS[activeTab] || "Admin";

  return (
    <>
      <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/80 md:px-6">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-9 shrink-0 lg:hidden"
            onClick={onOpenMenu}
            aria-label="Open menu"
          >
            <Menu className="size-4" />
          </Button>
          {!showSidebar && (
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="hidden size-9 lg:inline-flex"
              onClick={onShowSidebar}
              aria-label="Show sidebar"
            >
              <PanelLeft className="size-4" />
            </Button>
          )}

          <div className="min-w-0">
            <h1 className="truncate font-display text-base font-semibold tracking-tight text-foreground md:text-lg">
              {pageTitle}
            </h1>
          </div>
        </div>

        <div className="hidden max-w-sm flex-1 md:flex">
          <Button
            type="button"
            variant="outline"
            className="h-9 w-full justify-start gap-2 text-muted-foreground"
            onClick={() => setSearchOpen(true)}
          >
            <Search className="size-4 shrink-0" />
            <span className="truncate text-sm">Search modules…</span>
            <kbd className="pointer-events-none ml-auto hidden rounded border bg-muted px-1.5 py-0.5 text-[10px] font-medium lg:inline">
              ⌘K
            </kbd>
          </Button>
        </div>

        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-9 md:hidden"
            onClick={() => setSearchOpen(true)}
            aria-label="Search modules"
          >
            <Search className="size-4" />
          </Button>

          {onOpenPopups ? (
            <Button
              type="button"
              size="sm"
              variant={activeTab === "popups" ? "default" : "outline"}
              className="hidden h-9 gap-1.5 sm:inline-flex"
              onClick={onOpenPopups}
            >
              <Bell className="size-4" />
              <span className="hidden lg:inline">Popups</span>
            </Button>
          ) : null}

          <div className="hidden items-center gap-2 rounded-lg border bg-muted/30 px-2.5 py-1 sm:flex">
            <div className="text-center">
              <div className="text-[10px] font-medium text-muted-foreground">Views</div>
              <div className="text-sm font-semibold tabular-nums">{visitorCount.toLocaleString()}</div>
            </div>
            <div className="h-7 w-px bg-border" />
            <div className="text-center">
              <div className="text-[10px] font-medium text-muted-foreground">Visitors</div>
              <div className="text-sm font-semibold tabular-nums">
                {uniqueVisitorCount.toLocaleString()}
              </div>
            </div>
          </div>

          {onOpenNotifications ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="relative size-9"
              onClick={onOpenNotifications}
              aria-label="Notifications"
            >
              <Bell className="size-4" />
              {notificationCount > 0 ? (
                <Badge className="absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full p-0 text-[9px]">
                  {notificationCount > 9 ? "9+" : notificationCount}
                </Badge>
              ) : null}
            </Button>
          ) : null}

          {toolbar}

          {onLogout ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="size-9 rounded-full" aria-label="Account menu">
                  <Avatar className="size-8">
                    <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm font-medium">Administrator</span>
                    <span className="truncate text-xs text-muted-foreground">{userEmail}</span>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => onNavigateTab?.("settings")}>
                  <Settings className="mr-2 size-4" />
                  Settings
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onNavigateTab?.("dashboard")}>
                  <LayoutDashboard className="mr-2 size-4" />
                  Dashboard
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={onLogout}>
                  <LogOut className="mr-2 size-4" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <div className="flex size-9 items-center justify-center rounded-full bg-muted">
              <User className="size-4 text-muted-foreground" />
            </div>
          )}
        </div>
      </header>

      {onNavigateTab ? (
        <AdminNavSearch
          open={searchOpen}
          onOpenChange={setSearchOpen}
          onSelect={onNavigateTab}
        />
      ) : null}
    </>
  );
}
