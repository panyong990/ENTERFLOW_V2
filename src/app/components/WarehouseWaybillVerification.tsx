import {useCallback,useEffect,useRef,useState,type FormEvent} from 'react';
import {verifyWarehouseWaybill} from '../api/warehouseShipments';
import {scanFailureMessage} from '../api/warehouseWaybillScan.js';

export interface WarehouseScanTarget {
  deliveryId:string;
  busy:boolean;
  verifyIdentifier:(value:string)=>Promise<void>;
}
// Manual input and the parent camera share one request guard and API boundary.
export function WarehouseWaybillVerification({deliveryId,onScanTargetChange,onVerified}:{deliveryId:string;onScanTargetChange?:(target:WarehouseScanTarget|null)=>void;onVerified?:(deliveryId:string)=>void}) {
  const [identifier,setIdentifier]=useState('');
  const [busy,setBusy]=useState(false);
  const [notice,setNotice]=useState<{success:boolean;text:string}|null>(null);
  const active=useRef(true),inFlight=useRef(false),revision=useRef(0);
  useEffect(()=>{active.current=true;return()=>{active.current=false;revision.current++;};},[]);
  const verifyIdentifier=useCallback(async(value:string)=>{
    if(!active.current || inFlight.current)return;
    if(typeof value!=='string'||!value.length||value.length>120) {
      setNotice({success:false,text:'The decoded QR identifier is invalid. Enter or scan a valid Waybill QR code.'});return;
    }
    setIdentifier(value);
    inFlight.current=true;setBusy(true);setNotice(null);const current=++revision.current;
    try {
      const result=await verifyWarehouseWaybill(deliveryId,value);
      if(active.current && current===revision.current)setNotice({success:true,text:result.alreadyVerified
        ?'This Waybill was already verified. No duplicate verification was recorded.'
        :'Waybill verification recorded successfully. Delivery status is unchanged.'});
      onVerified?.(deliveryId);
    } catch(error) {
      if(active.current && current===revision.current)setNotice({success:false,text:scanFailureMessage(error)});
    } finally {inFlight.current=false;if(active.current)setBusy(false);}
  },[deliveryId,onVerified]);
  useEffect(()=>{
    onScanTargetChange?.({deliveryId,busy,verifyIdentifier});
    return()=>onScanTargetChange?.(null);
  },[deliveryId,busy,verifyIdentifier,onScanTargetChange]);
  function verify(event:FormEvent) {event.preventDefault();void verifyIdentifier(identifier);}
  return <div className="mt-3 text-xs">
    <details className="rounded-md border border-slate-200 bg-white p-3">
      <summary className="cursor-pointer font-dm font-semibold text-slate-600">Manual QR verification (optional)</summary>
      <form onSubmit={event=>{void verify(event);}} aria-label="Verify selected Warehouse Waybill" className="mt-3">
    <label htmlFor={'waybill-qr-'+deliveryId} className="block font-semibold text-slate-900">Waybill QR identifier</label>
    <p className="mt-1 text-slate-500">Enter or paste the identifier, or use the QR Code Scanner for this selected shipment.</p>
    <input id={'waybill-qr-'+deliveryId} value={identifier} maxLength={120} disabled={busy} autoComplete="off" spellCheck={false}
      onChange={event=>{revision.current++;setIdentifier(event.target.value);setNotice(null);}}
      className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2" />
    <button type="submit" disabled={busy || !identifier.length || identifier.length>120} className="mt-2 rounded-md px-4 py-2 font-semibold text-white disabled:opacity-50" style={{backgroundColor:'#C8102E'}}>
      {busy?'Verifying...':'Verify Waybill'}
    </button>
      </form>
    </details>
    {notice && <p role={notice.success?'status':'alert'} className={'mt-2 '+(notice.success?'text-green-800':'text-red-700')}>{notice.text}</p>}
  </div>;
}
