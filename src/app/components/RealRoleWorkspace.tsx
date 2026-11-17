import { InquiryRejectionArchive } from './sales/InquiryRejectionArchive';
import { useEffect, useState } from "react";
import { AlertCircle } from "lucide-react";
import { api } from "../api/client";
import type { EmployeeRole } from "../role-access";
import { Dashboard } from "./Dashboard";
import { SalesOrders } from "./SalesOrders";
import { ProductionFloor } from "./ProductionFloor";
import { OperationsProductionFloor } from "./OperationsProductionFloor";
import { Inventory } from "./Inventory";
import { WaybillScanner } from "./WaybillScanner";
import { WaybillHistory } from "./WaybillHistory";
import { WaybillMonitoring } from "./WaybillMonitoring";
import { Logistics, LogisticsActiveJobs, OperationsLogistics } from "./Logistics";
import { Accounting } from "./Accounting";
import { DeliveryReceipts } from "./DeliveryReceipts";
import { UserManagementView } from "./UserManagementView";
import { Clients } from "./Clients";
import { NotificationsCenter } from "./NotificationsCenter";
import { AnalyticsFullView } from "./AnalyticsFullView";
import { Settings } from "./Settings";
import { RealSalesWorkspace } from "./sales/RealSalesWorkspace";

function LiveDataNotice({ role }: { role: EmployeeRole }) {
  const [salesAccess, setSalesAccess] = useState<"checking" | "confirmed" | "unavailable">(role === "sales" ? "checking" : "unavailable");
  const [unavailableOperation, setUnavailableOperation] = useState<string | null>(null);
  useEffect(() => {
    if (role !== "sales") return;
    let active = true;
    api<{ roleCode: "sales"; operationalDataAvailable: false }>("/api/workspace/sales/readiness")
      .then(result => { if (active && result.roleCode === "sales") setSalesAccess("confirmed"); })
      .catch(() => { if (active) setSalesAccess("unavailable"); });
    return () => { active = false; };
  }, [role]);

  useEffect(() => {
    const onUnavailable = (event: Event) => {
      const detail = (event as CustomEvent<{ operation?: string }>).detail;
      if (detail?.operation) setUnavailableOperation(detail.operation);
    };
    window.addEventListener("enterflow:real-operation-unavailable", onUnavailable);
    return () => window.removeEventListener("enterflow:real-operation-unavailable", onUnavailable);
  }, []);

  const detail = role === "sales" && salesAccess === "confirmed"
    ? "Sales role access is confirmed, but the readiness endpoint returns no operational data."
    : role === "sales" && salesAccess === "checking"
      ? "Checking authorized Sales workspace access; this check does not load business records."
      : "The authenticated read APIs for these operational records are not implemented or connected.";
  return <div className="shrink-0 border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-950">
    <div role="status" className="flex items-start gap-2"><AlertCircle size={15} className="mt-0.5 shrink-0" aria-hidden /><span><strong>Real data unavailable:</strong> {detail} Demo records are excluded. Search, filters, sorting, tabs, and navigation remain interactive; data-changing operations require authenticated APIs and server-side authorization.</span></div>
    {unavailableOperation && <div role="alert" className="mt-2 border-t border-amber-200 pt-2"><strong>Operation not completed:</strong> {unavailableOperation} has no connected real-mode API. No local or database record was changed.</div>}
  </div>;
}

function DemoReferenceScreen({ role, route, onNavigate }: { role: EmployeeRole; route: string; onNavigate: (id: string) => void }) {
  if (route === "dashboard") return <Dashboard variant={role} onNavigate={onNavigate} />;
  if (route === "sales") return <SalesOrders />;
  if (route === "production" && role === "operations") return <OperationsProductionFloor />;
  if (route === "production") return <ProductionFloor />;
  if (route === "inventory" || route === "inventory-finished") return <Inventory key={route} initialTab={route === "inventory-finished" ? "finished" : "raw"} />;
  if (route === "waybill" && role === "operations") return <WaybillMonitoring />;
  if (route === "waybill") return <WaybillScanner />;
  if (route === "waybill-history") return <WaybillHistory />;
  if (route === "logistics-active-jobs") return <LogisticsActiveJobs onBack={() => onNavigate("dashboard")} />;
  if (route === "logistics" && role === "operations") return <OperationsLogistics />;
  if (route === "logistics") return <Logistics />;
  if (route === "delivery-receipts") return <DeliveryReceipts />;
  if (route === "accounting") return <Accounting />;
  if (route === "users") return <UserManagementView />;
  if (route === "clients") return <Clients />;
  if (route === "notifications") return <NotificationsCenter />;
  if (route === "analytics") return <AnalyticsFullView />;
  if (route === "settings") return <Settings />;
  return <main className="flex-1 p-8" role="status">This role has no workspace for this route.</main>;
}

export function RealRoleWorkspace({ role, route, onNavigate }: { role: EmployeeRole; route: string; onNavigate: (id: string) => void }) {
  if (route==='inquiry-rejections' && (role==='owner'||role==='operations')) return <InquiryRejectionArchive />;
  if (role === "sales") return <RealSalesWorkspace route={route} onNavigate={onNavigate} />;
  return <div className="flex min-h-0 min-w-0 flex-1 flex-col">
    <LiveDataNotice role={role} />
    <div className="min-h-0 flex-1 overflow-hidden" aria-label="Existing role workspace">
      <DemoReferenceScreen role={role} route={route} onNavigate={onNavigate} />
    </div>
  </div>;
}
