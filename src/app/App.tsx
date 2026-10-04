import { useState } from "react";
import { Sidebar, allowedFor } from "./components/Sidebar";
import { Dashboard } from "./components/Dashboard";
import { SalesOrders } from "./components/SalesOrders";
import { ProductionFloor } from "./components/ProductionFloor";
import { Inventory } from "./components/Inventory";
import { WaybillScanner } from "./components/WaybillScanner";
import { WaybillHistory } from "./components/WaybillHistory";
import { Logistics } from "./components/Logistics";
import { Accounting } from "./components/Accounting";
import { UserManagement } from "./components/UserManagement";
import { Clients } from "./components/Clients";
import { Settings } from "./components/Settings";
import { NotificationsCenter } from "./components/NotificationsCenter";
import { AnalyticsFullView } from "./components/AnalyticsFullView";
import { ClientPortal } from "./components/ClientPortal";
import { Login, type Role } from "./components/Login";
import { Unauthorized } from "./components/Unauthorized";
import { OrdersProvider, useOrders } from "./store/orders";
import { SettingsProvider } from "./store/settings";
import { MaterialsProvider } from "./store/materials";
import { NotificationsProvider, useNotifications } from "./store/notifications";
import { StockRequestsProvider } from "./store/stockRequests";
import { SessionProvider } from "./store/session";

const landingFor: Record<Role, string> = {
  owner: "dashboard",
  operations: "dashboard",
  sales: "dashboard",
  accounting: "dashboard",
  production: "dashboard",
  warehouse: "inventory",
  logistics: "dashboard",
  client: "client",
};

interface Session { role: Role; name: string }

function Shell() {
  const [session, setSession] = useState<Session | null>(null);
  const [active, setActive] = useState("dashboard");
  const { inquiries } = useOrders();
  const { unreadFor } = useNotifications();

  const login = (role: Role, name: string) => {
    setSession({ role, name });
    setActive(landingFor[role]);
  };

  const logout = () => {
    setSession(null);
    setActive("dashboard");
  };

  if (!session) return <Login onLogin={login} />;

  if (session.role === "client") {
    return <ClientPortal onLogout={logout} clientName={session.name} />;
  }

  const role = session.role;
  const allowed = allowedFor[role];
  const isAllowed = allowed.includes(active);

  const poCount = inquiries.filter((i) => i.stage === "po").length;
  const inquiryCount = inquiries.filter((i) => i.stage === "inquiry").length;
  const unreadCount = unreadFor(role).filter(n => !n.read).length;
  const badges: Record<string, number> = { sales: poCount + inquiryCount };

  const screen = !isAllowed ? <Unauthorized /> :
    active === "sales" ? <SalesOrders /> :
    active === "production" ? <ProductionFloor /> :
    active === "inventory" ? <Inventory /> :
    active === "waybill" ? <WaybillScanner /> :
    active === "waybill-history" ? <WaybillHistory /> :
    active === "logistics" ? <Logistics /> :
    active === "accounting" ? <Accounting /> :
    active === "users" ? <UserManagement currentRole={role} /> :
    active === "clients" ? <Clients /> :
    active === "notifications" ? <NotificationsCenter /> :
    active === "analytics" ? <AnalyticsFullView onBack={() => setActive("dashboard")} /> :
    active === "settings" ? <Settings /> :
    <Dashboard variant={role} onNavigate={setActive} />;

  return (
    <SessionProvider role={role} name={session.name} navigate={setActive}>
      <div className="size-full flex font-dm" style={{ backgroundColor: "#F4F6F9" }}>
        <Sidebar role={role} active={active} onNavigate={setActive} onLogout={logout} badges={badges} unreadNotif={unreadCount} />
        {screen}
      </div>
    </SessionProvider>
  );
}

export default function App() {
  return (
    <SettingsProvider>
      <MaterialsProvider>
        <OrdersProvider>
          <NotificationsProvider>
            <StockRequestsProvider>
              <Shell />
            </StockRequestsProvider>
          </NotificationsProvider>
        </OrdersProvider>
      </MaterialsProvider>
    </SettingsProvider>
  );
}
