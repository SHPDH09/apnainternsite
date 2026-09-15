import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import {
  Calendar,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  Menu,
  Shield,
  User,
  UserPlus,
} from "lucide-react";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { hasStaffPerm, type StaffPermissions } from "@/lib/staffPermissions";
import {
  staffNavItemClass,
  staffNavSectionClass,
  staffPageClass,
  staffSidebarClass,
} from "@/components/staff/staffStyles";

export type StaffNavService = {
  id: keyof StaffPermissions;
  label: string;
  icon: LucideIcon;
  color: string;
  tab: string;
};

type StaffShellProps = {
  activeTab: string;
  onNavigateTab: (tab: string) => void;
  pageTitle: string;
  staffName: string;
  staffEmail: string | null;
  permissions: StaffPermissions | null;
  services: StaffNavService[];
  sidebarOpen: boolean;
  onSidebarOpenChange: (open: boolean) => void;
  accountMenuSidebar: ReactNode;
  accountMenuHeader: ReactNode;
  onLogout: () => void;
  children: ReactNode;
};

function StaffNav({
  activeTab,
  onNavigateTab,
  permissions,
  services,
}: Pick<StaffShellProps, "activeTab" | "onNavigateTab" | "permissions" | "services">) {
  return (
    <nav className="flex-1 space-y-1 overflow-y-auto px-2 py-2">
      <button
        type="button"
        onClick={() => onNavigateTab("dashboard")}
        data-active={activeTab === "dashboard"}
        className={staffNavItemClass}
      >
        <LayoutDashboard className="size-4 shrink-0 text-[#5AA3E6]" />
        Dashboard
      </button>

      <div className={staffNavSectionClass}>Authorized access</div>
      {services.map(
        (service) =>
          hasStaffPerm(permissions, service.id) && (
            <button
              key={service.tab}
              type="button"
              onClick={() => onNavigateTab(service.tab)}
              data-active={activeTab === service.tab}
              className={staffNavItemClass}
            >
              <service.icon className={cn("size-4 shrink-0", service.color)} />
              {service.label}
            </button>
          )
      )}
      {hasStaffPerm(permissions, "can_manage_students") ? (
        <button
          type="button"
          onClick={() => onNavigateTab("add-registration")}
          data-active={activeTab === "add-registration"}
          className={staffNavItemClass}
        >
          <UserPlus className="size-4 shrink-0 text-emerald-400" />
          Add Registration
        </button>
      ) : null}

      <div className={staffNavSectionClass}>Account</div>
      {(
        [
          { tab: "profile", label: "Profile", Icon: User },
          { tab: "security", label: "Security", Icon: Shield },
          { tab: "my-attendance", label: "My Attendance", Icon: Calendar },
          { tab: "requests", label: "Requests", Icon: ClipboardList },
        ] as const
      ).map((item) => (
        <button
          key={item.tab}
          type="button"
          onClick={() => onNavigateTab(item.tab)}
          data-active={activeTab === item.tab}
          className={staffNavItemClass}
        >
          <item.Icon className="size-4 shrink-0 text-slate-400 group-data-[active=true]:text-[#5AA3E6]" />
          {item.label}
        </button>
      ))}
    </nav>
  );
}

function StaffSidebarFooter({
  accountMenuSidebar,
  onLogout,
}: {
  accountMenuSidebar: ReactNode;
  onLogout: () => void;
}) {
  return (
    <div className="mt-auto shrink-0 border-t border-slate-800/80 bg-black/25 p-3">
      <div className="mb-2">{accountMenuSidebar}</div>
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

export function StaffShell({
  activeTab,
  onNavigateTab,
  pageTitle,
  staffName,
  staffEmail,
  permissions,
  services,
  sidebarOpen,
  onSidebarOpenChange,
  accountMenuSidebar,
  accountMenuHeader,
  onLogout,
  children,
}: StaffShellProps) {
  const navigate = (tab: string) => {
    onNavigateTab(tab);
    onSidebarOpenChange(false);
  };

  return (
    <div className="portal-dashboard-bg flex min-h-screen">
      <aside
        className={cn(
          "sticky top-0 hidden h-screen w-[18.5rem] shrink-0 flex-col lg:flex",
          staffSidebarClass
        )}
      >
        <div className="flex items-center gap-3 border-b border-slate-800/80 px-4 py-4">
          <BrandLogo variant="icon" size="sm" />
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-white">Staff Portal</p>
            <p className="truncate text-[11px] font-medium text-[#5AA3E6]">Apna Intern</p>
          </div>
        </div>

        <StaffNav
          activeTab={activeTab}
          onNavigateTab={navigate}
          permissions={permissions}
          services={services}
        />

        <StaffSidebarFooter accountMenuSidebar={accountMenuSidebar} onLogout={onLogout} />
      </aside>

      <Sheet open={sidebarOpen} onOpenChange={onSidebarOpenChange}>
        <SheetContent
          side="left"
          className={cn("flex w-[19rem] flex-col p-0 sm:max-w-[19rem]", staffSidebarClass)}
        >
          <SheetHeader className="border-b border-slate-800/80 px-4 py-4 text-left">
            <div className="flex items-center gap-3">
              <BrandLogo variant="icon" size="sm" />
              <SheetTitle className="text-sm font-bold text-white">Staff Navigation</SheetTitle>
            </div>
          </SheetHeader>
          <StaffNav
            activeTab={activeTab}
            onNavigateTab={navigate}
            permissions={permissions}
            services={services}
          />
          <StaffSidebarFooter accountMenuSidebar={accountMenuSidebar} onLogout={onLogout} />
        </SheetContent>
      </Sheet>

      <main className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-[3.75rem] items-center justify-between gap-3 border-b border-slate-200/80 bg-white/90 px-4 shadow-sm backdrop-blur-md supports-[backdrop-filter]:bg-white/80 md:px-6">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="size-9 shrink-0 lg:hidden"
              onClick={() => onSidebarOpenChange(true)}
              aria-label="Open menu"
            >
              <Menu className="size-4" />
            </Button>
            <div className="min-w-0">
              <h1 className="truncate font-display text-base font-semibold tracking-tight text-slate-900 md:text-lg">
                {pageTitle}
              </h1>
              <p className="truncate text-[11px] font-medium text-slate-500">
                {staffName || "Staff member"}
                {staffEmail ? ` · ${staffEmail}` : ""}
              </p>
            </div>
          </div>
          {accountMenuHeader}
        </header>

        <div className={cn(staffPageClass, "portal-dash-animate-in")}>
          <div className="mx-auto max-w-7xl">{children}</div>
        </div>
      </main>
    </div>
  );
}
