import {summarizeWaybillItems} from './warehouseWaybillPrint.js';
export function validDispatchIdentity(row) {
  return row&&['id','jobOrderId'].every(key=>typeof row[key]==='string'&&/^[1-9]\d{0,19}$/.test(row[key])&&BigInt(row[key])<=18446744073709551615n);
}
export function dispatchSummary(shipment) {
  try {return {...summarizeWaybillItems(shipment?.waybillItems),available:true};}
  catch {return {item:'Not available',quantity:'Not available',available:false};}
}
export function dispatchMatches(shipment,{search='',dateFilter='all',now=new Date()}={}) {
  const term=search.trim().toLocaleLowerCase(),summary=dispatchSummary(shipment);
  const fields=[shipment.jobOrderReference,shipment.companyName,shipment.id,...(summary.available?[summary.item]:[])];
  if(term&&!fields.some(value=>typeof value==='string'&&value.toLocaleLowerCase().includes(term)))return false;
  if(dateFilter==='all')return true;
  const raw=shipment.dispatchedAt??shipment.estimatedDeliveryDate;
  if(typeof raw!=='string'||!/^\d{4}-\d{2}-\d{2}/.test(raw)||!Number.isFinite(Date.parse(raw)))return false;
  const day=new Date(raw.slice(0,10)+'T00:00:00'),today=new Date(now);today.setHours(0,0,0,0);
  const tomorrow=new Date(today);tomorrow.setDate(tomorrow.getDate()+1);
  const cutoff=new Date(today);if(dateFilter==='7days')cutoff.setDate(cutoff.getDate()-6);else if(dateFilter==='30days')cutoff.setDate(cutoff.getDate()-29);
  return day>=cutoff&&day<tomorrow;
}
export function dispatchStatus(value) {
  return ({pending:'Pending',in_transit:'In Transit',delivered:'Delivered',picked_up:'Picked Up',cancelled:'Cancelled'})[value]??value??'Not available';
}
