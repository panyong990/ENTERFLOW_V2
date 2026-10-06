export type AccountRole =
  | "admin"
  | "owner"
  | "operations"
  | "sales"
  | "accounting"
  | "production"
  | "warehouse"
  | "logistics"
  | "client";

export interface Account {
  id: string;
  type: "employee" | "client";
  name: string;
  email: string;
  username: string;
  phone: string;
  role: AccountRole;
  password: string;
  joined: string;
  active: boolean;
  emailAlerts?: boolean;
}

const STORAGE_KEY = "enterflow.user-accounts.v1";

const seedAccounts: Account[] = [
  { id: "employee-admin", type: "employee", name: "A. Garcia", email: "admin@enter-fil.com", username: "admin", phone: "—", role: "admin", password: "demo", joined: "Oct 6, 2026", active: true, emailAlerts: true },
  { id: "employee-owner", type: "employee", name: "T. Mendoza", email: "owner@enter-fil.com", username: "owner", phone: "+63 917 100 0000", role: "owner", password: "demo", joined: "Jan 15, 2024", active: true, emailAlerts: true },
  { id: "employee-operations", type: "employee", name: "M. Aquino", email: "ops@enter-fil.com", username: "ops", phone: "+63 917 200 0000", role: "operations", password: "demo", joined: "Apr 2, 2026", active: true, emailAlerts: true },
  { id: "employee-sales", type: "employee", name: "R. Santos", email: "sales@enter-fil.com", username: "sales", phone: "+63 917 300 0000", role: "sales", password: "demo", joined: "Apr 2, 2026", active: true, emailAlerts: true },
  { id: "employee-accounting", type: "employee", name: "L. Cruz", email: "finance@enter-fil.com", username: "finance", phone: "+63 917 400 0000", role: "accounting", password: "demo", joined: "Apr 2, 2026", active: true, emailAlerts: true },
  { id: "employee-production", type: "employee", name: "J. Reyes", email: "production@enter-fil.com", username: "production", phone: "+63 917 500 0000", role: "production", password: "demo", joined: "Apr 2, 2026", active: true, emailAlerts: true },
  { id: "employee-warehouse", type: "employee", name: "F. Santos", email: "warehouse@enter-fil.com", username: "warehouse", phone: "+63 917 600 0000", role: "warehouse", password: "demo", joined: "Apr 2, 2026", active: true, emailAlerts: false },
  { id: "employee-logistics", type: "employee", name: "P. Tan", email: "logistics@enter-fil.com", username: "logistics", phone: "+63 917 700 0000", role: "logistics", password: "demo", joined: "Apr 2, 2026", active: true, emailAlerts: true },
  { id: "client-be-aerospace", type: "client", name: "B.E. Aerospace", email: "client@be-aerospace.com", username: "client", phone: "—", role: "client", password: "demo", joined: "Mar 2023", active: true, emailAlerts: true },
];

export function getAccounts(): Account[] {
  if (typeof window === "undefined") return seedAccounts;
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (!stored) return seedAccounts;
  const parsed: unknown = JSON.parse(stored);
  if (!Array.isArray(parsed) || !parsed.every((account) =>
    account && typeof account === "object"
    && typeof account.id === "string"
    && (account.type === "employee" || account.type === "client")
    && typeof account.name === "string"
    && typeof account.email === "string"
    && typeof account.username === "string"
    && typeof account.phone === "string"
    && typeof account.role === "string"
    && typeof account.password === "string"
    && typeof account.joined === "string"
    && typeof account.active === "boolean"
  )) {
    throw new Error("Saved account data is invalid. Clear the enterflow.user-accounts.v1 local storage entry to restore demo accounts.");
  }
  return parsed as Account[];
}

export function saveAccounts(accounts: Account[]): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(accounts));
}
