import { useEffect, useState } from "react";
import { Sidebar } from "./components/Sidebar";
import { Dashboard } from "./components/Dashboard";
import { SalesOrders } from "./components/SalesOrders";
import { ProductionFloor } from "./components/ProductionFloor";
import { OperationsProductionFloor } from "./components/OperationsProductionFloor";
import { Inventory } from "./components/Inventory";
import { WaybillScanner } from "./components/WaybillScanner";
import { WaybillHistory } from "./components/WaybillHistory";
import { WaybillMonitoring } from "./components/WaybillMonitoring";
import { Logistics, LogisticsActiveJobs, OperationsLogistics } from "./components/Logistics";
import { Accounting } from "./components/Accounting";
import { DeliveryReceipts } from "./components/DeliveryReceipts";
import { UserManagementView } from "./components/UserManagementView";
import { ClientManagement } from "./components/ClientManagement";
import { EmployeeManagement } from "./components/EmployeeManagement";
import { RolesPermissions } from "./components/RolesPermissions";
import { AdminDashboard } from "./components/AdminDashboard";
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
import { api, enableRealRequests, type RealIdentity } from "./api/client";
import { allowedFor, landingFor } from "./role-access";
import { RealEmployeeShell, RealWorkspaceUnavailable } from "./components/RealEmployeeShell";

interface Session { role: Role; name: string }

function Shell({session,onLogout}: {session:Session;onLogout:()=>void}) {
  const [active, setActive] = useState(landingFor[session.role]);
  const { inquiries } = useOrders();
  const { unreadFor } = useNotifications();

  const logout = onLogout;

  if (session.role === "client") {
    return <ClientPortal onLogout={logout} clientName={session.name} />;
  }

  const role = session.role;
  const allowed = allowedFor[role];
  const isLogisticsActiveJobs = role === "logistics" && active === "logistics-active-jobs";
  const permissionRoute = active === "inventory-finished" ? "inventory" : active;
  const isAllowed = allowed.includes(permissionRoute) || isLogisticsActiveJobs;

  const poCount = inquiries.filter((i) => i.stage === "po").length;
  const inquiryCount = inquiries.filter((i) => i.stage === "inquiry").length;
  const unreadCount = unreadFor(role).filter(n => !n.read).length;
  const badges: Record<string, number> = { sales: poCount + inquiryCount };

  const screen = !isAllowed ? <Unauthorized /> :
    active === "sales" ? <SalesOrders /> :
    active === "production" && role === "operations" ? <OperationsProductionFloor /> :
    active === "production" ? <ProductionFloor /> :
    active === "inventory" || active === "inventory-finished"
      ? <Inventory key={active} initialTab={active === "inventory-finished" ? "finished" : "raw"} /> :
    active === "waybill" && role === "operations" ? <WaybillMonitoring /> :
    active === "waybill" ? <WaybillScanner /> :
    active === "waybill-history" ? <WaybillHistory /> :
    active === "logistics-active-jobs" ? <LogisticsActiveJobs onBack={() => setActive("dashboard")} /> :
    active === "logistics" && role === "operations" ? <OperationsLogistics /> :
    active === "logistics" ? <Logistics /> :
    active === "dashboard" && role === "admin" ? <AdminDashboard /> :
    active === "delivery-receipts" ? <DeliveryReceipts /> :
    active === "accounting" ? <Accounting /> :
    active === "users" ? <UserManagementView /> :
    active === "employee-management" ? <EmployeeManagement /> :
    active === "roles" ? <RolesPermissions /> :
    active === "clients" ? role === "admin" ? <ClientManagement /> : <Clients /> :
    active === "notifications" ? <NotificationsCenter /> :
    active === "analytics" ? <AnalyticsFullView /> :
    active === "settings" ? <Settings /> :
    <Dashboard variant={role} onNavigate={setActive} />;

  return (
    <SessionProvider role={role} name={session.name} navigate={setActive}>
      <div className="size-full flex font-dm" style={{ backgroundColor: "#F4F6F9" }}>
        <Sidebar role={role} active={active === "inventory-finished" ? "inventory" : isLogisticsActiveJobs ? "dashboard" : active} onNavigate={setActive} onLogout={logout} badges={badges} unreadNotif={role === "production" && active === "dashboard" ? 0 : unreadCount} />
        {screen}
      </div>
    </SessionProvider>
  );
}

