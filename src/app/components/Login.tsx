import { useState } from "react";
import { ArrowRight } from "lucide-react";

export type Role =
  | "owner"
  | "operations"
  | "sales"
  | "accounting"
  | "production"
  | "warehouse"
  | "logistics"
  | "client";

export interface RoleMeta {
  label: string;
  short: string;
  bg: string;
  fg: string;
  avatarBg: string;
}

export const roleMetas: Record<Role, RoleMeta> = {
  owner:      { label: "Owner / CEO",          short: "OW", bg: "#FEF3C7", fg: "#92400E", avatarBg: "#C9A84C" },
  operations: { label: "Operations Manager",   short: "OP", bg: "#FEE2E2", fg: "#991B1B", avatarBg: "#C8102E" },
  sales:      { label: "Sales Manager",        short: "SM", bg: "#FFE4E6", fg: "#9F1239", avatarBg: "#E11D48" },
  accounting: { label: "Accounting Secretary", short: "AC", bg: "#DCFCE7", fg: "#166534", avatarBg: "#16A34A" },
  production: { label: "Production Manager",   short: "PM", bg: "#DBEAFE", fg: "#1D4ED8", avatarBg: "#1A2B4A" },
  warehouse:  { label: "Warehouse Staff",      short: "WH", bg: "#E2E8F0", fg: "#475569", avatarBg: "#64748B" },
  logistics:  { label: "Logistics Personnel",  short: "LG", bg: "#FFEDD5", fg: "#9A3412", avatarBg: "#D97706" },
  client:     { label: "Client",               short: "CL", bg: "#EFF6FF", fg: "#1E40AF", avatarBg: "#2563EB" },
};

export const staffAccounts: { email: string; password: string; role: Role; name: string }[] = [
  { email: "owner@enter-fil.com",     password: "demo", role: "owner",      name: "T. Mendoza" },
  { email: "ops@enter-fil.com",       password: "demo", role: "operations", name: "M. Aquino" },
  { email: "sales@enter-fil.com",     password: "demo", role: "sales",      name: "R. Santos" },
  { email: "finance@enter-fil.com",   password: "demo", role: "accounting", name: "L. Cruz" },
  { email: "production@enter-fil.com",password: "demo", role: "production", name: "J. Reyes" },
  { email: "warehouse@enter-fil.com", password: "demo", role: "warehouse",  name: "F. Santos" },
  { email: "logistics@enter-fil.com", password: "demo", role: "logistics",  name: "P. Tan" },
];

const clientAccounts: { email: string; password: string; role: Role; name: string }[] = [
  { email: "client@be-aerospace.com", password: "demo", role: "client", name: "B.E. Aerospace" },
];

interface Props {
  onLogin: (role: Role, name: string) => void;
}

