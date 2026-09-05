import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  ArrowLeft,
  ChevronRight,
  Loader2,
  ScrollText,
  Search,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ACTOR_TAG_LABELS,
  type AdminLogRow,
  type AdminLogUserSummary,
  fetchAdminLogUserSummaries,
  fetchAdminLogsForUser,
  formatActorLabel,
  resolveRegistrationSourceLabel,
} from "@/lib/adminActionLog";

type AdminActivityLogsPanelProps = {
  isActive?: boolean;
};

const TAG_COLORS: Record<string, string> = {
  Admin: "bg-blue-100 text-blue-800 border-blue-200",
  "Super Admin": "bg-indigo-100 text-indigo-800 border-indigo-200",
  Staff: "bg-emerald-100 text-emerald-800 border-emerald-200",
  Referral: "bg-pink-100 text-pink-800 border-pink-200",
  "College Admin": "bg-violet-100 text-violet-800 border-violet-200",
  Registration: "bg-amber-100 text-amber-800 border-amber-200",
};

function tagBadgeClass(tag: string): string {
  return TAG_COLORS[tag] || "bg-slate-100 text-slate-700 border-slate-200";
}

function ActorBadge({ log }: { log: Partial<AdminLogRow> }) {
  const tag =
    log.actor_tag ||
    (log.actor_role ? ACTOR_TAG_LABELS[log.actor_role] || log.actor_role : "User");
  const name = log.actor_name || "";
  const email = log.admin_email || "";

  return (
    <div className="flex flex-col gap-1">
      <Badge variant="outline" className={`w-fit text-[10px] font-bold uppercase ${tagBadgeClass(tag)}`}>
        {tag}
      </Badge>
      {(name || email) && (
        <p className="text-xs font-medium text-slate-700">
          {name}
          {name && email ? " · " : ""}
          {email ? <span className="text-muted-foreground">{email}</span> : null}
        </p>
      )}
    </div>
  );
}

