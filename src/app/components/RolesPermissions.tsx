import {useEffect,useState} from "react";
import {api} from "../api/client";
import {AdminFeedback} from "./admin/AdminFeedback";
import { ShieldCheck } from "lucide-react";
import { allowedFor } from "./Sidebar";
import { roleMetas, type Role } from "./Login";
import { useSession } from "../store/session";
import { Unauthorized } from "./Unauthorized";

const employeeRoles = Object.keys(roleMetas).filter((role) => role !== "client") as Exclude<Role, "client">[];
const moduleNames: Record<string, string> = {
  dashboard: "Dashboard",
  sales: "Sales & Orders",
  production: "Production Floor",
  inventory: "Inventory",
  waybill: "Waybill Scanner",
  "waybill-history": "Waybill History",
  logistics: "Logistics",
  "delivery-receipts": "Delivery Receipts",
  accounting: "Payments Ledger",
  analytics: "Analytics",
  clients: "Client Management",
  "employee-management": "Employee Management",
  roles: "Roles & Permissions",
  users: "Employee Directory",
  notifications: "Notifications",
  settings: "Settings",
};

interface RoleMetadata {roles:{code:string;label:string;modules:{code:string;label:string}[];permissions:Record<string,string[]>}[];mismatches:string[]}
export function RolesPermissions() {
  const { role,mode } = useSession();
  const real=mode==='real';const [metadata,setMetadata]=useState<RoleMetadata|null>(null);const [error,setError]=useState('');const [loading,setLoading]=useState(real);const [version,setVersion]=useState(0);
  useEffect(()=>{if(!real)return;let live=true;setLoading(true);setError('');api<RoleMetadata>('/api/admin/roles').then(result=>{if(live)setMetadata(result);}).catch(cause=>{if(live)setError(cause.message);}).finally(()=>{if(live)setLoading(false);});return()=>{live=false;};},[real,version]);
  const mismatches=[...(metadata?.mismatches??[])];
  if(real&&metadata)for(const row of metadata.roles){const expected=allowedFor[row.code as Exclude<Role,'client'>];if(!expected){mismatches.push(`Unknown frontend role: ${row.code}`);continue;}const actual=row.modules.map(item=>item.code).filter(code=>code!=='logistics-active-jobs');if([...expected].sort().join('|')!==actual.sort().join('|'))mismatches.push(`Frontend/database module mapping differs for ${row.label}.`);if(roleMetas[row.code as Role]?.label!==row.label)mismatches.push(`Role label differs for ${row.code}.`);}
  if (role !== "admin") return <Unauthorized />;

  return (
    <main className="flex-1 min-w-0 h-full overflow-auto" style={{ backgroundColor: "#F5F7FB" }}>
      <header className="sticky top-0 z-10 border-b border-slate-200/80 bg-white/95 px-5 py-5 backdrop-blur sm:px-8">
        <div className="mx-auto max-w-[1600px]">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ color: "#C8102E", backgroundColor: "#FFF1F2" }}><ShieldCheck size={19} /></span>
            <h1 className="font-syne" style={{ fontSize: 27, fontWeight: 800, color: "#0F172A", lineHeight: 1.1 }}>Roles &amp; Permissions</h1>
          </div>
          <p className="font-dm ml-11 mt-1" style={{ fontSize: 13, color: "#64748B" }}>Review the existing system roles and their module access.</p>
        </div>
      </header>
      <section className="mx-auto max-w-[1600px] px-5 py-6 sm:px-8 sm:py-8">
        {real&&<AdminFeedback loading={loading} error={error} retry={()=>setVersion(v=>v+1)} />}
        {real&&mismatches.length>0&&<div role="alert" className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><p className="font-semibold">Configuration differences detected; no records were changed.</p>{mismatches.map((message,index)=><p key={index}>{message}</p>)}</div>}
        {real&&<button onClick={()=>setVersion(v=>v+1)} disabled={loading} className="mb-3 rounded border bg-white px-3 py-2 text-xs">Refresh metadata</button>}
        <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-4 py-4 sm:px-5">
            <h2 className="font-syne text-lg font-bold text-slate-900">Role access matrix</h2>
            <p className="mt-1 font-dm text-xs text-slate-500">Frontend modules and backend actions are separate controls. This page is read-only.</p>
          </div>
          <div className="overflow-x-auto">
            <table aria-label="System role module access" className="w-full min-w-[760px] table-fixed">
              <colgroup>
                <col className="w-[28%]" />
                <col className={real?"w-[36%]":"w-[72%]"} />{real&&<col className="w-[36%]" />}
              </colgroup>
              <thead className="bg-slate-50/80"><tr>
                <th className="whitespace-nowrap px-4 py-3 text-left font-dm text-[10px] font-bold uppercase tracking-wider text-slate-500 sm:px-5">System role</th>
                <th className="whitespace-nowrap px-4 py-3 text-left font-dm text-[10px] font-bold uppercase tracking-wider text-slate-500 sm:px-5">Frontend modules</th>{real&&<th className="px-4 py-3 text-left text-xs uppercase text-slate-500">Backend actions</th>}
              </tr></thead>
              <tbody>{(real?metadata?.roles.map(row=>row.code)??[]:employeeRoles).map((staffRole) => {
                const source=metadata?.roles.find(row=>row.code===staffRole);
                const meta = roleMetas[staffRole as Role]??{label:staffRole,bg:'#F1F5F9',fg:'#475569'};
                const modules = real?source?.modules.map(item=>item.code)??[]:allowedFor[staffRole as Exclude<Role,'client'>];
                return <tr key={staffRole} className="border-t border-slate-100 align-top hover:bg-slate-50/70">
                    <td className="px-4 py-4 align-middle sm:px-5">
                      <div className="flex flex-col items-start gap-1.5">
                        <span className="inline-flex max-w-full truncate rounded-full px-2.5 py-1 font-dm text-[11px] font-semibold text-slate-700" style={{ backgroundColor: meta.bg, color: meta.fg }}>{real?source?.label:meta.label}</span>
                        <span className="font-dm text-[11px] text-slate-500">{modules.length} {modules.length === 1 ? "module" : "modules"}</span>
                      </div>
                    </td>
                    <td className="px-4 py-4 align-middle sm:px-5">
                      <div className="flex flex-wrap gap-2">
                        {modules.map((module) => <span key={module} className="inline-flex items-center whitespace-nowrap rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 font-dm text-[11px] font-semibold leading-4 text-slate-700">{real?source?.modules.find(item=>item.code===module)?.label??module:moduleNames[module] || module}</span>)}
                      </div>
                    </td>
                    {real&&<td className="px-4 py-4 text-xs text-slate-600">{Object.entries(source?.permissions??{}).map(([resource,actions])=><p key={resource} className="mb-2 break-words"><strong>{resource}</strong>: {actions.join(', ')}</p>)}</td>}
                  </tr>;
              })}</tbody>
            </table>
          </div>
        </section>
      </section>
    </main>
  );
}
