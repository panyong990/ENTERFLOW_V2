import type { Role } from "./components/Login";

export type EmployeeRole = Exclude<Role, "client">;
export declare const allowedFor: Record<EmployeeRole, string[]>;
export declare const landingFor: Record<Role, string>;
export declare function isAllowedWorkspaceRoute(role: EmployeeRole, route: string): boolean;
