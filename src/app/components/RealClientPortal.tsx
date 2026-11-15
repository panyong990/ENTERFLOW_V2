import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError } from "../api/client";
import {
  clientPortalApi, type ClientDashboard, type ClientInvoice, type ClientJobOrder,
  type ClientNotification, type ClientOrder, type ClientOrderDetail, type ClientPayment,
  type ClientProfile, type ClientPurchaseOrder, type ClientQuotation, type ClientShipment,
} from "../api/clientPortal";

type Tab = "dashboard" | "orders" | "notifications" | "profile";
type Detail = { order: ClientOrderDetail; quotations: ClientQuotation[]; purchaseOrder: ClientPurchaseOrder | null; jobOrders: ClientJobOrder[]; shipments: ClientShipment[]; invoices: ClientInvoice[]; payments: ClientPayment[] };

const date = (value: string | null | undefined) => value ? new Date(value).toLocaleDateString() : "—";
const amount = (value: string | null | undefined) => value ?? "—";

function ErrorState({ message, retry }: { message: string; retry: () => void }) {
  return <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-800"><p>{message}</p><button className="mt-3 rounded border border-red-300 bg-white px-3 py-1.5 font-semibold" onClick={retry}>Retry</button></div>;
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">{children}</div>;
}

function DetailView({ detail, onBack }: { detail: Detail; onBack: () => void }) {
  const { order } = detail;
  return <div className="space-y-5">
    <button className="text-sm font-semibold text-red-700" onClick={onBack}>← Back to orders</button>
    <section className="rounded-xl border bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs uppercase tracking-wide text-slate-500">Order</p><h2 className="text-xl font-bold text-slate-900">{order.reference}</h2></div><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{order.stageLabel ?? "—"}</span></div>
      <div className="mt-4 grid gap-3 text-sm sm:grid-cols-3"><div><span className="text-slate-500">Submitted</span><div>{date(order.submittedAt)}</div></div><div><span className="text-slate-500">Requested delivery</span><div>{date(order.requestedDeliveryDate)}</div></div><div><span className="text-slate-500">Items</span><div>{order.itemCount}</div></div></div>
    </section>
    <section className="rounded-xl border bg-white p-5"><h3 className="font-bold">Order items</h3>{order.items.length ? <div className="mt-3 space-y-2">{order.items.map(item => <div className="rounded border p-3 text-sm" key={item.id}><div className="font-semibold">Line {item.lineNumber} · Specification {item.specificationId}</div><div className="text-slate-600">Quantity: {String(item.quantity)}</div></div>)}</div> : <p className="mt-3 text-sm text-slate-500">No order items.</p>}</section>
    <section className="grid gap-5 lg:grid-cols-2">
      <div className="rounded-xl border bg-white p-5"><h3 className="font-bold">Quotations</h3>{detail.quotations.length ? detail.quotations.map(q => <div className="mt-3 rounded border p-3 text-sm" key={q.id}><div className="flex justify-between gap-2 font-semibold"><span>{q.reference} · Revision {q.revisionNumber}</span><span>{q.status}</span></div><div className="mt-1 text-slate-600">Issued {date(q.issuedOn)} · Valid until {date(q.validUntil)}</div><div className="mt-1">Total: {amount(q.totalAmount)}</div></div>) : <p className="mt-3 text-sm text-slate-500">No sent quotations.</p>}</div>
      <div className="rounded-xl border bg-white p-5"><h3 className="font-bold">Purchase order</h3>{detail.purchaseOrder ? <div className="mt-3 text-sm"><div className="font-semibold">{detail.purchaseOrder.reference}</div><div className="text-slate-600">Uploaded {date(detail.purchaseOrder.uploadedAt)} · Received {date(detail.purchaseOrder.receivedAt)}</div></div> : <p className="mt-3 text-sm text-slate-500">No purchase order.</p>}</div>
    </section>
    <section className="grid gap-5 lg:grid-cols-2">
      <div className="rounded-xl border bg-white p-5"><h3 className="font-bold">Production</h3>{detail.jobOrders.length ? detail.jobOrders.map(job => <div className="mt-3 rounded border p-3 text-sm" key={job.id}><div className="font-semibold">{job.reference} · {job.status ?? "—"}</div><div className="text-slate-600">Due {date(job.productionDueDate)} · {job.productionStageLabel ?? "—"}</div><div>Completed: {job.completed ? date(job.completedAt) : "No"}</div></div>) : <p className="mt-3 text-sm text-slate-500">No job orders.</p>}</div>
      <div className="rounded-xl border bg-white p-5"><h3 className="font-bold">Delivery</h3>{detail.shipments.length ? detail.shipments.map(shipment => <div className="mt-3 rounded border p-3 text-sm" key={shipment.id}><div className="font-semibold">{shipment.deliveryMethodLabel} · {shipment.status ?? "—"}</div><div className="text-slate-600">Tracking reference: {shipment.trackingReference ?? "—"}</div><div>Delivery date: {date(shipment.deliveredAt ?? shipment.estimatedDeliveryDate)}</div></div>) : <p className="mt-3 text-sm text-slate-500">No delivery records.</p>}</div>
    </section>
    <section className="grid gap-5 lg:grid-cols-2"><div className="rounded-xl border bg-white p-5"><h3 className="font-bold">Invoices</h3>{detail.invoices.length ? detail.invoices.map(invoice => <div className="mt-3 rounded border p-3 text-sm" key={invoice.id}><div className="font-semibold">{invoice.reference}</div><div>Amount: {invoice.amount} · Due: {date(invoice.dueOn)}</div></div>) : <p className="mt-3 text-sm text-slate-500">No sent invoices.</p>}</div><div className="rounded-xl border bg-white p-5"><h3 className="font-bold">Payments</h3>{detail.payments.length ? detail.payments.map(payment => <div className="mt-3 rounded border p-3 text-sm" key={payment.id}><div className="font-semibold">{payment.paymentType} · {payment.verificationStatus}</div><div>Submitted: {payment.submittedAmount} · Verified: {payment.verifiedAmount ?? "—"}</div></div>) : <p className="mt-3 text-sm text-slate-500">No payment records.</p>}</div></section>
  </div>;
}

