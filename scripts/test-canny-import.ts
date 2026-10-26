// Stepped (hosted) Canny import must match the one-shot CLI import, using the
// synthetic fixture behind a fake paginated Canny API. No real Canny data.
import { readFileSync,mkdtempSync,rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import { openStorage } from '../dupes/feedback/src/node-storage.ts';
import { tenantStorage } from '../packages/platform/src/tenant-storage.ts';
import { importCanny } from '../dupes/feedback/src/importer.ts';
import { cannyStep,cannyProgress } from '../dupes/feedback/src/canny-import.ts';
import { createApp } from '../dupes/feedback/src/app.ts';
import { hash } from '../dupes/feedback/src/auth.ts';

const fixture=JSON.parse(readFileSync('fixtures/canny.json','utf8'));
const dir=mkdtempSync(join(tmpdir(),'canny-import-'));
const file=join(dir,'db.sqlite'),raw=new Database(file);raw.pragma('foreign_keys = ON');
for(const m of ['0001_platform.sql'])raw.exec(readFileSync('sites/dupes.sh/migrations/'+m,'utf8'));raw.close();
const db=openStorage(file);
for(const t of ['cli','hosted','http'])await db.run('INSERT INTO instances(id,owner_hash,app,name,created) VALUES(?,?,?,?,?)',[t,'test','feedback',t,new Date().toISOString()]);

// Fake Canny: pages of two items so every pagination mode is exercised.
const seenKeys=new Set<string>();let calls=0,rateLimitOnce=true;
const canny:typeof fetch=async(url,init)=>{
  calls++;const endpoint=String(url).replace('https://canny.io/api/',''),body=JSON.parse(String(init!.body));seenKeys.add(body.apiKey);
  if(body.apiKey!=='good-key')return new Response(JSON.stringify({error:'invalid api key'}),{status:401});
  if(endpoint==='v2/votes/list'&&rateLimitOnce){rateLimitOnce=false;return new Response('{}',{status:429,headers:{'retry-after':'3'}});}
  const map:Record<string,[string,string,string]>={'v1/boards/list':['boards','boards','all'],'v1/categories/list':['categories','categories','skip'],'v1/tags/list':['tags','tags','skip'],'v2/users/list':['users','users','cursor'],'v1/posts/list':['posts','posts','skip'],'v2/votes/list':['votes','items','cursor'],'v2/comments/list':['comments','items','cursor'],'v1/entries/list':['entries','entries','skip']};
  const [key,property,mode]=map[endpoint];let items=fixture[key] as any[];
  if(body.boardID)items=items.filter(i=>(i.board?.id||i.boardID)===body.boardID);
  if(mode==='all')return Response.json({[property]:items});
  const start=mode==='skip'?body.skip||0:Number(body.cursor||0),page=items.slice(start,start+2),more=start+2<items.length;
  return Response.json(mode==='skip'?{[property]:page,hasMore:more}:{[property]:page,hasNextPage:more,cursor:more?String(start+2):null});
};

const cli=tenantStorage(db,'cli'),hosted=tenantStorage(db,'hosted');
await importCanny(cli,fixture);
let steps=0,done=false,rateLimited=0;
while(!done){try{done=(await cannyStep(hosted,'good-key',{fetcher:canny})).done;}catch(e:any){if(e.status===429){rateLimited++;continue;}throw e;}if(++steps>200)throw Error('Import did not finish');}
assert.equal(rateLimited,1,'429 surfaces as a retryable step');

const dump=async(s:any)=>{const out:any={};for(const [t,order] of Object.entries({boards:'id',users:'id',tags:'id',posts:'id',post_tags:'post_id,tag_id',votes:'post_id,user_id',comments:'id',changelog:'id',changelog_posts:'entry_id,post_id'}))out[t]=(await s.all('SELECT * FROM '+t+' ORDER BY '+order)).map((r:any)=>{if(t==='votes')delete r.created;return r;});return out;};// fixture votes carry no timestamp
const a=await dump(cli),b=await dump(hosted);
for(const t of Object.keys(a))assert.deepEqual(b[t],a[t],t+' differs between stepped and one-shot import');
assert.equal((await hosted.get('SELECT email FROM users WHERE id=?',['canny:maya']))?.email,'maya@example.test','partial voter objects keep known emails');
const progress=await cannyProgress(hosted);assert.equal(progress?.phase,'done');assert.deepEqual(progress?.counts,{boards:3,users:3,posts:8,votes:6,comments:2,changelog:2});
assert.ok(!JSON.stringify(await hosted.all('SELECT value FROM settings')).includes('good-key'),'API key never stored');
await assert.rejects(cannyStep(hosted,'good-key',{fetcher:canny}),(e:any)=>e.status===409,'second run refused without restart');
await cannyStep(hosted,'good-key',{fetcher:canny,restart:true});
while(!(await cannyStep(hosted,'good-key',{fetcher:canny})).done);
assert.deepEqual(await dump(hosted),a,'re-import is idempotent');
assert.equal((await db.get("SELECT count(*) n FROM hosted_posts WHERE tenant_id='cli'"))?.n,8,'tenants stay isolated');

// HTTP route: admin only, bad key reported, key not echoed.
const adminKey='admin-key-'+'x'.repeat(32);
await tenantStorage(db,'http').run('INSERT INTO credentials(id,name,hash,kind) VALUES(?,?,?,?)',['k','test',await hash(adminKey),'api']);
const app=createApp(tenantStorage(db,'http'),{basePath:'/i/http',cannyFetch:canny});
const post=(body:any,auth=true)=>app.fetch(new Request('http://x/api/admin/import/canny',{method:'POST',headers:{'Content-Type':'application/json',...(auth?{Authorization:'Bearer '+adminKey}:{})},body:JSON.stringify(body)}));
assert.equal((await post({apiKey:'good-key'},false)).status,401);
const bad=await post({apiKey:'wrong-key-123'});assert.equal(bad.status,422);assert.ok(!(await bad.text()).includes('wrong-key-123'));
assert.equal((await post({})).status,400);
let r;do{r=await post({apiKey:'good-key'});}while(r.status===200&&!(await r.clone().json()).done);
assert.equal(r.status,200);
assert.equal((await tenantStorage(db,'http').get('SELECT count(*) n FROM posts'))?.n,8);
assert.equal((await createApp(tenantStorage(db,'http'),{demo:true}).fetch(new Request('http://x/api/admin/import/canny',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+adminKey},body:'{"apiKey":"good-key"}'}))).status,403);
rmSync(dir,{recursive:true,force:true});
console.log('Canny stepped import OK:',steps,'steps,',calls,'fake Canny calls');
