import { useState, Fragment } from "react";
import { Save, Building2, Phone, Truck, FileText, Bell, Mail, MessageSquare } from "lucide-react";
import { Toaster, toast } from "sonner";
import { useSettings, type CompanySettings } from "../store/settings";
import { NotificationBell } from "./NotificationBell";

export function Settings() {
  const { settings, update, save } = useSettings();
  const [emailAlerts, setEmailAlerts] = useState(true);
  const [smsAlerts, setSmsAlerts] = useState(false);
  const [emailTriggers, setEmailTriggers] = useState({
    newInquiry: true, quotationSent: true, joCreated: true, stageComplete: false,
    readyForDispatch: true, deliveryConfirmed: true, invoiceOverdue: true,
    paymentCleared: true, lowStock: true, orderCancelled: true, orderRejected: true, rushAdded: true,
  });
  const [smsTriggers, setSmsTriggers] = useState({
    newInquiry: false, quotationSent: false, joCreated: false, stageComplete: false,
    readyForDispatch: false, deliveryConfirmed: true, invoiceOverdue: true,
    paymentCleared: false, lowStock: true, orderCancelled: true, orderRejected: false, rushAdded: true,
  });

  const handleSave = () => {
    save();
    toast.success("Settings saved", { description: "Auto-populated across logistics, portal, and document footers" });
  };

  return (
    <div className="flex-1 h-full overflow-auto" style={{ backgroundColor: "#F4F6F9" }}>
      <Toaster position="bottom-right" richColors />

      <header className="bg-white border-b border-slate-200/70 px-8 py-5 sticky top-0 z-10 flex items-center justify-between">
        <div>
          <h1 className="font-syne" style={{ fontSize: 28, fontWeight: 800, color: "#0F172A", lineHeight: 1.1 }}>
            Company Settings
          </h1>
          <p className="font-dm mt-1" style={{ fontSize: 13, color: "#64748B" }}>
            Enter-Fil Industrial Products — system-wide info
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleSave}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-white font-dm hover:opacity-90"
            style={{ backgroundColor: "#C8102E", fontSize: 13, fontWeight: 700, letterSpacing: 0.4 }}
          >
            <Save size={15} strokeWidth={2.5} /> SAVE SETTINGS
          </button>
          <NotificationBell />
        </div>
      </header>

      <div className="px-8 py-8 max-w-5xl flex flex-col gap-6">
        <Section icon={Building2} title="Company Information" desc="Used on quotation, JO, and invoice headers">
          <Row>
            <Field label="Company Name" wide>
              <Input v={settings.companyName} onChange={(v) => update({ companyName: v })} />
            </Field>
          </Row>
          <Row>
            <Field label="Address Line 1"><Input v={settings.addressLine1} onChange={(v) => update({ addressLine1: v })} /></Field>
            <Field label="Address Line 2"><Input v={settings.addressLine2} onChange={(v) => update({ addressLine2: v })} /></Field>
          </Row>
          <Row>
            <Field label="City / Province"><Input v={settings.cityProvince} onChange={(v) => update({ cityProvince: v })} /></Field>
            <Field label="ZIP"><Input v={settings.zip} onChange={(v) => update({ zip: v })} /></Field>
          </Row>
        </Section>

        <Section icon={Phone} title="Contact Details" desc="Shown to clients in the portal and on documents">
          <Row>
            <Field label="Main Phone"><Input v={settings.mainPhone} onChange={(v) => update({ mainPhone: v })} /></Field>
            <Field label="Secondary Phone"><Input v={settings.secondaryPhone} onChange={(v) => update({ secondaryPhone: v })} /></Field>
          </Row>
          <Row>
            <Field label="Email"><Input v={settings.email} onChange={(v) => update({ email: v })} /></Field>
            <Field label="Office Hours"><Input v={settings.officeHours} onChange={(v) => update({ officeHours: v })} /></Field>
          </Row>
        </Section>

        <Section icon={Truck} title="Delivery Defaults" desc="Pre-filled in logistics forms; can be overridden per delivery">
          <Row>
            <Field label="Default Company Vehicle Plate"><Input v={settings.defaultPlate} onChange={(v) => update({ defaultPlate: v })} /></Field>
            <Field label="Default Driver Name"><Input v={settings.defaultDriver} onChange={(v) => update({ defaultDriver: v })} /></Field>
          </Row>
          <Row>
            <Field label="Default Driver Contact" wide><Input v={settings.defaultDriverContact} onChange={(v) => update({ defaultDriverContact: v })} /></Field>
          </Row>
          <div className="rounded-md p-3 font-dm" style={{ backgroundColor: "#FFFBEB", border: "1px solid #FDE68A", fontSize: 12, color: "#92400E" }}>
            These values pre-fill in logistics forms and can be overridden per delivery.
          </div>
        </Section>

        <Section icon={Bell} title="Notification Preferences" desc="Email and SMS alerts for system events">
          {/* Master toggles */}
          <div className="grid grid-cols-2 gap-3">
            <ToggleRow icon={Mail} label="Email Alerts" subtitle="Sent via SendGrid (configure at deployment)" enabled={emailAlerts} onToggle={() => setEmailAlerts(v => !v)} accent="#2563EB" />
            <ToggleRow icon={MessageSquare} label="SMS Alerts" subtitle="Sent via Semaphore PH (configure at deployment)" enabled={smsAlerts} onToggle={() => setSmsAlerts(v => !v)} accent="#16A34A" />
          </div>

          {/* Per-trigger matrix */}
          <div className="rounded-lg p-4" style={{ backgroundColor: "#F8FAFC", border: "1px solid #E2E8F0" }}>
            <div className="font-dm mb-3" style={{ fontSize: 11, fontWeight: 700, color: "#475569", letterSpacing: 0.5, textTransform: "uppercase" }}>Per-event channels</div>
            <div className="grid gap-1.5" style={{ gridTemplateColumns: "1fr 80px 80px" }}>
              <span className="font-dm" style={{ fontSize: 11, fontWeight: 700, color: "#94A3B8", letterSpacing: 0.5, textTransform: "uppercase" }}>Trigger</span>
              <span className="font-dm text-center" style={{ fontSize: 11, fontWeight: 700, color: "#94A3B8", letterSpacing: 0.5, textTransform: "uppercase" }}>Email</span>
              <span className="font-dm text-center" style={{ fontSize: 11, fontWeight: 700, color: "#94A3B8", letterSpacing: 0.5, textTransform: "uppercase" }}>SMS</span>
              {[
                ["New inquiry submitted", "newInquiry"],
                ["Quotation sent to client", "quotationSent"],
                ["JO created", "joCreated"],
                ["Production stage complete", "stageComplete"],
                ["Order Ready for Dispatch", "readyForDispatch"],
                ["Delivery confirmed (DR uploaded)", "deliveryConfirmed"],
                ["Invoice overdue", "invoiceOverdue"],
                ["Payment cleared", "paymentCleared"],
                ["Low stock alert", "lowStock"],
                ["Order cancelled by client", "orderCancelled"],
                ["Order rejected by management", "orderRejected"],
                ["Rush tag added mid-production", "rushAdded"],
              ].map(([label, key]) => (
                <Fragment key={key}>
                  <span className="font-dm py-1.5" style={{ fontSize: 12, color: "#0F172A" }}>{label}</span>
                  <div className="flex items-center justify-center">
                    <Checkbox
                      checked={emailTriggers[key as keyof typeof emailTriggers] && emailAlerts}
                      disabled={!emailAlerts}
                      onChange={() => setEmailTriggers(p => ({ ...p, [key]: !p[key as keyof typeof emailTriggers] }))}
                      color="#2563EB"
                    />
                  </div>
                  <div className="flex items-center justify-center">
                    <Checkbox
                      checked={smsTriggers[key as keyof typeof smsTriggers] && smsAlerts}
                      disabled={!smsAlerts}
                      onChange={() => setSmsTriggers(p => ({ ...p, [key]: !p[key as keyof typeof smsTriggers] }))}
                      color="#16A34A"
                    />
                  </div>
                </Fragment>
              ))}
            </div>
          </div>

          <div className="rounded-md p-3 font-dm" style={{ fontSize: 11, color: "#1E40AF", backgroundColor: "#EFF6FF", border: "1px solid #BFDBFE" }}>
            ℹ️ Email alerts via <strong>SendGrid</strong> · SMS alerts via <strong>Semaphore (PH)</strong> · Configured at deployment. Each user account can override these defaults in their personal settings.
          </div>
        </Section>

        <Section icon={FileText} title="Document Footer" desc="Shown on all PDFs (Quotation, JO, SI, DR)">
          <textarea
            value={settings.documentFooter}
            onChange={(e) => update({ documentFooter: e.target.value })}
            rows={3}
            className="w-full font-dm px-3 py-2.5 rounded-md border border-slate-200 outline-none focus:border-slate-400 resize-none bg-white"
            style={{ fontSize: 13, color: "#0F172A" }}
          />
          <div className="rounded-md p-3 font-mono-jb" style={{ backgroundColor: "#F8FAFC", border: "1px solid #E2E8F0", fontSize: 11, color: "#475569" }}>
            Preview: <span style={{ color: "#0F172A" }}>{previewFooter(settings)}</span>
          </div>
        </Section>

        <div className="flex items-center justify-between gap-3 rounded-xl px-5 py-4 bg-white border border-slate-200/70">
          <span className="font-dm" style={{ fontSize: 13, color: "#64748B" }}>
            These values auto-populate in: logistics delivery panels · client portal pick-up info · PDF document footers · Lalamove sender info copy.
          </span>
          <button
            onClick={handleSave}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-white font-dm hover:opacity-90"
            style={{ backgroundColor: "#C8102E", fontSize: 13, fontWeight: 700, letterSpacing: 0.4 }}
          >
            <Save size={15} strokeWidth={2.5} /> SAVE SETTINGS
          </button>
        </div>
      </div>
    </div>
  );
}

