import { NavLink } from "react-router-dom";
import {
  BarChart3,
  Bot,
  Contact,
  GitBranch,
  LayoutDashboard,
  MessageSquare,
  Send,
  Settings,
  Shield,
  Users,
  Workflow,
  FileText,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { useWaCrm } from "@/wa-crm/context/WaCrmContext";

const links = [
  { to: "/admin/wa-crm", end: true, label: "Dashboard", icon: LayoutDashboard },
  { to: "/admin/wa-crm/inbox", label: "Inbox", icon: MessageSquare, badgeKey: "unread" as const },
  { to: "/admin/wa-crm/contacts", label: "Contacts", icon: Contact },
  { to: "/admin/wa-crm/leads", label: "Leads", icon: GitBranch },
  { to: "/admin/wa-crm/campaigns", label: "Campaigns", icon: Send },
  { to: "/admin/wa-crm/templates", label: "Templates", icon: FileText },
  { to: "/admin/wa-crm/ai", label: "AI Assistant", icon: Bot },
  { to: "/admin/wa-crm/automation", label: "Automation", icon: Workflow },
  { to: "/admin/wa-crm/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/admin/wa-crm/team", label: "Team", icon: Users },
  { to: "/admin/wa-crm/whatsapp", label: "WhatsApp", icon: MessageSquare },
  { to: "/admin/wa-crm/compliance", label: "Compliance", icon: Shield },
  { to: "/admin/wa-crm/settings", label: "Settings", icon: Settings },
];

export function WaCrmSidebar({ mobile = false }: { mobile?: boolean }) {
  const { data } = useWaCrm();
  const unread = data?.kpis?.unreadMessages ?? 0;

  return (
    <nav className={cn("flex flex-col gap-1 p-3", mobile && "pb-20")}>
      <p className="px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">WA CRM</p>
      {links.map((link) => {
        const Icon = link.icon;
        const badge = link.badgeKey === "unread" && unread > 0 ? unread : null;
        return (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.end}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-sky-500/15 text-sky-200"
                  : "text-slate-300 hover:bg-slate-800 hover:text-white"
              )
            }
          >
            <Icon className="size-4 shrink-0 opacity-80" />
            <span className="truncate flex-1">{link.label}</span>
            {badge != null && (
              <Badge variant="secondary" className="h-5 min-w-5 justify-center bg-sky-600 text-white">
                {badge}
              </Badge>
            )}
          </NavLink>
        );
      })}
    </nav>
  );
}
