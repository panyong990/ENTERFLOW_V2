import { useEffect, useState } from "react";
import { SessionProvider, useSession } from "../../store/session";
import { Clients } from "../Clients";
import { Dashboard as SalesDashboard } from "./SalesDashboard";
import { SalesPipeline } from "./SalesPipeline";
import { SalesNotificationsCenter } from "./SalesNotificationsCenter";

export function RealSalesWorkspace({ route, onNavigate }: { route: string; onNavigate: (id: string) => void }) {
  const session = useSession();
  const [message, setMessage] = useState("");
  const [target, setTarget] = useState<string | undefined>();
  useEffect(() => {
    const pending = (event: Event) => setMessage((event as CustomEvent<string>).detail);
    window.addEventListener("enterflow:sales-pending", pending);
    return () => window.removeEventListener("enterflow:sales-pending", pending);
  }, []);
  const navigate = (id: string, orderId?: string) => { setTarget(orderId); onNavigate(id); };
  return <SessionProvider mode="real" role="sales" name={session.name} userId={session.userId} navigate={navigate}>
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      {message && <div role="alert" className="flex shrink-0 items-center justify-between gap-3 border-b border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950"><span>{message}</span><button aria-label="Dismiss integration notice" onClick={() => setMessage("")}>Dismiss</button></div>}
      <div className="min-h-0 flex-1 overflow-hidden" aria-label="Authenticated Sales workspace">
        {route === "dashboard" ? <SalesDashboard variant="sales" onNavigate={navigate} /> : route === "sales" ? <SalesPipeline targetInquiryId={target} /> : route === "clients" ? <Clients /> : route === "notifications" ? <SalesNotificationsCenter /> : <p role="alert">Sales destination unavailable.</p>}
      </div>
    </div>
  </SessionProvider>;
}
