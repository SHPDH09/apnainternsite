import { useCallback, useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Loader2, Mail, RefreshCw } from "lucide-react";
import { toast } from "sonner";
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
import { AdminPageHeader, AdminTableShell } from "@/components/admin/ui";
import { fetchAllSupabaseRows } from "@/lib/fetchAllSupabaseRows";

type UnpaidRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  contact_number: string | null;
  university_name: string | null;
  college_name: string | null;
  status: string | null;
  created_at: string | null;
  source: "student" | "lead";
};

type Props = {
  client: SupabaseClient;
};

export function UnpaidStudentsDirectoryPanel({ client }: Props) {
  const [rows, setRows] = useState<UnpaidRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [students, payments, leads] = await Promise.all([
        fetchAllSupabaseRows(client, "students", {
          select: "id,full_name,email,contact_number,university_name,college_name,status,created_at",
        }),
        fetchAllSupabaseRows(client, "payment_success", {
          select: "user_id,email",
        }),
        fetchAllSupabaseRows(client, "registration_leads", {
          select: "id,full_name,email,phone,university_name,college_name,created_at,cart_stage",
        }).catch(() => []),
      ]);

      const paidUserIds = new Set(
        (payments || []).map((p: { user_id?: string }) => p.user_id).filter(Boolean),
      );
      const paidEmails = new Set(
        (payments || [])
          .map((p: { email?: string }) => String(p.email || "").trim().toLowerCase())
          .filter(Boolean),
      );

      const unpaidStudents: UnpaidRow[] = (students || [])
        .filter((s: Record<string, unknown>) => {
          const id = String(s.id || "");
          const email = String(s.email || "").trim().toLowerCase();
          const status = String(s.status || "").toLowerCase();
          if (paidUserIds.has(id)) return false;
          if (email && paidEmails.has(email)) return false;
          return status.includes("pending") || status.includes("unpaid") || !paidUserIds.has(id);
        })
        .slice(0, 500)
        .map((s: Record<string, unknown>) => ({
          id: String(s.id),
          full_name: (s.full_name as string) || null,
          email: (s.email as string) || null,
          contact_number: (s.contact_number as string) || null,
          university_name: (s.university_name as string) || null,
          college_name: (s.college_name as string) || null,
          status: (s.status as string) || "pending_payment",
          created_at: (s.created_at as string) || null,
          source: "student" as const,
        }));

      const unpaidLeads: UnpaidRow[] = (leads || [])
        .filter((l: Record<string, unknown>) => {
          const stage = String(l.cart_stage || "").toLowerCase();
          return !stage.includes("converted") && !stage.includes("paid");
        })
        .slice(0, 200)
        .map((l: Record<string, unknown>) => ({
          id: String(l.id),
          full_name: (l.full_name as string) || null,
          email: (l.email as string) || null,
          contact_number: (l.phone as string) || null,
          university_name: (l.university_name as string) || null,
          college_name: (l.college_name as string) || null,
          status: String(l.cart_stage || "abandoned"),
          created_at: (l.created_at as string) || null,
          source: "lead" as const,
        }));

      setRows([...unpaidStudents, ...unpaidLeads]);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load unpaid records";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [client]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = rows.filter((r) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return [r.full_name, r.email, r.contact_number, r.college_name, r.university_name]
      .join(" ")
      .toLowerCase()
      .includes(q);
  });

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Unpaid Students"
        description="Students and abandoned registrations without a successful payment record."
        actions={
          <Button type="button" variant="outline" size="sm" className="gap-2" onClick={() => void load()}>
            <RefreshCw className="size-4" />
            Refresh
          </Button>
        }
      />

      {loading ? (
        <div className="flex h-48 items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-5 animate-spin" />
          Loading unpaid records…
        </div>
      ) : (
        <AdminTableShell
          title="Pending fee collection"
          description={`${filtered.length} record(s)`}
          searchValue={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search by name, email, or college…"
          empty={filtered.length === 0}
          emptyMessage="No unpaid students or leads found."
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email / Phone</TableHead>
                <TableHead>College</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Source</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.slice(0, 100).map((r) => (
                <TableRow key={`${r.source}-${r.id}`}>
                  <TableCell className="font-medium">{r.full_name || "—"}</TableCell>
                  <TableCell>
                    <div className="text-sm">{r.email || "—"}</div>
                    <div className="text-xs text-muted-foreground">{r.contact_number || ""}</div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">{r.college_name || "—"}</div>
                    <div className="text-xs text-muted-foreground">{r.university_name || ""}</div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize">
                      {r.status || "pending"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={r.source === "lead" ? "secondary" : "default"}>{r.source}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </AdminTableShell>
      )}

      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <Mail className="size-3.5" />
        Use Communications Center to send payment reminder emails to filtered audiences.
      </p>
    </div>
  );
}
