import {useCallback,useEffect,useRef,useState} from 'react';
import {toast} from 'sonner';
import {api,adminChanged,ApiError} from '../../api/client';
import {useSession} from '../../store/session';
import {getClientApplications,saveClientApplications,getAccounts,saveAccounts} from '../../store/accounts';
import {AdminDialog} from './AdminDialog';
import {AdminFeedback} from './AdminFeedback';
interface Application {id:string;companyName:string;contactPerson:string;email:string;username:string;phone:string|null;status:string;submittedAt:string;rejectionReason?:string|null}
interface List {applications:Application[];nextCursor:string|null}
const button='rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-50';
export function RegistrationRequests() {
 const real=useSession().mode==='real';
 const [list,setList]=useState<List>({applications:[],nextCursor:null});const [cursor,setCursor]=useState<string|null>(null);const [history,setHistory]=useState<(string|null)[]>([]);
 const [selected,setSelected]=useState<Application|null>(null);const [action,setAction]=useState<'approve'|'reject'|null>(null);const [reason,setReason]=useState('');
 const [loading,setLoading]=useState(true);const [busy,setBusy]=useState(false);const [error,setError]=useState('');const [dialogError,setDialogError]=useState('');const [uncertain,setUncertain]=useState(false);
 const locked=useRef(false);const request=useRef(0);
 const load=useCallback(async()=>{const token=++request.current;setLoading(true);setError('');try{const result=real?await api<List>(`/api/client-applications?limit=10${cursor?`&cursor=${encodeURIComponent(cursor)}`:''}`):{applications:getClientApplications().filter(item=>item.status==='pending'),nextCursor:null};if(token===request.current)setList(result);}catch(cause){if(token===request.current)setError((cause as Error).message);}finally{if(token===request.current)setLoading(false);}},[real,cursor]);
 useEffect(()=>{void load();return()=>{++request.current;};},[load]);
  useEffect(() => {
    if (!real || selected || busy) return;

    const update = () => {
      if (document.visibilityState !== "visible" || locked.current) return;
      void load();
    };

    const visibility = () => {
      if (document.visibilityState === "visible") update();
    };

    const timer = window.setInterval(update, 30000);
    window.addEventListener("focus", update);
    window.addEventListener("enterflow:admin-changed", update);
    document.addEventListener("visibilitychange", visibility);

    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", update);
      window.removeEventListener("enterflow:admin-changed", update);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [real, load, selected, busy]);
 const review=async(application:Application)=>{if(locked.current)return;locked.current=true;setBusy(true);setDialogError('');setError('');try{const detail=real?await api<Application>(`/api/client-applications/${application.id}`):application;setSelected(detail);setAction(null);setReason('');setUncertain(false);}catch(cause){setError((cause as Error).message);}finally{locked.current=false;setBusy(false);}};
 const refreshDecision=async()=>{if(!selected||locked.current)return;locked.current=true;setBusy(true);try{const latest=await api<Application>(`/api/client-applications/${selected.id}`);setSelected(latest);setUncertain(false);setAction(null);setDialogError(latest.status==='pending'?'Application is still pending. Review and confirm again if appropriate.':`Application is ${latest.status}.`);adminChanged();void load();}catch(cause){setDialogError((cause as Error).message);}finally{locked.current=false;setBusy(false);}};
 const decide=async()=>{
   if(!selected||!action||uncertain||locked.current)return;
   const trimmed=reason.trim();if(action==='reject'&&([...trimmed].length<1||[...trimmed].length>1000)){setDialogError('Enter a rejection reason containing 1–1,000 Unicode characters.');return;}
   locked.current=true;setBusy(true);setDialogError('');
   try {
    if(real)await api(`/api/client-applications/${selected.id}/${action}`,{method:'POST',body:action==='approve'?{}:{reason:trimmed}});
    else {
      const applications=getClientApplications();const application=applications.find(item=>item.id===selected.id);if(!application||application.status!=='pending')throw new Error('Application is no longer pending.');
      if(action==='approve') {const accounts=getAccounts();if(accounts.some(item=>item.email.toLowerCase()===application.email.toLowerCase()||item.username.toLowerCase()===application.username.toLowerCase()||(item.type==='client'&&item.name.toLowerCase()===application.companyName.toLowerCase())))throw new Error('A demo account already uses these details.');
        saveAccounts([...accounts,{id:crypto.randomUUID(),type:'client',role:'client',name:application.companyName,contactPerson:application.contactPerson,email:application.email,username:application.username,phone:application.phone,passwordHash:application.passwordHash,active:true,joined:new Date().toLocaleDateString()}]);}
      saveClientApplications(applications.map(item=>item.id===application.id?{...item,status:action==='approve'?'approved':'rejected',decisionAt:new Date().toISOString(),...(action==='reject'?{rejectionReason:trimmed}:{})}:item));
    }
    toast.success(`Application ${action==='approve'?'approved':'rejected'}${real?'':' in Demo Preview'}.`);setSelected(null);setAction(null);adminChanged();
    if(cursor){setCursor(null);setHistory([]);}else void load();
   }catch(cause){setDialogError((cause as Error).message);const failure=cause as ApiError;if(real&&(failure.status===0||failure.status===409||failure.status===503||failure.code==='INVALID_RESPONSE'))setUncertain(true);}
   finally{locked.current=false;setBusy(false);}
 };
 return <div className="p-4 sm:p-5 space-y-4"><div className="flex items-center justify-between"><div><h2 className="text-lg font-bold">Pending Client Registrations</h2><p className="text-xs text-slate-500">Newest pending requests. Decisions require explicit confirmation.</p></div></div>
 <AdminFeedback loading={loading} error={error} retry={()=>void load()} />
 <div className="overflow-x-auto"><table className="w-full min-w-[800px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr>{['Application ID','Company','Contact person','Email','Submitted','Status','Action'].map(label=><th className="p-3" key={label}>{label}</th>)}</tr></thead><tbody>{list.applications.map(item=><tr key={item.id} className="border-t border-slate-100"><td className="p-3">{item.id}</td><td className="p-3 font-semibold">{item.companyName}</td><td className="p-3">{item.contactPerson}</td><td className="p-3">{item.email}</td><td className="p-3">{new Date(real?item.submittedAt.replace(' ','T')+'Z':item.submittedAt).toLocaleString()}</td><td className="p-3"><span className="rounded-full bg-amber-50 px-2 py-1 text-xs text-amber-800">Pending</span></td><td className="p-3"><button className={button} disabled={busy||loading||!!error} onClick={()=>void review(item)}>Review</button></td></tr>)}</tbody></table></div>
 {!loading&&!error&&!list.applications.length&&<p className="py-10 text-center text-sm text-slate-500">No pending registrations. New applications will appear here for review.</p>}
 {real&&<div className="flex justify-end gap-2"><button className={button} disabled={!history.length||loading||busy} onClick={()=>{setCursor(history.at(-1)??null);setHistory(value=>value.slice(0,-1));}}>Previous</button><button className={button} disabled={!list.nextCursor||loading||busy} onClick={()=>{setHistory(value=>[...value,cursor]);setCursor(list.nextCursor);}}>Next</button></div>}
 {selected&&<AdminDialog title={action?`${action==='approve'?'Approve':'Reject'} application?`:'Application details'} description={selected.companyName} busy={busy} onClose={()=>{setSelected(null);setAction(null);setReason('');}}>
 <dl className="grid gap-3 sm:grid-cols-2 text-sm">{[['Application ID',selected.id],['Company',selected.companyName],['Contact person',selected.contactPerson],['Email',selected.email],['Username',selected.username],['Phone',selected.phone||'—'],['Status',selected.status]].map(([label,value])=><div key={label}><dt className="text-xs text-slate-500">{label}</dt><dd className="break-words">{value}</dd></div>)}</dl>
 {action==='approve'&&<p className="text-sm">Approval creates the company and its client login. No client session is created.</p>}
 {action==='reject'&&<label className="text-sm font-semibold">Rejection reason<textarea aria-label="Rejection reason" autoFocus value={reason} onChange={event=>setReason(event.target.value)} className="mt-1 w-full rounded-lg border p-3" rows={4}/><span className="text-xs font-normal text-slate-500">{[...reason.trim()].length}/1,000 characters after trimming</span></label>}
 {dialogError&&<p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{dialogError}</p>}
 {uncertain?<button className={button} disabled={busy} onClick={()=>void refreshDecision()}>Check latest application state</button>:selected.status==='pending'&&<div className="flex flex-wrap justify-end gap-2">{action?<><button className={button} disabled={busy} onClick={()=>{setAction(null);setReason('');}}>Back</button><button className={`${button} bg-red-700 text-white`} disabled={busy} onClick={()=>void decide()}>{busy?'Submitting…':`Confirm ${action==='approve'?'approval':'rejection'}`}</button></>:<><button className={button} onClick={()=>setAction('reject')}>Reject</button><button className={`${button} bg-red-700 text-white`} onClick={()=>setAction('approve')}>Approve</button></>}</div>}
 </AdminDialog>}
 </div>;
}
