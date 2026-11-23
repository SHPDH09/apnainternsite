import { Link, useLocation } from "react-router-dom";
import {
  STUDENT_LOGIN_PATH,
  CYBER_CAFE_LOGIN_PATH,
  COLLEGE_LOGIN_PATH,
  COMPANY_LOGIN_PATH,
  REFERRAL_LOGIN_PATH,
  ADMIN_LOGIN_PATH,
} from "@/lib/authRoutes";
import { GraduationCap, Store, School, Building2, Users2, ShieldAlert } from "lucide-react";

export function LoginPortalSelector() {
  const location = useLocation();
  const currentPath = location.pathname;

  const portals = [
    {
      id: "student",
      label: "Student",
      path: STUDENT_LOGIN_PATH,
      icon: GraduationCap,
      color: "from-blue-500 to-cyan-400",
    },
    {
      id: "admin",
      label: "Admin / Staff",
      path: ADMIN_LOGIN_PATH,
      icon: ShieldAlert,
      color: "from-indigo-600 to-blue-500",
    },
    {
      id: "cybercafe",
      label: "Cyber Café",
      path: CYBER_CAFE_LOGIN_PATH,
      icon: Store,
      color: "from-emerald-500 to-teal-400",
    },
    {
      id: "college",
      label: "College Desk",
      path: COLLEGE_LOGIN_PATH,
      icon: School,
      color: "from-amber-500 to-orange-400",
    },
    {
      id: "company",
      label: "Company",
      path: COMPANY_LOGIN_PATH,
      icon: Building2,
      color: "from-violet-500 to-purple-400",
    },
    {
      id: "referral",
      label: "Referral",
      path: REFERRAL_LOGIN_PATH,
      icon: Users2,
      color: "from-rose-500 to-pink-400",
    },
  ];

  const isCurrent = (path: string) => {
    if (path === STUDENT_LOGIN_PATH) {
      return currentPath === STUDENT_LOGIN_PATH || currentPath === "/login";
    }
    return currentPath === path;
  };

  return (
    <div className="w-full mb-6">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
          Select Portal Role
        </span>
        <span className="text-[10px] text-cyan-600 font-semibold flex items-center gap-1">
          <span className="size-1.5 rounded-full bg-cyan-500 animate-pulse" />
          Single Sign-on Enabled
        </span>
      </div>

      <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5 p-1 rounded-2xl bg-slate-100/90 border border-slate-200/80 shadow-inner">
        {portals.map((p) => {
          const active = isCurrent(p.path);
          const Icon = p.icon;
          return (
            <Link
              key={p.id}
              to={p.path}
              className={`relative flex flex-col items-center justify-center py-2 px-1 rounded-xl text-center transition-all duration-300 ${
                active
                  ? "bg-white text-slate-900 shadow-md font-bold scale-[1.02] border border-slate-200/60"
                  : "text-slate-600 hover:text-slate-900 hover:bg-white/60 font-medium"
              }`}
            >
              <div
                className={`flex size-7 items-center justify-center rounded-lg mb-1 transition-transform duration-300 ${
                  active
                    ? `bg-gradient-to-tr ${p.color} text-white shadow-sm`
                    : "bg-slate-200/80 text-slate-600"
                }`}
              >
                <Icon className="size-3.5" />
              </div>
              <span className="text-[11px] leading-tight truncate w-full px-0.5">
                {p.label}
              </span>
              {active && (
                <span className="absolute -bottom-0.5 size-1 rounded-full bg-primary" />
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
