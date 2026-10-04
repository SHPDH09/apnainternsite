import { useCallback, useEffect, useRef, useState } from "react";
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
import { AdminListPagination } from "@/components/admin/ui/AdminListPagination";
import { AdminPageHeader, AdminTableShell } from "@/components/admin/ui";
import { fetchAllSupabaseRows, fetchSupabaseTablePage } from "@/lib/fetchAllSupabaseRows";

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

const PAGE_SIZE = 25;

type Props = {
  client: SupabaseClient;
};

export function UnpaidStudentsDirectoryPanel({ client }: Props) {
  const [rows, setRows] = useState<UnpaidRow[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const paidKeysRef = useRef<{ userIds: Set<string>; emails: Set<string> } | null>(null);

  const ensurePaidKeys = useCallback(async () => {
    if (paidKeysRef.current) return paidKeysRef.current;
    const payments = await fetchAllSupabaseRows<{ user_id?: string; email?: string }>(
      client,
      "payment_success",
      {
        select: "user_id,email",
        orderBy: "created_at",
        ascending: false,
        pageSize: 500,
        maxRows: 40_000,
      }
    );
    const userIds = new Set(
      payments.map((p) => String(p.user_id || "")).filter(Boolean)
    );
    const emails = new Set(
      payments
        .map((p) => String(p.email || "").trim().toLowerCase())
        .filter(Boolean)
    );
    paidKeysRef.current = { userIds, emails };
    return paidKeysRef.current;
  }, [client]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const paid = await ensurePaidKeys();
      const searchQ = search.trim();
      const { rows: studentPage, total: studentTotal } = await fetchSupabaseTablePage<
        Record<string, unknown>
      >(client, "students", {
        page,
        pageSize: PAGE_SIZE,
        orderBy: "created_at",
        ascending: false,
        select:
          "id,full_name,email,contact_number,university_name,college_name,status,created_at",
        modify: (q) => {
          let query = q;
          if (searchQ) {
            const s = searchQ.replace(/"/g, '\\"');
            query = query.or(
              `full_name.ilike.%${s}%,email.ilike.%${s}%,college_name.ilike.%${s}%`
            );
          }
          return query;
        },
      });

      const unpaidStudents: UnpaidRow[] = studentPage
        .filter((s) => {
          const id = String(s.id || "");
          const email = String(s.email || "").trim().toLowerCase();
          if (paid.userIds.has(id)) return false;
          if (email && paid.emails.has(email)) return false;
          const status = String(s.status || "").toLowerCase();
          return (
            status.includes("pending") ||
            status.includes("unpaid") ||
            !paid.userIds.has(id)
          );
        })
        .map((s) => ({
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

      const { rows: leadPage, total: leadTotal } = await fetchSupabaseTablePage<
        Record<string, unknown>
      >(client, "registration_leads", {
        page,
        pageSize: PAGE_SIZE,
        orderBy: "updated_at",
        ascending: false,
        select:
          "id,full_name,email,phone,university_name,college_name,created_at,cart_stage",
        modify: (q) => {
          let query = q;
          if (searchQ) {
            const s = searchQ.replace(/"/g, '\\"');
            query = query.or(
              `full_name.ilike.%${s}%,email.ilike.%${s}%,college_name.ilike.%${s}%`
            );
          }
          return query;
        },
      });

      const unpaidLeads: UnpaidRow[] = leadPage
        .filter((l) => {
          const stage = String(l.cart_stage || "").toLowerCase();
          const email = String(l.email || "").trim().toLowerCase();
          if (email && paid.emails.has(email)) return false;
          return !stage.includes("converted") && !stage.includes("paid");
        })
        .map((l) => ({
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
      setTotalCount(studentTotal + leadTotal);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load unpaid records";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [client, ensurePaidKeys, page, search]);

  useEffect(() => {
    setPage(0);
  }, [search]);

  useEffect(() => {
    const delay = search.trim() ? 300 : 0;
    const timer = setTimeout(() => {
      void load();
    }, delay);
    return () => clearTimeout(timer);
  }, [load, page, search]);

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
          description={`${rows.length} on this page · ~${totalCount} indexed rows`}
          searchValue={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search by name, email, or college…"
          empty={rows.length === 0}
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
              {rows.map((r) => (
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
          <AdminListPagination
            page={page}
            pageSize={PAGE_SIZE}
            total={totalCount}
            onPageChange={setPage}
          />
        </AdminTableShell>
      )}

      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <Mail className="size-3.5" />
        Use Communications Center to send payment reminder emails to filtered audiences.
      </p>
    </div>
  );
}
