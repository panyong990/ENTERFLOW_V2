
import { useCallback, useEffect, useState } from "react";
import {
  type LucideIcon,
  AlertCircle,
  Building2,
  Clock3,
  ShieldCheck,
  UserCheck,
  UsersRound,
  ChevronDown,
  ChevronUp,
  ClipboardList,
} from "lucide-react";

import {
  getAccounts,
  subscribeToAccounts,
  type Account,
} from "../store/accounts";
import { roleMetas } from "./Login";
import { useSession } from "../store/session";
import { api } from "../api/client";
import { Unauthorized } from "./Unauthorized";

interface Activity {
  id: string;
  action: string;
  subjectId: string;
  actorName: string;
  occurredAt: string;
}

interface DashboardCounts {
  pendingApplications?: number;
  activity?: Activity[];
  employees: number;
  clients: number;
  activeEmployees: number;
  roles: number;
}

interface Metric {
  label: string;
  value: number;
  icon: LucideIcon;
  color: string;
  background: string;
}

const INITIAL_ACTIVITY_COUNT = 5;

function getDashboardCounts(accounts: Account[]): DashboardCounts {
  const employees = accounts.filter(
    (account) => account.type === "employee" && account.role !== "client"
  );

  const clients = accounts.filter(
    (account) => account.type === "client" && account.role === "client"
  );

  return {
    employees: employees.length,
    clients: clients.length,
    activeEmployees: employees.filter((employee) => employee.active).length,
    roles: Object.keys(roleMetas).filter((role) => role !== "client").length,
  };
}

