import { useState } from "react";
import { Pencil, Plus, X, RefreshCw, Shield, Lock, Power } from "lucide-react";
import { Toaster, toast } from "sonner";
import type { Role as AppRole } from "./Login";
import { NotificationBell } from "./NotificationBell";

type RoleId = "none" | "owner" | "operations" | "sales" | "accounting" | "production" | "warehouse" | "logistics";

const roles: { id: RoleId; label: string; desc: string; bg: string; fg: string; cardBg: string; cardFg: string; cardBorder?: string }[] = [
  { id: "none",       label: "No Role",              desc: "Cannot access the system",                          bg: "#E2E8F0", fg: "#475569", cardBg: "#FFFFFF", cardFg: "#0F172A", cardBorder: "#CBD5E1" },
  { id: "owner",      label: "Owner / CEO",          desc: "Full system access · only Owner can edit Owner",    bg: "#FEF3C7", fg: "#92400E", cardBg: "#C9A84C", cardFg: "#FFFFFF" },
  { id: "operations", label: "Operations Manager",   desc: "Full operational access across all modules",        bg: "#FEE2E2", fg: "#991B1B", cardBg: "#C8102E", cardFg: "#FFFFFF" },
  { id: "sales",      label: "Sales Manager",        desc: "Sales pipeline, quotations, client management",     bg: "#FFE4E6", fg: "#9F1239", cardBg: "#E11D48", cardFg: "#FFFFFF" },
  { id: "accounting", label: "Accounting Secretary", desc: "Payments Ledger, receipts, overdue tracking",       bg: "#DCFCE7", fg: "#166534", cardBg: "#16A34A", cardFg: "#FFFFFF" },
  { id: "production", label: "Production Manager",   desc: "Production Floor full · stage updates · JO files",  bg: "#DBEAFE", fg: "#1D4ED8", cardBg: "#1A2B4A", cardFg: "#FFFFFF" },
  { id: "warehouse",  label: "Warehouse Staff",      desc: "Inventory, Waybill Scanner, stage marking",         bg: "#E2E8F0", fg: "#475569", cardBg: "#64748B", cardFg: "#FFFFFF" },
  { id: "logistics",  label: "Logistics Personnel",  desc: "Logistics and dispatch tracking",                     bg: "#FFEDD5", fg: "#9A3412", cardBg: "#D97706", cardFg: "#FFFFFF" },
];

interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  initials: string;
  role: RoleId;
  joined: string;
  active: boolean;
  emailAlerts: boolean;
}

const initialUsers: User[] = [
  { id: "u0", name: "T. Mendoza",  email: "owner@enter-fil.com",      phone: "+63 917 100 0000", initials: "TM", role: "owner",      joined: "Jan 15, 2024", active: true,  emailAlerts: true  },
  { id: "u1", name: "M. Aquino",   email: "ops@enter-fil.com",        phone: "+63 917 200 0000", initials: "MA", role: "operations", joined: "Apr 2, 2026",  active: true,  emailAlerts: true  },
  { id: "u2", name: "R. Santos",   email: "sales@enter-fil.com",      phone: "+63 917 300 0000", initials: "RS", role: "sales",      joined: "Apr 2, 2026",  active: true,  emailAlerts: true  },
  { id: "u3", name: "L. Cruz",     email: "finance@enter-fil.com",    phone: "+63 917 400 0000", initials: "LC", role: "accounting", joined: "Apr 2, 2026",  active: true,  emailAlerts: true  },
  { id: "u4", name: "J. Reyes",    email: "production@enter-fil.com", phone: "+63 917 500 0000", initials: "JR", role: "production", joined: "Apr 2, 2026",  active: true,  emailAlerts: true  },
  { id: "u5", name: "F. Santos",   email: "warehouse@enter-fil.com",  phone: "+63 917 600 0000", initials: "FS", role: "warehouse",  joined: "Apr 2, 2026",  active: true,  emailAlerts: false },
  { id: "u6", name: "P. Tan",      email: "logistics@enter-fil.com",  phone: "+63 917 700 0000", initials: "PT", role: "logistics",  joined: "Apr 2, 2026",  active: true,  emailAlerts: true  },
  { id: "u7", name: "A. Garcia",   email: "alicia@enter-fil.com",     phone: "—",                initials: "AG", role: "none",       joined: "Apr 3, 2026",  active: false, emailAlerts: false },
];