export function AdminActivityLogsPanel({ isActive = true }: AdminActivityLogsPanelProps) {
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<AdminLogUserSummary[]>([]);
  const [selectedUser, setSelectedUser] = useState<AdminLogUserSummary | null>(null);
  const [userLogs, setUserLogs] = useState<AdminLogRow[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [logSearch, setLogSearch] = useState("");

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const summaries = await fetchAdminLogUserSummaries(supabase);

      const { data: staffRows } = await supabase
        .from("admin_staff")
        .select("id, email, full_name, role_tag");

      const merged = new Map<string, AdminLogUserSummary>();
      for (const s of summaries) {
        const key = s.user_id || s.admin_email;
        merged.set(key, s);
      }

      for (const staff of staffRows || []) {
        const key = staff.id;
        if (!merged.has(key)) {
          merged.set(key, {
            user_id: staff.id,
            admin_email: staff.email || "",
            actor_name: staff.full_name || "",
            actor_tag: ACTOR_TAG_LABELS.staff,
            actor_role: "staff",
            log_count: 0,
            last_activity_at: "",
          });
        } else {
          const row = merged.get(key)!;
          if (!row.actor_name && staff.full_name) row.actor_name = staff.full_name;
        }
      }

      setUsers(
        Array.from(merged.values()).sort((a, b) => {
          if (b.log_count !== a.log_count) return b.log_count - a.log_count;
          return new Date(b.last_activity_at || 0).getTime() - new Date(a.last_activity_at || 0).getTime();
        })
      );
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Could not load activity users");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadUserLogs = useCallback(async (user: AdminLogUserSummary) => {
    setLogsLoading(true);
    try {
      const rows = await fetchAdminLogsForUser(supabase, user.user_id, user.admin_email);
      setUserLogs(rows);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Could not load logs");
      setUserLogs([]);
    } finally {
      setLogsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isActive && !selectedUser) void loadUsers();
  }, [isActive, selectedUser, loadUsers]);

  useEffect(() => {
    if (selectedUser) void loadUserLogs(selectedUser);
  }, [selectedUser, loadUserLogs]);

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) =>
        u.actor_name.toLowerCase().includes(q) ||
        u.admin_email.toLowerCase().includes(q) ||
        u.actor_tag.toLowerCase().includes(q)
    );
  }, [users, search]);

  const filteredLogs = useMemo(() => {
    const q = logSearch.trim().toLowerCase();
    if (!q) return userLogs;
    return userLogs.filter(
      (l) =>
        (l.description || "").toLowerCase().includes(q) ||
        l.action_type.toLowerCase().includes(q) ||
        l.entity_type.toLowerCase().includes(q) ||
        formatActorLabel(l).toLowerCase().includes(q)
    );
  }, [userLogs, logSearch]);

  if (selectedUser) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <Button
              variant="outline"
              size="icon"
              className="shrink-0"
              onClick={() => {
                setSelectedUser(null);
                setUserLogs([]);
                setLogSearch("");
              }}
            >
              <ArrowLeft className="size-4" />
            </Button>
            <div>
              <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
                <ScrollText className="size-5 text-primary" />
                Activity Logs
              </h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                {selectedUser.actor_name || selectedUser.admin_email}
                {selectedUser.admin_email ? ` · ${selectedUser.admin_email}` : ""}
              </p>
              <Badge variant="outline" className={`mt-2 text-[10px] ${tagBadgeClass(selectedUser.actor_tag)}`}>
                {selectedUser.actor_tag}
              </Badge>
            </div>
          </div>
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              value={logSearch}
              onChange={(e) => setLogSearch(e.target.value)}
              placeholder="Search actions…"
              className="pl-9"
            />
          </div>
        </div>

        <Card className="border-none shadow-elegant overflow-hidden">
          {logsLoading ? (
            <div className="py-16 text-center text-muted-foreground">
              <Loader2 className="size-5 animate-spin inline mr-2" />
              Loading logs…
            </div>
          ) : filteredLogs.length === 0 ? (
            <p className="py-16 text-center text-sm text-muted-foreground">No activity logs for this user.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Actor</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Details</TableHead>
                  <TableHead>Source</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLogs.map((log) => {
                  const sourceLabel = resolveRegistrationSourceLabel(
                    log.registration_source,
                    log.metadata
                  );
                  return (
                    <TableRow key={log.id}>
                      <TableCell className="text-xs whitespace-nowrap text-muted-foreground">
                        {new Date(log.created_at).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <ActorBadge log={log} />
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-[10px] font-bold uppercase">
                          {log.action_type}
                        </Badge>
                        <p className="text-[10px] text-muted-foreground mt-1 capitalize">{log.entity_type}</p>
                      </TableCell>
                      <TableCell className="max-w-md">
                        <p className="text-sm font-medium text-slate-800">{log.description || "—"}</p>
                      </TableCell>
                      <TableCell>
                        {sourceLabel ? (
                          <Badge variant="outline" className="text-[10px]">
                            {sourceLabel}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-800 flex items-center gap-2">
            <Activity className="size-6 text-primary" /> User Activity Logs
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Select a user to view their admin actions. Tags show who performed each action (Staff, Admin, Referral, etc.).
          </p>
        </div>
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name or email…"
            className="pl-9"
          />
        </div>
      </div>

      <Card className="border-none shadow-elegant overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-muted-foreground">
            <Loader2 className="size-5 animate-spin inline mr-2" />
            Loading users…
          </div>
        ) : filteredUsers.length === 0 ? (
          <p className="py-16 text-center text-sm text-muted-foreground">No users with activity found.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Role Tag</TableHead>
                <TableHead className="text-right">Actions</TableHead>
                <TableHead>Last Activity</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.map((user) => (
                <TableRow
                  key={user.user_id || user.admin_email}
                  className="cursor-pointer hover:bg-slate-50"
                  onClick={() => setSelectedUser(user)}
                >
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="size-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <Users className="size-4 text-primary" />
                      </div>
                      <div>
                        <p className="font-semibold text-sm text-slate-900">
                          {user.actor_name || user.admin_email.split("@")[0] || "User"}
                        </p>
                        <p className="text-xs text-muted-foreground">{user.admin_email}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={`text-[10px] ${tagBadgeClass(user.actor_tag)}`}>
                      {user.actor_tag}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-bold tabular-nums">{user.log_count}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {user.last_activity_at
                      ? new Date(user.last_activity_at).toLocaleString()
                      : "—"}
                  </TableCell>
                  <TableCell>
                    <ChevronRight className="size-4 text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
