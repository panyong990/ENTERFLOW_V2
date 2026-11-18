import { X } from "lucide-react";

export function ModalShell({ title, subtitle, onClose, children, size = "md" }: { title: string; subtitle?: string; onClose: () => void; children: React.ReactNode; size?: "md" | "lg" }) {
  const max = size === "lg" ? "max-w-5xl" : "max-w-lg";
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(15,23,42,0.5)" }} onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={title} className={`bg-white rounded-xl w-full ${max} max-h-[90vh] flex flex-col`} style={{ boxShadow: "0 20px 40px rgba(0,0,0,0.2)" }} onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-5 border-b border-slate-200 flex items-start justify-between">
          <div>
            <h3 className="font-syne" style={{ fontSize: 18, fontWeight: 700, color: "#0F172A" }}>{title}</h3>
            {subtitle && <p className="font-dm mt-0.5" style={{ fontSize: 12, color: "#64748B" }}>{subtitle}</p>}
          </div>
          <button onClick={onClose} aria-label="Close" className="w-8 h-8 rounded-md hover:bg-slate-100 flex items-center justify-center"><X size={16} /></button>
        </div>
        <div className="p-6 overflow-auto">{children}</div>
      </div>
      <style>{`
        .form-input { font-family: "Inter", "Segoe UI", Roboto, Helvetica, Arial, sans-serif; font-size: 13px; padding: 10px 12px; border: 1px solid #E2E8F0; border-radius: 6px; outline: none; width: 100%; background: white; }
        .form-input:focus { border-color: #94A3B8; }
        .form-input-sm { font-family: "Inter", "Segoe UI", Roboto, Helvetica, Arial, sans-serif; font-size: 13px; padding: 8px 10px; border: 1px solid #E2E8F0; border-radius: 6px; outline: none; width: 100%; background: white; }
      `}</style>
    </div>
  );
}

