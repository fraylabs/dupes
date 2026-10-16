import { spawn,spawnSync } from 'node:child_process';
import { mkdirSync,readFileSync,writeFileSync,readdirSync,statSync,unlinkSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { chromium } from 'playwright';
import { openStorage } from '../dupes/feedback/src/node-storage.ts';
import { tenantStorage } from '../packages/platform/src/tenant-storage.ts';
import { importCanny } from '../dupes/feedback/src/importer.ts';
import { Feedback } from '../dupes/feedback/src/service.ts';
import Database from 'better-sqlite3';

const proof=resolve('proof','hosted-'+randomUUID());mkdirSync(proof,{recursive:true,mode:0o700});
const origin='http://127.0.0.1:8787',keyA=randomUUID()+randomUUID(),keyB=randomUUID()+randomUUID();
const vars=resolve('packages/platform/.dev.vars');writeFileSync(vars,'PLATFORM_API_KEYS="'+keyA+','+keyB+'"\n',{mode:0o600});
const config='packages/platform/wrangler.jsonc';const state=resolve(proof,'wrangler-state');
const env={...process.env,WRANGLER_SEND_METRICS:'false'};
const results:string[]=[];
// Exercise every core query against real composite-key tenant tables, including
// the import and merge paths, before starting the actual workerd/D1 service.
const sqlitePath=resolve(proof,'tenant-sql.sqlite');
const raw=new Database(sqlitePath);raw.pragma('foreign_keys = ON');raw.exec(readFileSync('packages/platform/migrations/0001_platform.sql','utf8'));raw.close();
const db=openStorage(sqlitePath);
await db.run('INSERT INTO instances(id,owner_hash,app,name,created) VALUES(?,?,?,?,?)',['a','proof','feedback','A',new Date().toISOString()]);
await db.run('INSERT INTO instances(id,owner_hash,app,name,created) VALUES(?,?,?,?,?)',['b','proof','feedback','B',new Date().toISOString()]);
const a=tenantStorage(db,'a'),b=tenantStorage(db,'b');
const fixture=JSON.parse(readFileSync('fixtures/canny.json','utf8'));
await importCanny(a,fixture);await importCanny(b,fixture);
const serviceA=new Feedback(a),serviceB=new Feedback(b);
assert.equal((await serviceA.posts())[0].votes,128);assert.equal((await serviceB.posts())[0].votes,128);
await serviceA.updateStatus('canny:dark','complete');assert.equal((await serviceB.post('canny:dark'))?.status,'planned');
await serviceA.merge('canny:duplicate','canny:dark');assert.equal((await serviceA.post('canny:dark'))?.votes,128);assert.equal((await serviceB.post('canny:duplicate'))?.merged_into,null);
await a.run('UPDATE users SET name=? WHERE id=?',['Tenant A','canny:maya']);assert.equal((await b.get('SELECT name FROM users WHERE id=?',['canny:maya']))?.name,'Maya Chen');
await a.run('DELETE FROM comments WHERE id=?',['canny:reply-slack']);assert.ok(await b.get('SELECT 1 FROM comments WHERE id=?',['canny:reply-slack']));
await serviceA.createEntry({title:'Tenant A only',body:'Scoped outbox',postIds:['canny:dark']});assert.equal((await serviceB.entries()).length,1);
results.push('Composite-key storage: same imported IDs in two tenants; Canny counts, status, merge, user update, comment delete and changelog isolation verified');

const migration=spawnSync(process.execPath,['node_modules/wrangler/bin/wrangler.js','d1','migrations','apply','dupes-platform-local','--local','--config',config,'--persist-to',state],{env,encoding:'utf8'});
if(migration.status!==0){unlinkSync(vars);throw Error('Local D1 migration failed: '+migration.status);}
const worker=spawn(process.execPath,['node_modules/wrangler/bin/wrangler.js','dev','--local','--config',config,'--ip','127.0.0.1','--port','8787','--persist-to',state],{env,stdio:['ignore','pipe','pipe']});
let logs='';worker.stdout.on('data',d=>logs+=d);worker.stderr.on('data',d=>logs+=d);
let browser:Awaited<ReturnType<typeof chromium.launch>>|undefined,mcp:Client|undefined;
try {
  for(let i=0;i<200;i++){try{if((await fetch(origin+'/health')).ok)break;}catch{}if(i===199)throw Error('Wrangler did not become ready; private log retained');await new Promise(r=>setTimeout(r,100));}
  async function request(path:string,method='GET',body?:any,key=keyA,expected=200){const r=await fetch(origin+path,{method,headers:{Authorization:'Bearer '+key,Origin:origin,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});assert.equal(r.status,expected,path+' HTTP status');return r.json();}
  await request('/v1/instances','POST',{app:'feedback',name:'No auth'},'bad',401);
  const first=await request('/v1/instances','POST',{app:'feedback',name:'Alpha workspace'},keyA,201);
  const second=await request('/v1/instances','POST',{app:'feedback',name:'Beta workspace'},keyA,201);
  const third=await request('/v1/instances','POST',{app:'feedback',name:'Other account'},keyB,201);
  assert.ok(first.adminApiKey&&first.url&&first.mcpEndpoint);
  assert.equal((await request('/v1/instances')).length,2);assert.equal((await request('/v1/instances','GET',undefined,keyB)).length,1);
  await request('/v1/instances/'+first.id,'GET',undefined,keyB,404);await request('/v1/instances/'+first.id,'DELETE',undefined,keyB,404);
  const p1='/i/'+first.id,p2='/i/'+second.id;
  const initial=await request(p1+'/api/posts','POST',{boardId:'ideas',title:'Alpha idea',details:'Tenant A content'},first.adminApiKey,201);
  await request(p2+'/api/posts/'+initial.id,'GET',undefined,second.adminApiKey,404);
  await request(p2+'/api/admin/posts/'+initial.id,'PATCH',{title:'Cross-tenant edit'},second.adminApiKey,404);
  await request(p2+'/api/admin/boards','POST',{name:'Cross-tenant key'},first.adminApiKey,401);
  const board=await request(p1+'/api/admin/boards','POST',{name:'Private A',private:true},first.adminApiKey,201);
  await request(p1+'/api/posts','POST',{boardId:board.id,title:'Private alpha'},first.adminApiKey,201);
  assert.equal((await request(p1+'/api/boards','GET',undefined,'')).length,1);
  await request(p1+'/api/admin/posts/'+initial.id,'PATCH',{status:'planned'},first.adminApiKey);
  assert.equal((await request(p1+'/api/roadmap','GET',undefined,'')).planned.length,1);
  await request(p1+'/api/admin/changelog','POST',{title:'Alpha shipped',body:'Scoped change',postIds:[initial.id]},first.adminApiKey,201);
  assert.equal((await request(p2+'/api/changelog','GET',undefined,'')).length,0);
  const meter=await request('/v1/instances/'+first.id);assert.ok(meter.usage.requests>=7);assert.ok(meter.usage.storageBytes>0);
  mcp=new Client({name:'Hosted proof',version:'1.0.0'});await mcp.connect(new StreamableHTTPClientTransport(new URL(first.mcpEndpoint),{requestInit:{headers:{Authorization:'Bearer '+first.adminApiKey}}}));assert.equal((await mcp.listTools()).tools.length,5);assert.ok(!(await mcp.callTool({name:'top_requests',arguments:{limit:5}})).isError);
  results.push('Wrangler local D1: authenticated provision/GET/list, owner isolation, API-key/read/write/private-board/changelog isolation, request/storage usage, MCP answered');
  const cli=spawnSync(process.execPath,['packages/cli/bin/dupe.mjs','up','feedback','--hosted','--name','CLI hosted workspace'],{env:{...env,DUPES_PLATFORM_URL:origin,DUPES_PLATFORM_API_KEY:keyA,DATA_DIR:proof},encoding:'utf8'});assert.equal(cli.status,0);assert.ok(!cli.stdout.includes(keyA));const file=readdirSync(proof).find(f=>f.startsWith('hosted-')&&f.endsWith('.json'));assert.ok(file);assert.equal(statSync(resolve(proof,file)).mode&0o777,0o600);const saved=JSON.parse(readFileSync(resolve(proof,file),'utf8'));assert.ok(!cli.stdout.includes(saved.adminApiKey));assert.ok((await fetch(saved.url+'/health')).ok);results.push('dupe up feedback --hosted provisioned a live local instance, saved key0600 and kept credentials out of stdout');
  browser=await chromium.launch({headless:true,args:['--no-sandbox']});const page=await browser.newPage({viewport:{width:1440,height:1000}});const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(first.url);await page.locator('.post-card').first().waitFor();await page.getByRole('link',{name:/Roadmap/}).click();await page.locator('.road-card').first().waitFor();assert.ok(page.url().includes(p1+'/roadmap'));
  await page.goto(first.adminUrl);await page.getByLabel('Admin API key').fill(first.adminApiKey);await page.getByRole('button',{name:'Sign in',exact:true}).click();await page.getByRole('heading',{name:'Keep good ideas moving.'}).waitFor();await page.screenshot({path:resolve('proof','hosted-admin.png'),fullPage:true});
  await page.goto(second.adminUrl);await page.getByLabel('Admin API key').waitFor();assert.ok(await page.getByLabel('Admin API key').isVisible());assert.deepEqual(errors,[]);results.push('Hosted browser URLs/assets/navigation and key login work; admin session remains isolated from another instance');
  await mcp.close();mcp=undefined;
  await request('/v1/instances/'+first.id,'DELETE');await request('/i/'+first.id+'/health','GET',undefined,'',404);assert.ok((await request(p2+'/health','GET',undefined,'')).ok);await request('/v1/instances/'+third.id,'DELETE',undefined,keyB);results.push('Deletion removed tenant content/credentials and routes; another tenant stayed healthy');
  writeFileSync(resolve('proof','hosted-result.json'),JSON.stringify({ok:true,results},null,2));for(const result of results)console.log('PASS '+result);
}finally {await browser?.close();await mcp?.close();worker.kill('SIGTERM');await new Promise(r=>{worker.once('exit',r);setTimeout(()=>{worker.kill('SIGKILL');r(undefined);},3000).unref();});if(logs)writeFileSync(resolve(proof,'wrangler-private.log'),logs,{mode:0o600});unlinkSync(vars);}
