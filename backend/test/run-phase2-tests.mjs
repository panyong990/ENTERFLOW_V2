// Offline backend regression only. This runner never decrypts a live credential.
import {readdir} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import path from 'node:path';
async function tests(dir){const files=[];for(const entry of await readdir(dir,{withFileTypes:true})){const p=path.join(dir,entry.name);if(entry.isDirectory())files.push(...await tests(p));else if(entry.name.endsWith('.test.js'))files.push(p);}return files;}
const child=spawn(process.execPath,['--import','./backend/test/phase2-offline-env.mjs','--test','--test-concurrency=4','--test-reporter=spec',...(await tests('backend/src')).sort()],{stdio:'inherit',windowsHide:true});
child.on('error',()=>{process.exitCode=1;});child.on('exit',code=>{process.exitCode=code??1;});
