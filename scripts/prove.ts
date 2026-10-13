// Real service proof. Disposable database, real CLI, HTTP, browser and official MCP client.
import { spawn,spawnSync } from 'node:child_process';
import { mkdirSync,readFileSync,writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomUUID,createHmac } from 'node:crypto';
import { createServer } from 'node:http';
import assert from 'node:assert/strict';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { chromium } from 'playwright';

const runId=randomUUID(),dir=resolve('proof',runId);mkdirSync(dir,{recursive:true});
const origin='http://127.0.0.1:3123',ssoSecret=randomUUID()+randomUUID();
const env={...process.env,DATA_DIR:dir,PORT:'3123',SSO_SECRET:ssoSecret};
const cli='packages/cli/bin/dupe.mjs';
const commands:string[]=[];
function execute(args:string[]){commands.push('dupe '+args.join(' '));const r=spawnSync(process.execPath,[cli,...args],{env,encoding:'utf8'});if(r.status!==0)throw Error(r.stderr||r.stdout);console.log(r.stdout.trim());}
execute(['list']);
const server=spawn(process.execPath,[cli,'up','feedback','--node'],{env,stdio:['ignore','pipe','pipe']});
const embedHost=createServer((_,res)=>{res.setHeader('Content-Type','text/html');res.end('<!doctype html><html><body><h1>Customer website</h1><script src="'+origin+'/widget.js" defer></script></body></html>');});
await new Promise<void>(r=>embedHost.listen(3124,'127.0.0.1',r));
let serverLogs='';server.stdout.on('data',d=>serverLogs+=d);server.stderr.on('data',d=>serverLogs+=d);
const results:string[]=[];let browser:Awaited<ReturnType<typeof chromium.launch>>|undefined;let mcp:Client|undefined;
try {
  for(let i=0;i<100;i++){try{const r=await fetch(origin+'/health');if(r.ok)break;}catch{}if(i===99)throw Error('Service did not start: '+serverLogs);await new Promise(r=>setTimeout(r,100));}
  const password=readFileSync(resolve(dir,'admin-password'),'utf8').trim();
  results.push('dupe up feedback --node: health ok, private bootstrap password file created');
  execute(['import','canny','--fixture','fixtures/canny.json','--node']);
  execute(['import','canny','--fixture','fixtures/canny.json','--node']);
  const jars:Record<string,string>={};
  async function request(path:string,method='GET',body?:any,identity='public',expected=200,extra:Record<string,string>={}) {
    const r=await fetch(origin+path,{method,headers:{Origin:origin,...(jars[identity]?{Cookie:jars[identity]}:{}),...(body?{'Content-Type':'application/json'}:{}),...extra},body:body?JSON.stringify(body):undefined});
    const set=r.headers.get('set-cookie');if(set)jars[identity]=set.split(';')[0];
    const data=await r.json();assert.equal(r.status,expected,path+' returned unexpected HTTP status');return data;
  }
  const publicBoards=await request('/api/boards');assert.equal(publicBoards.length,3);assert.ok(!publicBoards.some((b:any)=>b.private));
  const publicPosts=await request('/api/posts');assert.equal(publicPosts.length,7);assert.equal(publicPosts[0].votes,128);
  assert.equal(publicPosts.find((p:any)=>p.id==='canny:slack').votes,96);
  assert.equal((await request('/api/posts/canny:slack')).comments.length,1);
  await request('/api/posts/canny:private','GET',undefined,'public',404);
  assert.equal((await request('/api/changelog')).length,1);
  const roadmap=await request('/api/roadmap');assert.ok(!JSON.stringify(roadmap).includes('Internal planning'));
  assert.equal((await request('/api/posts?q=quieter')).length,2);
  assert.equal((await request('/api/posts?q=%')).length,0);
  results.push('Fixture rerun: 8 imported posts, 7 public; vote counts 128/96 intact; private board/comments and draft hidden; search works');
  await request('/api/admin/boards','POST',{name:'Forbidden'},'public',401);
  await request('/mcp','POST',{jsonrpc:'2.0',id:1,method:'tools/list'},'public',401);
  await request('/api/login','POST',{password:'wrong-password'},'admin',401);
  await request('/api/login','POST',{password},'admin');
  const key=await request('/api/admin/keys','POST',{name:'Proof agent'},'admin',201);
  await request('/api/admin/boards','POST',{name:'Bad origin'},'admin',403,{Origin:'https://example.test'});
  const unauthorized=await fetch(origin+'/api/admin/boards',{method:'POST',headers:{Cookie:jars.admin,'Content-Type':'application/json'},body:JSON.stringify({name:'Missing origin'})});assert.equal(unauthorized.status,403);
  const adminDetail=await request('/api/posts/canny:slack','GET',undefined,'admin');assert.equal(adminDetail.comments.length,2);assert.equal(adminDetail.comments[0].admin,1);
  results.push('Admin login, key issuance, anonymous write denial, MCP auth, origin checks, and private admin comment access verified');
  const anonymous=await request('/api/identify','POST',{name:'New Maya',email:'maya@example.test'},'voter');assert.notEqual(anonymous.id,'canny:maya');
  const p=await request('/api/posts','POST',{boardId:'canny:features',title:'Proof idea',details:'Created through the real REST API'},'voter',201);
  await request('/api/posts/'+p.id+'/vote','POST',{},'voter');await request('/api/posts/'+p.id+'/vote','POST',{},'voter');assert.equal((await request('/api/posts/'+p.id)).votes,1);
  await request('/api/posts/'+p.id+'/comments','POST',{body:'A real comment'},'voter',201);
  await request('/api/posts/'+p.id+'/vote','DELETE',undefined,'voter');assert.equal((await request('/api/posts/'+p.id)).votes,0);
  await request('/api/posts/'+p.id+'/vote','POST',{},'voter');
  const duplicate=await request('/api/posts','POST',{boardId:'canny:features',title:'Proof duplicate'},'voter',201);await request('/api/posts/'+duplicate.id+'/vote','POST',{},'voter');await request('/api/posts/'+duplicate.id+'/comments','POST',{body:'Move this comment'},'voter',201);
  await request('/api/admin/posts/'+duplicate.id+'/merge','POST',{targetId:p.id},'admin');const merged=await request('/api/posts/'+p.id);assert.equal(merged.votes,1);assert.equal(merged.comments.length,2);assert.equal((await request('/api/posts/'+duplicate.id)).mergedInto,p.id);
  const jwtHeader=Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url');const jwtBody=Buffer.from(JSON.stringify({aud:'feedback',sub:'maya',name:'Maya Chen',email:'maya@example.test',exp:Math.floor(Date.now()/1000)+300})).toString('base64url');const unsigned=jwtHeader+'.'+jwtBody;const token=unsigned+'.'+createHmac('sha256',ssoSecret).update(unsigned).digest('base64url');
  await request('/api/identify','POST',{token:token.slice(0,-5)+'abcde'},'sso',401);assert.equal((await request('/api/identify','POST',{token},'sso')).id,'canny:maya');
  results.push('REST posts/comments, idempotent vote/unvote, email impersonation prevention, signed SSO and deduplicated merge verified');
  mcp=new Client({name:'Feedback proof',version:'1.0.0'});
  await mcp.connect(new StreamableHTTPClientTransport(new URL(origin+'/mcp'),{requestInit:{headers:{Authorization:'Bearer '+key.token}}}));
  const tools=await mcp.listTools();assert.equal(tools.tools.length,5);
  for(const name of ['list_posts','search_posts','top_requests']){const response=await mcp.callTool({name,arguments:name==='search_posts'?{q:'Proof'}:{limit:5}});assert.ok(!response.isError,name);}
  assert.ok(!(await mcp.callTool({name:'update_status',arguments:{postId:p.id,status:'complete'}})).isError);
  assert.ok(!(await mcp.callTool({name:'post_changelog',arguments:{title:'Proof release',body:'Shipped and verified',postIds:[p.id]}})).isError);
  assert.equal((await request('/api/posts/'+p.id)).status,'complete');assert.equal((await request('/api/changelog')).length,2);
  const invalid=await mcp.callTool({name:'update_status',arguments:{postId:p.id,status:'invented'}});assert.equal(invalid.isError,true);
  results.push('Official MCP SDK connected; all five tools answered, status update and linked changelog persisted, invalid arguments rejected');
  for(const client of ['claude','codex','cursor'])execute(['mcp','feedback','--client',client]);
  browser=await chromium.launch({headless:true,args:['--no-sandbox']});const context=await browser.newContext({viewport:{width:1440,height:1080}});const page=await context.newPage();const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(origin);await page.locator('.post-card').first().waitFor();assert.ok(await page.getByRole('heading',{name:'Your ideas. Our next chapter.'}).isVisible());
  await page.screenshot({path:resolve('proof','feedback.png'),fullPage:true});
  await page.getByRole('button',{name:'Share an idea',exact:false}).click();await page.getByLabel('Name',{exact:true}).fill('Browser visitor');await page.getByRole('button',{name:'Continue',exact:true}).click();await page.getByLabel('Give it a clear title').fill('Browser idea');await page.getByLabel('What would you like to see?').fill('Verified through the actual UI');await page.getByRole('button',{name:'Share idea',exact:true}).click();await page.locator('.detail-title').filter({hasText:'Browser idea'}).waitFor();
  await page.getByRole('button',{name:'Close dialog'}).click();
  await page.goto(origin+'/roadmap');await page.locator('.road-card').first().waitFor();await page.screenshot({path:resolve('proof','roadmap.png'),fullPage:true});
  await page.goto(origin+'/changelog');await page.locator('.release').first().waitFor();await page.screenshot({path:resolve('proof','changelog.png'),fullPage:true});
  await page.goto(origin+'/admin');await page.getByLabel('Admin password').fill(password);await page.getByRole('button',{name:'Sign in',exact:true}).click();await page.getByRole('heading',{name:'Keep good ideas moving.'}).waitFor();await page.screenshot({path:resolve('proof','admin.png'),fullPage:true});
  await page.setViewportSize({width:390,height:844});await page.goto(origin);await page.locator('.post-card').first().waitFor();assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth));await page.screenshot({path:resolve('proof','mobile.png'),fullPage:true});
  // The embedded panel must render in another site's origin.
  await page.goto('http://127.0.0.1:3124');await page.getByRole('button',{name:'Share feedback',exact:true}).click();await page.frameLocator('iframe').locator('.post-card').first().waitFor();
  assert.deepEqual(errors,[]);results.push('Browser: idea submission, admin login, public pages, 390px layout and cross-origin widget rendered without JS errors; five screenshots saved');
  await request('/api/admin/keys/'+key.id,'DELETE',undefined,'admin');await request('/mcp','POST',{jsonrpc:'2.0',id:2,method:'tools/list'},'public',401,{Authorization:'Bearer '+key.token});
  results.push('Revoked API key rejected');
  writeFileSync(resolve('proof','result.json'),JSON.stringify({ok:true,commands,results},null,2));
  for(const r of results)console.log('PASS '+r);
}finally {embedHost.close();await browser?.close();await mcp?.close();server.kill('SIGTERM');await new Promise(r=>{server.once('exit',r);setTimeout(()=>{server.kill('SIGKILL');r(undefined);},3000).unref();});}