export function RealClientPortal({ onLogout, displayName = "Client" }: { onLogout?: () => void; displayName?: string }) {
  const [tab, setTab] = useState<Tab>("dashboard");
  const [profile, setProfile] = useState<ClientProfile | null>(null);
  const [dashboard, setDashboard] = useState<ClientDashboard | null>(null);
  const [orders, setOrders] = useState<ClientOrder[]>([]);
  const [notifications, setNotifications] = useState<ClientNotification[]>([]);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState("");
  const [detailError, setDetailError] = useState("");
  const [retry, setRetry] = useState(0);
  const detailController = useRef<AbortController | null>(null);

  const load = useCallback((signal: AbortSignal) => {
    setLoading(true); setError("");
    return Promise.all([clientPortalApi.profile(signal), clientPortalApi.dashboard(signal), clientPortalApi.orders({ page: 1, pageSize: 100, status: "all", sort: "submitted-desc" }, signal), clientPortalApi.notifications({ page: 1, pageSize: 50, status: "all", sort: "created-desc" }, signal)])
      .then(([nextProfile, nextDashboard, nextOrders, nextNotifications]) => { setProfile(nextProfile); setDashboard(nextDashboard); setOrders(nextOrders.items); setNotifications(nextNotifications.items); })
      .catch(cause => { if ((cause as Error).name !== "AbortError") setError(cause instanceof ApiError ? cause.message : "Client Portal data could not be loaded."); })
      .finally(() => { if (!signal.aborted) setLoading(false); });
  }, []);

  useEffect(() => { const controller = new AbortController(); void load(controller.signal); return () => controller.abort(); }, [load, retry]);

  useEffect(() => () => detailController.current?.abort(), []);

  const openOrder = useCallback((id: string) => {
    detailController.current?.abort();
    const controller = new AbortController();
    detailController.current = controller;
    setDetailId(id);
    setDetailLoading(true); setDetailError(""); setDetail(null);
    void Promise.all([clientPortalApi.order(id, controller.signal), clientPortalApi.quotations(id, controller.signal), clientPortalApi.purchaseOrder(id, controller.signal), clientPortalApi.jobOrders(id, controller.signal), clientPortalApi.delivery(id, controller.signal), clientPortalApi.invoices(id, controller.signal), clientPortalApi.payments(id, controller.signal)])
      .then(([order, quotations, purchaseOrder, jobOrders, delivery, invoices, payments]) => setDetail({ order, quotations, purchaseOrder, jobOrders: jobOrders.jobOrders, shipments: delivery.shipments, invoices, payments }))
      .catch(cause => { if ((cause as Error).name !== "AbortError") setDetailError(cause instanceof ApiError ? cause.message : "Order details could not be loaded."); })
      .finally(() => { if (detailController.current === controller) setDetailLoading(false); });
  }, []);

  const markRead = async (notification: ClientNotification) => {
    if (notification.isRead) return;
    try { await clientPortalApi.markNotificationRead(notification.id); setNotifications(current => current.map(item => item.id === notification.id ? { ...item, isRead: true, readAt: new Date().toISOString() } : item)); }
    catch (cause) { setError(cause instanceof ApiError ? cause.message : "Notification could not be updated."); }
  };

  const title = profile?.companyName ?? displayName;
  return <div className="size-full overflow-auto bg-[#F4F6F9] font-dm text-slate-900"><header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b bg-white px-5 sm:px-8"><div><div className="font-syne text-base font-extrabold">ENTER-FIL</div><div className="text-[11px] text-slate-500">Client Portal</div></div><div className="flex items-center gap-4 text-sm"><span>Welcome, <strong>{title}</strong></span><button className="font-semibold text-red-700" onClick={onLogout}>Logout</button></div></header><nav className="flex gap-1 overflow-x-auto border-b bg-white px-5 sm:px-8">{([['dashboard','Dashboard'],['orders','Orders'],['notifications','Notifications'],['profile','Company profile']] as [Tab,string][]).map(([id,label]) => <button key={id} className={`border-b-2 px-3 py-3 text-sm font-semibold ${tab === id ? "border-red-600 text-red-700" : "border-transparent text-slate-500"}`} onClick={() => { setTab(id); setDetail(null); }}>{label}{id === 'notifications' && notifications.some(n => !n.isRead) ? ` (${notifications.filter(n => !n.isRead).length})` : ""}</button>)}</nav><main className="mx-auto max-w-7xl space-y-5 p-5 sm:p-8">{loading ? <div role="status" className="rounded-xl border bg-white p-8 text-center text-sm text-slate-500">Loading Client Portal…</div> : error ? <ErrorState message={error} retry={() => setRetry(value => value + 1)} /> : detail ? <DetailView detail={detail} onBack={() => setDetail(null)} /> : detailLoading ? <div role="status" className="rounded-xl border bg-white p-8 text-center text-sm text-slate-500">Loading order details…</div> : detailError ? <ErrorState message={detailError} retry={() => { if (detailId) openOrder(detailId); }} /> : tab === "dashboard" ? <DashboardView dashboard={dashboard} onOrder={(id) => { setTab("orders"); openOrder(id); }} /> : tab === "orders" ? <OrdersView orders={orders} onOrder={openOrder} /> : tab === "notifications" ? <NotificationsView notifications={notifications} onRead={markRead} /> : <ProfileView profile={profile} />}</main></div>;
}

