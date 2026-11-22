// Test-only direct connection to the documented application account; no fallback.
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import mysql from 'mysql2/promise';
import { createDatabaseTlsOptions } from '../src/config/database-tls.js';
import {guardPhase2Pool} from '../src/config/phase2-pool.js';
export async function openPhase2Application() {
  const credential = path.join(process.env.LOCALAPPDATA, 'EnterFlow', 'Phase2', 'app-password.dpapi');
  const script = "$ErrorActionPreference='Stop'; $secret=ConvertTo-SecureString ((Get-Content -Raw -LiteralPath $env:ENTERFLOW_PART2_CREDENTIAL_FILE).Trim()); $ptr=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($secret); try { [Console]::Out.Write([Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)) } finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr); $secret.Dispose() }";
  let password;
  try {
    const result = await promisify(execFile)('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], {
      windowsHide: true,
      timeout: 10000,
      maxBuffer: 16384,
      env: {
        ...process.env,
        ENTERFLOW_PART2_CREDENTIAL_FILE: credential
      }
    });
    password = result.stdout;
    if (!password) throw new Error();
  } catch {
    throw new Error('Existing Phase 2 application credential could not be decrypted');
  }
  const ca = await readFile('backend/certs/local/phase2/ca.pem', 'utf8');
  const options = createDatabaseTlsOptions({
    host: '127.0.0.1',
    port: 62286,
    ca,
    expectedIdentity: 'localhost'
  });
  const settings={
    ...options,
    database: 'enterflow_phase2_db',
    user: 'enterflow_phase2_app',
    password,
    multipleStatements: false,
    supportBigNumbers: true,
    bigNumberStrings: true,
    decimalNumbers: false,
    timezone: 'Z',
    connectTimeout: 10000
  };
  const c = await mysql.createConnection(settings);
  const connectionId=String(c.connection.threadId),preludeQueries=[];
  try {
    const identitySql='SELECT DATABASE() AS name,VERSION() AS version,@@server_uuid AS serverUuid,CURRENT_USER() AS account';
    const [[identity]] = await c.query(identitySql);
    preludeQueries.push({connectionId,sql:identitySql,result:'OK'});
    if (identity.name !== 'enterflow_phase2_db' || identity.version !== '8.4.13' || identity.serverUuid !== '0d25d92c-e5cf-11f1-8149-0ae55c5c9ea8' || !identity.account.startsWith('enterflow_phase2_app@') || c.connection.stream.authorized !== true) throw new Error('Unexpected Phase 2 identity');
    await c.query("SET SESSION time_zone='+00:00'");
    preludeQueries.push({connectionId,sql:"SET SESSION time_zone='+00:00'",result:'OK'});
    identity.connectionId=connectionId;
    const stream=c.connection.stream;
    identity.target={configuredTcpHost:'127.0.0.1',configuredTcpPort:62286,driverVerificationHost:c.connection.config.host,observedRemoteHost:stream.remoteAddress??stream._parent?.remoteAddress??null,observedRemotePort:stream.remotePort??stream._parent?.remotePort??null};
    identity.tls={authorized:c.connection.stream.authorized,protocol:c.connection.stream.getProtocol(),expectedIdentity:'localhost'};
    return {
      connection: c,
      identity,preludeQueries,
      createGuardedPool:(onQuery=()=>{})=>{
        const raw=mysql.createPool({...settings,connectionLimit:2});
        const tracked={end:()=>raw.end(),async getConnection(){const connection=await raw.getConnection(),query=connection.query.bind(connection);connection.query=async(sql,params)=>{const entry={connectionId:String(connection.connection.threadId),sql};onQuery(entry);try{const result=await query(sql,params);entry.result='OK';return result;}catch(error){entry.result='ERROR';entry.code=error.code;throw error;}};return connection;}};
        return guardPhase2Pool(tracked,{phase2:{serverUuid:'0d25d92c-e5cf-11f1-8149-0ae55c5c9ea8'}});
      }
    };
  } catch (e) {
    await c.end();
    throw e;
  }
}
