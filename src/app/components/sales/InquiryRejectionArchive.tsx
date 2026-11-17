import { useEffect, useState } from 'react';
import { listInquiryRejections } from '../../api/salesOrders.js';

export function InquiryRejectionRecord({row}:{row:{id:string;reference:string;companyName:string;archivedAt:string;archiveNote:string}}) {
  return <article className="my-4 rounded border p-4"><b>{row.reference} · {row.companyName}</b><p>{row.archivedAt}</p><p className="whitespace-pre-wrap">{row.archiveNote}</p></article>;
}

export function InquiryRejectionArchive() {
  const [page,setPage]=useState(1),[refresh,setRefresh]=useState(0);
  const [state,setState]=useState<{loading:boolean;error:string;data:any}>({loading:true,error:'',data:null});
  useEffect(()=>{
    let active=true;setState({loading:true,error:'',data:null});
    void listInquiryRejections(page).then(data=>{if(active)setState({loading:false,error:'',data});})
      .catch(cause=>{if(active)setState({loading:false,error:cause instanceof Error?cause.message:'Rejection history unavailable.',data:null});});
    return()=>{active=false;};
  },[page,refresh]);
  return <main className="flex-1 overflow-auto p-8"><h1 className="text-2xl font-bold">Rejected Inquiries</h1>
    <p>Read-only rejection history. No Sales actions are available here.</p>
    {state.loading&&<p role="status">Loading rejection history…</p>}
    {state.error&&<p role="alert">{state.error}<button onClick={()=>setRefresh(n=>n+1)}>Retry</button></p>}
    {state.data&&<><p>{state.data.total} rejected inquiries</p>
      {state.data.items.map((row:any)=><InquiryRejectionRecord key={row.id} row={row} />)}
      {!state.data.items.length&&<p>No rejected inquiries.</p>}
      <button disabled={state.data.page<=1} onClick={()=>setPage(state.data.page-1)}>Previous</button>
      <span> Page {state.data.page} </span>
      <button disabled={state.data.page*state.data.pageSize>=state.data.total} onClick={()=>setPage(state.data.page+1)}>Next</button>
    </>}
  </main>;
}
