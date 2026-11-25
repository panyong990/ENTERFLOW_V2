import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire,Module} from 'node:module';
import {transformSync} from 'esbuild';
const require=createRequire(import.meta.url);
const compiled=transformSync(readFileSync(new URL('./adapters.ts',import.meta.url),'utf8'),{loader:'ts',format:'cjs'});
const module=new Module('client-adapters.fixture.cjs');
module.require=require;
module._compile(compiled.code,'client-adapters.fixture.cjs');
const {project,quotationUnitPrice}=module.exports;
const quotation={id:'9007199254740993',reference:'QT-1',revisionNumber:2,isLatestRevision:true,status:'accepted',totalAmount:'94.16',subtotal:'84.16',addonsTotal:'10.00',discountPercent:'10',downpaymentPercent:20,downpaymentAmount:'18.83',paymentTermLabel:'15-Day Terms',note:'Deliver to reception',noteHighlighted:true,pricingSummary:{discountAmount:'8.25',vatType:'Exclusive',vatRate:'12.0000',applyVat:true,vatAmount:'8.91'},lines:[{id:'21',lineNumber:1,description:'Filter',quantity:3,unitLabel:'pc',unitPrice:'28.0533'}],addons:[{id:'31',kind:'packaging',materialId:'71',label:'Carton',quantity:'2.0000',unitPrice:'5.0000',includeInUnitPrice:false},{id:'32',kind:'shipping',label:'Lalamove',quantity:'1.0000',unitPrice:'1.00',includeInUnitPrice:true}]};
function bundle(q=quotation){return {order:{id:'19',reference:'INQ-19',stageLabel:'Quotation',items:[],revisionRequests:[]},quotations:[q],purchaseOrder:null,jobOrders:[],shipments:[],invoices:[],payments:[],errors:[]};}
test('client projection retains four-decimal prices, add-ons, commercial totals, notes and accepted PO eligibility',()=>{
  const [view]=project(bundle(),{companyName:'Client'},'orders');
  assert.equal(view.quotationDecision,'accepted');assert.equal(view.quotationId,quotation.id);
  assert.equal(view.quotationDoc.lineItems[0].unitPrice,28.0533);
  assert.equal(view.quotationDoc.lineItems[0].unit,'pc');
  assert.equal(view.quotationDoc.packaging.materialName,'Carton');
  assert.equal(view.quotationDoc.shipping.includeInUnit,true);
  assert.equal(view.quotationDoc.total,94.16);
  assert.equal(view.quotationDoc.revisionNumber,2);
  assert.equal(view.quotationDoc.note,'Deliver to reception');
  assert.equal(view.quotationDoc.pricingSummary.vatAmount,8.91);
});
test('an older visible sent quotation cannot appear current while Sales prepares a draft',()=>{
  const [view]=project(bundle({...quotation,status:'sent',isLatestRevision:false} ),{companyName:'Client'},'orders');
  assert.equal(view.quotationStatus,'superseded');assert.equal(view.quotationDecision,null);
});
test('quotation prices reject invalid and unsafe decimals without inventing zero',()=>{
  assert.equal(quotationUnitPrice('27.5000'),27.5);
  for(const value of [null,'','unknown','-1','0.00001','9007199254740993.00'])assert.ok(Number.isNaN(quotationUnitPrice(value)));
});