function previewFooter(s: CompanySettings) {
  if (s.documentFooter.trim()) return s.documentFooter;
  return `${s.companyName} · ${s.addressLine1}, ${s.cityProvince} ${s.zip} · ${s.mainPhone} · ${s.email}`;
}

function Section({ icon: Icon, title, desc, children }: { icon: any; title: string; desc: string; children: React.ReactNode }) {
  return (
    <section className="bg-white rounded-xl border border-slate-200/70 p-6 flex flex-col gap-4" style={{ boxShadow: "0 1px 2px rgba(15,23,42,0.04)" }}>
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: "#FEE2E2" }}>
          <Icon size={16} style={{ color: "#C8102E" }} />
        </div>
        <div>
          <h2 className="font-syne" style={{ fontSize: 16, fontWeight: 700, color: "#0F172A" }}>{title}</h2>
          <p className="font-dm mt-0.5" style={{ fontSize: 12, color: "#64748B" }}>{desc}</p>
        </div>
      </div>
      <div className="flex flex-col gap-3">{children}</div>
    </section>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-3">{children}</div>;
}

function Field({ label, children, wide }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className={`flex flex-col gap-1.5 ${wide ? "col-span-2" : ""}`}>
      <label className="font-dm" style={{ fontSize: 11, fontWeight: 600, color: "#64748B", letterSpacing: 0.4, textTransform: "uppercase" }}>{label}</label>
      {children}
    </div>
  );
}

