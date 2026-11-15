import {useCallback,useEffect,useRef,useState} from 'react';
import {api,queryString,type DirectoryResult} from '../../api/client';
export function useDirectory(real:boolean,kind:'clients'|'employees',filters:Record<string,string|number>) {
 const [data,setData]=useState<DirectoryResult|null>(null);const [loading,setLoading]=useState(real);const [error,setError]=useState('');const [version,setVersion]=useState(0);
 const sequence=useRef(0);const query=queryString(filters);
 const refresh=useCallback(()=>setVersion(value=>value+1),[]);
 useEffect(()=>{if(!real)return;const token=++sequence.current;const controller=new AbortController();setLoading(true);setError('');
 const timer=setTimeout(()=>{api<DirectoryResult>(`/api/admin/${kind}?${query}`,{signal:controller.signal}).then(result=>{if(token===sequence.current)setData(result);}).catch(cause=>{if(token===sequence.current&&!controller.signal.aborted)setError(cause.message);}).finally(()=>{if(token===sequence.current&&!controller.signal.aborted)setLoading(false);});},200);
 return()=>{++sequence.current;clearTimeout(timer);controller.abort();};},[real,kind,query,version]);
 useEffect(()=>{if(!real)return;window.addEventListener('enterflow:admin-changed',refresh);return()=>window.removeEventListener('enterflow:admin-changed',refresh);},[real,refresh]);
 return {data,loading,error,refresh};
}
