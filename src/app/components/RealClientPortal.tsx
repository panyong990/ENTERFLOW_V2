import { ClientPortal } from './ClientPortal';
import { ClientDataProvider, useClientData } from './client/data';

function AuthenticatedPortal({ displayName, onLogout }: { displayName: string; onLogout?: () => void }) {
  const { profile } = useClientData();
  return <ClientPortal clientName={profile?.companyName ?? displayName} onLogout={onLogout} />;
}

export function RealClientPortal({ displayName = 'Client', onLogout }: { displayName?: string; onLogout?: () => void }) {
  return <ClientDataProvider><AuthenticatedPortal displayName={displayName} onLogout={onLogout} /></ClientDataProvider>;
}