export function Login({ onLogin }: Props) {
  const [page, setPage] = useState<"staff" | "client">("staff");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const pool = page === "staff" ? staffAccounts : clientAccounts;
    const match = pool.find((a) => a.email === email && a.password === password);
    if (!match) { setError("Invalid credentials. Try a demo account below."); return; }
    onLogin(match.role, match.name);
  };

  const quickLogin = (acct: typeof staffAccounts[0]) => onLogin(acct.role, acct.name);

  const switchPage = (p: "staff" | "client") => {
    setPage(p); setEmail(""); setPassword(""); setError("");
  };

  /* ─── STAFF LOGIN ─── */
  if (page === "staff") {
    return (
      <div className="size-full overflow-y-auto flex items-center justify-center font-dm py-6 px-4" style={{ backgroundColor: "#0D1B2E", minHeight: "100vh" }}>
        <div className="w-full max-w-[480px] my-auto" style={{ boxShadow: "0 24px 64px rgba(0,0,0,0.5)" }}>
          <div className="rounded-t-2xl px-6 py-5 sm:px-8 sm:py-7" style={{ backgroundColor: "#1A2B4A" }}>
            <div className="flex items-center gap-3 mb-5">
              <span style={{ fontSize: 30, color: "#C8102E", fontWeight: 800 }}>▲</span>
              <div>
                <div className="font-syne" style={{ fontSize: 20, fontWeight: 800, color: "white", lineHeight: 1, letterSpacing: 0.5 }}>ENTER-FLOW</div>
                <div className="font-dm" style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", letterSpacing: 0.6 }}>ERP System</div>
              </div>
            </div>
            <div className="font-syne" style={{ fontSize: 22, fontWeight: 700, color: "white", lineHeight: 1.1 }}>Staff Login</div>
            <p className="font-dm mt-1" style={{ fontSize: 13, color: "rgba(255,255,255,0.55)" }}>Access your ERP workspace.</p>
          </div>

          <div className="rounded-b-2xl bg-white px-6 py-5 sm:px-8 sm:py-6">
            <form onSubmit={submit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="font-dm" style={{ fontSize: 12, fontWeight: 600, color: "#475569" }}>Email</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@enter-fil.com"
                  className="font-dm px-3 py-2.5 rounded-md border border-slate-200 outline-none focus:border-slate-400"
                  style={{ fontSize: 13 }} autoComplete="email" />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="font-dm" style={{ fontSize: 12, fontWeight: 600, color: "#475569" }}>Password</label>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                  className="font-dm px-3 py-2.5 rounded-md border border-slate-200 outline-none focus:border-slate-400"
                  style={{ fontSize: 13 }} autoComplete="current-password" />
              </div>

              {error && (
                <div className="font-dm rounded-md px-3 py-2" style={{ fontSize: 12, color: "#991B1B", backgroundColor: "#FEF2F2", border: "1px solid #FECACA" }}>{error}</div>
              )}

              <button type="submit" className="flex items-center justify-center gap-2 py-3 rounded-md text-white font-dm hover:opacity-90 mt-1"
                style={{ backgroundColor: "#C8102E", fontSize: 13, fontWeight: 700, letterSpacing: 0.5 }}>
                Sign In <ArrowRight size={15} strokeWidth={2.5} />
              </button>

              <button type="button" className="font-dm text-center hover:underline" style={{ fontSize: 12, color: "#94A3B8" }}>Forgot password?</button>
            </form>

            {/* Demo Accounts */}
            <div className="mt-5 pt-5 border-t border-slate-200">
              <div className="font-dm mb-2" style={{ fontSize: 11, fontWeight: 700, color: "#64748B", letterSpacing: 0.5, textTransform: "uppercase" }}>
                Demo accounts (8 staff roles)
              </div>
              <div className="grid grid-cols-2 gap-2">
                {staffAccounts.map((a) => {
                  const m = roleMetas[a.role];
                  return (
                    <button
                      key={a.role}
                      onClick={() => quickLogin(a)}
                      className="font-dm px-3 py-2 rounded-md border border-slate-200 hover:bg-slate-50 text-left flex items-center gap-2"
                      style={{ fontSize: 12, fontWeight: 600, color: "#0F172A" }}
                      aria-label={`Sign in as ${m.label}`}
                    >
                      <span className="px-1.5 py-0.5 rounded font-syne" style={{ fontSize: 9, fontWeight: 800, backgroundColor: m.bg, color: m.fg }}>{m.short}</span>
                      <span className="truncate">{m.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-slate-200 text-center">
              <button onClick={() => switchPage("client")} className="font-dm hover:underline" style={{ fontSize: 12, color: "#64748B" }}>
                Client? Access your portal <span style={{ color: "#C8102E", fontWeight: 600 }}>→</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ─── CLIENT LOGIN ─── */
  return (
    <div className="size-full overflow-y-auto flex items-center justify-center font-dm py-6 px-4" style={{ backgroundColor: "#F4F6F9", minHeight: "100vh" }}>
      <div className="w-full max-w-[440px] bg-white rounded-2xl overflow-hidden my-auto" style={{ boxShadow: "0 10px 40px rgba(15,23,42,0.1)", border: "1px solid #E2E8F0" }}>
        <div className="px-8 pt-8 pb-6 border-b border-slate-200">
          <div className="flex items-center gap-3 mb-5">
            <span style={{ fontSize: 30, color: "#C8102E", fontWeight: 800 }}>▲</span>
            <div>
              <div className="font-syne" style={{ fontSize: 18, fontWeight: 800, color: "#0F172A", lineHeight: 1 }}>ENTER-FIL</div>
              <div className="font-dm" style={{ fontSize: 11, color: "#64748B", letterSpacing: 0.5 }}>Industrial Products · Client Portal</div>
            </div>
          </div>
          <div className="font-syne" style={{ fontSize: 22, fontWeight: 700, color: "#0F172A", lineHeight: 1.1 }}>Access Portal</div>
          <p className="font-dm mt-1" style={{ fontSize: 13, color: "#64748B" }}>Track your orders, status, and invoices.</p>
        </div>

        <div className="px-8 py-6">
          <form onSubmit={submit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="font-dm" style={{ fontSize: 12, fontWeight: 600, color: "#475569" }}>Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@yourcompany.com"
                className="font-dm px-3 py-2.5 rounded-md border border-slate-200 outline-none focus:border-slate-400" style={{ fontSize: 13 }} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="font-dm" style={{ fontSize: 12, fontWeight: 600, color: "#475569" }}>Password</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                className="font-dm px-3 py-2.5 rounded-md border border-slate-200 outline-none focus:border-slate-400" style={{ fontSize: 13 }} />
            </div>

            {error && (
              <div className="font-dm rounded-md px-3 py-2" style={{ fontSize: 12, color: "#991B1B", backgroundColor: "#FEF2F2", border: "1px solid #FECACA" }}>{error}</div>
            )}

            <button type="submit" className="flex items-center justify-center gap-2 py-3 rounded-md text-white font-dm hover:opacity-90 mt-1"
              style={{ backgroundColor: "#C8102E", fontSize: 13, fontWeight: 700, letterSpacing: 0.5 }}>
              Access Portal <ArrowRight size={15} strokeWidth={2.5} />
            </button>
          </form>

          <div className="mt-5 pt-5 border-t border-slate-200">
            <div className="font-dm mb-2" style={{ fontSize: 11, fontWeight: 700, color: "#64748B", letterSpacing: 0.5, textTransform: "uppercase" }}>Demo account</div>
            <div className="flex flex-col gap-2">
              {clientAccounts.map((a) => (
                <button key={a.role} onClick={() => quickLogin(a)}
                  className="font-dm px-3 py-2.5 rounded-md border border-slate-200 hover:bg-slate-50 text-left flex items-center justify-between"
                  style={{ fontSize: 12, fontWeight: 600, color: "#0F172A" }}>
                  <span>{a.name}</span>
                  <span style={{ color: "#94A3B8", fontWeight: 400 }}>client@be-aerospace.com</span>
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-slate-200 text-center">
            <button onClick={() => switchPage("staff")} className="font-dm hover:underline" style={{ fontSize: 12, color: "#64748B" }}>
              Enter-Fil staff? <span style={{ color: "#1A2B4A", fontWeight: 600 }}>Sign in here →</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
