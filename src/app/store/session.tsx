import { createContext, useContext, type ReactNode } from "react";
import type { Role } from "../components/Login";

interface SessionCtx {
  role: Role;
  name: string;
  navigate?: (id: string, inquiryId?: string) => void;
  mode?: 'demo' | 'real';
  userId?: string;
}

const SessionContext = createContext<SessionCtx | null>(null);

export function SessionProvider({ role, name, navigate, mode = 'demo', userId, children }: SessionCtx & { children: ReactNode }) {
  return (
    <SessionContext.Provider value={{ role, name, navigate, mode, userId }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const c = useContext(SessionContext);
  /* Fall back to "operations" if not in a session — useful during shared component tests */
  return c ?? { role: "operations" as Role, name: "Demo User", navigate: undefined };
}
