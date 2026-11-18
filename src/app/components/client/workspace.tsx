import { createContext, useContext } from 'react';
import { useOptionalClientData, useOrderAdapter, useSettings as useRealSettings, useNotificationAdapter, type State } from './data';
import type { Surface } from './adapters';
import type { useOrders as useDemoOrders } from '../../store/orders';
import type { useSettings as useDemoSettings } from '../../store/settings';
import type { useNotifications as useDemoNotifications } from '../../store/notifications';
import type * as companySettings from '../../store/clientCompanySettings';
import type * as attachments from '../../store/attachments';
import { NotificationBell as RealNotificationBell } from './NotificationBell';
import { NotificationsCenter as RealNotificationsCenter } from './NotificationsCenter';
import { InvoicePreviewModal as RealInvoicePreviewModal } from './InvoicePreviewModal';

// Only the development entry supplies these stores. Real mode never reads Demo persistence.
export interface DemoWorkspace {
  orders: ReturnType<typeof useDemoOrders>;
  settings: ReturnType<typeof useDemoSettings>;
  notifications: ReturnType<typeof useDemoNotifications>;
  getCompanySettings: typeof companySettings.getClientCompanySettings;
  saveCompanySettings: typeof companySettings.saveClientCompanySettings;
  loadProductSketchAttachment: typeof attachments.loadProductSketchAttachment;
  NotificationBell: typeof RealNotificationBell;
  NotificationsCenter: typeof RealNotificationsCenter;
  InvoicePreviewModal: typeof RealInvoicePreviewModal;
}
const Context = createContext<DemoWorkspace | null>(null);
export const DemoWorkspaceProvider = Context.Provider;
const emptyRealData: State = { profile: null, bundles: [], notifications: [], loading: false, error: '', refresh: () => {}, markRead: async () => {}, realMode: true };
export function useClientData() {
  const real = useOptionalClientData();
  const demo = useContext(Context);
  if (!real && !demo) throw new Error('Client workspace provider required');
  return { ...(real ?? emptyRealData), realMode: real !== null, demo: real ? null : demo };
}
export function useOrders(surface: Surface = 'orders') {
  const data = useClientData();
  const real = useOrderAdapter(data as State, surface);
  return (data.realMode ? real : data.demo!.orders) as ReturnType<typeof useOrderAdapter> & ReturnType<typeof useDemoOrders>;
}
export function useSettings() {
  const { demo } = useClientData();
  const real = useRealSettings();
  return demo?.settings ?? real;
}
export function useNotifications() {
  const data = useClientData();
  const real = useNotificationAdapter(data as State);
  return (data.realMode ? real : data.demo!.notifications) as ReturnType<typeof useDemoNotifications>;
}
export function useProductSketchLoader() {
  const { demo } = useClientData();
  return demo?.loadProductSketchAttachment ?? (async () => null);
}
export function NotificationBell(props: Parameters<typeof RealNotificationBell>[0]) {
  const { demo } = useClientData();
  const Component = demo?.NotificationBell ?? RealNotificationBell;
  return <Component {...props} />;
}
export function NotificationsCenter(props: Parameters<typeof RealNotificationsCenter>[0]) {
  const { demo } = useClientData();
  const Component = demo?.NotificationsCenter ?? RealNotificationsCenter;
  return <Component {...props} />;
}
export function InvoicePreviewModal(props: Parameters<typeof RealInvoicePreviewModal>[0]) {
  const { demo } = useClientData();
  const Component = demo?.InvoicePreviewModal ?? RealInvoicePreviewModal;
  return <Component {...props} />;
}
