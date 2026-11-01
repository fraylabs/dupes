import { spawn,spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
// One-step signup on a local site Worker and D1, without a browser. Values are synthetic.
const config='sites/dupes.sh/wrangler.jsonc',state=resolve('proof/signup-d1-'+randomUUID());
const origin='http://127.0.0.1:8792',env={...process.env,WRANGLER_SEND_METRICS:'false'},operator='synthetic-proof-platform-key-'+'0'.repeat(16);
const migrate=spawnSync(process.execPath,['node_modules/wrangler/bin/wrangler.js','d1','migrations','apply','dupes-site-local','--local','--config',config,'--persist-to',state],{env,encoding:'utf8',timeout:60000});assert.equal(migrate.status,0,'Local site D1 migration');
const worker=spawn(process.execPath,['node_modules/wrangler/bin/wrangler.js','dev','--local','--config',config,'--ip','127.0.0.1','--port','8792','--persist-to',state,'--var','ABUSE_SECRET:synthetic-proof-abuse-secret-'+'0'.repeat(16),'--var','PLATFORM_API_KEYS:'+operator,'--var','PUBLIC_ORIGIN:'+origin],{env,stdio:['ignore','pipe','pipe']});
let logs='';worker.stdout.on('data',d=>logs+=d);worker.stderr.on('data',d=>logs+=d);
const pass=(message:string)=>console.log('PASS '+message);
const site={Origin:origin,'Content-Type':'application/json','CF-Connecting-IP':'198.51.100.7','User-Agent':'Mozilla/5.0 (Macintosh) Proof'};
async function post(path:string,body:unknown,expected:number,headers:Record<string,string>=site){const r=await fetch(origin+path,{method:'POST',headers,body:JSON.stringify(body)});assert.equal(r.status,expected,path+' HTTP status');return r.status===204?undefined:r.json() as Promise<any>;}
try {
  for(let i=0;i<300;i++){try{if((await fetch(origin+'/health')).ok)break;}catch{}if(i===299)throw Error('Site Wrangler readiness failed');await new Promise(r=>setTimeout(r,100));}
  const made=await post('/api/signup',{email:'one-step@example.invalid',website:'',name:'Acme feedback'},201);
  assert.ok(made.workspaceKey&&made.adminApiKey&&made.url?.startsWith(origin+'/i/'),'Workspace key, board URL and admin key in one response');
  assert.equal((await fetch(made.url+'/')).status,200);
  assert.deepEqual((await(await fetch(made.url+'/api/boards')).json()).map((b:any)=>b.id),['ideas']);
  assert.equal((await fetch(made.url+'/api/admin/users',{headers:{Authorization:'Bearer '+made.adminApiKey}})).status,200);
  const owned=await(await fetch(origin+'/v1/instances',{headers:{Authorization:'Bearer '+made.workspaceKey}})).json();
  assert.deepEqual(owned.map((i:any)=>[i.id,i.app,i.name]),[[made.instanceId,'feedback','Acme feedback']]);
  await post('/v1/instances',{app:'feedback',name:'Second'},409,{Authorization:'Bearer '+made.workspaceKey,'Content-Type':'application/json'});
  pass('Signup with a board name returns a working Feedback board URL and admin key; the one-instance limit still refuses a second');
  const plain=await post('/api/signup',{email:'plain@example.invalid',website:''},201);
  assert.deepEqual(Object.keys(plain),['workspaceId','workspaceKey','mcpEndpoint','emailVerified','instanceLimit','notice']);
  assert.deepEqual(await(await fetch(origin+'/v1/instances',{headers:{Authorization:'Bearer '+plain.workspaceKey}})).json(),[]);
  await post('/api/signup',{email:'blank@example.invalid',website:'',name:'  '},400);
  await post('/api/signup',{email:'bot@example.invalid',website:'filled',name:'Bot'},202);
  await post('/api/signup',{email:'cross@example.invalid',website:'',name:'Cross'},403,{...site,Origin:'https://example.invalid'});
  pass('Without a name signup is unchanged; blank names, honeypots and cross-origin requests create nothing');
  for(const step of ['signup_submit','signup_board_open'])await post('/api/event',{step,source:'proof'},204);
  await post('/api/event',{step:'signup_other',source:'proof'},400);
  const stats=await(await fetch(origin+'/v1/stats?source=proof',{headers:{Authorization:'Bearer '+operator}})).json();
  assert.deepEqual(stats.visits.map((v:any)=>[v.path,v.views]).sort(),[['event:signup_board_open',1],['event:signup_submit',1]]);
  pass('signup_submit and signup_board_open add to the anonymous daily counts');
} catch(error) {console.error(logs.slice(-4000));throw error;}
finally {worker.kill();}
