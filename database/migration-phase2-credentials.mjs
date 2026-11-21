import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { validatePhase2Target } from './migration-phase2.mjs';

// Only the credential explicitly bound to this isolated descriptor is eligible.
// The plaintext travels through an anonymous child-process pipe, never a file,
// shell argument, process environment, console or persisted migration report.
export async function phase2Password(env) {
  validatePhase2Target(env);
  if (Boolean(env.DB_MIGRATION_PASSWORD) === Boolean(env.DB_MIGRATION_PASSWORD_DPAPI_FILE)) throw new Error('Phase 2 requires exactly one password source');
  if (env.DB_MIGRATION_PASSWORD) return env.DB_MIGRATION_PASSWORD;
  if (process.platform !== 'win32') throw new Error('Phase 2 DPAPI credentials require their Windows user');
  const descriptor = JSON.parse((await readFile(new URL('./phase2-target.local.json',import.meta.url),'utf8')).replace(/^\uFEFF/,''));
  if (descriptor.host !== env.DB_HOST || String(descriptor.port) !== env.DB_PORT || descriptor.database !== env.DB_NAME || descriptor.container !== 'enterflow-phase2-mysql' ||
      path.resolve(env.DB_MIGRATION_PASSWORD_DPAPI_FILE).toLowerCase() !== path.resolve(descriptor.credentialFile).toLowerCase() || env.DB_MIGRATION_USER !== 'root') throw new Error('DPAPI source does not match the isolated Phase 2 root descriptor');
  const script = "$ErrorActionPreference='Stop'; $secret=ConvertTo-SecureString ((Get-Content -Raw -LiteralPath $env:ENTERFLOW_PHASE2_CREDENTIAL_FILE).Trim()); $ptr=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($secret); try { [Console]::Out.Write([Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)) } finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr); $secret.Dispose() }";
  try {
    const { stdout } = await promisify(execFile)('powershell.exe',['-NoProfile','-NonInteractive','-Command',script],{
      windowsHide:true,timeout:10000,maxBuffer:16384,
      env:{ ...process.env,ENTERFLOW_PHASE2_CREDENTIAL_FILE:descriptor.credentialFile },
    });
    if (!stdout) throw new Error('Empty password');
    return stdout;
  } catch { throw new Error('Cannot decrypt the descriptor-bound Phase 2 credential for this Windows user'); }
}
