import { Link } from "react-router-dom";
import { Store, Share2, Ticket, Building2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { COMPANY_REGISTER_PATH } from "@/lib/authRoutes";

const cards = [
  {
    kind: "cyber_cafe",
    title: "Cyber Cafe Partner",
    desc: "Register students from your shop, track payments, and grow footfall.",
    icon: Store,
    accent: "from-emerald-500 to-teal-600",
  },
  {
    kind: "referral",
    title: "Referral Partner",
    desc: "Share your referral link, track clicks and registrations end-to-end.",
    icon: Share2,
    accent: "from-blue-500 to-indigo-600",
  },
  {
    kind: "coupon",
    title: "Coupon Partner",
    desc: "Apply for scoped discount coupons by university, college, and domain.",
    icon: Ticket,
    accent: "from-amber-500 to-orange-600",
  },
  {
    kind: "company",
    title: "Company Partner",
    desc: "Register your company, post jobs, and hire Apna Intern candidates after admin approval.",
    icon: Building2,
    accent: "from-violet-500 to-indigo-600",
    href: COMPANY_REGISTER_PATH,
  },
] as const;

export function HomePartnerSection() {
  return (
    <section id="partner-registration" className="scroll-mt-24 py-16 md:py-20">
      <div className="mx-auto max-w-6xl px-6 lg:px-8">
        <div className="reveal-on-scroll mb-10 text-center">
          <p className="text-[10px] font-black uppercase tracking-widest text-primary">Partner with us</p>
          <h2 className="font-display mt-2 text-3xl font-extrabold text-slate-900 md:text-4xl">
            Registration for Partners
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-slate-600">
            Cyber cafes, referral promoters, coupon partners, and{" "}
            <Link to={COMPANY_REGISTER_PATH} className="font-semibold text-primary hover:underline">
              company hiring partners
            </Link>{" "}
            can apply online. Your dashboard stays locked until our admin team verifies your application.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Button asChild size="lg" className="rounded-full font-black gap-2">
              <Link to="/partner/register">
                Apply for partner <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="rounded-full font-bold">
              <Link to={COMPANY_REGISTER_PATH}>Company registration</Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="rounded-full font-bold">
              <Link to="/partner/dashboard">Check application status</Link>
            </Button>
          </div>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {cards.map((card) => {
            const Icon = card.icon;
            const applyHref =
              "href" in card && card.href
                ? card.href
                : `/partner/register?type=${card.kind}`;
            return (
              <div
                key={card.kind}
                className="home-card-premium flex flex-col rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm"
              >
                <div
                  className={`mb-4 inline-flex size-12 items-center justify-center rounded-2xl bg-gradient-to-br ${card.accent} text-white shadow-md`}
                >
                  <Icon className="size-6" />
                </div>
                <h3 className="text-lg font-bold text-slate-900">{card.title}</h3>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-slate-600">{card.desc}</p>
                <Button asChild className="mt-6 w-full rounded-full font-black gap-2">
                  <Link to={applyHref}>
                    Apply now <ArrowRight className="size-4" />
                  </Link>
                </Button>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
