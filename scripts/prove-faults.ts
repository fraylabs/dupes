import { spawn,spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
// Faults end to end on a local site Worker and D1: a client app's error events in, grouped faults out
// over REST, both MCP endpoints and the page. Values are synthetic.
const config='sites/dupes.sh/wrangler.jsonc',proof=resolve('proof','faults-'+randomUUID()),state=resolve(proof,'d1');mkdirSync(proof,{recursive:true,mode:0o700});
const origin='http://127.0.0.1:8793',env={...process.env,WRANGLER_SEND_METRICS:'false'},operator='synthetic-proof-platform-key-'+'1'.repeat(16);
const migrate=spawnSync(process.execPath,['node_modules/wrangler/bin/wrangler.js','d1','migrations','apply','dupes-site-local','--local','--config',config,'--persist-to',state],{env,encoding:'utf8',timeout:60000});assert.equal(migrate.status,0,'Local site D1 migration');
const worker=spawn(process.execPath,['node_modules/wrangler/bin/wrangler.js','dev','--local','--config',config,'--ip','127.0.0.1','--port','8793','--persist-to',state,'--var','ABUSE_SECRET:synthetic-proof-abuse-secret-'+'1'.repeat(16),'--var','PLATFORM_API_KEYS:'+operator,'--var','PUBLIC_ORIGIN:'+origin],{env,stdio:['ignore','pipe','pipe']});
let logs='';worker.stdout.on('data',d=>logs+=d);worker.stderr.on('data',d=>logs+=d);
const pass=(message:string)=>console.log('PASS '+message);
const json={'Content-Type':'application/json'},platformKey={Authorization:'Bearer '+operator,...json};
async function call(method:string,url:string,expected:number,headers:Record<string,string>={},body?:unknown){const r=await fetch(url,{method,headers,body:body===undefined?undefined:typeof body==='string'?body:JSON.stringify(body)});assert.equal(r.status,expected,method+' '+new URL(url).pathname+' HTTP status');return {headers:r.headers,body:r.status===204?undefined:await r.json() as any};}
const hex=()=>randomUUID().replaceAll('-','');
// The shape a small client reporter sends: one exception with a stack, a release and a few tags.
const thrown=(type:string,value:string,frames:[string,number][],release='example-app@1.0.0')=>({event_id:hex(),timestamp:Date.now()/1000,platform:'javascript',level:'error',release,tags:{app:'example-app',where:'sign-in',os:'ios',os_version:'19.1'},exception:{values:[{type,value,stacktrace:{frames:frames.map(([name,lineno])=>({filename:'index.bundle',function:name,lineno,colno:7}))}}]}});
let browser:Awaited<ReturnType<typeof chromium.launch>>|undefined;
try {
  for(let i=0;i<300;i++){try{if((await fetch(origin+'/health')).ok)break;}catch{}if(i===299)throw Error('Site Wrangler readiness failed');await new Promise(r=>setTimeout(r,100));}
  const made=(await call('POST',origin+'/v1/instances',201,platformKey,{app:'faults',name:'Acme faults'})).body;
  assert.ok(made.adminApiKey&&made.url===origin+'/i/'+made.id&&made.mcpEndpoint===made.url+'/mcp');
  const admin={Authorization:'Bearer '+made.adminApiKey,...json};
  await call('GET',made.url+'/api/projects',401);await call('GET',made.url+'/api/faults',401);await call('POST',made.url+'/mcp',401,json,{jsonrpc:'2.0',id:1,method:'tools/list'});
  assert.deepEqual((await call('GET',made.url+'/api/projects',200,admin)).body,[]);
  const project=(await call('POST',made.url+'/api/projects',201,admin,{name:'Example app'})).body,dsn=new URL(project.dsn);
  assert.ok(/^[a-f0-9]{32}$/.test(dsn.username)&&!dsn.password&&dsn.host===new URL(origin).host&&dsn.pathname==='/'+project.id&&!dsn.search,'DSN is scheme://key@host/number');
  await call('POST',made.url+'/api/projects',400,admin,{name:'Example app'});await call('POST',made.url+'/api/projects',400,admin,{name:'<b>'});
  pass('A platform key creates a Faults workspace; its admin key creates a project and gets a standard DSN; nothing is readable without the key');

  const store=origin+'/api/'+project.id+'/store/?sentry_key='+dsn.username,first=thrown('TypeError','undefined is not a function',[['run',10],['signIn',120]]);
  assert.deepEqual((await call('POST',store,200,json,first)).body,{id:first.event_id});
  await call('POST',store,200,json,thrown('TypeError','undefined is not a function',[['run',14],['signIn',131]],'example-app@1.0.1'));
  await call('POST',origin+'/api/'+project.id+'/store',200,{'Content-Type':'text/plain','X-Sentry-Auth':'Sentry sentry_version=7, sentry_key='+dsn.username},thrown('RangeError','Maximum call stack size exceeded',[['run',10],['draw',55]]));
  for(const wait of [300,450])await call('POST',store,200,json,{event_id:hex(),timestamp:Date.now()/1000,level:'warning',message:'Timed out after '+wait+' ms',release:'example-app@1.0.1'});
  let list=(await call('GET',made.url+'/api/faults',200,admin)).body;
  assert.deepEqual(list.map((f:any)=>[f.type,f.count,f.project_name]).sort(),[['Message',2,'Example app'],['RangeError',1,'Example app'],['TypeError',2,'Example app']]);
  const typeError=list.find((f:any)=>f.type==='TypeError');
  assert.deepEqual([typeError.first_release,typeError.last_release,typeError.location,typeError.status],['example-app@1.0.0','example-app@1.0.1','sign-in','open']);
  const read=(await call('GET',made.url+'/api/faults/'+typeError.id,200,admin)).body;
  assert.deepEqual(read.sample.frames.map((f:any)=>[f.function,f.lineno]),[['run',14],['signIn',131]]);assert.deepEqual(read.sample.tags,first.tags);
  pass('Events arrive at the store address by query key or auth header; repeats of one fault share a line and a count across releases and line numbers; the latest sample is kept');

  const preflight=await fetch(store,{method:'OPTIONS'});assert.equal(preflight.status,204);assert.equal(preflight.headers.get('Access-Control-Allow-Origin'),'*');
  await call('POST',origin+'/api/'+project.id+'/store/?sentry_key='+'0'.repeat(32),401,json,first);await call('POST',origin+'/api/999999/store/?sentry_key='+dsn.username,401,json,first);await call('POST',origin+'/api/'+project.id+'/store/',401,json,first);
  await call('POST',store,400,json,{});await call('POST',store,400,json,'{not json');
  await call('POST',store,413,json,{...first,extra:'x'.repeat(210*1024)});
  await call('POST',store,200,json,{...first,event_id:'<script>',release:'r'.repeat(5000),tags:{where:'w'.repeat(5000),'<img>':1},extra:{secret:'not kept'},user:{email:'not-kept@example.invalid'}});
  const clipped=(await call('GET',made.url+'/api/faults/'+typeError.id,200,admin)).body;
  assert.ok(/^[a-f0-9]{32}$/.test(clipped.sample.event_id)&&clipped.last_release.length===120&&clipped.location.length===200&&!JSON.stringify(clipped).includes('not kept')&&!JSON.stringify(clipped).includes('not-kept'));
  pass('Wrong or missing keys get 401, empty or broken events 400, oversize 413; fields outside the kept set are dropped and long ones cut');

  assert.equal((await call('POST',made.url+'/api/faults/'+typeError.id+'/resolve',200,admin,{})).body.status,'resolved');
  assert.equal((await call('GET',made.url+'/api/faults',200,admin)).body.length,2);assert.equal((await call('GET',made.url+'/api/faults?status=resolved',200,admin)).body.length,1);
  await call('POST',store,200,json,thrown('TypeError','undefined is not a function',[['run',10],['signIn',120]],'example-app@1.0.2'));
  const back=(await call('GET',made.url+'/api/faults/'+typeError.id,200,admin)).body;assert.deepEqual([back.status,back.count,back.last_release],['open',4,'example-app@1.0.2']);
  await call('POST',made.url+'/api/faults/missing/resolve',404,admin,{});await call('GET',made.url+'/api/faults?status=other',400,admin);
  pass('A fault can be resolved, and reopens by itself when it is reported again');

  const rpc=async(url:string,headers:Record<string,string>,name:string,args:unknown={})=>{const r=(await call('POST',url,200,headers,{jsonrpc:'2.0',id:1,method:'tools/call',params:{name,arguments:args}})).body.result;return {isError:!!r.isError,value:r.isError?r.content[0].text:JSON.parse(r.content[0].text)};};
  const tools=(await call('POST',made.url+'/mcp',200,admin,{jsonrpc:'2.0',id:1,method:'tools/list'})).body.result.tools.map((t:any)=>t.name);
  assert.deepEqual(tools,['list_projects','create_project','list_faults','get_fault','resolve_fault','reopen_fault']);
  assert.equal((await rpc(made.url+'/mcp',admin,'list_faults',{status:'all'})).value.length,3);
  assert.equal((await rpc(made.url+'/mcp',admin,'get_fault',{id:typeError.id})).value.sample.type,'TypeError');
  const second=(await rpc(origin+'/v1/mcp',platformKey,'faults_create_project',{instanceId:made.id,name:'Flood'})).value;
  assert.equal((await rpc(origin+'/v1/mcp',platformKey,'faults_list_projects',{instanceId:made.id})).value.length,2);
  assert.equal((await rpc(origin+'/v1/mcp',platformKey,'faults_resolve_fault',{instanceId:made.id,id:typeError.id})).value.status,'resolved');
  assert.equal((await rpc(origin+'/v1/mcp',platformKey,'faults_reopen_fault',{instanceId:made.id,id:typeError.id})).value.status,'open');
  pass('Agents list, read, resolve and reopen faults over the instance MCP endpoint and the workspace one');

  const other=(await call('POST',origin+'/api/signup',201,{Origin:origin,...json,'CF-Connecting-IP':'198.51.100.9','User-Agent':'Mozilla/5.0 (Macintosh) Proof'},{email:'other@example.invalid',website:'',name:'Other board'})).body;
  await call('GET',made.url+'/api/faults',401,{Authorization:'Bearer '+other.adminApiKey});
  assert.equal((await rpc(origin+'/v1/mcp',{Authorization:'Bearer '+other.workspaceKey,...json},'faults_list_faults',{instanceId:made.id})).isError,true);
  assert.equal((await rpc(origin+'/v1/mcp',{Authorization:'Bearer '+other.workspaceKey,...json},'faults_list_faults',{instanceId:other.instanceId})).isError,true);
  pass('Another workspace cannot read these faults with its admin key or its workspace key');

  browser=await chromium.launch({headless:true,args:['--no-sandbox']});const errors:string[]=[];
  const page=await browser.newPage({viewport:{width:1280,height:900}});page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  const opened=await page.goto(made.url+'/');assert.ok(opened?.headers()['content-security-policy']?.includes("script-src 'self'"));assert.ok(!(await page.content()).includes('dupes-powered-by'));
  await page.getByLabel('Admin API key').fill(made.adminApiKey);await page.getByRole('button',{name:'Sign in',exact:true}).click();
  await page.locator('.fault').first().waitFor();assert.equal(await page.locator('.fault').count(),3);
  await page.locator('.fault',{hasText:'TypeError'}).locator('.fault-head').click();await page.locator('.stack').waitFor();
  assert.ok((await page.locator('.stack').innerText()).includes('at signIn (index.bundle:120:7)'));
  await page.screenshot({path:resolve(proof,'faults-desktop.png'),fullPage:true});
  await page.setViewportSize({width:390,height:844});await page.screenshot({path:resolve(proof,'faults-phone.png'),fullPage:true});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),'No sideways scroll at phone width');
  await page.getByRole('button',{name:'Mark resolved'}).click();await page.waitForFunction(()=>document.querySelectorAll('.fault').length===2);
  await page.getByRole('button',{name:'Resolved',exact:true}).click();await page.waitForFunction(()=>document.querySelectorAll('.fault').length===1&&!!document.querySelector('.fault.resolved'));
  await page.getByRole('button',{name:'Sign out'}).click();await page.getByLabel('Admin API key').waitFor();await page.screenshot({path:resolve(proof,'faults-sign-in.png')});
  assert.deepEqual(errors.filter(e=>!e.includes('401')),[]);
  pass('The page signs in with the admin key, lists faults, opens one with its stack, resolves it and signs out, with no script or policy errors');

  const flood=new URL(second.dsn),statuses:number[]=[];let retry='';
  for(let i=0;i<130;i++){const r=await fetch(origin+'/api/'+second.id+'/store/?sentry_key='+flood.username,{method:'POST',headers:json,body:JSON.stringify(thrown('Error','flood',[['loop',1]]))});statuses.push(r.status);if(r.status===429)retry=r.headers.get('Retry-After')||'';await r.body?.cancel();}
  assert.ok(statuses.includes(200)&&statuses.includes(429)&&statuses.every(s=>s===200||s===429)&&Number(retry)>0,'Per-project minute limit');
  const flooded=(await call('GET',made.url+'/api/faults?project='+second.id,200,admin)).body;assert.equal(flooded.length,1);assert.equal(flooded[0].count,statuses.filter(s=>s===200).length);
  pass('One project is held to its events-per-minute limit; refused events are not counted');

  const usage=(await call('GET',origin+'/v1/instances/'+made.id,200,platformKey)).body.usage;assert.ok(usage.storageBytes>0&&usage.requests>0);
  await call('DELETE',origin+'/v1/instances/'+made.id,200,platformKey);
  await call('POST',store,401,json,first);await call('GET',made.url+'/api/session',404);assert.deepEqual((await call('GET',origin+'/v1/instances',200,platformKey)).body,[]);
  pass('Usage is metered; deleting the workspace removes its projects, faults and keys');
  console.log('Pictures in '+proof);
} catch(error) {console.error(logs.slice(-4000));throw error;}
finally {await browser?.close();worker.kill();}
