import { writeFile } from 'node:fs/promises';
import { connectTarget } from './target.mjs';
if (process.argv.slice(2).join(' ') !== '--approved-read') throw new Error('Explicit isolated identity-read approval required');
try {
  const { db, manifest } = await connectTarget();
  try {
    await writeFile(new URL('identity.observed.local.json', import.meta.url), JSON.stringify(manifest, null, 2) + '\n', { flag: 'wx' });
    console.log('Saved nonsecret observed identity for review. No application database or data created.');
  } finally { await db.end(); }
} catch { console.error('Identity observation failed; no pin accepted. Inspect owned resource metadata; do not bypass checks or retry creation.'); process.exitCode = 1; }
