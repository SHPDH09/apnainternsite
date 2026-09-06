import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, Plus, Check, X } from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import {
  fetchCybercafePendingApplications,
  fetchPendingPartnerApplications,
  PARTNER_KIND_LABELS,
  referralApplyModeLabel,
  type PartnerApplicationRow,
} from "@/lib/partnerApplications";
import {
  approveCybercafeProfile,
  approvePartnerApplication,
  rejectPartnerApplication,
} from "@/lib/partnerApplicationAdmin";
import { PortalSectionHeader } from "@/components/portal/portalDashboardUi";

type CafePending = {
  id: string;
  owner_name: string;
  email: string;
  phone: string;
  shop_name: string;
  location: string;
  status: string;
  created_at: string;
};

export function PartnerApplicationsPanel() {
  const [loading, setLoading] = useState(true);
  const [apps, setApps] = useState<PartnerApplicationRow[]>([]);
  const [cafes, setCafes] = useState<CafePending[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [pendingApps, pendingCafes] = await Promise.all([
        fetchPendingPartnerApplications(supabase),
        fetchCybercafePendingApplications(supabase),
      ]);
      setApps(pendingApps);
      const appEmails = new Set(pendingApps.filter((a) => a.partner_kind === "cyber_cafe").map((a) => a.email.toLowerCase()));
      setCafes(
        pendingCafes.filter((c) => !appEmails.has(String(c.email || "").toLowerCase()))
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not load applications.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const approveApp = async (app: PartnerApplicationRow) => {
    setBusyId(app.id);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.id) throw new Error("Admin session required");
      await approvePartnerApplication(supabase, app, user.id);
      toast.success(`${PARTNER_KIND_LABELS[app.partner_kind]} approved.`);
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Approve failed.");
    } finally {
      setBusyId(null);
    }
  };

  const rejectApp = async (app: PartnerApplicationRow) => {
    const reason = window.prompt("Rejection reason (optional):") || "";
    setBusyId(app.id);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.id) throw new Error("Admin session required");
      await rejectPartnerApplication(supabase, app, user.id, reason);
      toast.success("Application rejected.");
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Reject failed.");
    } finally {
      setBusyId(null);
    }
  };

  const approveCafe = async (cafe: CafePending) => {
    setBusyId(cafe.id);
    try {
      await approveCybercafeProfile(supabase, cafe.id);
      toast.success("Cyber cafe approved.");
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Approve failed.");
    } finally {
      setBusyId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-slate-500 py-8">
        <Loader2 className="size-5 animate-spin" /> Loading partner applications…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PortalSectionHeader
        title="Partner applications"
        subtitle="Verify cyber cafe, referral, and coupon partner requests. Dashboards stay locked until you approve."
        action={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" className="font-black gap-2">
              <Link to="/partner/register">
                <Plus className="size-4" /> Public apply page
              </Link>
            </Button>
            <Button variant="outline" onClick={() => void reload()}>Refresh</Button>
          </div>
        }
      />

      <Card className="overflow-hidden border-none shadow-elegant">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Type</TableHead>
              <TableHead>Applicant</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Submitted</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {apps.map((app) => (
              <TableRow key={app.id}>
                <TableCell>
                  <Badge>{PARTNER_KIND_LABELS[app.partner_kind]}</Badge>
                  {app.partner_kind === "referral" && app.payload?.referral_apply_mode ? (
                    <p className="mt-1 text-[10px] font-semibold text-slate-500">
                      {referralApplyModeLabel(app.payload.referral_apply_mode)}
                    </p>
                  ) : null}
                </TableCell>
                <TableCell>
                  <p className="font-bold text-sm">{app.full_name}</p>
                  <p className="text-xs text-slate-500">{app.email}</p>
                </TableCell>
                <TableCell className="text-xs">{app.contact_number || "—"}</TableCell>
                <TableCell className="text-xs">{new Date(app.created_at).toLocaleString()}</TableCell>
                <TableCell className="text-right space-x-2">
                  <Button size="sm" className="gap-1" disabled={busyId === app.id} onClick={() => void approveApp(app)}>
                    {busyId === app.id ? <Loader2 className="size-3 animate-spin" /> : <Check className="size-3" />}
                    Approve
                  </Button>
                  <Button size="sm" variant="outline" className="gap-1" disabled={busyId === app.id} onClick={() => void rejectApp(app)}>
                    <X className="size-3" /> Reject
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {cafes.map((cafe) => (
              <TableRow key={`cafe-${cafe.id}`}>
                <TableCell><Badge variant="secondary">Cyber Cafe (legacy queue)</Badge></TableCell>
                <TableCell>
                  <p className="font-bold text-sm">{cafe.owner_name}</p>
                  <p className="text-xs text-slate-500">{cafe.email}</p>
                  <p className="text-xs text-slate-400">{cafe.shop_name}</p>
                </TableCell>
                <TableCell className="text-xs">{cafe.phone || "—"}</TableCell>
                <TableCell className="text-xs">{new Date(cafe.created_at).toLocaleString()}</TableCell>
                <TableCell className="text-right">
                  <Button size="sm" className="gap-1" disabled={busyId === cafe.id} onClick={() => void approveCafe(cafe)}>
                    Approve
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {!apps.length && !cafes.length ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-sm text-slate-500 py-8">
                  No pending partner applications.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
