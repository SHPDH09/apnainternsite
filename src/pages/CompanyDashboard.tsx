import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { COMPANY_LOGIN_PATH } from "@/lib/authRoutes";
import { fetchCompanyProfile, companyStatusLabel, type CompanyProfileRow } from "@/lib/companyCollaboration";
import { CompanyCollaborationWorkspace } from "@/components/company/CompanyCollaborationWorkspace";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader2, LogOut, Clock, XCircle } from "lucide-react";
import { toast } from "sonner";

export default function CompanyDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<CompanyProfileRow | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          navigate(COMPANY_LOGIN_PATH);
          return;
        }
        const row = await fetchCompanyProfile(supabase, session.user.id);
        if (!row) {
          toast.error("No company profile linked to this account.");
          navigate("/");
          return;
        }
        setProfile(row);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not load company profile");
      } finally {
        setLoading(false);
      }
    })();
  }, [navigate]);

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate(COMPANY_LOGIN_PATH);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!profile) return null;

  if (profile.status === "pending_approval") {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50">
        <Card className="max-w-md p-8 text-center space-y-4">
          <Clock className="size-12 mx-auto text-amber-500" />
          <h1 className="text-xl font-bold">Awaiting admin approval</h1>
          <p className="text-sm text-muted-foreground">
            Your company registration for <strong>{profile.company_name}</strong> is under review. You will get dashboard access after approval.
          </p>
          <Button variant="outline" onClick={() => void signOut()}>
            <LogOut className="size-4 mr-2" /> Sign out
          </Button>
        </Card>
      </div>
    );
  }

  if (profile.status !== "approved") {
    if (profile.status === "rejected") {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50">
        <Card className="max-w-md p-8 text-center space-y-4">
          <XCircle className="size-12 mx-auto text-red-500" />
          <h1 className="text-xl font-bold">Registration not approved</h1>
          <p className="text-sm text-muted-foreground">
            {profile.rejection_reason || "Contact Apna Intern support for details."}
          </p>
          <Button variant="outline" onClick={() => void signOut()}>
            Sign out
          </Button>
        </Card>
      </div>
    );
    }
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50">
        <Card className="max-w-md p-8 text-center space-y-4">
          <Clock className="size-12 mx-auto text-slate-400" />
          <h1 className="text-xl font-bold">Company access restricted</h1>
          <p className="text-sm text-muted-foreground">
            Your company account status is <strong>{companyStatusLabel(profile.status)}</strong>. Contact Apna Intern support.
          </p>
          <Button variant="outline" onClick={() => void signOut()}>
            Sign out
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b bg-white px-4 py-3 flex items-center justify-between">
        <div>
          <p className="text-xs text-primary font-semibold">Company portal</p>
          <p className="font-bold">{profile.company_name}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground hidden sm:inline">
            {companyStatusLabel(profile.status)}
          </span>
          <Button variant="outline" size="sm" onClick={() => void signOut()}>
            <LogOut className="size-4 mr-1" /> Sign out
          </Button>
        </div>
      </header>
      <main className="max-w-5xl mx-auto p-4 md:p-6">
        <CompanyCollaborationWorkspace company={profile} />
      </main>
    </div>
  );
}
