import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Bell,
  ChevronLeft,
  LayoutDashboard,
  LogOut,
  Menu,
  PanelLeft,
  Search,
  Settings,
  User,
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
  AdminSidebarNav,
  buildAdminNavSearchGroups,
} from "@/components/admin/AdminSidebarNav";
import {
  adminSidebarClass,
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
  keys: "Keys",
};

type AdminNavProps = {
  activeTab: string;
  isServiceEnabled: (key: string) => boolean;
  onNavigateEngineering: () => void;
  onNavigateNonEngineering: () => void;
};

function AdminNavItems({
  activeTab,
  isServiceEnabled,
  onNavigateEngineering,
  onNavigateNonEngineering,
}: AdminNavProps) {
  return (
    <AdminSidebarNav
      activeTab={activeTab}
      isServiceEnabled={isServiceEnabled}
      onNavigateEngineering={onNavigateEngineering}
      onNavigateNonEngineering={onNavigateNonEngineering}
    />
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
    <div className={cn("mt-auto shrink-0 border-t border-slate-800/80 bg-black/25 p-3")}>
      <div className="mb-2 flex items-center gap-2 rounded-xl bg-white/[0.06] px-2.5 py-2.5">
        <Avatar className="size-8 ring-2 ring-[#5AA3E6]/30">
          <AvatarFallback className="bg-[#5AA3E6]/20 text-xs font-bold text-[#5AA3E6]">
            {initials}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-semibold text-slate-100">Administrator</p>
          <p className="truncate text-[11px] text-slate-500">{userEmail || "Signed in"}</p>
        </div>
      </div>
      <Button
        variant="ghost"
        size="sm"
        className="h-9 w-full justify-start gap-2 text-red-400 hover:bg-red-500/10 hover:text-red-300"
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
  activeTab,
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
        "admin-sidebar hidden lg:flex w-[18.5rem] shrink-0 flex-col sticky top-0 h-screen",
        adminSidebarClass,
        className
      )}
    >
      <div className="flex items-center justify-between gap-2 border-b border-slate-800/80 px-4 py-4">
        <div className="flex min-w-0 items-center gap-3">
          <BrandLogo variant="icon" size="sm" />
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-white">Admin Panel</p>
            <p className="truncate text-[11px] font-medium text-[#5AA3E6]">Apna Intern</p>
          </div>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8 shrink-0 text-slate-500 hover:bg-white/5 hover:text-slate-200"
          onClick={onCollapse}
          title="Collapse sidebar"
        >
          <ChevronLeft className="size-4" />
        </Button>
      </div>

      <TabsList className="flex h-auto min-h-0 flex-1 flex-col items-stretch justify-start gap-1 overflow-y-auto rounded-none border-0 bg-transparent p-2 shadow-none">
        <AdminNavItems
          activeTab={activeTab}
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
  activeTab,
  isServiceEnabled,
  onNavigateEngineering,
  onNavigateNonEngineering,
  ...footer
}: AdminMobileNavProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className={cn("flex w-[19rem] flex-col p-0 sm:max-w-[19rem]", adminSidebarClass)}>
        <SheetHeader className="border-b border-slate-800/80 px-4 py-4 text-left">
          <div className="flex items-center gap-3">
            <BrandLogo variant="icon" size="sm" />
            <SheetTitle className="text-sm font-bold text-white">Admin Navigation</SheetTitle>
          </div>
        </SheetHeader>
        <TabsList className="flex h-auto min-h-0 flex-1 flex-col items-stretch justify-start gap-1 overflow-y-auto rounded-none border-0 bg-transparent p-2 shadow-none">
          <AdminNavItems
            activeTab={activeTab}
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
  isServiceEnabled?: (key: string) => boolean;
  onNavigateEngineering?: () => void;
  onNavigateNonEngineering?: () => void;
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
  onSelectTab,
  isServiceEnabled,
  onNavigateEngineering,
  onNavigateNonEngineering,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectTab: (tab: string) => void;
  isServiceEnabled: (key: string) => boolean;
  onNavigateEngineering: () => void;
  onNavigateNonEngineering: () => void;
}) {
  const groups = useMemo(
    () => buildAdminNavSearchGroups(isServiceEnabled, onNavigateEngineering, onNavigateNonEngineering),
    [isServiceEnabled, onNavigateEngineering, onNavigateNonEngineering]
  );

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Search modules…" />
      <CommandList>
        <CommandEmpty>No module found.</CommandEmpty>
        {groups.map((group) => (
          <CommandGroup key={group.heading} heading={group.heading}>
            {group.entries.map((entry) => (
              <CommandItem
                key={entry.value}
                value={`${entry.label} ${entry.value}`}
                onSelect={() => {
                  if ("action" in entry && entry.action) {
                    entry.action();
                  } else {
                    onSelectTab(entry.value);
                  }
                  onOpenChange(false);
                }}
              >
                {entry.label}
              </CommandItem>
            ))}
          </CommandGroup>
        ))}
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
  isServiceEnabled,
  onNavigateEngineering,
  onNavigateNonEngineering,
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
      <header className="sticky top-0 z-30 flex h-[3.75rem] items-center gap-3 border-b border-slate-200/80 bg-white/90 px-4 shadow-sm backdrop-blur-md supports-[backdrop-filter]:bg-white/80 md:px-6">
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

          <div className="hidden items-center gap-2 rounded-xl border border-slate-200/80 bg-slate-50 px-3 py-1.5 sm:flex">
            <div className="text-center">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Views</div>
              <div className="text-sm font-bold tabular-nums text-slate-900">{visitorCount.toLocaleString()}</div>
            </div>
            <div className="h-8 w-px bg-slate-200" />
            <div className="text-center">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Visitors</div>
              <div className="text-sm font-bold tabular-nums text-[#2B7CD3]">
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

      {onNavigateTab && isServiceEnabled && onNavigateEngineering && onNavigateNonEngineering ? (
        <AdminNavSearch
          open={searchOpen}
          onOpenChange={setSearchOpen}
          onSelectTab={onNavigateTab}
          isServiceEnabled={isServiceEnabled}
          onNavigateEngineering={onNavigateEngineering}
          onNavigateNonEngineering={onNavigateNonEngineering}
        />
      ) : null}
    </>
  );
}
