import { useRef, useState } from "react";
import { api } from "../api/client";
import { ArrowRight } from "lucide-react";
import { getAccounts, getClientApplications, hashPassword, saveClientApplications, verifyPassword } from "../store/accounts";

export type Role =
  | "owner"
  | "operations"
  | "sales"
  | "accounting"
  | "production"
  | "warehouse"
  | "logistics"
  | "admin"
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
  admin:      { label: "Admin",                short: "AD", bg: "#EDE9FE", fg: "#5B21B6", avatarBg: "#7C3AED" },
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
  { email: "admin@enter-fil.com",     password: "demo", role: "admin",      name: "A. Garcia" },
];

export const clientAccounts: { email: string; password: string; role: Role; name: string }[] = [
  { email: "client@be-aerospace.com", password: "demo", role: "client", name: "B.E. Aerospace" },
];

interface Props {
  onLogin: (role: Role, name: string) => void;
  onRealLogin?: () => Promise<void>;
  sessionError?: string;
}

export function createDemoQuickLoginHandler(
  account: Pick<(typeof staffAccounts)[number], "email" | "role" | "name">,
  options: {
    isEnabled: () => boolean;
    readAccounts: typeof getAccounts;
    onLogin: (role: Role, name: string) => void;
    onUnavailable: (message: string) => void;
  }
) {
  return () => {
    if (!options.isEnabled()) return;
    let accounts;
    try {
      accounts = options.readAccounts();
    } catch {
      options.onUnavailable("Demo account data is unavailable.");
      return;
    }
    const saved = accounts.find((candidate) =>
      candidate.email.toLocaleLowerCase() === account.email.toLocaleLowerCase()
      && candidate.type === (account.role === "client" ? "client" : "employee")
    );
    if (saved && !saved.active) {
      options.onUnavailable("This account is deactivated.");
      return;
    }
    // The fixed Demo preset determines the workspace; local state only
    // blocks an account explicitly marked inactive.
    options.onLogin(account.role, account.name);
  };
}

