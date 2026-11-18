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
import { AdminDashboard } from "./AdminDashboard";
import { EmployeeManagement } from "./EmployeeManagement";
import { ClientManagement } from "./ClientManagement";
import { RolesPermissions } from "./RolesPermissions";

function OriginalRoleScreen({ role, route, onNavigate, targetInquiryId }: { role: EmployeeRole; route: string; onNavigate: (id: string, inquiryId?: string) => void; targetInquiryId?: string }) {
  if (route === "dashboard" && role === "admin") return <AdminDashboard />;
  if (route === "dashboard") return <Dashboard variant={role} onNavigate={onNavigate} />;
  if (route === "sales") return <SalesOrders targetInquiryId={targetInquiryId} />;
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
  if (route === "clients" && role === "admin") return <ClientManagement />;
  if (route === "client-requests" && role === "admin") return <ClientManagement initialTab="requests" />;
  if (route === "employee-management" && role === "admin") return <EmployeeManagement />;
  if (route === "roles" && role === "admin") return <RolesPermissions />;
  if (route === "clients") return <Clients />;
  if (route === "notifications") return <NotificationsCenter />;
  if (route === "analytics") return <AnalyticsFullView />;
  if (route === "settings") return <Settings />;
  return <main className="flex-1 p-8" role="status">This role has no workspace for this route.</main>;
}

export function RealRoleWorkspace({ role, route, onNavigate, targetInquiryId }: { role: EmployeeRole; route: string; onNavigate: (id: string, inquiryId?: string) => void; targetInquiryId?: string }) {
  if (route==='inquiry-rejections' && (role==='owner'||role==='operations')) return <InquiryRejectionArchive />;
  return <div className="flex min-h-0 min-w-0 flex-1 flex-col">
    <div className="min-h-0 flex-1 overflow-hidden" aria-label="Existing role workspace">
      <OriginalRoleScreen role={role} route={route} onNavigate={onNavigate} targetInquiryId={targetInquiryId} />
    </div>
  </div>;
}