function formatAction(action: string): string {
  if (!action) return "Administrative activity recorded";

  const readable = action
    .replaceAll("_", " ")
    .replaceAll(".", " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim();

  const parts = readable.split(" ").filter(Boolean);

  if (parts.length === 0) return "Administrative activity recorded";

  // Convert resource.action to a more natural title.
  // Example: employee.provisioned -> Employee account provisioned
  if (
    parts.length === 2 &&
    parts[0].toLowerCase() === "employee" &&
    parts[1].toLowerCase() === "provisioned"
  ) {
    return "Employee account provisioned";
  }

  return readable.charAt(0).toUpperCase() + readable.slice(1);
}

function formatDate(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "Date unavailable";

  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function AdminDashboard() {
  const { role } = useSession();

  if (role !== "admin") return <Unauthorized />;

  return <AdminDashboardPage />;
}

function AdminDashboardPage() {
  const { mode, navigate } = useSession();
  const real = mode === "real";

  const [counts, setCounts] = useState<DashboardCounts | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showAllActivity, setShowAllActivity] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);

    try {
      const data = real
        ? await api<DashboardCounts>("/api/admin/dashboard")
        : getDashboardCounts(getAccounts());

      setCounts(data);
      setError("");
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Unable to load account data."
      );
    } finally {
      setLoading(false);
    }
  }, [real]);

  useEffect(() => {
    void refresh();

    if (!real) {
      return subscribeToAccounts(refresh);
    }

    window.addEventListener("enterflow:admin-changed", refresh);
    window.addEventListener("focus", refresh);

    return () => {
      window.removeEventListener("enterflow:admin-changed", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, [refresh, real]);

  const metrics: Metric[] = counts
    ? [
        {
          label: "Total Employees",
          value: counts.employees,
          icon: UsersRound,
          color: "#1A2B4A",
          background: "#EFF4FA",
        },
        {
          label: "Total Clients",
          value: counts.clients,
          icon: Building2,
          color: "#C8102E",
          background: "#FFF1F2",
        },
        {
          label: "Active Employee Accounts",
          value: counts.activeEmployees,
          icon: UserCheck,
          color: "#15803D",
          background: "#F0FDF4",
        },
        {
          label: "System Roles",
          value: counts.roles,
          icon: ShieldCheck,
          color: "#7C3AED",
          background: "#F5F3FF",
        },
      ]
    : [];

  const activity = real ? counts?.activity ?? [] : [];

  const displayedActivity = showAllActivity
    ? activity
    : activity.slice(0, INITIAL_ACTIVITY_COUNT);

  const hasMoreActivity = activity.length > INITIAL_ACTIVITY_COUNT;

  return (
    <main
      className="min-w-0 flex-1 h-full overflow-auto bg-[#F5F7FB]"
    >
      {/* Page header */}
      <header className="sticky top-0 z-10 border-b border-slate-200/80 bg-white/95 px-5 py-5 backdrop-blur sm:px-8">
        <div className="mx-auto max-w-[1600px]">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-50 text-[#C8102E]">
              <ShieldCheck size={19} aria-hidden="true" />
            </span>

            <h1 className="font-syne text-[27px] font-extrabold leading-tight text-slate-900">
              Admin Dashboard
            </h1>
          </div>

          <p className="font-dm ml-11 mt-1 text-[13px] text-slate-500">
            Overview of employee accounts, client accounts, and
            administrative activity.
          </p>
        </div>
      </header>

      <section className="mx-auto max-w-[1600px] space-y-6 px-5 py-6 sm:px-8 sm:py-8">
        {/* Pending client registrations */}
        {real && counts && (
          <button
            type="button"
            onClick={() => navigate?.("client-requests")}
            className="flex w-full items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-left shadow-sm transition-colors hover:border-slate-300 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
          >
            <span className="flex min-w-0 items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-700">
                <ClipboardList size={18} aria-hidden="true" />
              </span>
              <span className="flex flex-col gap-0.5">
                <span className="font-dm text-sm font-semibold text-slate-900">
                  Pending Client Registrations
                </span>
                <span className="font-dm text-xs text-slate-500">
                  {counts.pendingApplications ?? 0} application(s) awaiting review
                </span>
              </span>
            </span>
            <span className="shrink-0 font-dm text-xs font-semibold text-slate-600">
              View requests
            </span>
          </button>
        )}
        {/* Summary metrics */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {!counts && loading
            ? Array.from({ length: 4 }, (_, index) => (
                <div
                  key={index}
                  aria-label="Loading account metrics"
                  className="h-32 animate-pulse rounded-2xl border border-slate-200/80 bg-white p-5"
                >
                  <div className="h-4 w-2/3 rounded bg-slate-100" />
                  <div className="mt-5 h-8 w-1/3 rounded bg-slate-100" />
                </div>
              ))
            : metrics.map(
                ({ label, value, icon: Icon, color, background }) => (
                  <article
                    key={label}
                    className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition-shadow duration-200 hover:shadow-md"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-dm text-sm font-medium text-slate-500">
                          {label}
                        </p>

                        <p className="font-syne mt-3 text-3xl font-extrabold leading-none text-slate-900">
                          {value.toLocaleString()}
                        </p>
                      </div>

                      <span
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
                        style={{
                          color,
                          backgroundColor: background,
                        }}
                      >
                        <Icon size={20} aria-hidden="true" />
                      </span>
                    </div>
                  </article>
                )
              )}
        </div>

        {/* Error state */}
        {error && (
          <div
            role="alert"
            className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4"
          >
            <AlertCircle
              size={18}
              className="mt-0.5 shrink-0 text-red-700"
              aria-hidden="true"
            />

            <div className="min-w-0 flex-1">
              <p className="font-dm text-sm font-semibold text-red-900">
                Account metrics could not be loaded.
              </p>

              <p className="font-dm mt-1 break-words text-xs text-red-800">
                {error}
              </p>

              <button
                type="button"
                onClick={() => void refresh()}
                className="font-dm mt-3 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-800 hover:bg-red-100"
              >
                Retry
              </button>
            </div>
          </div>
        )}

        {/* Administrative activity */}
        <section
          className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm"
          aria-labelledby="admin-activity-heading"
        >
          <div className="border-b border-slate-100 px-5 py-4">
            <div className="flex items-center gap-2.5">
              <Clock3
                size={18}
                className="text-slate-500"
                aria-hidden="true"
              />

              <h2
                id="admin-activity-heading"
                className="font-syne text-lg font-bold text-slate-900"
              >
                Recent Administrative Activity
              </h2>
            </div>

            <p className="font-dm mt-1 text-xs text-slate-500">
              Latest recorded administrative actions.
            </p>
          </div>

          {real && activity.length > 0 ? (
            <>
              <ul className="divide-y divide-slate-100">
                {displayedActivity.map((item) => (
                  <li
                    key={item.id}
                    className="px-5 py-4 transition-colors duration-150 hover:bg-slate-50/80"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-dm text-sm font-semibold text-slate-800">
                          {formatAction(item.action)}
                        </p>

                        <p className="font-dm mt-1 text-xs text-slate-500">
                          By {item.actorName || "Recorded administrator"}
                          {item.subjectId
                            ? ` · Record #${item.subjectId}`
                            : ""}
                        </p>
                      </div>

                      <time
                        dateTime={item.occurredAt}
                        className="font-dm shrink-0 text-xs text-slate-500"
                      >
                        {formatDate(item.occurredAt)}
                      </time>
                    </div>
                  </li>
                ))}
              </ul>

              {hasMoreActivity && (
                <div className="border-t border-slate-100 px-5 py-3 text-center">
                  <button
                    type="button"
                    onClick={() =>
                      setShowAllActivity((previous) => !previous)
                    }
                    aria-expanded={showAllActivity}
                    className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-[#1A2B4A] transition-colors hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                  >
                    {showAllActivity ? (
                      <>
                        Show less
                        <ChevronUp size={16} aria-hidden="true" />
                      </>
                    ) : (
                      <>
                        Show more ({activity.length - INITIAL_ACTIVITY_COUNT})
                        <ChevronDown size={16} aria-hidden="true" />
                      </>
                    )}
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="flex min-h-36 flex-col items-center justify-center px-5 py-8 text-center">
              <Clock3
                size={22}
                className="text-slate-400"
                aria-hidden="true"
              />

              <p className="font-dm mt-3 text-sm text-slate-600">
                {real
                  ? error
                    ? "Activity could not be refreshed."
                    : loading
                      ? "Loading activity..."
                      : "No administrative activity recorded."
                  : "Administrative activity is unavailable in Demo Preview."}
              </p>
            </div>
          )}
        </section>
      </section>
    </main>
  );
}
