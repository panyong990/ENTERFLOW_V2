// Execute the real presentation/calculation exports; no HTTP or database calls.
import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import Module,{createRequire} from 'node:module';
import {resolve} from 'node:path';

const bundle=await build({stdin:{resolveDir:process.cwd(),loader:'tsx',contents:`
  export {computeUnitPrice} from './src/app/store/materials.tsx';
  export {warehouseFinishedGoodStatus} from './src/app/api/warehouseFinishedGoods.ts';
`},bundle:true,write:false,platform:'node',format:'cjs',jsx:'automatic',external:['react','react-dom'],define:{'import.meta.env.DEV':'false'}});
const mod=new Module(resolve('warehouse-blocker-contracts.cjs'));
mod.paths=createRequire(import.meta.url).resolve.paths('react');
mod._compile(bundle.outputFiles[0].text,resolve('warehouse-blocker-contracts.cjs'));
const {computeUnitPrice,warehouseFinishedGoodStatus}=mod.exports;

test('MAIN per-filter BOM computation keeps material prices, labor, markup, discount and VAT distinct',()=>{
  const materials=[{id:'A',unitPrice:10,qtyInStock:2},{id:'B',unitPrice:30,qtyInStock:5}];
  const config={laborCost:5,includeLabor:true,markupPct:10,applyMarkup:true,discountPct:0,vatType:'Exclusive',vatRate:12,applyVAT:true};
  const firstBom=[{materialId:'A',qtyConsumed:1.5}];
  const secondBom=[{materialId:'B',qtyConsumed:4}];
  const before=JSON.stringify({materials,config,firstBom,secondBom});
  const first=computeUnitPrice(firstBom,config,materials);
  const second=computeUnitPrice(secondBom,config,materials);
  assert.equal(first.material,15);assert.equal(first.total,20);assert.equal(first.withMarkup,22);
  assert.ok(Math.abs(first.withVat-24.64)<1e-9);
  assert.ok(Math.abs(second.withVat-154)<1e-9);
  assert.ok(Math.abs(first.withVat*3+second.withVat*2-381.92)<1e-9);
  assert.equal(computeUnitPrice(firstBom,{...config,discountPct:100},materials).withVat,0);
  assert.equal(JSON.stringify({materials,config,firstBom,secondBom}),before);
});

test('unknown prices never become a successful zero-price BOM computation',()=>{
  const config={includeLabor:false,applyMarkup:false,applyVAT:false};
  assert.ok(Number.isNaN(computeUnitPrice([{materialId:'A',qtyConsumed:1}],config,[{id:'A',unitPrice:Number.NaN}]).withVat));
});

test('finished goods preserve verified zero, low/equal thresholds, unknown and provisional distinctions',()=>{
  const item={qtyInStock:'6',quantityStatus:'verified',bufferMin:'5',thresholdStatus:'verified'};
  for(const [patch,label] of [
    [{},'In Stock'],[{qtyInStock:'5'},'Low Stock'],[{qtyInStock:'0'},'Out of Stock'],
    [{qtyInStock:null,quantityStatus:'unknown'},'Not verified'],
    [{qtyInStock:'0',quantityStatus:'provisional_sample'},'Not verified'],
    [{bufferMin:null,thresholdStatus:'unknown'},'Threshold not verified']
  ]) assert.equal(warehouseFinishedGoodStatus({...item,...patch}).label,label);
  assert.deepEqual(item,{qtyInStock:'6',quantityStatus:'verified',bufferMin:'5',thresholdStatus:'verified'});
});
