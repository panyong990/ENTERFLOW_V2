import { useMemo, useState } from "react";
import {
  Clock, CheckCircle2, Circle, AlertTriangle, Pause, Archive, Eye, X,
  User, Package, Calendar, Wrench, Printer, ArrowLeft, ClipboardList, Pencil, Flag, XCircle,
} from "lucide-react";
import { useSettings } from "../store/settings";
import { useNotifications } from "../store/notifications";
import { NotificationBell } from "./NotificationBell";
import { Toaster, toast } from "sonner";
import { JOTemplateModal, type JOTemplateData } from "./JOTemplateModal";
import { useOrders, type Stage } from "../store/orders";

const STAGES = [
  "Molding",
  "Cutting of Steel Plate",
  "Spotting of Filter Core",
  "Assembling",
  "Inserting of Filter Media",
  "Trimming",
  "Top/Bottom Cap Sealing (Heating)",
  "Gasket / O-Ring Fitting",
  "Quality / Product Inspection",
  "Completed",
];

type BadgeKind = "molding" | "spotting" | "assembling" | "quality" | "holding";

const badgeStyle: Record<BadgeKind, { bg: string; fg: string; label: string }> = {
  molding: { bg: "#E2E8F0", fg: "#334155", label: "Molding" },
  spotting: { bg: "#FEF3C7", fg: "#B45309", label: "Spotting" },
  assembling: { bg: "#FEF3C7", fg: "#B45309", label: "Assembling" },
  quality: { bg: "#DBEAFE", fg: "#1D4ED8", label: "Quality / P.I." },
  holding: { bg: "#F1F5F9", fg: "#64748B", label: "Holding" },
};

interface StageHistoryEntry {
  markedBy: string;
  date: string;
  status: "done" | "reverted";
  reason?: string;
}

interface ActivityEntry {
  id: string;
  timestamp: string;
  user: string;
  stageName: string;
  oldStatus: string;
  newStatus: string;
  reason: string;
}

interface Job {
  id: string;
  jo: string;
  client: string;
  product: string;
  qty: number;
  due: string;
  badge: BadgeKind;
  stageIndex: number;
  paused?: boolean;
  urgent?: boolean;
  sketch?: string;
  specs: string[];
  stageHistory: (StageHistoryEntry | null)[];
  activityLog: ActivityEntry[];
}

const makeHistory = (doneCount: number): (StageHistoryEntry | null)[] => {
  const operators = ["F. Santos", "J. Reyes", "M. Tan", "J. Reyes", "M. Tan", "M. Tan", "J. Reyes", "J. Reyes", "F. Santos", "F. Santos"];
  const dates = ["Apr 20", "Apr 21", "Apr 22", "Apr 23", "Apr 24", "Apr 24", "Apr 25", "Apr 25", "Apr 26", "Apr 26"];
  return Array.from({ length: 10 }, (_, i) =>
    i < doneCount ? { markedBy: operators[i], date: dates[i], status: "done" as const } : null
  );
};

const initial: Job[] = [
  {
    id: "j1", jo: "JO-2026-001", client: "B.E. AEROSPACE", product: "AIR FILTER", qty: 50,
    due: "Apr 30", badge: "quality", stageIndex: 8, urgent: true,
    sketch: "KF-OS.107.65.252_drawing.pdf",
    specs: ["Item: KF-OS.107.65.252", "OD: 107mm · ID: 64.6mm · Height: 252mm", "Media: Microglass Fiber", "Inner Core: Expanded Metal Perfo 2mm", "End Cap: E.G. 1.0mm · Brand: Hitachi Comp."],
    stageHistory: makeHistory(8),
    activityLog: [],
  },
  {
    id: "j2", jo: "JO-2026-002", client: "MAYNILAD", product: "FILTER", qty: 100,
    due: "May 02", badge: "assembling", stageIndex: 3,
    specs: ["Item: KF-OF.175.20.87", "OD: 175mm · ID: 20mm · Height: 87mm", "Media: Pleated ZS20 w/ Double Alum Screen"],
    stageHistory: makeHistory(3),
    activityLog: [],
  },
  {
    id: "j3", jo: "JO-2026-003", client: "G.U. ENGINEERING", product: "OIL SEPARATOR", qty: 30,
    due: "May 05", badge: "molding", stageIndex: 0,
    specs: ["Item: KF-OS.200/167.108.160", "OD: 200mm · ID: 108mm", "Media: Microglass Fiber", "Outer Core: Perfo 6mm"],
    stageHistory: makeHistory(0),
    activityLog: [],
  },
  {
    id: "j4", jo: "JO-2026-004", client: "EMERALD VINYL", product: "COLUMN FILTER", qty: 20,
    due: "May 10", badge: "holding", stageIndex: 0, paused: true,
    specs: ["Item: TBC · Awaiting material delivery"],
    stageHistory: makeHistory(0),
    activityLog: [],
  },
];

function DetailStat({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 p-3 flex items-start gap-2">
      <div className="w-8 h-8 rounded-md flex items-center justify-center shrink-0" style={{ backgroundColor: "#F1F5F9", color: "#475569" }} aria-hidden>
        <Icon size={14} />
      </div>
      <div className="min-w-0">
        <div className="font-dm" style={{ fontSize: 10, fontWeight: 600, color: "#64748B", letterSpacing: 0.4, textTransform: "uppercase" }}>{label}</div>
        <div className="font-syne truncate" style={{ fontSize: 13, fontWeight: 700, color: "#0F172A" }}>{value}</div>
      </div>
    </div>
  );
}

const filterTabs = [
  { id: "all", label: "ALL" },
  { id: "molding", label: "MOLDING" },
  { id: "spotting", label: "SPOTTING OF FILTER CORE" },
  { id: "assembling", label: "ASSEMBLING" },
  { id: "quality", label: "QUALITY / P.I." },
];

function tabCount(jobs: Job[], tab: string) {
  if (tab === "all") return jobs.length;
  if (tab === "molding") return jobs.filter((j) => j.stageIndex === 0).length;
  if (tab === "spotting") return jobs.filter((j) => j.stageIndex === 2).length;
  if (tab === "assembling") return jobs.filter((j) => j.stageIndex === 3).length;
  if (tab === "quality") return jobs.filter((j) => j.stageIndex >= 7).length;
  return 0;
}

function jobMatches(j: Job, tab: string) {
  if (tab === "all") return true;
  if (tab === "molding") return j.stageIndex === 0;
  if (tab === "spotting") return j.stageIndex === 2;
  if (tab === "assembling") return j.stageIndex === 3;
  if (tab === "quality") return j.stageIndex >= 7;
  return true;
}

