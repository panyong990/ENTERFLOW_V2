// Read-only TLS diagnosis. No migration runner, activation locks or write APIs.
import {readFile,writeFile} from 'node:fs/promises';
import {parseEnv} from 'node:util';
import {X509Certificate} from 'node:crypto';
import path from 'node:path';
import {checkServerIdentity} from 'node:tls';
import mysql from 'mysql2';
import {connectPhase2,phase2CertificateName} from '../migration-phase2-tls.mjs';
import {phase2Password} from '../migration-phase2-credentials.mjs';
import {validatePhase2Target} from '../migration-phase2.mjs';

const env = parseEnv(await readFile('database/.env.phase2.migrations.local','utf8'));
validatePhase2Target(env);
for (const key of Object.keys(env)) {
  if (process.env[key] !== undefined && process.env[key] !== env[key]) throw new Error('Ambient Phase 2 environment conflict');
}
if (!env.DB_SSL_CA || env.DB_SSL_LOCAL_SELF_SIGNED === 'true') throw new Error('Verified CA required');
const ca = await readFile(env.DB_SSL_CA,'utf8'), caCertificate = new X509Certificate(ca);
const config = {host:env.DB_HOST,port:Number(env.DB_PORT),database:env.DB_NAME,
  user:env.DB_MIGRATION_USER,password:await phase2Password(env),
  ssl:{ca,rejectUnauthorized:true,verifyIdentity:true},multipleStatements:false,
  supportBigNumbers:true,bigNumberStrings:true,timezone:'Z',connectTimeout:10000};
const name = phase2CertificateName(env);
const report = {target:{host:config.host,port:config.port,database:config.database,expectedIdentity:name},
  ca:{path:path.resolve(env.DB_SSL_CA),subject:caCertificate.subject,issuer:caCertificate.issuer,
    validFrom:caCertificate.validFrom,validTo:caCertificate.validTo,fingerprint256:caCertificate.fingerprint256},
  handshakes:[],connections:[],queries:[],readOnly:true};
const connections = [];
const driver = {createConnection(options) {
  const connection = mysql.createConnection(options), original = connection.startTLS;
  connection.startTLS = function(done) {
    original.call(this,error => {
      const socket = this.stream, cert = socket.getPeerCertificate(true);
      const identityError = checkServerIdentity(name,cert ?? {});
      const leaf = cert?.raw ? new X509Certificate(cert.raw) : null;
      report.handshakes.push({host:options.host,port:options.port,
        rejectUnauthorized:options.ssl.rejectUnauthorized,verifyIdentity:options.ssl.verifyIdentity,
        authorized:socket.authorized,authorizationError:socket.authorizationError ?? null,
        protocol:socket.getProtocol(),sessionReused:socket.isSessionReused(),
        servername:socket.servername ?? null,peerCertificateFields:Object.keys(cert ?? {}),
        san:cert?.subjectaltname ?? null,subject:cert?.subject ?? null,issuer:cert?.issuer ?? null,
        validFrom:cert?.valid_from ?? null,validTo:cert?.valid_to ?? null,
        fingerprint256:cert?.fingerprint256 ?? null,
        signedByConfiguredCA:leaf ? leaf.verify(caCertificate.publicKey) : null,
        identityError:identityError ? {code:identityError.code,reason:identityError.reason} : null,
        driverTlsError:error?.code ?? null});
      done(error);
    });
  };
  return connection;
}};
try {
  for (const role of ['owner','observer']) {
    try {
      const db = await connectPhase2(config,name,driver); connections.push(db);
      const sql = 'SELECT DATABASE() AS name,VERSION() AS version,@@server_uuid AS serverUuid,@@hostname AS hostname,@@port AS internalPort,CAST(CONNECTION_ID() AS CHAR) AS connectionId';
      report.queries.push({role,sql});
      const [[identity]] = await db.query(sql);
      if (identity.name !== 'enterflow_phase2_db' || identity.version !== '8.4.13' || identity.serverUuid !== '0d25d92c-e5cf-11f1-8149-0ae55c5c9ea8') throw new Error('Unexpected target identity');
      const settingsSql = "SHOW VARIABLES WHERE Variable_name IN ('ssl_ca','ssl_cert')";
      report.queries.push({role,sql:settingsSql});
      const [settings] = await db.query(settingsSql);
      report.connections.push({role,result:'PASS',identity,settings});
    } catch(error) {
      report.connections.push({role,result:'FAIL',code:error.code ?? 'DIAGNOSTIC_FAILURE',tlsFailure:error.phase2TlsFailure ?? null});
    }
  }
} finally { for (const db of connections) await db.end(); }
report.result = report.connections.length === 2 && report.connections.every(c => c.result === 'PASS') ? 'PASS' : 'FAIL';
const output = process.argv[2];
if (output) await writeFile(output,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
if (report.result !== 'PASS') process.exitCode = 1;
