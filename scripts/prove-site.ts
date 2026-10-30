import { spawn,spawnSync } from 'node:child_process';
import { mkdirSync,readFileSync,writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
const dir=resolve('proof/site');mkdirSync(dir,{recursive:true});
const config='sites/dupes.sh/wrangler.jsonc',state=resolve('proof/site-d1-'+randomUUID());
const origin='http://127.0.0.1:8791',env={...process.env,WRANGLER_SEND_METRICS:'false'};
const cli=(args:string[])=>spawnSync(process.execPath,['node_modules/wrangler/bin/wrangler.js',...args,'--config',config,'--persist-to',state],{env,encoding:'utf8',timeout:60000});
const migrate=cli(['d1','migrations','apply','dupes-site-local','--local']);assert.equal(migrate.status,0,'Local site D1 migration');
function query(sql:string){const run=cli(['d1','execute','dupes-site-local','--local','--command',sql,'--json']);assert.equal(run.status,0,'D1 readback');const parsed=JSON.parse(run.stdout);return parsed[0].results;}
const worker=spawn(process.execPath,['node_modules/wrangler/bin/wrangler.js','dev','--local','--config',config,'--ip','127.0.0.1','--port','8791','--persist-to',state],{env,stdio:['ignore','pipe','pipe']});
let logs='';worker.stdout.on('data',d=>logs+=d);worker.stderr.on('data',d=>logs+=d);
let browser:Awaited<ReturnType<typeof chromium.launch>>|undefined;
const results:string[]=[],shots:string[]=[];
const pass=(message:string)=>{results.push(message);console.log('PASS '+message);};
try {
  for(let i=0;i<200;i++){try{if((await fetch(origin+'/health')).ok)break;}catch{}if(i===199)throw Error('Site Wrangler readiness failed');await new Promise(r=>setTimeout(r,100));}
  async function request(path:string,method='GET',body?:unknown,expected=200,requestOrigin=origin){const r=await fetch(origin+path,{method,headers:{Origin:requestOrigin,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});assert.equal(r.status,expected,path+' HTTP status');return r;}
  const signup={email:'api-proof@example.invalid',consent:true,website:''};
  const saved=await(await request('/api/waitlist','POST',signup,202)).json();
  await request('/api/waitlist','POST',signup,202);assert.equal(query('SELECT count(*) n FROM site_waitlist')[0].n,1);
  assert.equal(query("SELECT count(*) n FROM site_waitlist WHERE consent_version='hosted-availability-v1' AND length(removal_hash)=64")[0].n,1);
  await request('/api/waitlist','POST',{...signup,email:'not-email'},400);await request('/api/waitlist','POST',{...signup,consent:false},400);await request('/api/waitlist','POST',{...signup,email:'other@example.invalid'},403,'https://example.invalid');
  await request('/api/waitlist','POST',{...signup,email:'bot@example.invalid',website:'honeypot'},202);assert.equal(query('SELECT count(*) n FROM site_waitlist')[0].n,1);
  await request('/api/waitlist','GET',undefined,405);await request('/api/waitlist','DELETE',{token:'bad'},400);
  await request('/api/waitlist','DELETE',{token:saved.removalToken});assert.equal(query('SELECT count(*) n FROM site_waitlist')[0].n,0);
  pass('Actual local D1 waitlist: write, deduplication, consent/hash readback, invalid input, cross-origin denial, honeypot and token deletion passed');
  const posts=await(await request('/i/next-dupe/api/posts')).json();assert.equal(posts.length,8);for(const name of ['Typeform','Calendly','Linktree','Statuspage','Mailchimp','Hotjar','Loom','DocSend'])assert.ok(posts.some((p:any)=>p.title===name&&p.votes===0));
  for(const path of ['/', '/catalogue','/vote','/waitlist','/docs','/privacy']){const r=await request(path);assert.ok(!r.headers.get('X-Robots-Tag')?.includes('noindex'));assert.ok((await r.text()).includes('<title>'));}
  for(const path of ['/reference/readme.txt','/reference/api.txt','/reference/agents.txt','/images/feedback.png','/images/roadmap.png','/video/dupes-feedback-demo-720p.webm','/video/dupes-feedback-demo-720p.mp4','/video/dupes-feedback-demo-poster.jpg'])await request(path);
  {const film='/video/dupes-feedback-demo-720p.mp4',full=await(await fetch(origin+film)).arrayBuffer(),size=full.byteLength;assert.equal((await fetch(origin+film)).headers.get('Accept-Ranges'),'bytes');
  for(const [range,start,end] of [['bytes=0-1',0,1],['bytes=-500',size-500,size-1],['bytes=1000-',1000,size-1]] as const){const r=await fetch(origin+film,{headers:{Range:range}});assert.equal(r.status,206,range);assert.equal(r.headers.get('Content-Range'),`bytes ${start}-${end}/${size}`,range);assert.ok(Buffer.from(await r.arrayBuffer()).equals(Buffer.from(full.slice(start,end+1))),range+' bytes');}
  const over=await fetch(origin+film,{headers:{Range:'bytes='+size+'-'}});assert.equal(over.status,416);assert.equal(over.headers.get('Content-Range'),'bytes */'+size);
  pass('Film byte ranges: 206 for first, suffix and open ranges with matching bytes, 416 past the end');}
  const boardHTML=await(await request('/i/next-dupe/')).text();assert.ok(boardHTML.includes("Dupes isn't affiliated with or endorsed by Typeform."));assert.ok((await(await request('/robots.txt')).text()).includes('Disallow: /'));await request('/missing-page',undefined,undefined,404);
  browser=await chromium.launch({headless:true,args:['--no-sandbox']});
  const desktop=await browser.newContext({viewport:{width:1440,height:1000}}),mobile=await browser.newContext({viewport:{width:390,height:844},isMobile:true,deviceScaleFactor:1});
  const pages=['home','signup','catalogue','vote','waitlist','docs','privacy'];const errors:string[]=[];
  for(const [kind,context] of [['desktop',desktop],['mobile',mobile]] as const) {
    const p=await context.newPage();p.on('pageerror',e=>errors.push(e.message));
    for(const name of pages){const path=name==='home'?'/':'/'+name;await p.goto(origin+path,{waitUntil:'networkidle'});if(name==='vote')await p.frameLocator('iframe').getByRole('button',{name:'Typeform',exact:true}).waitFor();assert.ok(await p.locator('h1').isVisible());const overflow=await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);assert.equal(overflow,false,kind+' '+name+' horizontal overflow');const file=kind+'-'+name+'.png';await p.screenshot({path:resolve(dir,file),fullPage:true});shots.push(file);}
    await p.close();
  }
  const p=await desktop.newPage();p.on('pageerror',e=>errors.push(e.message));await p.goto(origin+'/vote');await p.locator('iframe').scrollIntoViewIfNeeded();const board=p.frameLocator('iframe');await board.getByRole('button',{name:'Vote for Typeform',exact:true}).click();await board.getByLabel('Name',{exact:true}).fill('Site proof visitor');await board.getByRole('button',{name:'Continue',exact:true}).click();await board.getByRole('status').filter({hasText:'Your vote is counted'}).waitFor();assert.equal((await(await request('/i/next-dupe/api/posts/candidate-typeform')).json()).votes,1);
  await board.getByRole('button',{name:'Vote for Typeform',exact:true}).click();await board.getByRole('status').filter({hasText:'Your vote is counted'}).waitFor();assert.equal((await(await request('/i/next-dupe/api/posts/candidate-typeform')).json()).votes,1);
  pass('Real embedded Feedback workspace: eight candidates, browser identity, persistent vote and idempotent repeat passed');
  const mp=await mobile.newPage();mp.on('pageerror',e=>errors.push(e.message));await mp.goto(origin+'/vote');await mp.locator('iframe').scrollIntoViewIfNeeded();const mobileBoard=mp.frameLocator('iframe');await mobileBoard.getByRole('button',{name:'Vote for Calendly',exact:true}).click();await mobileBoard.getByLabel('Name',{exact:true}).fill('Mobile proof visitor');await mobileBoard.getByRole('button',{name:'Continue',exact:true}).click();await mobileBoard.getByRole('status').filter({hasText:'Your vote is counted'}).waitFor();assert.equal((await(await request('/i/next-dupe/api/posts/candidate-calendly')).json()).votes,1);await mp.close();pass('390px mobile embedded identity dialog and vote completed through visible controls');
  await p.goto(origin+'/waitlist');await p.getByLabel('Email address').fill('browser-proof@example.invalid');await p.getByLabel("I'd like hosted availability updates from Dupes.").check();await p.getByRole('button',{name:/Join the waitlist/}).click();await p.getByRole('status').filter({hasText:'Request received'}).waitFor();assert.equal(query('SELECT count(*) n FROM site_waitlist')[0].n,1);await p.getByRole('button',{name:'Remove my signup',exact:true}).click();await p.getByRole('status').filter({hasText:'Your signup has been removed'}).waitFor();assert.equal(query('SELECT count(*) n FROM site_waitlist')[0].n,0);assert.deepEqual(errors,[]);
  pass('Browser waitlist signup/removal reached D1; all six pages at desktop and 390px passed overflow and JavaScript checks');
  const human='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';
  const events=()=>Object.fromEntries(query("SELECT path,sum(views) n FROM site_daily_visits WHERE path LIKE 'event:%' GROUP BY path").map((r:any)=>[r.path,r.n]));
  await request('/api/event','POST',{step:'demo_play'},204);assert.deepEqual(events(),{},'Node/bot user agents are not counted');
  await request('/api/event','POST',{step:'visit'},400);await request('/api/event','POST',{step:'demo_play'},403,'https://example.invalid');await request('/api/event','GET',undefined,405);
  const filmErrors:string[]=[];const film=await browser.newContext({viewport:{width:1440,height:1000},userAgent:human}),fp=await film.newPage();fp.on('pageerror',e=>filmErrors.push(e.message));
  await fp.goto(origin+'/?utm_source=film-proof',{waitUntil:'domcontentloaded'});const video=fp.locator('#demo-film');const before=await video.boundingBox();
  assert.equal(await video.getAttribute('poster'),'/video/dupes-feedback-demo-poster.jpg');assert.ok(await video.evaluate((v:HTMLVideoElement)=>v.muted&&v.loop&&v.playsInline));
  await video.scrollIntoViewIfNeeded();await fp.waitForFunction(()=>{const v=document.querySelector('#demo-film') as HTMLVideoElement;return !v.paused&&v.readyState>=2;},undefined,{timeout:15000});
  const after=await video.boundingBox();assert.ok(before&&after&&Math.abs(before.height-after.height)<1&&Math.abs(before.width-after.width)<1,'Video box is fixed before metadata loads');assert.ok(Math.abs(after!.width/after!.height-16/9)<0.02,'16:9 video box');
  await fp.evaluate(()=>{const v=document.querySelector('#demo-film') as HTMLVideoElement;v.currentTime=12.2;});await fp.waitForFunction(()=>(document.querySelector('#demo-film') as HTMLVideoElement).currentTime>=12.2);
  await fp.evaluate(()=>{const v=document.querySelector('#demo-film') as HTMLVideoElement;v.currentTime=13;});await fp.waitForTimeout(1000);
  for(let i=0;i<50&&events()['event:demo_half']!==1;i++)await fp.waitForTimeout(200);
  assert.deepEqual(events(),{'event:demo_play':1,'event:demo_half':1},'Each step counted once per page load');
  assert.equal(query("SELECT count(*) n FROM site_daily_visits WHERE path LIKE 'event:%' AND source='film-proof'")[0].n,2,'Events keep the landing source');
  const caption=await fp.locator('.hero-caption').filter({hasText:'A visitor votes'}).textContent();assert.ok(caption?.includes('Recorded in the Dupes Feedback demo with fictional sample data.'));
  assert.ok((await fp.locator('.price-note').textContent())?.includes('$948/year'));await fp.close();await film.close();
  const calm=await browser.newContext({viewport:{width:390,height:844},isMobile:true,userAgent:human,reducedMotion:'reduce'}),cp=await calm.newPage();cp.on('pageerror',e=>filmErrors.push(e.message));
  await cp.goto(origin+'/',{waitUntil:'networkidle'});await cp.locator('#demo-film').scrollIntoViewIfNeeded();await cp.waitForTimeout(1500);assert.ok(await cp.locator('#demo-film').evaluate((v:HTMLVideoElement)=>v.paused),'Reduced motion: the film waits for the visitor');
  await cp.locator('#demo-film').screenshot({path:resolve(dir,'mobile-film-poster.png')});await cp.close();await calm.close();assert.deepEqual(filmErrors,[]);
  pass('Homepage film: same-origin assets, poster, muted in-view autoplay, fixed 16:9 box, reduced-motion pause, and demo_play/demo_half counted once each with the landing source; bot, cross-origin and unknown steps refused or uncounted');
  // Browser-rendered sheets accompany the twelve original full-page PNGs.
  for(const kind of ['desktop','mobile']) {const sheet=await desktop.newPage();const files=shots.filter(f=>f.startsWith(kind));await sheet.setContent('<html><body style="margin:0;background:#eee;font-family:sans-serif"><div style="display:grid;grid-template-columns:repeat(3,420px);gap:16px;padding:16px">'+files.map(f=>'<section><h2 style="font-size:16px">'+f+'</h2><img style="display:block;width:420px" src="data:image/png;base64,'+readFileSync(resolve(dir,f)).toString('base64')+'"></section>').join('')+'</div></body></html>');await sheet.setViewportSize({width:1320,height:1000});await sheet.screenshot({path:resolve('proof','site-'+kind+'-sheet.png'),fullPage:true});await sheet.close();}
  writeFileSync(resolve(dir,'result.json'),JSON.stringify({ok:true,results,screenshots:shots,communityProjects:9,publicDeployment:false},null,2));writeFileSync(resolve('proof','site-result.json'),JSON.stringify({ok:true,results,screenshots:shots},null,2));
} finally {writeFileSync(resolve('proof','site-wrangler.log'),logs,{mode:0o600});await browser?.close();if(worker.exitCode===null&&worker.signalCode===null){worker.kill('SIGTERM');await new Promise(r=>{worker.once('exit',r);setTimeout(()=>{worker.kill('SIGKILL');r(undefined);},3000);});}}
