type Variant = "in-progress" | "pending" | "completed" | "delayed" | "queued";

const styles: Record<Variant, { bg: string; fg: string; label: string }> = {
  "in-progress": { bg: "#DBEAFE", fg: "#1D4ED8", label: "In Progress" },
  pending: { bg: "#FEF3C7", fg: "#B45309", label: "Pending" },
  completed: { bg: "#DCFCE7", fg: "#15803D", label: "Completed" },
  delayed: { bg: "#FEE2E2", fg: "#B91C1C", label: "Delayed" },
  queued: { bg: "#E2E8F0", fg: "#475569", label: "Queued" },
};

export function StatusBadge({ variant, children }: { variant: Variant; children?: React.ReactNode }) {
  const s = styles[variant];
  return (
    <span
      className="inline-flex items-center px-2.5 py-1 rounded-full font-dm"
      style={{ backgroundColor: s.bg, color: s.fg, fontSize: 11, fontWeight: 600, letterSpacing: 0.2 }}
    >
      {children ?? s.label}
    </span>
  );
}
