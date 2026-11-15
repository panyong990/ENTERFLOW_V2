export function AdminFeedback({loading,error,retry}:{loading?:boolean;error?:string;retry?:()=>void}) {
 return <>{loading&&<p role="status" className="rounded-lg bg-slate-100 p-3 text-sm text-slate-600 motion-safe:animate-pulse">Loading current records…</p>}
 {error&&<div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"><p>{error}</p>{retry&&<button type="button" className="mt-2 rounded border px-3 py-1" onClick={retry}>Refresh records</button>}</div>}</>;
}
