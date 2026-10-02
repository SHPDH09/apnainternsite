import { Outlet, Link } from "react-router-dom";
import { Bell, Menu, Search } from "lucide-react";
import { useState } from "react";
import { WaCrmProvider, useWaCrm } from "@/wa-crm/context/WaCrmContext";
import { WaCrmSidebar } from "@/wa-crm/layout/WaCrmSidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { SiteLoader } from "@/components/SiteLoader";

function ShellInner() {
  const { data, loading, error } = useWaCrm();
  const [mobileOpen, setMobileOpen] = useState(false);

  if (loading && !data) {
    return <SiteLoader variant="fullscreen" message="Loading WA CRM…" />;
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="max-w-md rounded-xl border bg-white p-6 text-center shadow-sm">
          <p className="font-semibold text-slate-900">Could not load WA CRM</p>
          <p className="text-sm text-muted-foreground mt-2">{error.message}</p>
          <Button asChild className="mt-4">
            <Link to="/admin">Back to Admin</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row">
      <aside className="hidden md:flex w-64 shrink-0 flex-col bg-slate-950 text-white border-r border-slate-800">
        <div className="px-4 py-5 border-b border-slate-800">
          <p className="text-lg font-bold tracking-tight">WA CRM</p>
          <p className="text-xs text-slate-400 mt-0.5">WhatsApp Business Platform</p>
          {data?.demoMode && (
            <Badge className="mt-2 bg-amber-500/20 text-amber-200 hover:bg-amber-500/20">Demo mode</Badge>
          )}
        </div>
        <WaCrmSidebar />
        <div className="mt-auto p-4 text-xs text-slate-500 border-t border-slate-800">
          <Link to="/admin" className="text-sky-400 hover:underline">
            ← Apna Intern Admin
          </Link>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b bg-white/95 backdrop-blur px-4 py-3">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" className="md:hidden">
                <Menu className="size-4" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 p-0 bg-slate-950 text-white border-slate-800">
              <WaCrmSidebar mobile />
            </SheetContent>
          </Sheet>
          <div className="relative flex-1 max-w-xl">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input className="pl-9 h-9" placeholder="Search contacts, chats, leads…" />
          </div>
          <Button variant="ghost" size="icon">
            <Bell className="size-4" />
          </Button>
        </header>

        <main className="flex-1 p-4 md:p-6 overflow-auto pb-20 md:pb-6">
          <Outlet />
        </main>

        <nav className="md:hidden fixed bottom-0 inset-x-0 border-t bg-white flex justify-around py-2 text-[10px] z-30">
          {[
            { href: "/admin/wa-crm", label: "Home" },
            { href: "/admin/wa-crm/inbox", label: "Inbox" },
            { href: "/admin/wa-crm/leads", label: "Leads" },
            { href: "/admin/wa-crm/campaigns", label: "Campaigns" },
            { href: "/admin/wa-crm/settings", label: "More" },
          ].map((item) => (
            <Link key={item.href} to={item.href} className="flex flex-col items-center px-2 text-muted-foreground">
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </div>
  );
}

export function WaCrmShell() {
  return (
    <WaCrmProvider>
      <ShellInner />
    </WaCrmProvider>
  );
}