function RoleBadge({ role }: { role: RoleId }) {
  const r = roles.find((x) => x.id === role)!;
  return (
    <span
      className="font-dm px-2.5 py-1 rounded-full"
      style={{ fontSize: 11, fontWeight: 600, backgroundColor: r.bg, color: r.fg }}
    >
      {r.label}
    </span>
  );
}

function generateTempPassword(): string {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$";
  let pwd = "";
  for (let i = 0; i < 12; i++) {
    pwd += chars[Math.floor(Math.random() * chars.length)];
  }
  return pwd;
}

export function UserManagement({ currentRole = "operations" }: { currentRole?: AppRole } = {}) {
  const [users, setUsers] = useState<User[]>(initialUsers);
  const [editingId, setEditingId] = useState<string | null>(null);
  const editing = users.find((u) => u.id === editingId);
  const [draft, setDraft] = useState<RoleId>("none");

  const canManageOwner = currentRole === "owner";
  const isProtected = (u: User) => u.role === "owner" && !canManageOwner;

  const toggleActive = (u: User) => {
    if (isProtected(u)) {
      toast.error("Only the Owner can deactivate the Owner account");
      return;
    }
    setUsers((prev) => prev.map((x) => (x.id === u.id ? { ...x, active: !x.active } : x)));
    toast.success(u.active ? `${u.name} deactivated` : `${u.name} reactivated`);
  };

  const toggleEmailAlerts = (u: User) => {
    setUsers((prev) => prev.map((x) => (x.id === u.id ? { ...x, emailAlerts: !x.emailAlerts } : x)));
    toast.success(`Email alerts ${u.emailAlerts ? "disabled" : "enabled"} for ${u.name}`);
  };

  // Add User modal state
  const [showAddUser, setShowAddUser] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newRole, setNewRole] = useState<RoleId>("none");
  const [tempPassword, setTempPassword] = useState(() => generateTempPassword());

  /* Editable fields besides role */
  const [draftName, setDraftName] = useState("");
  const [draftEmail, setDraftEmail] = useState("");
  const [draftPhone, setDraftPhone] = useState("");

  const openEdit = (u: User) => {
    if (isProtected(u)) {
      toast.error("Only the Owner can edit the Owner account");
      return;
    }
    setEditingId(u.id);
    setDraft(u.role);
    setDraftName(u.name);
    setDraftEmail(u.email);
    setDraftPhone(u.phone ?? "");
  };

  const save = () => {
    if (!editing) return;
    if (!draftName.trim()) { toast.error("Name is required"); return; }
    if (!draftEmail.trim()) { toast.error("Email is required"); return; }
    const initials = draftName.trim().split(" ").map((s) => s[0].toUpperCase()).slice(0, 2).join("");
    setUsers((prev) => prev.map((u) => (u.id === editing.id ? {
      ...u,
      role: draft,
      name: draftName.trim(),
      email: draftEmail.trim(),
      phone: draftPhone.trim() || "—",
      initials,
    } : u)));
    toast.success("User updated", { description: `${draftName.trim()} · ${roles.find((r) => r.id === draft)!.label}` });
    setEditingId(null);
  };

  const openAddUser = () => {
    setNewName("");
    setNewEmail("");
    setNewRole("none");
    setTempPassword(generateTempPassword());
    setShowAddUser(true);
  };

  const createUser = () => {
    if (!newName.trim()) { toast.error("Full name is required"); return; }
    if (!newEmail.trim()) { toast.error("Email is required"); return; }
    const initials = newName.trim().split(" ").map((s) => s[0].toUpperCase()).slice(0, 2).join("");
    const newUser: User = {
      id: `u${Date.now()}`,
      name: newName.trim(),
      email: newEmail.trim(),
      phone: "—",
      initials,
      role: newRole,
      joined: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
      active: true,
      emailAlerts: true,
    };
    setUsers((prev) => [...prev, newUser]);
    toast.success("Account created", { description: `Invite sent to ${newEmail.trim()}` });
    setShowAddUser(false);
  };

  return (
    <div className="flex-1 h-full overflow-auto" style={{ backgroundColor: "#F4F6F9" }}>
      <Toaster position="bottom-right" richColors />

      <header className="bg-white border-b border-slate-200/70 px-8 py-5 sticky top-0 z-10 flex items-start justify-between">
        <div>
          <h1 className="font-syne" style={{ fontSize: 28, fontWeight: 800, color: "#0F172A", lineHeight: 1.1 }}>
            User Management
          </h1>
          <p className="font-dm mt-1" style={{ fontSize: 13, color: "#64748B" }}>
            Manage user accounts and assign roles to control module access across the ERP system.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={openAddUser}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-white font-dm hover:opacity-90"
            style={{ backgroundColor: "#C8102E", fontSize: 13, fontWeight: 700, letterSpacing: 0.3 }}
          >
            <Plus size={15} strokeWidth={2.5} /> Add User
          </button>
          <NotificationBell />
        </div>
      </header>

      <div className="px-8 py-8 flex flex-col gap-8">
        {/* Role Access Matrix */}
        <section>
          <h2 className="font-syne mb-4" style={{ fontSize: 22, fontWeight: 700, color: "#0F172A" }}>
            Role Access Matrix
          </h2>
          <div className="grid grid-cols-4 gap-4">
            {roles.map((r) => (
              <div
                key={r.id}
                className="rounded-xl p-4 flex flex-col gap-2"
                style={{
                  backgroundColor: r.cardBg,
                  color: r.cardFg,
                  border: r.cardBorder ? `1px solid ${r.cardBorder}` : "none",
                  boxShadow: "0 1px 2px rgba(15,23,42,0.04)",
                  minHeight: 130,
                }}
              >
                <span
                  className="font-dm self-start px-2 py-0.5 rounded-full flex items-center gap-1"
                  style={{ fontSize: 10, fontWeight: 700, backgroundColor: r.bg, color: r.fg, letterSpacing: 0.4 }}
                >
                  {r.id === "owner" && <Shield size={10} />}
                  {r.label}
                </span>
                <div className="font-syne" style={{ fontSize: 14, fontWeight: 700 }}>{r.label}</div>
                <div className="font-dm" style={{ fontSize: 11, opacity: r.id === "none" ? 0.7 : 0.9, lineHeight: 1.4 }}>
                  {r.desc}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* All Users */}
        <section>
          <div className="flex items-center justify-between mb-1">
            <h2 className="font-syne" style={{ fontSize: 22, fontWeight: 700, color: "#0F172A" }}>
              All Users ({users.length})
            </h2>
          </div>
          <p className="font-dm mt-1 mb-4" style={{ fontSize: 13, color: "#64748B" }}>
            Click "Edit" to assign or change a user's access level and notification preferences.
          </p>

          <div
            className="bg-white rounded-xl border border-slate-200/70 overflow-hidden"
            style={{ boxShadow: "0 1px 2px rgba(15,23,42,0.04)" }}
          >
            <table className="w-full">
              <thead style={{ backgroundColor: "#F4F6F9" }}>
                <tr>
                  {/* Section J — remove "Email Alerts" column from main table; toggle moves to Edit modal */}
                  {["User", "Email", "Initials", "Current Role", "Status", "Joined", "Actions"].map((h) => (
                    <th
                      key={h}
                      className="font-dm text-left px-4 py-3"
                      style={{ fontSize: 11, fontWeight: 600, color: "#64748B", letterSpacing: 0.4, textTransform: "uppercase" }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.map((u) => {
                  const protectedRow = isProtected(u);
                  return (
                    <tr key={u.id} className="border-t border-slate-200/70 hover:bg-slate-50" style={{ opacity: u.active ? 1 : 0.55 }}>
                      <td className="px-4 py-3 font-dm flex items-center gap-2" style={{ fontSize: 14, fontWeight: 600, color: "#0F172A" }}>
                        {u.name}
                        {u.role === "owner" && <Shield size={12} style={{ color: "#C9A84C" }} />}
                      </td>
                      <td className="px-4 py-3 font-dm" style={{ fontSize: 13, color: "#475569" }}>{u.email}</td>
                      <td className="px-4 py-3">
                        <div className="w-9 h-9 rounded-full flex items-center justify-center font-syne text-white" style={{ backgroundColor: "#1A2B4A", fontSize: 12, fontWeight: 700 }}>{u.initials}</div>
                      </td>
                      <td className="px-4 py-3"><RoleBadge role={u.role} /></td>
                      <td className="px-4 py-3">
                        <span className="font-dm px-2 py-0.5 rounded-full" style={{ fontSize: 11, fontWeight: 600, backgroundColor: u.active ? "#DCFCE7" : "#E2E8F0", color: u.active ? "#15803D" : "#64748B" }}>
                          {u.active ? "Active" : "Deactivated"}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-dm" style={{ fontSize: 13, color: "#475569" }}>{u.joined}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => openEdit(u)}
                            disabled={protectedRow}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-slate-200 hover:bg-slate-50 font-dm disabled:opacity-40 disabled:cursor-not-allowed"
                            style={{ fontSize: 12, fontWeight: 600, color: "#0F172A" }}
                            title={protectedRow ? "Only the Owner can edit this account" : ""}
                          >
                            {protectedRow ? <Lock size={12} /> : <Pencil size={12} />} Edit
                          </button>
                          <button
                            onClick={() => toggleActive(u)}
                            disabled={protectedRow}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md font-dm border disabled:opacity-40 disabled:cursor-not-allowed"
                            style={{
                              fontSize: 12, fontWeight: 600,
                              borderColor: u.active ? "#FECACA" : "#BBF7D0",
                              color: u.active ? "#C8102E" : "#15803D",
                              backgroundColor: u.active ? "#FEF2F2" : "#F0FDF4",
                            }}
                          >
                            <Power size={12} /> {u.active ? "Deactivate" : "Reactivate"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {/* ─── Add User Modal ─── */}
      {showAddUser && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: "rgba(15,23,42,0.5)" }}
          onClick={() => setShowAddUser(false)}
        >
          <div
            className="bg-white rounded-xl w-full max-w-lg overflow-hidden"
            style={{ boxShadow: "0 20px 40px rgba(0,0,0,0.2)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-5 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-syne" style={{ fontSize: 18, fontWeight: 700, color: "#0F172A" }}>
                Add New User
              </h3>
              <button
                onClick={() => setShowAddUser(false)}
                aria-label="Close"
                className="w-8 h-8 rounded-md hover:bg-slate-100 flex items-center justify-center"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-6 flex flex-col gap-4">
              {/* Full Name */}
              <div className="flex flex-col gap-1.5">
                <label className="font-dm" style={{ fontSize: 12, fontWeight: 600, color: "#475569" }}>
                  Full Name *
                </label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Maria Santos"
                  className="font-dm px-3 py-2.5 rounded-md border border-slate-200 outline-none focus:border-slate-400"
                  style={{ fontSize: 13 }}
                />
              </div>

              {/* Email */}
              <div className="flex flex-col gap-1.5">
                <label className="font-dm" style={{ fontSize: 12, fontWeight: 600, color: "#475569" }}>
                  Email *
                </label>
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="user@enter-fil.com"
                  className="font-dm px-3 py-2.5 rounded-md border border-slate-200 outline-none focus:border-slate-400"
                  style={{ fontSize: 13 }}
                />
              </div>

              {/* Temporary Password */}
              <div className="flex flex-col gap-1.5">
                <label className="font-dm" style={{ fontSize: 12, fontWeight: 600, color: "#475569" }}>
                  Temporary Password <span style={{ color: "#94A3B8", fontWeight: 400 }}>(auto-generated, shown once)</span>
                </label>
                <div className="flex items-center gap-2">
                  <div
                    className="flex-1 font-mono-jb px-3 py-2.5 rounded-md border border-slate-200"
                    style={{ fontSize: 13, backgroundColor: "#F8FAFC", color: "#0F172A", letterSpacing: 1 }}
                  >
                    {tempPassword}
                  </div>
                  <button
                    onClick={() => setTempPassword(generateTempPassword())}
                    className="w-10 h-10 rounded-md border border-slate-200 flex items-center justify-center hover:bg-slate-50"
                    aria-label="Regenerate password"
                    style={{ color: "#64748B" }}
                  >
                    <RefreshCw size={14} />
                  </button>
                </div>
                <p className="font-dm" style={{ fontSize: 11, color: "#94A3B8" }}>
                  Copy this password before sending — it won't be shown again.
                </p>
              </div>

              {/* Role */}
              <div className="flex flex-col gap-2">
                <label className="font-dm" style={{ fontSize: 12, fontWeight: 600, color: "#475569" }}>
                  Role
                </label>
                <div className="flex flex-col gap-2 max-h-[320px] overflow-auto pr-1">
                  {roles
                    .filter(r => r.id !== "owner" || canManageOwner)
                    .map((r) => {
                    const active = newRole === r.id;
                    return (
                      <label
                        key={r.id}
                        className="flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-colors"
                        style={{
                          border: active ? "2px solid #C8102E" : "1px solid #CBD5E1",
                          backgroundColor: active ? "#FEF2F2" : "#FFFFFF",
                          padding: active ? 11 : 12,
                        }}
                      >
                        <input
                          type="radio"
                          name="newRole"
                          checked={active}
                          onChange={() => setNewRole(r.id)}
                          style={{ accentColor: "#C8102E", marginTop: 3 }}
                        />
                        <div className="flex-1">
                          <div className="font-dm flex items-center gap-1" style={{ fontSize: 13, fontWeight: 600, color: "#0F172A" }}>
                            {r.id === "owner" && <Shield size={11} style={{ color: "#C9A84C" }} />}
                            {r.label}
                          </div>
                          <div className="font-dm" style={{ fontSize: 12, color: "#64748B" }}>
                            {r.desc}
                          </div>
                        </div>
                      </label>
                    );
                  })}
                </div>
                {!canManageOwner && (
                  <div className="rounded-md px-3 py-2 mt-1 font-dm" style={{ fontSize: 11, color: "#92400E", backgroundColor: "#FFFBEB", border: "1px solid #FDE68A" }}>
                    🔒 Only the Owner / CEO can create another Owner account.
                  </div>
                )}
              </div>

              {/* Create Button */}
              <button
                onClick={createUser}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-md text-white font-dm hover:opacity-90"
                style={{ backgroundColor: "#C8102E", fontSize: 13, fontWeight: 700, letterSpacing: 0.4 }}
              >
                ✉ Create Account &amp; Send Invite
              </button>

              <p className="font-dm text-center" style={{ fontSize: 12, color: "#64748B" }}>
                User will receive an email with their temporary password and login instructions.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ─── Edit Role Modal ─── */}
      {editing && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: "rgba(15,23,42,0.5)" }}
          onClick={() => setEditingId(null)}
        >
          <div
            className="bg-white rounded-xl w-full max-w-lg overflow-hidden"
            style={{ boxShadow: "0 20px 40px rgba(0,0,0,0.2)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-5 border-b border-slate-200 flex items-center justify-between" style={{ backgroundColor: "#1A2B4A" }}>
              <div>
                <h3 className="font-syne text-white" style={{ fontSize: 18, fontWeight: 700 }}>
                  Edit User — {editing.name}
                </h3>
                <p className="font-dm mt-0.5" style={{ fontSize: 12, color: "rgba(255,255,255,0.6)" }}>
                  Update name, email, phone, or role · changes apply immediately
                </p>
              </div>
              <button onClick={() => setEditingId(null)} aria-label="Close" className="w-8 h-8 rounded-md hover:bg-white/10 flex items-center justify-center">
                <X size={16} style={{ color: "white" }} aria-hidden />
              </button>
            </div>

            <div className="p-6 flex flex-col gap-4 max-h-[60vh] overflow-auto">
              {/* User Details */}
              <div className="rounded-lg p-4" style={{ backgroundColor: "#F8FAFC", border: "1px solid #E2E8F0" }}>
                <div className="font-dm mb-3" style={{ fontSize: 11, fontWeight: 700, color: "#475569", letterSpacing: 0.4, textTransform: "uppercase" }}>User Details</div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <label className="font-dm" style={{ fontSize: 12, fontWeight: 600, color: "#475569" }}>Full Name *</label>
                    <input value={draftName} onChange={(e) => setDraftName(e.target.value)} className="font-dm px-3 py-2 rounded-md border border-slate-200 outline-none focus:border-slate-400 bg-white" style={{ fontSize: 13 }} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="font-dm" style={{ fontSize: 12, fontWeight: 600, color: "#475569" }}>Email *</label>
                    <input value={draftEmail} onChange={(e) => setDraftEmail(e.target.value)} type="email" className="font-dm px-3 py-2 rounded-md border border-slate-200 outline-none focus:border-slate-400 bg-white" style={{ fontSize: 13 }} />
                  </div>
                  <div className="flex flex-col gap-1.5 col-span-2">
                    <label className="font-dm" style={{ fontSize: 12, fontWeight: 600, color: "#475569" }}>Phone</label>
                    <input value={draftPhone} onChange={(e) => setDraftPhone(e.target.value)} placeholder="+63..." className="font-dm px-3 py-2 rounded-md border border-slate-200 outline-none focus:border-slate-400 bg-white" style={{ fontSize: 13 }} />
                  </div>
                </div>
              </div>

              {/* Section J — Email Alerts toggle moved into Edit modal */}
              <div className="rounded-lg p-3 flex items-center justify-between" style={{ backgroundColor: "#EFF6FF", border: "1px solid #BFDBFE" }}>
                <div>
                  <div className="font-dm" style={{ fontSize: 13, fontWeight: 600, color: "#1E3A8A" }}>Email Alerts</div>
                  <div className="font-dm" style={{ fontSize: 11, color: "#1E40AF" }}>Receive in-app + email notifications for events targeting this role.</div>
                </div>
                <button
                  onClick={() => editing && toggleEmailAlerts(editing)}
                  className="relative w-12 h-6 rounded-full transition-colors"
                  style={{ backgroundColor: editing.emailAlerts ? "#2563EB" : "#CBD5E1" }}
                  title={editing.emailAlerts ? "Email ON" : "Email OFF"}
                >
                  <span className="absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all" style={{ left: editing.emailAlerts ? 26 : 2, boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }} />
                </button>
              </div>

              {/* Role */}
              <div>
                <div className="font-dm mb-2" style={{ fontSize: 11, fontWeight: 700, color: "#475569", letterSpacing: 0.4, textTransform: "uppercase" }}>Role</div>
                <div className="flex flex-col gap-2">
                  {roles
                    .filter(r => r.id !== "owner" || canManageOwner)
                    .map((r) => {
                    const active = draft === r.id;
                    return (
                      <label
                        key={r.id}
                        className="flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-colors"
                        style={{
                          border: active ? "2px solid #C8102E" : "1px solid #CBD5E1",
                          backgroundColor: active ? "#FEF2F2" : "#FFFFFF",
                          padding: active ? 11 : 12,
                        }}
                      >
                        <input type="radio" name="role" checked={active} onChange={() => setDraft(r.id)} style={{ accentColor: "#C8102E", marginTop: 3 }} />
                        <div className="flex-1">
                          <div className="font-dm flex items-center gap-1" style={{ fontSize: 13, fontWeight: 600, color: "#0F172A" }}>
                            {r.id === "owner" && <Shield size={11} style={{ color: "#C9A84C" }} />}
                            {r.label}
                          </div>
                          <div className="font-dm" style={{ fontSize: 12, color: "#64748B" }}>{r.desc}</div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-end gap-3">
              <button
                onClick={() => setEditingId(null)}
                className="font-dm px-4 py-2 rounded-md hover:bg-slate-100"
                style={{ fontSize: 13, fontWeight: 600, color: "#475569" }}
              >
                Cancel
              </button>
              <button
                onClick={save}
                className="font-dm px-4 py-2 rounded-md text-white hover:opacity-90"
                style={{ backgroundColor: "#C8102E", fontSize: 13, fontWeight: 700 }}
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