function Input({ v, onChange }: { v: string; onChange: (v: string) => void }) {
  return (
    <input
      value={v}
      onChange={(e) => onChange(e.target.value)}
      className="w-full font-dm px-3 py-2.5 rounded-md border border-slate-200 outline-none focus:border-slate-400 bg-white"
      style={{ fontSize: 13, color: "#0F172A" }}
    />
  );
}

function ToggleRow({ icon: Icon, label, subtitle, enabled, onToggle, accent }: {
  icon: any; label: string; subtitle: string; enabled: boolean; onToggle: () => void; accent: string;
}) {
  return (
    <div className="rounded-lg p-4 flex items-center gap-3" style={{ border: enabled ? `1.5px solid ${accent}` : "1px solid #E2E8F0", backgroundColor: enabled ? `${accent}10` : "#FFFFFF" }}>
      <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: enabled ? accent : "#E2E8F0" }}>
        <Icon size={16} style={{ color: enabled ? "white" : "#94A3B8" }} />
      </div>
      <div className="flex-1">
        <div className="font-dm" style={{ fontSize: 13, fontWeight: 700, color: "#0F172A" }}>{label}</div>
        <div className="font-dm" style={{ fontSize: 11, color: "#64748B" }}>{subtitle}</div>
      </div>
      <button
        onClick={onToggle}
        className="relative w-11 h-6 rounded-full transition-colors"
        style={{ backgroundColor: enabled ? accent : "#CBD5E1" }}
      >
        <span className="absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all" style={{ left: enabled ? 22 : 2, boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }} />
      </button>
    </div>
  );
}

function Checkbox({ checked, onChange, disabled, color }: { checked: boolean; onChange: () => void; disabled?: boolean; color: string }) {
  return (
    <input
      type="checkbox"
      checked={checked}
      onChange={onChange}
      disabled={disabled}
      style={{ accentColor: color, width: 16, height: 16, cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.4 : 1 }}
    />
  );
}
