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
import { fetchSupabaseTablePage } from "@/lib/fetchAllSupabaseRows";
import {
  fetchPaidEnrollmentKeys,
  fetchUnpaidRegistrationLeadsPage,
} from "@/lib/unpaidStudentsAdmin";
import { parseStudentMetadata, isStudentPendingDirectoryPayment } from "@/lib/studentPaymentAccess";

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
  const paidKeysRef = useRef<Awaited<ReturnType<typeof fetchPaidEnrollmentKeys>> | null>(null);

  const ensurePaidKeys = useCallback(async () => {
    if (paidKeysRef.current) return paidKeysRef.current;
    paidKeysRef.current = await fetchPaidEnrollmentKeys(client);
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
          "id,full_name,email,contact_number,university_name,college_name,status,created_at,metadata",
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
          const meta = parseStudentMetadata(s.metadata);
          if (isStudentPendingDirectoryPayment(meta)) return true;
          return (
            status.includes("pending") ||
            status.includes("unpaid") ||
            status.includes("payment")
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

      const { rows: leadRows, total: leadTotal } = await fetchUnpaidRegistrationLeadsPage(
        client,
        {
          page,
          pageSize: PAGE_SIZE,
          search: searchQ || undefined,
          paid,
        }
      );

      const unpaidLeads: UnpaidRow[] = leadRows.map((l) => ({
        ...l,
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
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => {
              paidKeysRef.current = null;
              void load();
            }}
          >
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