function DemoApp({session,onLogout}:{session:Session;onLogout:()=>void}) {
  return (
    <SettingsProvider>
      <MaterialsProvider>
        <OrdersProvider>
          <NotificationsProvider>
            <StockRequestsProvider>
              <Shell session={session} onLogout={onLogout} />
            </StockRequestsProvider>
          </NotificationsProvider>
        </OrdersProvider>
      </MaterialsProvider>
    </SettingsProvider>
  );
}


export default function App() {
  const [demo,setDemo]=useState<Session|null>(null);
  const [identity,setIdentity]=useState<RealIdentity|null>(null);
  const [checking,setChecking]=useState(true);
  const [error,setError]=useState('');
  const [active,setActive]=useState('dashboard');
  const restore=async()=>{
    setChecking(true); setError(''); enableRealRequests(true);
    try {const user=await api<RealIdentity>('/api/auth/me',{public:true});
      if(!['owner','admin','operations','sales','accounting','production','warehouse','logistics','client'].includes(user.roleCode)) throw new Error('Unsupported account role.');
      setIdentity(user);
    } catch(cause) {setIdentity(null); if((cause as {status?:number}).status!==401)setError(cause instanceof Error?cause.message:'Unable to verify session.');}
    finally{setChecking(false);}
  };
  useEffect(()=>{void restore();
    const expired=()=>{setIdentity(null);setError('Your session has expired. Please sign in again.');};
    const recheck=()=>{void restore();};
    window.addEventListener('enterflow:session-expired',expired);window.addEventListener('enterflow:session-recheck',recheck);
    return()=>{window.removeEventListener('enterflow:session-expired',expired);window.removeEventListener('enterflow:session-recheck',recheck);};
  },[]);
  const logout=async()=>{setChecking(true);try{await api('/api/auth/logout',{method:'POST',body:{}});setIdentity(null);setActive('dashboard');setError('');}
    catch(cause){setError(cause instanceof Error?cause.message:'Logout could not be confirmed.');}finally{setChecking(false);}};
  if(demo) return <div className="h-full flex flex-col"><div className="bg-amber-50 text-amber-900 border-b px-3 py-1 text-xs text-center">Demo Preview - sample data; changes stay in this browser.</div><div className="flex-1 min-h-0"><DemoApp session={demo} onLogout={()=>{setDemo(null);enableRealRequests(true);void restore();}} /></div></div>;
  if(checking)return <div className="h-full flex items-center justify-center" role="status">Checking authenticated session...</div>;
  if(!identity)return <Login onLogin={(role,name)=>{if(!import.meta.env.DEV)return;enableRealRequests(false);setDemo({role,name});}} onRealLogin={async()=>{setActive('dashboard');await restore();}} sessionError={error} />;
  if(error)return <div className="h-full flex items-center justify-center bg-slate-50"><div role="alert" className="max-w-lg rounded-xl border bg-white p-6"><p>{error}</p><button className="mt-4 rounded border p-2" onClick={()=>void logout()}>Retry sign out</button></div></div>;
  if(identity.accountType==='client')return <RealWorkspaceUnavailable title="Client Portal" detail="The authenticated Client Portal data APIs are not connected in this milestone." onLogout={()=>void logout()} />;
  if(identity.accountType!=='employee'||identity.roleCode==='client')return <RealWorkspaceUnavailable title="Workspace unavailable" detail="This account type and role combination is not supported." onLogout={()=>void logout()} />;
  if(identity.roleCode!=='admin')return <RealEmployeeShell key={`${identity.userId}:${identity.roleCode}`} identity={identity as RealIdentity & {roleCode:Exclude<Role,'client'>}} onLogout={()=>void logout()} />;
  const screen=active==='clients'||active==='client-requests'?<ClientManagement key={active} initialTab={active==='client-requests'?'requests':'directory'} />:active==='employee-management'?<EmployeeManagement />:active==='roles'?<RolesPermissions />:<AdminDashboard />;
  return <SessionProvider mode="real" role="admin" name={identity.displayName} userId={identity.userId} navigate={setActive}>
    <div className="h-full flex bg-[#F5F7FB]"><Sidebar role="admin" active={active==='client-requests'?'clients':active} onNavigate={setActive} onLogout={()=>void logout()} userName={identity.displayName} />{screen}</div>
  </SessionProvider>;
}
