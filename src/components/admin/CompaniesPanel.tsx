import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PortalSectionHeader } from "@/components/portal/portalDashboardUi";
import { CompanyCollaborationWorkspace } from "@/components/company/CompanyCollaborationWorkspace";
import {
  approveCompany,
  companyStatusLabel,
  fetchAllCompanies,
  rejectCompany,
  type CompanyProfileRow,
} from "@/lib/companyCollaboration";
import { Building2, Check, Eye, Loader2, Search, X } from "lucide-react";
import { toast } from "sonner";

export function CompaniesPanel() {
  const [rows, setRows] = useState<CompanyProfileRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [detail, setDetail] = useState<CompanyProfileRow | null>(null);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectTarget, setRejectTarget] = useState<CompanyProfileRow | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await fetchAllCompanies(supabase));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not load companies");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = rows.filter((r) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      r.company_name.toLowerCase().includes(q) ||
      r.contact_name.toLowerCase().includes(q) ||
      r.email.toLowerCase().includes(q) ||
      (r.gst_number || "").toLowerCase().includes(q)
    );
  });

  const handleApprove = async (row: CompanyProfileRow) => {
    setBusyId(row.id);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.id) throw new Error("Admin session required");
      await approveCompany(supabase, row.id, user.id);
      toast.success(`${row.company_name} approved — dashboard unlocked`);
      await load();
      if (detail?.id === row.id) {
        setDetail({ ...row, status: "approved" });
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Approve failed");
    } finally {
      setBusyId(null);
    }
  };

  const submitReject = async () => {
    if (!rejectTarget) return;
    setBusyId(rejectTarget.id);
    try {
      await rejectCompany(supabase, rejectTarget.id, rejectReason);
      toast.success("Company rejected");
      setRejectOpen(false);
      setRejectTarget(null);
      setRejectReason("");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Reject failed");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      <PortalSectionHeader
        title="Company collaboration"
        subtitle="Review company registrations, mirror dashboards, import students, and complete hiring"
        icon={Building2}
      />

      <div className="portal-dash-card p-4">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search company, contact, email, GST…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="portal-dash-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Company</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>GST</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-16">
                  <Loader2 className="size-8 animate-spin mx-auto text-primary" />
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-16 text-muted-foreground">
                  No companies found.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((row) => (
                <TableRow key={row.id} className="cursor-pointer hover:bg-muted/30" onClick={() => setDetail(row)}>
                  <TableCell>
                    <div className="font-bold text-sm">{row.company_name}</div>
                    <div className="text-xs text-muted-foreground truncate max-w-[220px]">{row.company_address || "—"}</div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">{row.contact_name}</div>
                    <div className="text-xs text-muted-foreground">{row.email}</div>
                  </TableCell>
                  <TableCell className="text-xs font-mono">{row.gst_number || "—"}</TableCell>
                  <TableCell>
                    <Badge variant={row.status === "approved" ? "default" : "secondary"}>
                      {companyStatusLabel(row.status)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="outline" onClick={() => setDetail(row)}>
                        <Eye className="size-4" />
                      </Button>
                      {row.status === "pending_approval" ? (
                        <>
                          <Button
                            size="sm"
                            className="bg-emerald-600 hover:bg-emerald-700"
                            disabled={busyId === row.id}
                            onClick={() => void handleApprove(row)}
                          >
                            <Check className="size-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-red-600"
                            disabled={busyId === row.id}
                            onClick={() => {
                              setRejectTarget(row);
                              setRejectOpen(true);
                            }}
                          >
                            <X className="size-4" />
                          </Button>
                        </>
                      ) : null}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Company dashboard (admin view)</DialogTitle>
          </DialogHeader>
          {detail ? (
            <CompanyCollaborationWorkspace
              company={detail}
              readOnly={detail.status !== "approved"}
              allowAdminImport={detail.status === "approved"}
            />
          ) : null}
          <DialogFooter>
            <Button onClick={() => setDetail(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject company</DialogTitle>
          </DialogHeader>
          <Input
            placeholder="Reason (optional)"
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" disabled={!!busyId} onClick={() => void submitReject()}>
              Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
