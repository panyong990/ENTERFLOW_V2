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
  password?: string;
  passwordHash?: string;
  joined: string;
  active: boolean;
  emailAlerts?: boolean;
  employeeId?: string;
  department?: string;
  jobTitle?: string;
  contactPerson?: string;
}

export interface EmployeeDirectoryEntry {
  id: string;
  employeeId: string;
  name: string;
  role: Exclude<AccountRole, "client">;
  active: boolean;
  department?: string;
  jobTitle?: string;
}

export function isEmployeeRole(role: AccountRole): role is EmployeeDirectoryEntry["role"] {
  return role === "admin"
    || role === "owner"
    || role === "operations"
    || role === "sales"
    || role === "accounting"
    || role === "production"
    || role === "warehouse"
    || role === "logistics";
}

const STORAGE_KEY = "enterflow.user-accounts.v1";
const APPLICATIONS_STORAGE_KEY = "enterflow.client-applications.v1";
const CLIENT_APPLICATIONS_UPDATED_EVENT = "enterflow:client-applications-updated";
const ACCOUNTS_UPDATED_EVENT = "enterflow:accounts-updated";

export function subscribeToAccounts(onChange: () => void): () => void {
  if (typeof window === "undefined") return () => {};

  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY || event.key === null) onChange();
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(ACCOUNTS_UPDATED_EVENT, onChange);
  window.addEventListener("focus", onChange);

  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(ACCOUNTS_UPDATED_EVENT, onChange);
    window.removeEventListener("focus", onChange);
  };
}

export function subscribeToClientApplications(onChange: () => void): () => void {
  if (typeof window === "undefined") return () => {};

  const onStorage = (event: StorageEvent) => {
    if (event.key === APPLICATIONS_STORAGE_KEY || event.key === null) onChange();
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(CLIENT_APPLICATIONS_UPDATED_EVENT, onChange);
  window.addEventListener("focus", onChange);

  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(CLIENT_APPLICATIONS_UPDATED_EVENT, onChange);
    window.removeEventListener("focus", onChange);
  };
}

export type RegistrationStatus = "pending" | "approved" | "rejected";

export interface ClientRegistrationApplication {
  id: string;
  companyName: string;
  contactPerson: string;
  email: string;
  username: string;
  phone: string;
  passwordHash: string;
  submittedAt: string;
  status: RegistrationStatus;
  decisionAt?: string;
  rejectionReason?: string;
}

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
    && (account.password === undefined || typeof account.password === "string")
    && (account.passwordHash === undefined || typeof account.passwordHash === "string")
    && typeof account.joined === "string"
    && typeof account.active === "boolean"
  )) {
    throw new Error("Saved account data is invalid. Clear the enterflow.user-accounts.v1 local storage entry to restore demo accounts.");
  }
  return parsed as Account[];
}

export function getEmployeeDirectory(): EmployeeDirectoryEntry[] {
  return getAccounts().flatMap(({ id, employeeId, type, name, role, active, department, jobTitle }) => {
    if (type !== "employee") return [];
    if (!isEmployeeRole(role)) {
      throw new Error(`Saved employee account "${id}" has an invalid staff role.`);
    }
    return [{ id, employeeId: employeeId || id, name, role, active, department, jobTitle }];
  });
}

export function saveAccounts(accounts: Account[]): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(accounts));
  window.dispatchEvent(new Event(ACCOUNTS_UPDATED_EVENT));
}

export function getClientApplications(): ClientRegistrationApplication[] {
  if (typeof window === "undefined") return [];
  const stored = window.localStorage.getItem(APPLICATIONS_STORAGE_KEY);
  if (!stored) return [];
  const parsed: unknown = JSON.parse(stored);
  if (!Array.isArray(parsed) || !parsed.every((application) =>
    application && typeof application === "object"
    && typeof application.id === "string"
    && typeof application.companyName === "string"
    && typeof application.contactPerson === "string"
    && typeof application.email === "string"
    && typeof application.username === "string"
    && typeof application.phone === "string"
    && typeof application.passwordHash === "string"
    && typeof application.submittedAt === "string"
    && ["pending", "approved", "rejected"].includes(application.status)
  )) {
    throw new Error("Saved client registration data is invalid. Clear the enterflow.client-applications.v1 local storage entry to remove it.");
  }
  return parsed as ClientRegistrationApplication[];
}

export function saveClientApplications(applications: ClientRegistrationApplication[]): void {
  window.localStorage.setItem(APPLICATIONS_STORAGE_KEY, JSON.stringify(applications));
  window.dispatchEvent(new Event(CLIENT_APPLICATIONS_UPDATED_EVENT));
}

export async function hashPassword(password: string): Promise<string> {
  if (!globalThis.crypto?.subtle) {
    throw new Error("Secure password hashing is unavailable in this browser.");
  }
  const salt = globalThis.crypto.getRandomValues(new Uint8Array(16));
  const key = await globalThis.crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await globalThis.crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: 310_000, hash: "SHA-256" },
    key,
    256,
  );
  const encode = (bytes: Uint8Array) => Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${encode(salt)}:${encode(new Uint8Array(bits))}`;
}

export async function verifyPassword(account: Account, password: string): Promise<boolean> {
  if (account.passwordHash) {
    const [saltHex, expectedHex] = account.passwordHash.split(":");
    if (!saltHex || !expectedHex || !globalThis.crypto?.subtle) {
      throw new Error("Saved password data is invalid or secure password verification is unavailable.");
    }
    const salt = new Uint8Array(saltHex.match(/.{2}/g)?.map((byte) => Number.parseInt(byte, 16)) ?? []);
    const key = await globalThis.crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
    const bits = await globalThis.crypto.subtle.deriveBits(
      { name: "PBKDF2", salt, iterations: 310_000, hash: "SHA-256" },
      key,
      256,
    );
    const actualHex = Array.from(new Uint8Array(bits), (byte) => byte.toString(16).padStart(2, "0")).join("");
    return actualHex === expectedHex;
  }
  return account.password !== undefined && account.password === password;
}
