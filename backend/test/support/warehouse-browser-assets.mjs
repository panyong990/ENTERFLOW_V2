// Pure browser fixture builder. No database, credentials, grants or launcher imports.
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { compile } from '@tailwindcss/node';

export async function cameraAssets() {
  const bundle = await build({stdin:{resolveDir:process.cwd(),loader:'tsx',contents:`
    import React from 'react';import {createRoot} from 'react-dom/client';
    import {SessionProvider} from './src/app/store/session.tsx';
    import {OrdersProvider} from './src/app/store/orders.tsx';
    import {NotificationsProvider} from './src/app/store/notifications.tsx';
    import {enableRealRequests} from './src/app/api/client.ts';
    import {WaybillScanner} from './src/app/components/WaybillScanner.tsx';
    enableRealRequests(true);
    createRoot(document.getElementById('root')).render(<SessionProvider role="warehouse" name="Offline Warehouse employee" mode="real"><OrdersProvider mode="real"><NotificationsProvider mode="real"><WaybillScanner/></NotificationsProvider></OrdersProvider></SessionProvider>);
  `},bundle:true,write:false,platform:'browser',format:'iife',jsx:'automatic',define:{'process.env.NODE_ENV':'"production"','import.meta.env.DEV':'false'}});
  const component = name => readFileSync(new URL(`../../../src/app/components/${name}.tsx`,import.meta.url),'utf8');
  const files=['WaybillScanner','WarehouseWaybillVerification','RealWarehouseWaybillRecords','WaybillDocument','WarehouseReference','WarehouseProductSketches'].map(component);
  const tokens=files.flatMap(source=>[...source.matchAll(/className="([^"]+)"/g)].flatMap(match=>match[1].split(/\s+/)));
  tokens.push('text-green-800','text-red-700','animate-pulse');
  const compiler=await compile('@import "tailwindcss";',{base:process.cwd(),onDependency:()=>{}});
  const printStyle=files[0].match(/<style>\{`([\s\S]*?@media print[\s\S]*?)`\}<\/style>/)?.[1];
  assert.ok(printStyle,'Existing Waybill print stylesheet is required');
  const fonts=readFileSync(new URL('../../../src/styles/fonts.css',import.meta.url),'utf8').replace(/@import[^;]+;/g,'');
  return {js:bundle.outputFiles[0].text,css:compiler.build(tokens)+'\n'+fonts+'\n'+printStyle};
}