function DashboardView({ dashboard, onOrder }: { dashboard: ClientDashboard | null; onOrder: (id: string) => void }) {
  if (!dashboard) return <Empty>Dashboard data is unavailable.</Empty>;
  return <div className="space-y-5"><h1 className="text-2xl font-bold">Dashboard</h1><div className="grid gap-4 sm:grid-cols-4">{[['Active orders', dashboard.activeOrders], ['Pending inquiries', dashboard.pendingInquiries], ['Sent quotations', dashboard.sentQuotations], ['Sent invoices', dashboard.openInvoices]].map(([label,value]) => <div className="rounded-xl border bg-white p-5" key={String(label)}><div className="text-xs uppercase tracking-wide text-slate-500">{label}</div><div className="mt-2 text-3xl font-bold">{String(value)}</div></div>)}</div><div className="grid gap-5 lg:grid-cols-2"><section className="rounded-xl border bg-white p-5"><h2 className="font-bold">Recent order activity</h2>{dashboard.recentOrderActivity.length ? dashboard.recentOrderActivity.map(item => <button className="mt-3 block w-full rounded border p-3 text-left text-sm" key={item.id} onClick={() => onOrder(item.id)}><span className="font-semibold">{item.reference}</span><span className="ml-2 text-slate-600">{item.stageLabel ?? "—"}</span><div className="text-xs text-slate-500">Updated {date(item.updatedAt)}</div></button>) : <p className="mt-3 text-sm text-slate-500">No recent activity.</p>}</section><section className="rounded-xl border bg-white p-5"><h2 className="font-bold">Upcoming deliveries</h2>{dashboard.upcomingDeliveries.length ? dashboard.upcomingDeliveries.map(item => <div className="mt-3 rounded border p-3 text-sm" key={item.id}><div className="font-semibold">{item.deliveryMethodLabel} · {item.status ?? "—"}</div><div className="text-slate-600">{date(item.estimatedDeliveryDate ?? item.expectedPickupDate)}</div></div>) : <p className="mt-3 text-sm text-slate-500">No upcoming deliveries.</p>}</section></div></div>;
}

