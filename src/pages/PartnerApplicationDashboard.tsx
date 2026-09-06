import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Clock, Loader2, LogOut, ShieldX, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { SiteNav } from "@/components/SiteNav";
import { SiteFooter } from "@/components/SiteFooter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  fetchPartnerApplicationForUser,
  PARTNER_KIND_LABELS,
  type PartnerApplicationRow,
} from "@/lib/partnerApplications";
import {
  CYBER_CAFE_DASHBOARD_PATH,
  REFERRAL_DASHBOARD_PATH,
} from "@/lib/authRoutes";

export default function PartnerApplicationDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [app, setApp] = useState<PartnerApplicationRow | null>(null);
  const [cafeStatus, setCafeStatus] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.id) {
        navigate("/login?next=/partner/dashboard");
        return;
      }

      const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
      const roleList = (roles || []).map((r) => String((r as { role: string }).role));
      if (roleList.includes("referral_partner")) {
        navigate(REFERRAL_DASHBOARD_PATH, { replace: true });
        return;
      }
      if (roleList.includes("cybercafe")) {
        navigate(CYBER_CAFE_DASHBOARD_PATH, { replace: true });
        return;
      }

      const application = await fetchPartnerApplicationForUser(supabase, user.id);
      setApp(application);

      const { data: cafe } = await supabase
        .from("cybercafe_profiles")
        .select("status")
        .eq("email", user.email || "")
        .maybeSingle();
      setCafeStatus(cafe?.status ? String(cafe.status) : null);

      if (cafe?.status === "approved") {
        navigate(CYBER_CAFE_DASHBOARD_PATH, { replace: true });
        return;
      }

      if (application?.status === "approved") {
        if (application.partner_kind === "cyber_cafe") {
          navigate(CYBER_CAFE_DASHBOARD_PATH, { replace: true });
        } else {
          navigate(REFERRAL_DASHBOARD_PATH, { replace: true });
        }
      }
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-500 gap-2">
        <Loader2 className="size-5 animate-spin" /> Loading partner status…
      </div>
    );
  }

  const status = app?.status || (cafeStatus === "pending_approval" ? "pending" : cafeStatus);
  const kind = app?.partner_kind || "cyber_cafe";

  return (
    <div className="min-h-screen bg-slate-50">
      <SiteNav />
      <main className="mx-auto max-w-lg px-4 py-16">
        <Card className="p-8 text-center shadow-elegant border-none">
          {status === "rejected" ? (
            <>
              <ShieldX className="size-14 text-red-500 mx-auto mb-4" />
              <h1 className="text-2xl font-black mb-2">Application rejected</h1>
              <p className="text-sm text-slate-600 mb-4">
                {app?.rejection_reason || "Contact support if you believe this is a mistake."}
              </p>
            </>
          ) : status === "approved" ? (
            <>
              <CheckCircle2 className="size-14 text-emerald-500 mx-auto mb-4" />
              <h1 className="text-2xl font-black mb-2">Application approved</h1>
              <p className="text-sm text-slate-600">Redirecting to your partner dashboard…</p>
            </>
          ) : (
            <>
              <Clock className="size-14 text-amber-500 mx-auto mb-4" />
              <h1 className="text-2xl font-black mb-2">Dashboard locked</h1>
              <p className="text-sm text-slate-600 px-2">
                Your {PARTNER_KIND_LABELS[kind]} application is under admin review. You will get full
                dashboard access after verification (usually 12–24 hours).
              </p>
            </>
          )}

          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <Badge variant="secondary">{PARTNER_KIND_LABELS[kind]}</Badge>
            <Badge variant="outline">{status || "pending"}</Badge>
          </div>

          <div className="mt-8 flex flex-col gap-2">
            <Button variant="outline" onClick={() => void load()}>Refresh status</Button>
            <Button variant="ghost" className="gap-2" onClick={() => void handleLogout()}>
              <LogOut className="size-4" /> Sign out
            </Button>
            <Link to="/" className="text-xs text-slate-500 hover:text-primary mt-2">Back to home</Link>
          </div>
        </Card>
      </main>
      <SiteFooter />
    </div>
  );
}
