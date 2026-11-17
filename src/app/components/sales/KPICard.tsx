import { TrendingUp, TrendingDown, type LucideIcon } from "lucide-react";

interface Props {
  label: string;
  value: string;
  delta?: string;
  trend?: "up" | "down";
  showTrend?: boolean;
  icon: LucideIcon;
  accent?: string;
}

export function KPICard({ label, value, delta, trend = "up", showTrend = true, icon: Icon, accent = "#C8102E" }: Props) {
  const TrendIcon = trend === "up" ? TrendingUp : TrendingDown;
  const trendColor = trend === "up" ? "#16A34A" : "#C8102E";
  return (
    <div
      className="bg-white rounded-xl p-5 flex flex-col gap-3 border border-slate-200/60"
      style={{ boxShadow: "0 1px 2px rgba(15,23,42,0.04)" }}
    >
      <div className="flex items-start justify-between">
        <span className="font-dm" style={{ fontSize: 12, fontWeight: 600, color: "#64748B", letterSpacing: 0.4, textTransform: "uppercase" }}>
          {label}
        </span>
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center"
          style={{ backgroundColor: `${accent}15`, color: accent }}
        >
          <Icon size={18} />
        </div>
      </div>
      <div className="font-syne" style={{ fontSize: 28, fontWeight: 800, color: "#0F172A", lineHeight: 1 }}>
        {value}
      </div>
      {delta && (
        <div className="flex items-center gap-1.5 font-dm" style={{ fontSize: 12 }}>
          {showTrend && <TrendIcon size={14} style={{ color: trendColor }} />}
          <span style={{ color: showTrend ? trendColor : "#64748B", fontWeight: 500 }}>{delta}</span>
          {showTrend && <span style={{ color: "#64748B" }}>vs last week</span>}
        </div>
      )}
    </div>
  );
}