function getJOTemplateData(job: Job): JOTemplateData {
  const specLine = job.specs[1] ?? "";
  const odMatch = specLine.match(/OD:\s*([\d.]+)mm/);
  const idMatch = specLine.match(/ID:\s*([\d.]+)mm/);
  const hMatch = specLine.match(/Height:\s*([\d.]+)mm/);
  const mediaLine = job.specs[2] ?? "";
  const innerLine = job.specs[3] ?? "";
  const endCapLine = job.specs[4] ?? "";
  const itemPN = job.specs[0]?.replace("Item: ", "") ?? "";
  return {
    jo: job.jo,
    client: job.client,
    product: job.product,
    qty: job.qty,
    date: "Apr 26, 2026",
    itemCode: `${job.product.replace(" ", "").toUpperCase().slice(0, 6)}-00001`,
    enterFilPN: itemPN.split(" ")[0],
    specs: {
      od1: odMatch?.[1],
      id1: idMatch?.[1],
      height: hMatch?.[1],
      media: mediaLine.replace("Media: ", ""),
      innerCore: innerLine.replace("Inner Core: ", ""),
      endCap: endCapLine.split("·")[0]?.replace("End Cap: ", ""),
      brand: endCapLine.split("Brand: ")?.[1],
    },
    preparedBy: "Tricia (Management)",
    sketch: job.sketch,
    urgent: job.urgent,
    dueDate: job.due,
  };
}

