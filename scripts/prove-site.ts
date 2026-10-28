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
  for(const path of ['/reference/readme.txt','/reference/api.txt','/reference/agents.txt','/images/feedback.png','/images/roadmap.png'])await request(path);
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
  // Browser-rendered sheets accompany the twelve original full-page PNGs.
  for(const kind of ['desktop','mobile']) {const sheet=await desktop.newPage();const files=shots.filter(f=>f.startsWith(kind));await sheet.setContent('<html><body style="margin:0;background:#eee;font-family:sans-serif"><div style="display:grid;grid-template-columns:repeat(3,420px);gap:16px;padding:16px">'+files.map(f=>'<section><h2 style="font-size:16px">'+f+'</h2><img style="display:block;width:420px" src="data:image/png;base64,'+readFileSync(resolve(dir,f)).toString('base64')+'"></section>').join('')+'</div></body></html>');await sheet.setViewportSize({width:1320,height:1000});await sheet.screenshot({path:resolve('proof','site-'+kind+'-sheet.png'),fullPage:true});await sheet.close();}
  writeFileSync(resolve(dir,'result.json'),JSON.stringify({ok:true,results,screenshots:shots,communityProjects:9,publicDeployment:false},null,2));writeFileSync(resolve('proof','site-result.json'),JSON.stringify({ok:true,results,screenshots:shots},null,2));
} finally {writeFileSync(resolve('proof','site-wrangler.log'),logs,{mode:0o600});await browser?.close();if(worker.exitCode===null&&worker.signalCode===null){worker.kill('SIGTERM');await new Promise(r=>{worker.once('exit',r);setTimeout(()=>{worker.kill('SIGKILL');r(undefined);},3000);});}}