export function Login({ onLogin, onRealLogin, sessionError }: Props) {
  const [mode,setMode]=useState<"real"|"demo">("real");
  const [busy,setBusy]=useState(false);
  const submitLocked=useRef(false);
  const [fieldErrors,setFieldErrors]=useState<Record<string,string>>({});
  const [page, setPage] = useState<"staff" | "client">("staff");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isRegistering, setIsRegistering] = useState(false);
  const [registration, setRegistration] = useState({ companyName: "", contactPerson: "", phone: "", username: "" });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if(busy||submitLocked.current)return;
    setError('');setFieldErrors({});
    if(mode==='real') {
      submitLocked.current=true;setBusy(true);
      try {
        if(page==='client' && isRegistering) {
          await api('/api/auth/register',{public:true,method:'POST',body:{companyName:registration.companyName.trim(),contactPerson:registration.contactPerson.trim(),phone:registration.phone.trim(),username:registration.username.trim(),email:email.trim(),password}});
          setPassword('');setIsRegistering(false);setRegistration({companyName:'',contactPerson:'',phone:'',username:''});
          setError('Application submitted. Enter-Fil staff will review your registration.');
        } else {
          await api('/api/auth/login',{public:true,method:'POST',body:{identifier:email.trim(),password}});
          setPassword('');await onRealLogin?.();
        }
      } catch(cause) {const failure=cause as {message?:string;errors?:Record<string,string>};setError(failure.message??'Service unavailable.');setFieldErrors(failure.errors??{});}
      finally {submitLocked.current=false;setBusy(false);}
      return;
    }
    if(!import.meta.env.DEV)return;
    const normalizedEmail = email.trim().toLocaleLowerCase();
    if (page === "client" && isRegistering) {
      const companyName = registration.companyName.trim();
      const contactPerson = registration.contactPerson.trim();
      const username = registration.username.trim();
      const phone = registration.phone.trim();
      if (!companyName || !contactPerson || !username || !email.trim() || !password) {
        setError("Company, contact person, email, username, and password are required.");
        return;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
        setError("Enter a valid email address.");
        return;
      }
      const accounts = getAccounts();
      const applications = getClientApplications();
      if (accounts.some((account) =>
        account.email.toLocaleLowerCase() === normalizedEmail
        || account.username.toLocaleLowerCase() === username.toLocaleLowerCase()
        || (account.type === "client" && account.name.trim().toLocaleLowerCase() === companyName.toLocaleLowerCase())
      ) || applications.some((application) =>
        application.status === "pending" && (
          application.email.toLocaleLowerCase() === normalizedEmail
          || application.username.toLocaleLowerCase() === username.toLocaleLowerCase()
          || application.companyName.trim().toLocaleLowerCase() === companyName.toLocaleLowerCase()
        )
      )) {
        setError("An account or pending application already uses this company, email address, or username.");
        return;
      }
      submitLocked.current=true;setBusy(true);
      try {
        const passwordHash = await hashPassword(password);
        saveClientApplications([...applications, {
          id: crypto.randomUUID(),
          companyName,
          contactPerson,
          email: normalizedEmail,
          username,
          phone,
          passwordHash,
          submittedAt: new Date().toISOString(),
          status: "pending",
        }]);
        setIsRegistering(false);
        setEmail("");
        setPassword("");
        setRegistration({ companyName: "", contactPerson: "", phone: "", username: "" });
        setError("Application submitted. Enter-Fil staff will review your registration.");
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Unable to submit your application.");
      } finally {submitLocked.current=false;setBusy(false);}
      return;
    }
    const match = getAccounts().find((account) =>
      account.type === (page === "staff" ? "employee" : "client")
      && account.active
      && (account.email.toLocaleLowerCase() === normalizedEmail
        || account.username.toLocaleLowerCase() === email.trim().toLocaleLowerCase())
    );
    let validCredentials = false;
    try {
      validCredentials = match ? await verifyPassword(match, password) : false;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to verify credentials.");
      return;
    }
    if (!match || !validCredentials) { setError("Invalid credentials."); return; }
    onLogin(match.role, match.name);
  };

  const quickLogin = (acct: { email: string; password: string; role: Role; name: string }) => {
    createDemoQuickLoginHandler(acct, {
      isEnabled: () => import.meta.env.DEV && !busy && !submitLocked.current,
      readAccounts: getAccounts,
      onLogin: (role, name) => {setMode("demo");setError("");setFieldErrors({});onLogin(role, name);},
      onUnavailable: setError,
    })();
  };

  const switchPage = (p: "staff" | "client") => {
    setPage(p); setEmail(""); setPassword(""); setError(""); setIsRegistering(false);
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
              {sessionError&&<p role="alert" className="text-sm text-red-700">{sessionError}</p>}
              {Object.keys(fieldErrors).length>0&&<div role="alert" className="rounded border border-red-200 p-3 text-xs text-red-700">{Object.entries(fieldErrors).map(([key,value])=><p key={key}>{key}: {value}</p>)}</div>}
              <div className="flex flex-col gap-1.5">
                <label className="font-dm" style={{ fontSize: 12, fontWeight: 600, color: "#475569" }}>Email or username</label>
                <input aria-label="Email or username" type="text" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@enter-fil.com"
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

              <button disabled={busy} aria-busy={busy} type="submit" className="flex items-center justify-center gap-2 py-3 rounded-md text-white font-dm hover:opacity-90 mt-1"
                style={{ backgroundColor: "#C8102E", fontSize: 13, fontWeight: 700, letterSpacing: 0.5 }}>
                {busy?"Signing in...":"Sign In"} <ArrowRight size={15} strokeWidth={2.5} />
              </button>

              <button type="button" onClick={()=>setError("Password recovery is not yet available. Contact an authorized administrator.")} className="font-dm text-center hover:underline" style={{ fontSize: 12, color: "#94A3B8" }}>Forgot password?</button>
            </form>

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
          <p className="font-dm mt-1" style={{ fontSize: 13, color: "#64748B" }}>{isRegistering ? "Submit your company details for account review." : "Track your orders, status, and invoices."}</p>
        </div>

        <div className="px-8 py-6">
          <form onSubmit={submit} className="flex flex-col gap-4">
              {sessionError&&<p role="alert" className="text-sm text-red-700">{sessionError}</p>}
              {Object.keys(fieldErrors).length>0&&<div role="alert" className="rounded border border-red-200 p-3 text-xs text-red-700">{Object.entries(fieldErrors).map(([key,value])=><p key={key}>{key}: {value}</p>)}</div>}
            {isRegistering && (
              <>
                <div className="flex flex-col gap-1.5">
                  <label className="font-dm" style={{ fontSize: 12, fontWeight: 600, color: "#475569" }}>Company name</label>
                  <input required value={registration.companyName} onChange={(e) => setRegistration({ ...registration, companyName: e.target.value })}
                    className="font-dm px-3 py-2.5 rounded-md border border-slate-200 outline-none focus:border-slate-400" style={{ fontSize: 13 }} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="font-dm" style={{ fontSize: 12, fontWeight: 600, color: "#475569" }}>Contact person</label>
                  <input required value={registration.contactPerson} onChange={(e) => setRegistration({ ...registration, contactPerson: e.target.value })}
                    className="font-dm px-3 py-2.5 rounded-md border border-slate-200 outline-none focus:border-slate-400" style={{ fontSize: 13 }} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="font-dm" style={{ fontSize: 12, fontWeight: 600, color: "#475569" }}>Contact number (optional)</label>
                  <input type="tel" value={registration.phone} onChange={(e) => setRegistration({ ...registration, phone: e.target.value })}
                    className="font-dm px-3 py-2.5 rounded-md border border-slate-200 outline-none focus:border-slate-400" style={{ fontSize: 13 }} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="font-dm" style={{ fontSize: 12, fontWeight: 600, color: "#475569" }}>Username</label>
                  <input required value={registration.username} onChange={(e) => setRegistration({ ...registration, username: e.target.value })}
                    className="font-dm px-3 py-2.5 rounded-md border border-slate-200 outline-none focus:border-slate-400" style={{ fontSize: 13 }} />
                </div>
              </>
            )}
            <div className="flex flex-col gap-1.5">
              <label className="font-dm" style={{ fontSize: 12, fontWeight: 600, color: "#475569" }}>Email</label>
              <input aria-label="Email or username" type={isRegistering?"email":"text"} required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@yourcompany.com"
                className="font-dm px-3 py-2.5 rounded-md border border-slate-200 outline-none focus:border-slate-400" style={{ fontSize: 13 }} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="font-dm" style={{ fontSize: 12, fontWeight: 600, color: "#475569" }}>{isRegistering ? "Set password" : "Password"}</label>
              <input type="password" autoComplete={isRegistering?"new-password":"current-password"} required minLength={isRegistering ? 8 : undefined} value={password} onChange={(e) => setPassword(e.target.value)}
                className="font-dm px-3 py-2.5 rounded-md border border-slate-200 outline-none focus:border-slate-400" style={{ fontSize: 13 }} />
            </div>

            {error && (
              <div role="status" className="font-dm rounded-md px-3 py-2" style={{ fontSize: 12, color: error.startsWith("Application submitted") ? "#166534" : "#991B1B", backgroundColor: error.startsWith("Application submitted") ? "#F0FDF4" : "#FEF2F2", border: `1px solid ${error.startsWith("Application submitted") ? "#BBF7D0" : "#FECACA"}` }}>{error}</div>
            )}

            <button disabled={busy} aria-busy={busy} type="submit" className="flex items-center justify-center gap-2 py-3 rounded-md text-white font-dm hover:opacity-90 mt-1"
              style={{ backgroundColor: "#C8102E", fontSize: 13, fontWeight: 700, letterSpacing: 0.5 }}>
              {busy?"Submitting...":isRegistering ? "Submit registration" : "Access Portal"} <ArrowRight size={15} strokeWidth={2.5} />
            </button>
          </form>

          {import.meta.env.DEV && !isRegistering && <div className="mt-5 border-t border-slate-200 pt-5">
            <div className="font-dm mb-2" style={{ fontSize: 11, fontWeight: 700, color: "#64748B", letterSpacing: 0.5, textTransform: "uppercase" }}>Demo Client Access</div>
            <button type="button" disabled={busy} onClick={() => quickLogin(clientAccounts[0])}
              className="font-dm w-full rounded-md border border-slate-200 px-3 py-2.5 text-left hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              style={{ fontSize: 12, fontWeight: 600, color: "#0F172A" }}>
              Enter Demo Client Portal <span className="float-right" style={{ color: "#64748B", fontWeight: 400 }}>{clientAccounts[0].name}</span>
            </button>
          </div>}

            <div className="mt-4 text-center">
              <button type="button" onClick={() => { setIsRegistering((value) => !value); setEmail(""); setPassword(""); setError(""); }}
                className="font-dm hover:underline" style={{ fontSize: 12, color: "#C8102E" }}>
                {isRegistering ? "Already have an account? Sign in" : "New client? Apply for portal access"}
              </button>
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
