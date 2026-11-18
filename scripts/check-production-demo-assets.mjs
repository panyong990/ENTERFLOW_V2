import { readdir, readFile, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { scanAssets } from './production-asset-scan.mjs';

const args=process.argv.slice(2);
if(args.length>1 || args.some(arg=>arg!=='--write-report'))throw new Error('Only --write-report is supported.');
const directory=join(process.cwd(),'dist','assets');
const filenames=(await readdir(directory)).filter(name=>name.endsWith('.js')).sort();
const assets=await Promise.all(filenames.map(async filename=>({filename,contents:await readFile(join(directory,filename),'utf8')})));
const catalog=JSON.parse(await readFile(new URL('../docs/inventory-reconciliation/integrated-main-catalog.json',import.meta.url),'utf8'));
const materialSource=await readFile(new URL('../src/app/store/materials.tsx',import.meta.url),'utf8');
const result=scanAssets(assets,{catalog,materialSource});
if(args.includes('--write-report')) {
  const reportDirectory=join(process.cwd(),'docs','asset-scanner');
  await mkdir(reportDirectory,{recursive:true});
  await writeFile(join(reportDirectory,'current-scan.json'),JSON.stringify(result,null,2)+'\n');
}
console.log(JSON.stringify({assets:result.assets,verifiedCatalogOccurrences:result.classifiedCatalog.length,verifiedCompatibilityOccurrences:result.classifiedCompatibility.length,unexplainedFindings:result.violations.length}));
if(result.violations.length)throw new Error('Production asset policy failed. Review safe scanner evidence; no finding has been suppressed.');
