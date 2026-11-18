import { useState } from "react";
import type { RealIdentity } from "../api/client";
import { isAllowedWorkspaceRoute, landingFor, type EmployeeRole } from "../role-access";
import { SessionProvider } from "../store/session";
import { OrdersProvider } from "../store/orders";
import { MaterialsProvider } from "../store/materials";
import { NotificationsProvider } from "../store/notifications";
import { StockRequestsProvider } from "../store/stockRequests";
import { SettingsProvider } from "../store/settings";
import { Sidebar } from "./Sidebar";
import { Unauthorized } from "./Unauthorized";
import { RealRoleWorkspace } from "./RealRoleWorkspace";
import { SalesSidebar } from "./sales/SalesSidebar";

export function RealWorkspaceUnavailable({ title, detail, onLogout }: { title: string; detail?: string; onLogout?: () => void }) {
  return (
    <main className="flex-1 min-w-0 h-full overflow-auto bg-[#F5F7FB]" aria-labelledby="real-workspace-title">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white px-6 py-5">
        <h1 id="real-workspace-title" className="text-2xl font-bold text-slate-900">{title}</h1>
        <p className="mt-1 text-sm text-slate-500">Real account · authenticated workspace</p>
      </header>
      <section className="mx-auto max-w-3xl p-6" aria-live="polite">
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-amber-950">
          <h2 className="font-semibold">Live operational integration is not available yet</h2>
          <p className="mt-2 text-sm">This real workspace does not load Demo Mode data. Its operational records and actions will appear after the corresponding authenticated backend APIs are implemented.</p>
          {detail && <p className="mt-2 text-sm">{detail}</p>}
          <p className="mt-3 text-xs">No operational changes were made.</p>
          {onLogout && <button type="button" className="mt-4 rounded border border-amber-900/30 bg-white px-3 py-2 text-sm" onClick={onLogout}>Sign out</button>}
        </div>
      </section>
    </main>
  );
}

export function RealEmployeeShell({ identity, onLogout }: { identity: RealIdentity & { roleCode: EmployeeRole }; onLogout: () => void }) {
  const role = identity.roleCode;
  const [active, setActive] = useState(landingFor[role]);
  const [targetInquiryId, setTargetInquiryId] = useState<string | undefined>();
  const navigate = (route: string, inquiryId?: string) => {
    if (isAllowedWorkspaceRoute(role, route)) { setTargetInquiryId(inquiryId); setActive(route); }
  };
  const screen = !isAllowedWorkspaceRoute(role, active)
    ? <Unauthorized />
    : <RealRoleWorkspace role={role} route={active} onNavigate={navigate} targetInquiryId={targetInquiryId} />;

  return (
    <SessionProvider mode="real" role={role} name={identity.displayName} userId={identity.userId} navigate={navigate}>
      <SettingsProvider mode="real">
      <OrdersProvider mode="real">
      <MaterialsProvider mode="real">
      <NotificationsProvider mode="real">
      <StockRequestsProvider mode="real">
      <div className="flex h-full min-h-0 bg-[#F5F7FB]">
        {role === "sales" ? <SalesSidebar active={active} onNavigate={navigate} onLogout={onLogout} userName={identity.displayName} /> : <Sidebar role={role} active={active} onNavigate={navigate} onLogout={onLogout} userName={identity.displayName} />}
        <div className="flex min-w-0 flex-1 flex-col">
          {screen}
        </div>
      </div>
      </StockRequestsProvider>
      </NotificationsProvider>
      </MaterialsProvider>
      </OrdersProvider>
      </SettingsProvider>
    </SessionProvider>
  );
}