function OrdersView({ orders, onOrder }: { orders: ClientOrder[]; onOrder: (id: string) => void }) {
  return <div className="space-y-5"><h1 className="text-2xl font-bold">Orders and inquiries</h1>{orders.length ? <div className="grid gap-4 md:grid-cols-2">{orders.map(order => <button className="rounded-xl border bg-white p-5 text-left" key={order.id} onClick={() => onOrder(order.id)}><div className="flex justify-between gap-3"><span className="font-bold">{order.reference}</span><span className="text-xs font-semibold text-slate-600">{order.stageLabel ?? "—"}</span></div><div className="mt-3 text-sm text-slate-600">Submitted {date(order.submittedAt)} · {order.itemCount} item(s)</div></button>)}</div> : <Empty>No orders or inquiries found.</Empty>}</div>;
}

function NotificationsView({ notifications, onRead }: { notifications: ClientNotification[]; onRead: (notification: ClientNotification) => void }) {
  return <div className="space-y-5"><h1 className="text-2xl font-bold">Notifications</h1>{notifications.length ? notifications.map(notification => <button className={`block w-full rounded-xl border bg-white p-5 text-left ${notification.isRead ? "" : "border-red-200"}`} key={notification.id} onClick={() => void onRead(notification)}><div className="flex justify-between gap-3"><span className="font-bold">{notification.title}</span>{!notification.isRead && <span className="text-xs font-semibold text-red-700">Unread</span>}</div><p className="mt-2 text-sm text-slate-600">{notification.message}</p><p className="mt-2 text-xs text-slate-500">{date(notification.createdAt)}</p></button>) : <Empty>No notifications.</Empty>}</div>;
}

function ProfileView({ profile }: { profile: ClientProfile | null }) {
  if (!profile) return <Empty>Company profile is unavailable.</Empty>;
  return <div className="space-y-5"><h1 className="text-2xl font-bold">Company profile</h1><section className="grid gap-4 rounded-xl border bg-white p-5 text-sm sm:grid-cols-2">{[['Company', profile.companyName], ['Industry', profile.industry], ['Contact', profile.contactPerson], ['Email', profile.email], ['Phone', profile.phone], ['Address', [profile.addressLine1, profile.addressLine2, profile.cityProvince, profile.postalCode].filter(Boolean).join(', ') || null], ['Payment terms', profile.paymentTermLabel]].map(([label,value]) => <div key={String(label)}><div className="text-xs uppercase tracking-wide text-slate-500">{label}</div><div className="mt-1">{String(value ?? "—")}</div></div>)}</section></div>;
}
