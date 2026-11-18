import type { ReactNode } from 'react';
import { useOrders } from '../../store/orders';
import { useSettings } from '../../store/settings';
import { useNotifications } from '../../store/notifications';
import { getClientCompanySettings, saveClientCompanySettings } from '../../store/clientCompanySettings';
import { loadProductSketchAttachment } from '../../store/attachments';
import { NotificationBell } from '../NotificationBell';
import { NotificationsCenter } from '../NotificationsCenter';
import { InvoicePreviewModal } from '../InvoicePreviewModal';
import { DemoWorkspaceProvider } from './workspace';

export default function DemoClientDataProvider({ children }: { children: ReactNode }) {
  const orders = useOrders();
  const settings = useSettings();
  const notifications = useNotifications();
  return <DemoWorkspaceProvider value={{ orders, settings, notifications,
    getCompanySettings: getClientCompanySettings, saveCompanySettings: saveClientCompanySettings,
    loadProductSketchAttachment, NotificationBell, NotificationsCenter, InvoicePreviewModal,
  }}>{children}</DemoWorkspaceProvider>;
}
