import { InquiryRejectionArchive } from './sales/InquiryRejectionArchive';
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
  if (route === "sales") return <main className="flex-1 overflow-auto bg-[#F4F6F9] p-8" aria-labelledby="sales-unavailable-title"><section className="mx-auto max-w-3xl rounded-xl border border-slate-200 bg-white p-8 shadow-sm"><h1 id="sales-unavailable-title" className="font-syne text-2xl font-bold text-slate-900">Sales &amp; Orders</h1><p className="mt-2 text-sm text-slate-600">Authenticated Sales records are unavailable for this role’s current workspace. Demo records are not shown.</p></section></main>;
  return <div className="flex min-h-0 min-w-0 flex-1 flex-col">
    <div className="min-h-0 flex-1 overflow-hidden" aria-label="Existing role workspace">
      <DemoReferenceScreen role={role} route={route} onNavigate={onNavigate} />
    </div>
  </div>;
}
