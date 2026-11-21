// Requires explicit approval for isolated container replacement. No MySQL SQL.
// Docker configuration (including existing Env) is retained in memory, not logged.
import http from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const name = 'enterflow-phase2-mysql';
const candidate = 'enterflow-phase2-mysql-fixed-port';
const retained = 'enterflow-phase2-mysql-before-fixed-tls';
const oldId = '2acac2d1b6069b6ed30a95b69eb582bd68ef9f365bc092f46530306f34a9eb73';
const volume = 'enterflow-phase2-data';
const assert = (ok,message) => { if (!ok) throw new Error(message); };
async function api(method,url,body,allow404 = false) {
  const data = body === undefined ? undefined : JSON.stringify(body);
  return new Promise((resolve,reject) => {
    const req = http.request({ socketPath:'//./pipe/docker_engine',path:url,method,
      headers:data ? {'Content-Type':'application/json','Content-Length':Buffer.byteLength(data)} : {} },res => {
      let text = ''; res.setEncoding('utf8'); res.on('data',part => { text += part; });
      res.on('end',() => {
        if (allow404 && res.statusCode === 404) return resolve(null);
        if (res.statusCode < 200 || res.statusCode > 299) return reject(new Error(`Docker ${method} ${url} failed: HTTP ${res.statusCode}; response withheld`));
        resolve(text ? JSON.parse(text) : null);
      });
    });
    req.on('error',() => reject(new Error('Docker named-pipe access failed')));
    req.setTimeout(90000,() => req.destroy());
    req.end(data);
  });
}
try {
  const descriptorPath = new URL('../phase2-target.local.json',import.meta.url);
  const descriptor = JSON.parse((await readFile(descriptorPath,'utf8')).replace(/^\uFEFF/,''));
  assert(descriptor.containerId === oldId && descriptor.container === name && descriptor.port === 62286 && descriptor.database === 'enterflow_phase2_db','Descriptor guard failed');
  const original = await api('GET',`/containers/${name}/json`);
  assert(original.Id === oldId && original.Config.Image === descriptor.image,'Original container identity mismatch');
  assert(original.Mounts.length === 1 && original.Mounts[0].Name === volume && original.Mounts[0].Destination === '/var/lib/mysql','Original data volume mismatch');
  assert(original.HostConfig.PortBindings['3306/tcp'].length === 1 && original.HostConfig.PortBindings['3306/tcp'][0].HostIp === '127.0.0.1' && original.HostConfig.PortBindings['3306/tcp'][0].HostPort === '','Expected original dynamic binding');
  assert(!await api('GET',`/containers/${candidate}/json`,undefined,true),'Candidate name already exists; investigate, do not retry');
  assert(!await api('GET',`/containers/${retained}/json`,undefined,true),'Retained name already exists; investigate, do not retry');
  const config = structuredClone(original.Config);
  const host = structuredClone(original.HostConfig);
  host.PortBindings = {'3306/tcp':[{HostIp:'127.0.0.1',HostPort:'62286'}]};
  host.PublishAllPorts = false;
  const created = await api('POST',`/containers/create?name=${candidate}`,{...config,HostConfig:host});
  console.log(JSON.stringify({step:'created stopped candidate',id:created.Id,volume,fixedPort:62286}));
  await promisify(execFile)('docker',['cp','database/phase2-tls/enterflow-phase2-tls.cnf',`${candidate}:/etc/mysql/conf.d/enterflow-phase2-tls.cnf`],{windowsHide:true});
  const staged = await api('GET',`/containers/${created.Id}/json`);
  assert(staged.Mounts.length === 1 && staged.Mounts[0].Name === volume,'Candidate data volume mismatch; not started');
  assert(JSON.stringify(staged.Config.Env) === JSON.stringify(original.Config.Env),'Candidate environment mismatch; not started');
  if (original.State.Running) await api('POST',`/containers/${oldId}/stop?t=60`);
  await api('POST',`/containers/${oldId}/rename?name=${retained}`);
  await api('POST',`/containers/${created.Id}/rename?name=${name}`);
  await api('POST',`/containers/${created.Id}/start`);
  const actual = await api('GET',`/containers/${name}/json`);
  assert(actual.State.Running && actual.Mounts[0].Name === volume,'Replacement did not start on preserved volume; manual review required');
  assert(actual.NetworkSettings.Ports['3306/tcp'][0].HostIp === '127.0.0.1' && actual.NetworkSettings.Ports['3306/tcp'][0].HostPort === '62286','Replacement published binding mismatch');
  descriptor.containerId = actual.Id;
  await writeFile(descriptorPath,JSON.stringify(descriptor,null,2)+'\n','utf8');
  console.log(JSON.stringify({step:'fixed binding restored',id:actual.Id,name,volume,port:62286,retainedOldContainer:retained}));
} catch(error) {
  // No cleanup, deletion, automatic rollback or retries of partial Docker work.
  console.error(error.message?.startsWith('Docker ') ? error.message : 'Isolated port replacement stopped; inspect the current container state before further action.');
  process.exitCode = 1;
}