export function ProductionFloor() {
  const [jobs, setJobs] = useState<Job[]>(initial);
  const [tab, setTab] = useState("all");
  const [detailId, setDetailId] = useState<string | null>(null);
  const [labelJob, setLabelJob] = useState<Job | null>(null);
  const [stageMonitorId, setStageMonitorId] = useState<string | null>(null);
  const [joFileJob, setJoFileJob] = useState<Job | null>(null);
  const [editingDueId, setEditingDueId] = useState<string | null>(null);
  const [editingDueValue, setEditingDueValue] = useState("");
  const [editingDueReason, setEditingDueReason] = useState("");
  const [confirmCancelJob, setConfirmCancelJob] = useState<Job | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [qcFailed, setQcFailed] = useState<Set<string>>(new Set());
  const { push: pushNotif } = useNotifications();
  const { completedJOs, setStage, cancelJOFromProduction } = useOrders();

  /* Map a production stageIndex to an inquiry Stage */
  const stageForIndex = (idx: number): Stage => {
    if (idx >= 9) return "ready_for_dispatch";
    if (idx >= 8) return "quality_inspection";
    if (idx >= 1) return "in_production";
    return "jo";
  };

  /* Whenever a job advances, sync the matching inquiry's stage */
  const syncInquiryStage = (job: Job, newIdx: number) => {
    const inq = completedJOs.find(i => i.joNumber === job.jo);
    if (inq) setStage(inq.id, stageForIndex(newIdx));
  };

  const toggleUrgent = (id: string) => {
    setJobs(prev => prev.map(j => {
      if (j.id !== id) return j;
      const next = !j.urgent;
      if (next) {
        pushNotif({
          dept: "production",
          title: `${j.jo} marked URGENT mid-production`,
          body: `${j.client} · ${j.product} · priority bumped`,
          link: "production",
          recipients: ["owner", "operations", "production"],
        });
        toast.success(`${j.jo} marked urgent`, { description: "Production team notified" });
      } else {
        toast(`${j.jo} urgency removed`);
      }
      return { ...j, urgent: next };
    }));
  };

  const saveDue = (id: string, due: string) => {
    if (!due.trim()) { toast.error("Enter a valid date"); return; }
    const job = jobs.find(j => j.id === id);
    if (!job) return;
    setJobs(prev => prev.map(j => j.id === id ? { ...j, due } : j));
    /* Notify both client and Enter-Fil with reason */
    pushNotif({
      dept: "production",
      title: `Due date updated: ${job.jo}`,
      body: `${job.client} · ${job.product} · new due ${due}${editingDueReason ? ` · Reason: ${editingDueReason}` : ""}${editingDueReason ? "" : " · For details, contact via Viber/SMS/email."}`,
      link: "production",
      recipients: ["owner", "operations", "production", "client"],
    });
    setEditingDueId(null); setEditingDueReason("");
    toast.success("Due date updated · client & team notified");
  };

  const markQCFailed = (id: string) => {
    setQcFailed(prev => new Set(prev).add(id));
    const job = jobs.find(j => j.id === id);
    if (!job) return;
    pushNotif({
      dept: "production",
      title: `❌ QC Failed: ${job.jo}`,
      body: `${job.client} · ${job.product} · Stage stays at Quality Inspection until passed. Rework required.`,
      link: "production",
      recipients: ["owner", "operations", "production", "warehouse"],
    });
    toast.error("Quality check failed", { description: "Job stays at QC stage until rework passes" });
  };

  const markQCPassed = (id: string) => {
    setQcFailed(prev => { const next = new Set(prev); next.delete(id); return next; });
    advanceStage(id);
    toast.success("QC passed → moving to next stage");
  };

  const cancelJO = () => {
    if (!confirmCancelJob) return;
    if (!cancelReason.trim()) { toast.error("A reason is required"); return; }
    const job = confirmCancelJob;
    setJobs(prev => prev.filter(j => j.id !== job.id));
    /* archive the matching inquiry in the orders store */
    cancelJOFromProduction(job.jo, cancelReason.trim());
    pushNotif({
      dept: "production",
      title: `JO cancelled: ${job.jo}`,
      body: `${job.client} · ${job.product} · Reason: ${cancelReason.trim()}`,
      link: "production",
      recipients: ["owner", "operations", "sales", "client"],
    });
    toast.info("JO cancelled · archived", { description: `${job.jo} · ${job.client} notified` });
    setConfirmCancelJob(null);
    setCancelReason("");
  };

  const visible = useMemo(() => jobs.filter((j) => jobMatches(j, tab)), [jobs, tab]);
  const pausedJob = jobs.find((j) => j.paused);

  const advanceStage = (id: string) => {
    setJobs((prev) =>
      prev.map((j) => {
        if (j.id !== id) return j;
        const newIdx = Math.min(j.stageIndex + 1, STAGES.length - 1);
        const newHistory = [...j.stageHistory];
        newHistory[j.stageIndex] = { markedBy: "F. Santos · Warehouse", date: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" }), status: "done" };
        toast.success(`Stage complete: ${STAGES[j.stageIndex]}`, { description: `${j.jo} → ${STAGES[newIdx]}` });
        /* sync inquiry stage in store */
        syncInquiryStage(j, newIdx);
        /* notify on stage complete + ready-for-dispatch */
        pushNotif({
          dept: "production",
          title: `${j.jo} → ${STAGES[newIdx]}`,
          body: `${j.client} · ${j.product} · marked by F. Santos`,
          link: "production",
          recipients: ["owner", "operations", "production"],
        });
        if (newIdx === STAGES.length - 1) {
          pushNotif({
            dept: "logistics",
            title: `Order ready for dispatch: ${j.jo}`,
            body: `${j.client} · ${j.product} · ${j.qty} pcs`,
            link: "waybill",
            recipients: ["owner", "operations", "logistics", "warehouse"],
          });
        }
        return { ...j, stageIndex: newIdx, stageHistory: newHistory };
      })
    );
  };

  const archive = (job: Job) => {
    setJobs((prev) => prev.filter((j) => j.id !== job.id));
    toast.success(`${job.jo} completed`, { description: "Archived to history", duration: 3500 });
  };

  const resumeJob = (id: string) => {
    setJobs((prev) => prev.map((j) => (j.id === id ? { ...j, paused: false } : j)));
    const job = jobs.find((j) => j.id === id);
    toast.success("Production resumed", { description: `${job?.jo} is back in progress` });
  };

  const monitoringJob = jobs.find((j) => j.id === stageMonitorId);

  return (
    <div className="flex-1 h-full overflow-auto" style={{ backgroundColor: "#F4F6F9" }}>
      <Toaster position="bottom-right" richColors />

      <header className="bg-white border-b border-slate-200/70 px-8 py-5 sticky top-0 z-10">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="font-syne" style={{ fontSize: 28, fontWeight: 800, color: "#0F172A", lineHeight: 1.1 }}>
              Production Floor
            </h1>
            <p className="font-dm mt-1" style={{ fontSize: 13, color: "#64748B" }}>
              Kiosk mode — tap to update job stages · 10-step manufacturing process
            </p>
          </div>
          <div className="flex items-center gap-3">
              <NotificationBell />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 mt-5">
          {filterTabs.map((t) => {
            const isActive = tab === t.id;
            const count = tabCount(jobs, t.id);
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className="font-dm px-4 py-2 rounded-full transition-colors"
                style={{ fontSize: 12, fontWeight: 700, letterSpacing: 0.5, backgroundColor: isActive ? "#C8102E" : "#F1F5F9", color: isActive ? "#FFFFFF" : "#0F172A" }}
              >
                {t.label} ({count})
              </button>
            );
          })}
        </div>
      </header>

      <div className="px-8 py-8 pb-28">
        <div className="grid grid-cols-2 gap-6">
          {visible.map((job) => {
            const completed = job.stageIndex >= STAGES.length - 1;
            const pct = Math.round(((job.stageIndex + (completed ? 1 : 0)) / STAGES.length) * 100);
            const stageNum = Math.min(job.stageIndex + 1, STAGES.length);
            const b = badgeStyle[job.badge];

            return (
              <article
                key={job.id}
                className="bg-white rounded-xl overflow-hidden flex flex-col"
                style={{ boxShadow: "0 1px 2px rgba(15,23,42,0.04)", border: job.urgent ? "2px solid #C8102E" : "1px solid rgba(226,232,240,0.7)" }}
              >
                {/* Rush banner */}
                {job.urgent && (
                  <div className="px-5 py-1.5 flex items-center gap-2" style={{ backgroundColor: "#C8102E" }}>
                    <span className="font-dm text-white" style={{ fontSize: 11, fontWeight: 800, letterSpacing: 0.6 }}>🚨 RUSH ORDER — PRIORITY PRODUCTION</span>
                    <span className="font-dm text-white/80 ml-auto" style={{ fontSize: 11 }}>Due: {job.due}</span>
                  </div>
                )}
                {/* Card Header */}
                <div className="px-5 py-4 border-b border-slate-200/70" style={{ backgroundColor: "#1A2B4A", color: "white" }}>
                  <div className="flex items-center justify-between">
                    <span className="font-mono-jb tracking-wide" style={{ fontSize: 18, fontWeight: 600, color: "white" }}>{job.jo}</span>
                    <span className="font-dm px-2.5 py-1 rounded-full" style={{ fontSize: 11, fontWeight: 600, backgroundColor: b.bg, color: b.fg }}>{b.label}</span>
                  </div>
                  <div className="flex items-center justify-between mt-1.5">
                    <span className="font-syne" style={{ fontSize: 13, fontWeight: 700, color: "white", letterSpacing: 0.5 }}>{job.client}</span>
                    <div className="flex items-center gap-3">
                      {/* View JO File */}
                      <button
                        onClick={() => setJoFileJob(job)}
                        aria-label={`View JO file for ${job.jo}`}
                        className="font-dm flex items-center gap-1 text-white/70 hover:text-white"
                        style={{ fontSize: 11, fontWeight: 600 }}
                      >
                        📄 View JO File
                      </button>
                      {/* View Full Details */}
                      <button
                        onClick={() => setDetailId(job.id)}
                        aria-label={`View full details for ${job.jo}`}
                        className="font-dm flex items-center gap-1 text-white/80 hover:text-white"
                        style={{ fontSize: 11, fontWeight: 600 }}
                      >
                        <Eye size={12} aria-hidden /> View Full Details
                      </button>
                    </div>
                  </div>
                </div>

                {/* Card Body */}
                <div className="px-5 py-4 flex flex-col gap-4">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2 font-dm" style={{ fontSize: 12, color: "#475569" }}>
                      <Clock size={14} />
                      {editingDueId === job.id ? (
                        <div className="flex flex-col gap-1.5 p-2 rounded-md" style={{ backgroundColor: "#FFFBEB", border: "1px solid #FDE68A" }}>
                          <div className="flex items-center gap-1">
                            <input
                              value={editingDueValue}
                              onChange={(e) => setEditingDueValue(e.target.value)}
                              placeholder="e.g. May 5, 2026"
                              autoFocus
                              className="font-dm px-2 py-1 rounded border border-amber-200 outline-none focus:border-amber-400 bg-white"
                              style={{ fontSize: 11, width: 120 }}
                            />
                            <input
                              value={editingDueReason}
                              onChange={(e) => setEditingDueReason(e.target.value)}
                              placeholder="Reason (optional, e.g. delayed material)"
                              className="font-dm px-2 py-1 rounded border border-amber-200 outline-none focus:border-amber-400 bg-white flex-1"
                              style={{ fontSize: 11 }}
                            />
                          </div>
                          <div className="flex items-center justify-between gap-1">
                            <span className="font-dm" style={{ fontSize: 10, color: "#92400E", fontStyle: "italic" }}>For details, contact via Viber/SMS/email</span>
                            <div className="flex items-center gap-1">
                              <button onClick={() => { setEditingDueId(null); setEditingDueReason(""); }} className="font-dm px-1.5 py-0.5 rounded hover:bg-amber-100" style={{ fontSize: 10, color: "#64748B" }}>Cancel</button>
                              <button onClick={() => saveDue(job.id, editingDueValue)} className="font-dm px-2 py-0.5 rounded text-white flex items-center gap-1" style={{ fontSize: 10, fontWeight: 700, backgroundColor: "#16A34A" }}>Save & Notify</button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <>
                          <span>Due: {job.due}</span>
                          <button onClick={() => { setEditingDueId(job.id); setEditingDueValue(job.due); }} className="hover:bg-slate-100 px-1.5 py-0.5 rounded" title="Edit due date">
                            <Pencil size={10} style={{ color: "#94A3B8" }} />
                          </button>
                        </>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => toggleUrgent(job.id)}
                        title={job.urgent ? "Remove urgent" : "Mark as urgent"}
                        className="font-dm flex items-center gap-1 px-2 py-1 rounded-md hover:opacity-90"
                        style={{ fontSize: 10, fontWeight: 700, backgroundColor: job.urgent ? "#FEE2E2" : "#F1F5F9", color: job.urgent ? "#C8102E" : "#475569", letterSpacing: 0.3 }}
                      >
                        <Flag size={11} /> {job.urgent ? "RUSH ON" : "Mark Rush"}
                      </button>
                      <button
                        onClick={() => setConfirmCancelJob(job)}
                        title="Cancel JO"
                        className="font-dm flex items-center gap-1 px-2 py-1 rounded-md hover:bg-red-50"
                        style={{ fontSize: 10, fontWeight: 700, color: "#94A3B8" }}
                      >
                        <XCircle size={11} /> Cancel
                      </button>
                      {job.paused && (
                        <span className="flex items-center gap-1 font-dm ml-1" style={{ fontSize: 11, fontWeight: 600, color: "#C8102E" }}>
                          <Pause size={12} /> PAUSED
                        </span>
                      )}
                    </div>
                  </div>

                  <div>
                    <div className="font-syne" style={{ fontSize: 16, fontWeight: 700, color: "#0F172A", letterSpacing: 0.5 }}>{job.product}</div>
                    <div className="font-dm mt-0.5" style={{ fontSize: 12, color: "#64748B" }}>Qty: {job.qty}</div>
                  </div>

                  <div className="rounded-lg p-3 flex flex-col gap-1" style={{ backgroundColor: "#F4F6F9" }}>
                    {job.specs.map((s, i) => (
                      <div key={i} className="font-dm" style={{ fontSize: 11, color: "#475569", lineHeight: 1.6 }}>{s}</div>
                    ))}
                  </div>

                  {/* Progress */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-dm" style={{ fontSize: 12, fontWeight: 600, color: "#475569" }}>Stage {stageNum} of {STAGES.length}</span>
                      <span className="font-syne" style={{ fontSize: 13, fontWeight: 700, color: "#0F172A" }}>{pct}%</span>
                    </div>
                    <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: "#E2E8F0" }}>
                      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: completed ? "#16A34A" : "#C8102E" }} />
                    </div>
                    <div className="font-dm mt-1.5" style={{ fontSize: 11, color: "#64748B" }}>
                      Current: {STAGES[Math.min(job.stageIndex, STAGES.length - 1)]}
                    </div>
                  </div>

                  {/* View Production Stages Button */}
                  <button
                    onClick={() => setStageMonitorId(job.id)}
                    className="font-dm flex items-center justify-center gap-2 py-2.5 rounded-md hover:opacity-90 border"
                    style={{ fontSize: 12, fontWeight: 700, backgroundColor: "#1A2B4A", color: "white", letterSpacing: 0.3, border: "none" }}
                  >
                    <ClipboardList size={14} /> 📋 View Production Stages →
                  </button>
                </div>

                {/* Card Footer */}
                <div className="px-5 py-4 border-t border-slate-200/70 flex justify-end" style={{ backgroundColor: "#FAFBFC" }}>
                  {completed ? (
                    <div className="flex items-center gap-2">
                      <button onClick={() => setLabelJob(job)} className="flex items-center gap-2 px-4 py-2.5 rounded-md font-dm border-2 hover:bg-white" style={{ borderColor: "#1A2B4A", color: "#1A2B4A", fontSize: 12, fontWeight: 700, letterSpacing: 0.5 }}>
                        <Printer size={14} strokeWidth={2.5} /> 🏷 PRINT DISPATCH LABEL
                      </button>
                      <button onClick={() => archive(job)} className="flex items-center gap-2 px-4 py-2.5 rounded-md text-white font-dm hover:opacity-90" style={{ backgroundColor: "#16A34A", fontSize: 12, fontWeight: 700, letterSpacing: 0.5 }}>
                        <Archive size={14} strokeWidth={2.5} /> MARK COMPLETE &amp; ARCHIVE
                      </button>
                    </div>
                  ) : job.paused ? (
                    <div className="flex items-center gap-2">
                      <span className="font-dm flex items-center gap-1" style={{ fontSize: 11, fontWeight: 600, color: "#D97706" }}>
                        <Pause size={12} /> On hold — material shortage
                      </span>
                      <button
                        onClick={() => resumeJob(job.id)}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-md text-white font-dm hover:opacity-90"
                        style={{ backgroundColor: "#16A34A", fontSize: 12, fontWeight: 700, letterSpacing: 0.5 }}
                      >
                        ✅ Resume Production
                      </button>
                    </div>
                  ) : job.stageIndex === 8 ? (
                    /* Quality / Product Inspection — special pass/fail flow */
                    <div className="flex items-center gap-2 flex-wrap">
                      {qcFailed.has(job.id) ? (
                        <>
                          <span className="font-dm flex items-center gap-1 px-2 py-1 rounded-md" style={{ fontSize: 11, fontWeight: 700, backgroundColor: "#FEE2E2", color: "#991B1B" }}>
                            <AlertTriangle size={12} /> QC FAILED — REWORK
                          </span>
                          <button onClick={() => markQCPassed(job.id)} className="flex items-center gap-2 px-3 py-2 rounded-md text-white font-dm hover:opacity-90" style={{ backgroundColor: "#16A34A", fontSize: 11, fontWeight: 700, letterSpacing: 0.4 }}>
                            <CheckCircle2 size={13} /> Mark Rework Passed
                          </button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => markQCFailed(job.id)} className="flex items-center gap-2 px-3 py-2 rounded-md font-dm border-2 hover:bg-red-50" style={{ borderColor: "#FECACA", color: "#C8102E", fontSize: 11, fontWeight: 700, letterSpacing: 0.4 }}>
                            <XCircle size={13} /> Mark Failed
                          </button>
                          <button onClick={() => markQCPassed(job.id)} className="flex items-center gap-2 px-4 py-2 rounded-md text-white font-dm hover:opacity-90" style={{ backgroundColor: "#16A34A", fontSize: 11, fontWeight: 700, letterSpacing: 0.4 }}>
                            <CheckCircle2 size={13} /> ✓ QC Passed → Complete
                          </button>
                        </>
                      )}
                    </div>
                  ) : (
                    <button onClick={() => advanceStage(job.id)} className="flex items-center gap-2 px-4 py-2.5 rounded-md text-white font-dm hover:opacity-90" style={{ backgroundColor: "#C8102E", fontSize: 12, fontWeight: 700, letterSpacing: 0.5 }}>
                      <CheckCircle2 size={14} strokeWidth={2.5} /> MARK STAGE DONE
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </div>

      {/* Full Details Side Drawer */}
      {detailId && (() => {
        const j = jobs.find((x) => x.id === detailId);
        if (!j) return null;
        const completed = j.stageIndex >= STAGES.length - 1;
        const stageNum = Math.min(j.stageIndex + 1, STAGES.length);
        const pct = Math.round(((j.stageIndex + (completed ? 1 : 0)) / STAGES.length) * 100);
        return (
          <div className="fixed inset-0 z-50 flex items-stretch justify-end" style={{ backgroundColor: "rgba(15,23,42,0.5)" }} onClick={() => setDetailId(null)}>
            <div className="w-full max-w-2xl bg-white h-full overflow-auto flex flex-col" style={{ boxShadow: "-20px 0 40px rgba(0,0,0,0.2)" }} onClick={(e) => e.stopPropagation()} role="dialog" aria-label={`Job details ${j.jo}`}>
              <div className="px-6 py-5 border-b border-slate-200" style={{ backgroundColor: "#1A2B4A", color: "white" }}>
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-mono-jb" style={{ fontSize: 22, fontWeight: 600 }}>{j.jo}</div>
                    <div className="font-syne mt-1" style={{ fontSize: 16, fontWeight: 700, letterSpacing: 0.5 }}>{j.client}</div>
                    <div className="font-dm mt-0.5 text-white/70" style={{ fontSize: 13 }}>{j.product} · Qty {j.qty}</div>
                  </div>
                  <button onClick={() => setDetailId(null)} aria-label="Close" className="w-8 h-8 rounded-md hover:bg-white/10 flex items-center justify-center"><X size={18} aria-hidden /></button>
                </div>
              </div>
              <div className="p-6 flex flex-col gap-6">
                <div className="grid grid-cols-3 gap-3">
                  <DetailStat icon={Calendar} label="Due Date" value={j.due} />
                  <DetailStat icon={Wrench} label="Current Stage" value={STAGES[Math.min(j.stageIndex, STAGES.length - 1)]} />
                  <DetailStat icon={Package} label="Progress" value={`${pct}%`} />
                </div>
                <section>
                  <h4 className="font-syne mb-2" style={{ fontSize: 14, fontWeight: 700, color: "#0F172A" }}>Specifications</h4>
                  <div className="rounded-lg p-4 flex flex-col gap-1" style={{ backgroundColor: "#F4F6F9" }}>
                    {j.specs.map((s, i) => <div key={i} className="font-dm" style={{ fontSize: 13, color: "#475569", lineHeight: 1.6 }}>{s}</div>)}
                  </div>
                </section>
                <section>
                  <h4 className="font-syne mb-3" style={{ fontSize: 14, fontWeight: 700, color: "#0F172A" }}>Stage Timeline ({stageNum} of {STAGES.length})</h4>
                  <ol className="flex flex-col gap-2">
                    {STAGES.map((s, i) => {
                      const done = i < j.stageIndex;
                      const current = i === j.stageIndex && !completed;
                      return (
                        <li key={s} className="flex items-center gap-3">
                          {done ? <CheckCircle2 size={18} style={{ color: "#16A34A" }} aria-hidden />
                            : current ? <div className="w-[18px] h-[18px] rounded-full flex items-center justify-center" style={{ backgroundColor: "#2563EB" }} aria-hidden><div className="w-2 h-2 rounded-full bg-white" /></div>
                            : <Circle size={18} style={{ color: "#CBD5E1" }} aria-hidden />}
                          <span className="font-dm flex-1" style={{ fontSize: 13, fontWeight: current ? 700 : 500, color: done ? "#475569" : current ? "#0F172A" : "#94A3B8" }}>
                            {i + 1}. {s}
                          </span>
                          {current && <span className="font-dm" style={{ fontSize: 11, fontWeight: 600, color: "#2563EB" }}>CURRENT</span>}
                        </li>
                      );
                    })}
                  </ol>
                </section>
                <section className="rounded-lg p-4" style={{ backgroundColor: "#FFFBEB", border: "1px solid #FDE68A" }}>
                  <h4 className="font-syne mb-2 flex items-center gap-2" style={{ fontSize: 13, fontWeight: 700, color: "#92400E" }}>
                    <User size={14} aria-hidden /> Assigned Operators
                  </h4>
                  <div className="font-dm" style={{ fontSize: 13, color: "#92400E" }}>J. Reyes (Manager) · F. Santos · M. Tan</div>
                </section>

                {/* Uploaded Documents */}
                {(j.sketch) && (
                  <section>
                    <h4 className="font-syne mb-3" style={{ fontSize: 14, fontWeight: 700, color: "#0F172A" }}>Uploaded Documents</h4>
                    <div className="flex flex-col gap-2">
                      {j.sketch && (
                        <div className="flex items-center gap-3 rounded-lg px-4 py-3" style={{ backgroundColor: "#EFF6FF", border: "1px solid #BFDBFE" }}>
                          <ClipboardList size={15} style={{ color: "#1A2B4A" }} />
                          <div className="flex-1 min-w-0">
                            <div className="font-dm" style={{ fontSize: 11, fontWeight: 700, color: "#64748B", textTransform: "uppercase", letterSpacing: 0.3 }}>Final Sketch / Drawing</div>
                            <div className="font-mono-jb truncate" style={{ fontSize: 12, fontWeight: 600, color: "#1A2B4A" }}>{j.sketch}</div>
                          </div>
                          <button
                            onClick={() => toast.info(`Opening: ${j.sketch}`, { description: "In production, this opens the drawing file" })}
                            className="font-dm flex items-center gap-1 px-2.5 py-1 rounded-md border border-blue-200 hover:bg-blue-100"
                            style={{ fontSize: 11, fontWeight: 600, color: "#1A2B4A" }}
                          >
                            <Eye size={11} /> View
                          </button>
                        </div>
                      )}
                    </div>
                  </section>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Stage Monitoring Page */}
      {monitoringJob && (
        <StageMonitoringPage
          job={monitoringJob}
          onClose={() => setStageMonitorId(null)}
          onUpdate={(updatedJob) => {
            setJobs((prev) => prev.map((j) => (j.id === updatedJob.id ? updatedJob : j)));
          }}
          onAdvance={() => {
            advanceStage(monitoringJob.id);
          }}
        />
      )}

      {/* JO File Modal */}
      {joFileJob && (
        <JOTemplateModal
          data={getJOTemplateData(joFileJob)}
          onClose={() => setJoFileJob(null)}
        />
      )}

      {/* Dispatch Label Modal */}
      {labelJob && <DispatchLabelModal job={labelJob} onClose={() => setLabelJob(null)} />}

      {/* Cancel JO modal — required reason */}
      {confirmCancelJob && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" style={{ backgroundColor: "rgba(15,23,42,0.6)" }} onClick={() => { setConfirmCancelJob(null); setCancelReason(""); }}>
          <div className="bg-white rounded-xl w-full max-w-md flex flex-col" style={{ boxShadow: "0 24px 48px rgba(0,0,0,0.3)" }} onClick={e => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-slate-200 flex items-center gap-2" style={{ backgroundColor: "#FEF2F2" }}>
              <XCircle size={18} style={{ color: "#C8102E" }} />
              <h3 className="font-syne" style={{ fontSize: 16, fontWeight: 700, color: "#991B1B" }}>Cancel Job Order</h3>
            </div>
            <div className="p-5 flex flex-col gap-3">
              <div className="font-dm" style={{ fontSize: 13, color: "#0F172A" }}>
                <span style={{ fontWeight: 700 }}>{confirmCancelJob.jo}</span> · {confirmCancelJob.client} · {confirmCancelJob.qty} pcs {confirmCancelJob.product}
              </div>
              <div className="rounded-md p-2.5 font-dm" style={{ fontSize: 11, color: "#92400E", backgroundColor: "#FFFBEB", border: "1px solid #FDE68A" }}>
                ⚠️ This will move the JO to the archive. The client will be notified with the reason. This cannot be undone from the production floor.
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="font-dm" style={{ fontSize: 11, fontWeight: 700, color: "#475569", letterSpacing: 0.4, textTransform: "uppercase" }}>Reason for cancellation *</label>
                <textarea
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="e.g. Client requested cancellation · Specs cannot be produced · Material unavailable"
                  rows={3}
                  className="font-dm px-3 py-2 rounded-md border border-slate-300 outline-none focus:border-slate-500 bg-white resize-none"
                  style={{ fontSize: 13, color: "#0F172A" }}
                  autoFocus
                />
              </div>
            </div>
            <div className="px-5 py-4 border-t border-slate-200 flex justify-end gap-2">
              <button onClick={() => { setConfirmCancelJob(null); setCancelReason(""); }} className="font-dm px-4 py-2 rounded-md hover:bg-slate-100" style={{ fontSize: 13, fontWeight: 600, color: "#475569" }}>Keep JO</button>
              <button
                onClick={cancelJO}
                disabled={!cancelReason.trim()}
                className="font-dm px-4 py-2 rounded-md text-white hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
                style={{ backgroundColor: "#C8102E", fontSize: 13, fontWeight: 700 }}
              >
                <XCircle size={14} /> Cancel JO &amp; Notify
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Paused Banner */}
      {pausedJob && (
        <div className="fixed bottom-0 left-[240px] right-0 px-8 py-3 flex items-center gap-4 text-white" style={{ backgroundColor: "#92400E", boxShadow: "0 -2px 8px rgba(0,0,0,0.15)" }}>
          <AlertTriangle size={18} />
          <span className="font-syne" style={{ fontSize: 13, fontWeight: 700, letterSpacing: 0.5 }}>⚠️ MATERIAL SHORTAGE — PRODUCTION PAUSED</span>
          <span className="font-dm" style={{ fontSize: 13 }}>· {pausedJob.jo} · {pausedJob.client}</span>
          <div className="ml-auto flex items-center gap-2">
            <span className="font-dm text-white/70" style={{ fontSize: 12 }}>Once materials arrive:</span>
            <button
              onClick={() => resumeJob(pausedJob.id)}
              className="flex items-center gap-2 px-4 py-2 rounded-md font-dm hover:opacity-90"
              style={{ backgroundColor: "#16A34A", fontSize: 12, fontWeight: 700, letterSpacing: 0.4 }}
            >
              ✅ Mark Shortage Resolved &amp; Resume
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Stage Monitoring Page ─── */
function StageMonitoringPage({
  job, onClose, onUpdate, onAdvance,
}: {
  job: Job;
  onClose: () => void;
  onUpdate: (job: Job) => void;
  onAdvance: () => void;
}) {
  const [revertStageIdx, setRevertStageIdx] = useState<number | null>(null);

  const completed = job.stageIndex >= STAGES.length - 1;

  const markDone = () => {
    if (job.paused) { toast.error("Job is paused — resolve material shortage first"); return; }
    if (completed) { toast.info("All stages already completed"); return; }
    onAdvance();
    toast.success(`✅ Stage marked done: ${STAGES[job.stageIndex]}`);
  };

  return (
    <div className="fixed inset-0 z-[100]" style={{ backgroundColor: "#F4F6F9" }}>
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-8 py-4 flex items-center justify-between sticky top-0 z-10" style={{ boxShadow: "0 1px 2px rgba(15,23,42,0.04)" }}>
        <div className="flex items-center gap-4">
          <button
            onClick={onClose}
            className="flex items-center gap-2 font-dm hover:underline"
            style={{ fontSize: 13, fontWeight: 600, color: "#1A2B4A" }}
          >
            <ArrowLeft size={16} /> Back to Production Floor
          </button>
          <span style={{ color: "#CBD5E1" }}>|</span>
          <div>
            <span className="font-mono-jb" style={{ fontSize: 16, fontWeight: 700, color: "#0F172A" }}>{job.jo}</span>
            <span className="font-dm ml-2" style={{ fontSize: 14, color: "#64748B" }}>· {job.client}</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="font-dm" style={{ fontSize: 13, color: "#64748B" }}>{job.product} · Qty {job.qty} · Due {job.due}</span>
          {job.paused && (
            <span className="font-dm flex items-center gap-1 px-2.5 py-1 rounded-full" style={{ fontSize: 11, fontWeight: 700, backgroundColor: "#FEE2E2", color: "#991B1B" }}>
              <Pause size={11} /> PAUSED
            </span>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="px-8 py-8 overflow-auto" style={{ height: "calc(100vh - 65px - 80px)" }}>
        <div className="max-w-2xl mx-auto">
          <h2 className="font-syne mb-2" style={{ fontSize: 20, fontWeight: 700, color: "#0F172A" }}>Production Timeline</h2>
          <p className="font-dm mb-6" style={{ fontSize: 13, color: "#64748B" }}>Full stage history · Click ✏ Edit/Revert to update any completed stage</p>

          <div className="flex flex-col gap-3">
            {STAGES.map((stageName, i) => {
              const isDone = i < job.stageIndex;
              const isCurrent = i === job.stageIndex && !completed;
              const isCompleted = i === job.stageIndex && completed;
              const isPending = i > job.stageIndex;
              const history = job.stageHistory[i];

              let statusLabel = isPending ? "Pending" : isCurrent ? "Current" : isCompleted ? "Done" : isDone ? "Done" : "Pending";
              let statusBg = isPending ? "#F1F5F9" : isCurrent ? "#DBEAFE" : isDone || isCompleted ? "#DCFCE7" : "#F1F5F9";
              let statusFg = isPending ? "#64748B" : isCurrent ? "#1D4ED8" : isDone || isCompleted ? "#15803D" : "#64748B";
              let statusIcon = isPending ? "⬜" : isCurrent ? "🔵" : isDone || isCompleted ? "✅" : "⬜";

              if (history?.status === "reverted") {
                statusLabel = "Reverted";
                statusBg = "#FEF3C7";
                statusFg = "#B45309";
                statusIcon = "⚠️";
              }

              return (
                <div
                  key={stageName}
                  className="bg-white rounded-xl border overflow-hidden"
                  style={{
                    borderColor: isCurrent ? "#2563EB" : isDone || isCompleted ? "#86EFAC" : "#E2E8F0",
                    boxShadow: isCurrent ? "0 0 0 2px #DBEAFE" : "0 1px 2px rgba(15,23,42,0.04)",
                  }}
                >
                  <div className="px-5 py-4 flex items-center gap-4">
                    {/* Stage Number */}
                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 font-syne"
                      style={{
                        backgroundColor: isDone || isCompleted ? "#16A34A" : isCurrent ? "#2563EB" : "#E2E8F0",
                        color: isDone || isCompleted || isCurrent ? "white" : "#94A3B8",
                        fontSize: 13, fontWeight: 700,
                      }}
                    >
                      {isDone || isCompleted ? "✓" : i + 1}
                    </div>

                    {/* Stage Info */}
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-dm" style={{ fontSize: 14, fontWeight: isCurrent ? 700 : 500, color: isPending ? "#94A3B8" : "#0F172A" }}>
                          {i + 1}. {stageName}
                        </span>
                        <span
                          className="font-dm px-2 py-0.5 rounded-full"
                          style={{ fontSize: 10, fontWeight: 700, backgroundColor: statusBg, color: statusFg }}
                        >
                          {statusIcon} {statusLabel}
                        </span>
                      </div>
                      {history && (
                        <div className="font-dm mt-0.5" style={{ fontSize: 12, color: "#64748B" }}>
                          {history.date} · Marked by {history.markedBy}
                          {history.reason && <span style={{ color: "#B45309" }}> · Reason: {history.reason}</span>}
                        </div>
                      )}
                      {isCurrent && (
                        <div className="font-dm mt-0.5" style={{ fontSize: 12, color: "#2563EB", fontWeight: 600 }}>
                          ← Currently in progress
                        </div>
                      )}
                    </div>

                    {/* Edit/Revert Button (only on done stages) */}
                    {(isDone || isCompleted) && (
                      <button
                        onClick={() => setRevertStageIdx(i)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-slate-200 hover:bg-slate-50 font-dm shrink-0"
                        style={{ fontSize: 12, fontWeight: 600, color: "#475569" }}
                      >
                        <Pencil size={12} /> Edit/Revert
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Activity Log */}
          {job.activityLog.length > 0 && (
            <div className="mt-8">
              <h3 className="font-syne mb-3" style={{ fontSize: 14, fontWeight: 700, color: "#0F172A" }}>Activity Log</h3>
              <div className="flex flex-col gap-2">
                {job.activityLog.map((entry) => (
                  <div key={entry.id} className="rounded-lg px-4 py-3 border border-slate-200 bg-white">
                    <div className="flex items-start justify-between">
                      <div className="font-dm" style={{ fontSize: 13, color: "#0F172A" }}>
                        <span style={{ fontWeight: 600 }}>{entry.user}</span> changed{" "}
                        <span style={{ fontWeight: 600 }}>{entry.stageName}</span>:{" "}
                        <span style={{ color: "#64748B" }}>{entry.oldStatus} → {entry.newStatus}</span>
                      </div>
                      <span className="font-dm" style={{ fontSize: 11, color: "#94A3B8", whiteSpace: "nowrap", marginLeft: 8 }}>{entry.timestamp}</span>
                    </div>
                    <div className="font-dm mt-0.5" style={{ fontSize: 12, color: "#64748B" }}>
                      Reason: {entry.reason}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 px-8 py-4 flex items-center gap-4" style={{ boxShadow: "0 -2px 8px rgba(0,0,0,0.06)" }}>
        <button
          onClick={markDone}
          disabled={completed || job.paused}
          className="flex items-center gap-2 px-6 py-3 rounded-lg text-white font-syne hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ backgroundColor: "#C8102E", fontSize: 14, fontWeight: 700, letterSpacing: 0.4 }}
        >
          <CheckCircle2 size={18} strokeWidth={2.5} /> ✅ MARK CURRENT STAGE DONE
        </button>
        <button
          onClick={() => {
            toast.warning("Material shortage reported", { description: "Management has been notified" });
          }}
          className="flex items-center gap-2 px-5 py-3 rounded-lg font-dm border-2 hover:bg-slate-50"
          style={{ borderColor: "#D97706", color: "#92400E", fontSize: 13, fontWeight: 700 }}
        >
          <AlertTriangle size={16} /> ⚠️ REPORT MATERIAL SHORTAGE
        </button>
        <div className="flex-1 text-right">
          <span className="font-dm" style={{ fontSize: 12, color: "#64748B" }}>
            Stage {Math.min(job.stageIndex + 1, STAGES.length)} of {STAGES.length} · {Math.round(((job.stageIndex + (completed ? 1 : 0)) / STAGES.length) * 100)}% complete
          </span>
        </div>
      </div>

      {/* Revert/Edit Stage Modal */}
      {revertStageIdx !== null && (
        <RevertStageModal
          stageName={STAGES[revertStageIdx]}
          stageIndex={revertStageIdx}
          job={job}
          onClose={() => setRevertStageIdx(null)}
          onSave={(newStatus, reason) => {
            const newHistory = [...job.stageHistory];
            newHistory[revertStageIdx] = {
              markedBy: "Tricia (Management)",
              date: "Apr 26",
              status: newStatus === "Completed" ? "done" : "reverted",
              reason,
            };

            let newStageIndex = job.stageIndex;
            if (newStatus === "Set as Current") {
              newStageIndex = revertStageIdx;
            } else if (newStatus === "Pending" && revertStageIdx < job.stageIndex) {
              newStageIndex = revertStageIdx;
              // Clear history for stages after this
              for (let k = revertStageIdx; k < 10; k++) { newHistory[k] = null; }
            }

            const logEntry: ActivityEntry = {
              id: `log-${Date.now()}`,
              timestamp: new Date().toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }),
              user: "Tricia (Management)",
              stageName: STAGES[revertStageIdx],
              oldStatus: "Done",
              newStatus,
              reason,
            };

            onUpdate({ ...job, stageIndex: newStageIndex, stageHistory: newHistory, activityLog: [...job.activityLog, logEntry] });
            setRevertStageIdx(null);
            toast.success("Stage updated", { description: `${STAGES[revertStageIdx]} → ${newStatus}` });
          }}
        />
      )}
    </div>
  );
}

/* ─── Revert/Edit Stage Modal ─── */
function RevertStageModal({
  stageName, stageIndex, job, onClose, onSave,
}: {
  stageName: string;
  stageIndex: number;
  job: Job;
  onClose: () => void;
  onSave: (newStatus: "Completed" | "Set as Current" | "Pending", reason: string) => void;
}) {
  const [newStatus, setNewStatus] = useState<"Completed" | "Set as Current" | "Pending">("Completed");
  const [reason, setReason] = useState("");

  const save = () => {
    if (!reason.trim()) { toast.error("Reason is required"); return; }
    onSave(newStatus, reason.trim());
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" style={{ backgroundColor: "rgba(15,23,42,0.65)" }} onClick={onClose}>
      <div className="bg-white rounded-xl w-full max-w-lg overflow-hidden" style={{ boxShadow: "0 24px 48px rgba(0,0,0,0.3)" }} onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-5 border-b border-slate-200 flex items-center justify-between">
          <h3 className="font-syne" style={{ fontSize: 18, fontWeight: 700, color: "#0F172A" }}>
            Update Stage — {stageName}
          </h3>
          <button onClick={onClose} aria-label="Close" className="w-8 h-8 rounded-md hover:bg-slate-100 flex items-center justify-center"><X size={16} /></button>
        </div>

        <div className="p-6 flex flex-col gap-4">
          {/* Warning Banner */}
          <div className="rounded-lg px-4 py-3 flex items-start gap-3" style={{ backgroundColor: "#FFFBEB", border: "1px solid #FDE68A" }}>
            <AlertTriangle size={16} style={{ color: "#D97706", marginTop: 2, shrink: 0 }} />
            <span className="font-dm" style={{ fontSize: 13, color: "#92400E" }}>
              Reverting a stage will update the production timeline and notify management.
            </span>
          </div>

          {/* Status Options */}
          <div>
            <div className="font-dm mb-2" style={{ fontSize: 12, fontWeight: 600, color: "#475569" }}>Change status to:</div>
            <div className="flex gap-2">
              {(["Completed", "Set as Current", "Pending"] as const).map((s) => {
                const active = newStatus === s;
                const icons = { Completed: "✅", "Set as Current": "🔵", Pending: "⬜" };
                return (
                  <button
                    key={s}
                    onClick={() => setNewStatus(s)}
                    className="flex-1 py-2.5 rounded-lg font-dm transition-colors"
                    style={{
                      fontSize: 12, fontWeight: 700,
                      backgroundColor: active ? (s === "Completed" ? "#DCFCE7" : s === "Set as Current" ? "#DBEAFE" : "#F1F5F9") : "#F8FAFC",
                      color: active ? (s === "Completed" ? "#15803D" : s === "Set as Current" ? "#1D4ED8" : "#475569") : "#64748B",
                      border: active ? `2px solid ${s === "Completed" ? "#86EFAC" : s === "Set as Current" ? "#93C5FD" : "#CBD5E1"}` : "1px solid #E2E8F0",
                    }}
                  >
                    {icons[s]} {s}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Reason */}
          <div>
            <div className="font-dm mb-1" style={{ fontSize: 12, fontWeight: 600, color: "#475569" }}>Reason (required)</div>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder='e.g. "Failed quality check", "Human error — needs redo", "Client requested spec change"'
              rows={3}
              className="w-full font-dm px-3 py-2.5 rounded-md border border-slate-200 outline-none focus:border-slate-400 resize-none"
              style={{ fontSize: 13 }}
            />
          </div>
        </div>

        <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-end gap-3">
          <button onClick={onClose} className="font-dm px-4 py-2 rounded-md hover:bg-slate-100" style={{ fontSize: 13, fontWeight: 600, color: "#475569" }}>Cancel</button>
          <button onClick={save} className="font-dm px-4 py-2 rounded-md text-white hover:opacity-90" style={{ backgroundColor: "#C8102E", fontSize: 13, fontWeight: 700 }}>Save Stage Update</button>
        </div>
      </div>
    </div>
  );
}

/* ─── Dispatch Label Modal ─── */
function DispatchLabelModal({ job, onClose }: { job: Job; onClose: () => void }) {
  const { settings } = useSettings();
  const code = `FP-2026-${String(Math.floor(Math.random() * 90000) + 10000)}`;
  const po = job.jo.replace("JO", "PO");
  const itemSpec = job.specs[1] ?? "";
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(15,23,42,0.5)" }} onClick={onClose}>
      <div className="bg-white rounded-xl w-full max-w-md flex flex-col" style={{ boxShadow: "0 20px 40px rgba(0,0,0,0.2)" }} onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <h3 className="font-syne" style={{ fontSize: 16, fontWeight: 700, color: "#0F172A" }}>Dispatch Barcode Label</h3>
          <button onClick={onClose} aria-label="Close" className="w-8 h-8 rounded-md hover:bg-slate-100 flex items-center justify-center"><X size={16} /></button>
        </div>
        <div className="p-5">
          <div className="rounded-md font-mono-jb" style={{ border: "2px solid #0F172A", backgroundColor: "white", padding: "16px 18px", fontSize: 12, color: "#0F172A", lineHeight: 1.5 }}>
            <div style={{ fontWeight: 800, letterSpacing: 0.5 }}>▲ ENTER-FIL INDUSTRIAL PRODUCTS</div>
            <div style={{ borderTop: "2px solid #0F172A", margin: "6px 0" }} />
            <div className="flex justify-between"><span>JO: {job.jo}</span><span>PO: {po}</span></div>
            <div>Client: {job.client}</div>
            <div>Item: {job.product} {itemSpec}</div>
            <div>Qty: {job.qty} pcs</div>
            <div style={{ borderTop: "1px dashed #94A3B8", margin: "6px 0" }} />
            <div style={{ fontSize: 11, color: "#475569" }}>Ship to:</div>
            <div>M. Rivera · {job.client}</div>
            <div>{settings.addressLine1}, {settings.cityProvince}</div>
            <div>📞 {settings.mainPhone}</div>
            <div style={{ borderTop: "1px dashed #94A3B8", margin: "6px 0" }} />
            <div>Method: Company Vehicle</div>
            <div style={{ borderTop: "2px solid #0F172A", margin: "6px 0" }} />
            <div className="flex flex-col items-center gap-1 py-2">
              <div className="flex items-end gap-[2px]" aria-hidden>
                {Array.from({ length: 38 }).map((_, i) => (
                  <span key={i} style={{ width: i % 3 === 0 ? 3 : 2, height: 56, backgroundColor: i % 5 === 0 ? "#0F172A" : i % 2 ? "#0F172A" : "transparent" }} />
                ))}
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: 1 }}>{code}</div>
            </div>
          </div>
          <p className="font-dm mt-3" style={{ fontSize: 11, color: "#94A3B8" }}>Designed for A6 / 4×6 inch shipping label paper.</p>
        </div>
        <div className="px-5 py-4 border-t border-slate-200 flex justify-end gap-2">
          <button onClick={onClose} className="font-dm px-4 py-2 rounded-md hover:bg-slate-100" style={{ fontSize: 13, fontWeight: 600, color: "#475569" }}>Close</button>
          <button onClick={() => { window.print(); }} className="font-dm px-4 py-2 rounded-md text-white hover:opacity-90 flex items-center gap-2" style={{ backgroundColor: "#1A2B4A", fontSize: 13, fontWeight: 700, letterSpacing: 0.4 }}>
            <Printer size={14} strokeWidth={2.5} /> Print Label
          </button>
        </div>
      </div>
    </div>
  );
}
