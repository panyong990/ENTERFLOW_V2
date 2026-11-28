import { WarehouseProductSketches } from "./WarehouseProductSketches";
import { WarehouseReference } from "./WarehouseReference";
import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import {Printer} from 'lucide-react';
import {
  getWarehouseShipment,
  listWarehouseShipments,
  saveWarehouseWaybill,
  type WarehouseShipment,
} from "../api/warehouseShipments";
import { warehouseWaybillsFromShipment } from "../api/warehouseWaybillAdapter.js";
import { prepareRealWaybill, storedWaybillForPrint, validateWaybillResponse } from "../api/warehouseWaybillPrint.js";
import { WaybillDocument, type WaybillDocumentData } from "./WaybillDocument";
import { WarehouseWaybillVerification,type WarehouseScanTarget } from './WarehouseWaybillVerification';
import {dispatchSummary,dispatchMatches,dispatchStatus,validDispatchIdentity} from '../api/warehouseDispatch.js';

function errorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Unable to load Warehouse records.";
}

export function RealWarehouseWaybillRecords({onScanTargetChange,search='',dateFilter='all',refreshKey=0,onBusyChange}:{
  onScanTargetChange?:(target:WarehouseScanTarget|null)=>void;search?:string;dateFilter?:string;refreshKey?:number;onBusyChange?:(value:boolean)=>void
}={}) {
  const [shipments, setShipments] = useState<WarehouseShipment[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<WarehouseShipment | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState("");
  const [detailError, setDetailError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const busyRef = useRef(false);
  const epoch = useRef(0);
  const [busy, setBusy] = useState(false);
  const [uncertainId, setUncertainId] = useState<string | null>(null);
  const [printError, setPrintError] = useState("");
  const [preview, setPreview] = useState<{ shipmentId: string; waybill: ReturnType<typeof storedWaybillForPrint>; document: WaybillDocumentData } | null>(null);
  const [qrReady, setQrReady] = useState(false);
  const [dialogOpened, setDialogOpened] = useState(false);
  const [printNotice, setPrintNotice] = useState("");
  const [itemDetails,setItemDetails]=useState<Record<string,WarehouseShipment>>({});
  const [itemsLoading,setItemsLoading]=useState(false);
  const [itemReadFailed,setItemReadFailed]=useState(false);
  const [verificationNotice,setVerificationNotice]=useState('');
  const verifiedIdsRef=useRef(new Set<string>());

  const handleVerified=useCallback((deliveryId:string)=>{
    verifiedIdsRef.current.add(deliveryId);
    setShipments(current=>current.filter(row=>row.id!==deliveryId));
    setSelectedId(current=>current===deliveryId?null:current);
    setVerificationNotice('Waybill successfully verified and moved to Waybill History.');
    setRefresh(current=>current+1);
  },[]);


  useEffect(()=>{onBusyChange?.(busy||loading||detailLoading);return()=>onBusyChange?.(false);},[busy,loading,detailLoading,onBusyChange]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    setShipments([]);
    setItemDetails({});setItemReadFailed(false);setItemsLoading(false);

    listWarehouseShipments(100, controller.signal, true)
      .then(async(result) => {
        if(controller.signal.aborted)return;
        if(!Array.isArray(result)||result.length>100||!result.every(validDispatchIdentity)||new Set(result.map(row=>row.id)).size!==result.length)throw new Error('Shipment records could not be confirmed.');
        setShipments(result.filter(row=>!verifiedIdsRef.current.has(row.id)));setLoading(false);setItemsLoading(result.length>0);
        // Existing list rows omit items. Reuse authorized detail reads, bounded to four.
        let next=0;
        await Promise.all(Array.from({length:Math.min(4,result.length)},async()=>{
          while(next<result.length&&!controller.signal.aborted) {
            const row=result[next++];
            try {
              const value=await getWarehouseShipment(row.id,controller.signal);
              if(value.id!==row.id||value.jobOrderId!==row.jobOrderId)throw new Error('Shipment detail mismatch.');
              if(!controller.signal.aborted)setItemDetails(current=>({...current,[row.id]:value}));
            }catch {if(!controller.signal.aborted)setItemReadFailed(true);}
          }
        }));
        if(!controller.signal.aborted)setItemsLoading(false);
      })
      .catch((cause) => {
        if (!controller.signal.aborted) setError(errorMessage(cause));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [refresh,refreshKey]);

  useEffect(() => {
    const currentEpoch = ++epoch.current;
    setPreview(null); setPrintError(""); setPrintNotice("");
    if (!selectedId) {
      setDetail(null);
      setDetailLoading(false);
      setDetailError("");
      return () => { if (epoch.current === currentEpoch) epoch.current++; };
    }

    const controller = new AbortController();
    setDetail(null);
    setDetailLoading(true);
    setDetailError("");

    getWarehouseShipment(selectedId, controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) {
          if (result.id !== selectedId) {
            setDetailError("Shipment response did not match the requested record.");
            return;
          }
          setDetail(result);
          if (uncertainId === selectedId) setUncertainId(null);
        }
      })
      .catch((cause) => {
        if (!controller.signal.aborted) {
          setDetailError(errorMessage(cause));
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setDetailLoading(false);
      });

    return () => { controller.abort(); if (epoch.current === currentEpoch) epoch.current++; };
  }, [selectedId, refresh,refreshKey]);

  const visibleShipments=shipments.map(row=>detail?.id===row.id?detail:itemDetails[row.id]??row)
    .filter(row=>!verifiedIdsRef.current.has(row.id)&&dispatchMatches(row,{search,dateFilter}));
  const selectionVisible=!selectedId||loading||itemsLoading||visibleShipments.some(row=>row.id===selectedId);
  useEffect(()=>{if(!selectionVisible)setSelectedId(null);},[selectionVisible]);
  useEffect(()=>{setSelectedId(null);},[search,dateFilter]);

  const waybills = detail ? warehouseWaybillsFromShipment(detail) : [];

  async function openPreview() {
    if (!detail || busyRef.current || uncertainId) return;
    busyRef.current = true; setBusy(true); setPrintError(""); setPrintNotice("");
    const selected = detail, current = epoch.current;
    let shipment = selected;
    try {
      if (!Array.isArray(selected.waybills)) throw new Error('Refresh the shipment before generating a Waybill.');
      if (selected.waybills.length === 0) {
        try {
          const saved = await saveWarehouseWaybill(selected.id);
          validateWaybillResponse(saved, selected.id);
          shipment = await getWarehouseShipment(selected.id);
          const stored = storedWaybillForPrint(shipment);
          if (shipment.id !== selected.id || stored.waybillId !== saved.id || stored.qrIdentifier !== saved.qrIdentifier || stored.reference !== saved.reference) throw new Error('Waybill read-back did not match. Refresh before retrying.');
          if (current === epoch.current) setDetail(shipment);
        } catch (cause) { if (current === epoch.current) setUncertainId(selected.id); throw cause; }
      }
      const prepared = await prepareRealWaybill(shipment);
      if (current === epoch.current) {
        setQrReady(false); setDialogOpened(false);
        setPreview({ shipmentId: selected.id, ...prepared });
      }
    } catch (cause) { if (current === epoch.current) setPrintError(errorMessage(cause)); }
    finally { busyRef.current = false; setBusy(false); }
  }
  function openPrintDialog() {
    if (!preview || !qrReady || busyRef.current || uncertainId) return;
    try { window.print(); setDialogOpened(true); setPrintNotice('Confirm printed output below only if printing completed. A canceled dialog does not record a print.'); }
    catch { setPrintError('The print dialog could not be opened. No print was recorded.'); }
  }
  async function confirmPrinted() {
    if (!preview || !dialogOpened || !qrReady || busyRef.current || uncertainId) return;
    const selected = preview, current = epoch.current;
    busyRef.current = true; setBusy(true); setPrintError("");
    try {
      const result = await saveWarehouseWaybill(selected.shipmentId, true);
      validateWaybillResponse(result, selected.shipmentId, selected.waybill, true);
      const shipment = await getWarehouseShipment(selected.shipmentId);
      const stored = storedWaybillForPrint(shipment);
      if (shipment.id !== selected.shipmentId || stored.waybillId !== selected.waybill.waybillId || stored.qrIdentifier !== selected.waybill.qrIdentifier || stored.reference !== selected.waybill.reference || !stored.printedAt) throw new Error('Print record could not be confirmed. Refresh before retrying.');
      if (current === epoch.current) { setDetail(shipment); setDialogOpened(false); setPrintNotice('Print confirmation saved. The original QR identifier is unchanged.'); }
    } catch (cause) { if (current === epoch.current) { setUncertainId(selected.shipmentId); setPrintError(errorMessage(cause)); } }
    finally { busyRef.current = false; setBusy(false); }
  }

  return (
    <>
      {verificationNotice&&(
        <p role="status" className="mb-3 rounded-md border border-green-200 bg-green-50 px-4 py-3 text-xs font-semibold text-green-800">
          {verificationNotice}
        </p>
      )}
      {!onBusyChange && <div className="mb-3 flex justify-end"><button type="button" disabled={loading||detailLoading||busy} onClick={()=>setRefresh(value=>value+1)} className="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-semibold">Refresh</button></div>}
      <div className="bg-white rounded-xl border border-slate-200/70 overflow-hidden" style={{boxShadow:'0 1px 2px rgba(15,23,42,0.04)'}}>
        <table className="w-full" aria-label="Real dispatch shipments" aria-busy={loading||itemsLoading}>
          <thead style={{backgroundColor:'#F4F6F9'}}><tr>
            {['JO No.','Client','Item','Qty','Method','Status'].map(label=><th key={label} className="font-dm text-left px-4 py-3" style={{fontSize:11,fontWeight:600,color:'#64748B',letterSpacing:0.4,textTransform:'uppercase'}}>{label}</th>)}
          </tr></thead>
          <tbody>
            {loading ? <tr><td colSpan={6} className="px-4 py-6 text-center font-dm" style={{fontSize:12,color:'#94A3B8'}}>Loading authenticated dispatch shipments...</td></tr>
              : error ? <tr><td colSpan={6} className="px-4 py-6 text-center font-dm"><p role="alert" className="text-xs text-red-700">{error}</p></td></tr>
              : shipments.length===0 ? <tr><td colSpan={6} className="px-4 py-6 text-center font-dm" style={{fontSize:12,color:'#94A3B8'}}>No Warehouse delivery records were returned. A completed Production JO alone does not create a shipment or waybill.</td></tr>
              : visibleShipments.length===0 ? <tr><td colSpan={6} className="px-4 py-6 text-center font-dm" style={{fontSize:12,color:'#94A3B8'}}>{itemsLoading?'Loading matching shipment details...':'No matching shipments in available data.'}</td></tr>
              : visibleShipments.map(row=>{
                const expanded=selectedId===row.id,summary=dispatchSummary(row),current=expanded&&detail?.id===row.id;
                const toggle=()=>{if(!busy)setSelectedId(expanded?null:row.id);};
                return <Fragment key={row.id}>
                  <tr data-shipment-id={row.id} onClick={toggle} onKeyDown={event=>{if(event.target!==event.currentTarget)return;if(event.key==='Enter'||event.key===' '){event.preventDefault();toggle();}}}
                    tabIndex={busy?-1:0} aria-expanded={expanded} aria-controls={'dispatch-details-'+row.id}
                    className="border-t border-slate-200/70 hover:bg-slate-50 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500">
                    <td className="px-4 py-3 font-mono-jb" style={{fontSize:12,fontWeight:700,color:'#1A2B4A'}}><button type="button" disabled={busy} className="text-left" aria-expanded={expanded} onKeyDown={event=>event.stopPropagation()}>
                      <WarehouseReference value={row.jobOrderReference||'Not available'}/><span className="block font-dm" style={{fontSize:10,color:'#64748B',fontWeight:400}}>Shipment {row.id} · {row.status}</span>
                    </button></td>
                    <td className="px-4 py-3 font-dm" style={{fontSize:13,fontWeight:600,color:'#0F172A'}}>{row.companyName||'Not available'}</td>
                    <td className="px-4 py-3 font-dm" style={{fontSize:13,color:'#475569'}}>{summary.available?summary.item:itemsLoading&&!itemDetails[row.id]?'Loading item details...':'Not available'}</td>
                    <td className="px-4 py-3 font-dm" style={{fontSize:13,color:'#475569'}}>{summary.quantity}</td>
                    <td className="px-4 py-3 font-dm" style={{fontSize:13,color:'#475569'}}>{row.deliveryMethodLabel||'Not available'}</td>
                    <td className="px-4 py-3"><span className="font-dm px-2 py-0.5 rounded-full" style={{fontSize:10,fontWeight:700,backgroundColor:'#FEE2E2',color:'#C8102E'}}>{dispatchStatus(row.status)}</span></td>
                  </tr>
                  {expanded && <tr><td colSpan={6} className="p-0">
                    <section id={'dispatch-details-'+row.id} aria-label={'Waybill for shipment '+row.id} className="border-t border-slate-200/70 px-4 py-3" style={{backgroundColor:'#F8FAFC'}}>
                      {detailLoading&&<p role="status" className="py-3 text-xs text-slate-600">Loading authenticated waybill details...</p>}
                      {detailError&&<p role="alert" className="py-3 text-xs text-red-700">{detailError}</p>}
                      {current&&!detailLoading&&!detailError&&<>
                        <div className="rounded-lg border border-slate-200 bg-white px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                          <div><h3 className="font-syne" style={{fontSize:14,fontWeight:800,color:'#1A2B4A',letterSpacing:0.5}}>WAYBILL</h3><p className="font-dm mt-0.5" style={{fontSize:11,color:'#64748B'}}>Shipment document</p></div>
                          <div className="flex min-w-0 flex-wrap items-center justify-end gap-4">
                            <div className="flex min-w-0 flex-wrap items-center justify-end gap-x-3 gap-y-1">
                              {waybills[0]?.reference&&<span className="font-mono-jb min-w-0 max-w-full break-all sm:max-w-64" style={{fontSize:12,fontWeight:700,color:'#1A2B4A'}}><WarehouseReference value={waybills[0].reference}/></span>}
                              <span title={waybills[0]?.printedAt?`Originally printed: ${waybills[0].printedAt}`:undefined} aria-label="Waybill print status" className="font-dm flex items-center gap-1.5" style={{fontSize:11,fontWeight:700,color:waybills[0]?.printedAt?'#15803D':'#64748B'}}>
                                <span className="w-2 h-2 rounded-full" style={{backgroundColor:waybills[0]?.printedAt?'#16A34A':'#94A3B8'}} />
                                {detail.waybills?.length===0?'Not Generated':waybills.length?(waybills[0].printedAt?'Printed':'Not recorded as printed'):'Record unavailable'}
                              </span>
                            </div>
                            <button type="button" onClick={()=>{void openPreview();}} disabled={busy||Boolean(uncertainId)||!Array.isArray(detail.waybills)} className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-md text-white font-dm hover:opacity-90 disabled:opacity-50" style={{backgroundColor:'#C8102E',fontSize:12,fontWeight:800,letterSpacing:0.3}}>
                              <Printer size={14} strokeWidth={2.5}/>{busy?'Preparing Waybill...':detail.waybills?.length===0?'Generate & Print Waybill':'Preview / Reprint Waybill'}
                            </button>
                          </div>
                        </div>
                        <WarehouseProductSketches deliveryId={detail.id}/>
                        {detail.salesInvoiceCount && /^[0-9]{1,20}$/.test(detail.salesInvoiceCount) && BigInt(detail.salesInvoiceCount) > 1n && <p role="status" className="mt-2 text-xs text-amber-800">Multiple sales invoices are linked to this purchase order. No single invoice reference is selected for the Waybill.</p>}
                        <WarehouseWaybillVerification key={detail.id+'-'+refresh+'-'+refreshKey} deliveryId={detail.id} onScanTargetChange={onScanTargetChange} onVerified={handleVerified}/>
                      </>}
                      {uncertainId&&<p role="alert" className="mt-2 text-xs text-amber-800">The last change must be reconciled. Refresh this shipment before another change; no automatic retry was made.</p>}
                      {printError&&<p role="alert" className="mt-2 text-xs text-red-700">{printError}</p>}
                    </section>
                  </td></tr>}
                </Fragment>;
              })}
          </tbody>
        </table>
      </div>
      {itemsLoading&&<p role="status" className="mt-2 text-xs text-slate-500">Loading persisted shipment item details...</p>}
      {!itemsLoading&&(itemReadFailed||visibleShipments.some(row=>!dispatchSummary(row).available))&&<p className="mt-2 text-xs text-slate-500">Some shipment item details are unavailable. Quantities are not estimated.</p>}
      {dateFilter!=='all'&&<p className="mt-2 text-xs text-slate-500">Filtered by actual dispatch date, or planned date when not dispatched. Undated shipments are excluded.</p>}
      {preview && (
        <div role="dialog" aria-modal="true" aria-label="Waybill Preview" className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/70 p-4">
          <div className="flex max-h-[90vh] w-full max-w-4xl flex-col rounded-xl bg-white shadow-2xl">
            <div className="waybill-preview-actions flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-3">
              <div className="min-w-0"><h3 className="font-syne text-sm font-bold">Waybill Preview</h3><p className="break-all text-xs text-slate-500"><WarehouseReference value={preview.waybill.reference}/></p></div>
              <div className="flex gap-2">
                <button type="button" disabled={!qrReady || busy || Boolean(uncertainId)} onClick={openPrintDialog} className="rounded-md bg-slate-800 px-4 py-2 text-xs font-bold text-white disabled:opacity-50">Print Waybill</button>
                <button type="button" disabled={!dialogOpened || !qrReady || busy || Boolean(uncertainId)} onClick={() => { void confirmPrinted(); }} className="rounded-md border border-slate-300 px-3 py-2 text-xs font-bold disabled:opacity-50">Confirm printed</button>
                <button type="button" disabled={busy} onClick={() => setPreview(null)} aria-label="Close Waybill preview" className="px-3 text-lg disabled:opacity-50">×</button>
              </div>
              {printNotice && <p role="status" className="w-full text-xs text-slate-600">{printNotice}</p>}
              {printError && <p role="alert" className="w-full text-xs text-red-700">{printError}</p>}
              {uncertainId && <p role="alert" className="w-full text-xs text-amber-800">Close the preview and refresh the shipment to reconcile the last change.</p>}
            </div>
            <div className="overflow-auto bg-slate-100 p-4 md:p-5 print:p-0">
              <WaybillDocument data={preview.document} qrIdentifier={preview.waybill.qrIdentifier} onQrReady={() => setQrReady(true)} onQrError={() => { setQrReady(false); setPrintError('QR image could not be loaded. Printing is blocked.'); }} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
