import { useEffect, useState } from "react";
import { useSession } from "../../store/session";
import { Clients } from "../Clients";
import { Dashboard } from "../Dashboard";
import { SalesOrders } from "../SalesOrders";
import { NotificationsCenter } from "../NotificationsCenter";

// Legacy entry point only. The main role router uses these shared screens directly.
export function RealSalesWorkspace({ route, onNavigate }: { route: string; onNavigate: (id: string, inquiryId?: string) => void }) {
  const session = useSession();
  const [target, setTarget] = useState<string | undefined>();
  useEffect(() => setTarget(undefined), [route]);
  const navigate = (id: string, inquiryId?: string) => { setTarget(inquiryId); onNavigate(id, inquiryId); };
  return <div className="min-h-0 min-w-0 flex-1 overflow-hidden">
    {route === "dashboard" ? <Dashboard variant="sales" onNavigate={navigate} /> : route === "sales" ? <SalesOrders targetInquiryId={target} /> : route === "clients" ? <Clients /> : route === "notifications" ? <NotificationsCenter role="sales" onNavigate={navigate} /> : <p role="status">Sales destination unavailable.</p>}
  </div>;
}
