import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Building2, ArrowRight, MapPin, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { fetchPublicCompanyPartners, type PublicCompanyPartner } from "@/lib/publicCompanyPartners";
import { COMPANY_LOGIN_PATH, COMPANY_REGISTER_PATH } from "@/lib/authRoutes";

export function HomeCompanyPartnersSection() {
  const [partners, setPartners] = useState<PublicCompanyPartner[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      try {
        setPartners(await fetchPublicCompanyPartners(supabase));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <section id="company-partners" className="scroll-mt-24 bg-slate-50/80 py-16 md:py-20">
      <div className="mx-auto max-w-6xl px-6 lg:px-8">
        <div className="reveal-on-scroll mb-10 text-center">
          <p className="text-[10px] font-black uppercase tracking-widest text-primary">Hiring partners</p>
          <h2 className="font-display mt-2 text-3xl font-extrabold text-slate-900 md:text-4xl">
            Company partners
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-slate-600">
            Approved companies collaborate with Apna Intern to post jobs and hire internship-ready candidates.
            Register your organisation to join this network.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Button asChild size="lg" className="rounded-full font-black gap-2">
              <Link to={COMPANY_REGISTER_PATH}>
                Company registration <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="rounded-full font-bold">
              <Link to={COMPANY_LOGIN_PATH}>Company login</Link>
            </Button>
          </div>
        </div>

        {loading ? (
          <p className="text-center text-sm text-slate-500 py-12">Loading company partners…</p>
        ) : partners.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-10 text-center">
            <Building2 className="size-10 mx-auto text-slate-300 mb-3" />
            <p className="text-sm text-slate-600 font-medium">Approved company partners will appear here.</p>
            <p className="text-xs text-slate-500 mt-2">Be the first — submit your company registration today.</p>
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {partners.map((p) => {
              const initials = p.company_name
                .split(/\s+/)
                .slice(0, 2)
                .map((w) => w[0]?.toUpperCase() || "")
                .join("")
                .slice(0, 3);
              return (
                <article
                  key={p.id}
                  className="home-card-premium flex flex-col rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm"
                >
                  <div className="mb-4 flex items-start gap-3">
                    <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 text-sm font-black text-white shadow-md">
                      {initials || "CO"}
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-bold text-slate-900 leading-snug">{p.company_name}</h3>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-600 mt-1">
                        Verified partner
                      </p>
                    </div>
                  </div>
                  <div className="space-y-2 text-sm text-slate-600 flex-1">
                    <p className="flex items-start gap-2">
                      <User className="size-4 shrink-0 mt-0.5 text-slate-400" />
                      <span>
                        {p.contact_name}
                        {p.designation ? ` · ${p.designation}` : ""}
                      </span>
                    </p>
                    {p.company_address ? (
                      <p className="flex items-start gap-2">
                        <MapPin className="size-4 shrink-0 mt-0.5 text-slate-400" />
                        <span className="line-clamp-2">{p.company_address}</span>
                      </p>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
