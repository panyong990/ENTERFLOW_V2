export class ApiError extends Error {
  constructor(public status: number, message: string, public code?: string, public errors?: Record<string,string>) { super(message); }
}
let realRequestsEnabled = false;
export function enableRealRequests(enabled: boolean) { realRequestsEnabled = enabled; }
export async function api<T>(path: string, options: { method?: string; body?: unknown; signal?: AbortSignal; public?: boolean } = {}): Promise<T> {
  if (!options.public && !realRequestsEnabled) throw new ApiError(403, 'Real API access is unavailable in Demo Preview.');
  if (!path.startsWith('/api/')) throw new Error('Only same-origin API paths are permitted.');
  let response: Response;
  const timeout = AbortSignal.timeout(15000);
  try {
    response = await fetch(path, {method:options.method ?? 'GET',credentials:'same-origin',cache:'no-store',
      headers:options.body===undefined ? {Accept:'application/json'} : {Accept:'application/json','Content-Type':'application/json'},
      ...(options.body===undefined?{}:{body:JSON.stringify(options.body)}),signal: options.signal ? AbortSignal.any([timeout,options.signal]) : timeout});
  } catch { throw new ApiError(0, 'The request could not be confirmed. Refresh before retrying any change.', 'NETWORK_ERROR'); }
  let result: {success?:boolean;data:T;message?:string;code?:string;errors?:Record<string,string>};
  try { result=await response.json(); } catch { throw new ApiError(response.status,'The service returned an invalid response. Refresh before retrying.','INVALID_RESPONSE'); }
  if (!result || typeof result !== 'object' || Array.isArray(result) || typeof result.success !== 'boolean') {
    throw new ApiError(response.status,'The service returned an invalid response. Refresh before retrying.','INVALID_RESPONSE');
  }
  if (!response.ok || result.success!==true) {
    if(response.status===401 && !options.public) window.dispatchEvent(new Event('enterflow:session-expired'));
    if(response.status===403 && !options.public) window.dispatchEvent(new Event('enterflow:session-recheck'));
    throw new ApiError(response.status,result.message ?? 'Request failed.',result.code,result.errors);
  }
  return result.data;
}
export function adminChanged() { window.dispatchEvent(new Event('enterflow:admin-changed')); }
export function queryString(values: Record<string,string|number>) { return new URLSearchParams(Object.entries(values).map(([k,v])=>[k,String(v)])).toString(); }
export interface RealIdentity { userId:string;roleCode:import('../components/Login').Role;accountType:'employee'|'client';displayName:string }
export interface DirectoryRow { id:string;name?:string;companyName?:string;employeeId?:string;department?:string;jobTitle?:string;email:string;username:string|null;phone:string|null;roleCode?:string;active:boolean|null;accountId?:string|null;joinedOn:string|null;createdAt:string;revision:string }
export interface DirectoryResult { items:DirectoryRow[];total:number;page:number;pageSize:number;summary?:{total:number;active:number;departments:string[]} }
export function accountFromRow(row:DirectoryRow, type:'employee'|'client') {
  return {...row,type,name:row.name??row.companyName??'',email:row.email??'',username:row.username??'',phone:row.phone??'',
    role:(type==='client'?'client':row.roleCode) as import('../store/accounts').AccountRole,active:row.active===true,
    joined:row.joinedOn??row.createdAt.slice(0,10)};
}
