import type { ReactNode } from "react";

// Presentation only. Never use this value for requests, QR content or persistence.
export function compactWarehouseReference(value: string): string {
  return value.replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi,
    uuid => `${uuid.slice(0, 8)}\u2026${uuid.slice(-4)}`);
}

export function WarehouseReference({ value, plainWhenUnchanged = false }: { value: ReactNode; plainWhenUnchanged?: boolean }) {
  if (typeof value !== "string") return <>{value}</>;
  const compact = compactWarehouseReference(value);
  if (plainWhenUnchanged && compact === value) return <>{value}</>;
  return <span title={value} aria-label={value} className="min-w-0 break-all" style={{ overflowWrap: "anywhere", wordBreak: "break-all", display: "inline-block", maxWidth: "100%", verticalAlign: "bottom" }}>
    {compact === value ? value : <>
      <span aria-hidden="true" className="print:hidden">{compact}</span>
      <span aria-hidden="true" className="hidden print:inline">{value}</span>
    </>}
  </span>;
}
