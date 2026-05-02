import { ShieldAlert } from "lucide-react";

export function Unauthorized() {
  return (
    <div className="flex-1 h-full flex items-center justify-center font-dm" style={{ backgroundColor: "#F4F6F9" }}>
      <div className="text-center max-w-md px-8">
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5"
          style={{ backgroundColor: "#FEE2E2", color: "#C8102E" }}
          aria-hidden
        >
          <ShieldAlert size={28} />
        </div>
        <div className="font-syne mb-2" style={{ fontSize: 28, fontWeight: 800, color: "#0F172A", lineHeight: 1.1 }}>
          403 — Restricted Module
        </div>
        <p className="font-dm" style={{ fontSize: 14, color: "#475569", lineHeight: 1.6 }}>
          You don't have access to this module. Contact your administrator if you believe this is a mistake.
        </p>
      </div>
    </div>
  );
}
