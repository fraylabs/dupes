import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { z } from 'zod';
import { d1Storage } from '../../../dupes/feedback/src/d1-storage.ts';
import { createApp } from '../../../dupes/feedback/src/app.ts';
import { hash,id,now,equal } from '../../../dupes/feedback/src/auth.ts';
import type { Storage,Statement } from '../../../dupes/feedback/src/storage.ts';
import { tenantStorage,tenantTables,tenantStatement } from './tenant-storage.ts';
import { createFormsApp } from '../../../dupes/forms/src/app.ts';
import { deliverPending } from '../../../dupes/forms/src/webhooks.ts';
type Env={DB:Parameters<typeof d1Storage>[0];PLATFORM_API_KEYS:string;PUBLIC_ORIGIN?:string;SSO_SECRET?:string};
type Instance={id:string;owner_hash:string;app:string;name:string;created:string;requests:number};
const platform=new Hono<{Bindings:Env;Variables:{owner:string;db:Storage}}>();
platform.use('*',bodyLimit({maxSize:2*1024*1024}));
platform.use('*',async(c,next)=>{c.header('Cache-Control','no-store');c.set('db',d1Storage(c.env.DB));await next();});
platform.onError((e,c)=>c.json({error:e instanceof z.ZodError?'Invalid input':'Request could not be completed'},e instanceof z.ZodError?400:500));
platform.get('/health',async c=>{await c.get('db').get('SELECT 1');return c.json({ok:true,product:'dupes-platform'});});
platform.use('/v1/*',async(c,next)=>{
  const bearer=c.req.header('Authorization')?.match(/^Bearer (.+)$/)?.[1];
  if(!bearer)return c.json({error:'Platform API key required'},401);
  const digest=await hash(bearer);const configured=(c.env.PLATFORM_API_KEYS||'').split(',').map(v=>v.trim()).filter(v=>v.length>=32);
  if(!configured.length)return c.json({error:'Platform provisioning is not configured'},503);
  if(!(await Promise.all(configured.map(async key=>equal(digest,await hash(key))))).some(Boolean))return c.json({error:'Platform API key not recognised'},401);
  c.set('owner',digest);await next();
});
function location(instance:Instance,origin:string){const url=origin+'/i/'+instance.id;return {id:instance.id,app:instance.app,name:instance.name,created:instance.created,url,adminUrl:url+'/admin',mcpEndpoint:url+'/mcp'};}
async function usage(db:Storage,instance:Instance) {
  // Logical UTF-8 payload bytes, not allocated SQLite page size. Cheap exact
  // per-tenant content metering on management reads; shared page overhead excluded.
  const formsTables={credentials:'id,hash,kind,expires',forms:'id,title,draft,published,version,source_id,source_json,created,updated',versions:'form_id,version,definition',responses:'id,form_id,version,answers,hidden,variables,ending,created',webhooks:'id,form_id,url,secret,enabled,created',deliveries:'id,hook_id,response_id,payload,attempts,next_at,sent,last_status,lease_token,leased_until'};
  const tables=instance.app==='forms'?formsTables:tenantTables,prefix=instance.app==='forms'?'forms_':'hosted_';
  const terms=Object.entries(tables).map(([table,cols])=>`COALESCE((SELECT sum(${cols.split(',').map(col=>`COALESCE(length(CAST(${col} AS BLOB)),0)`).join('+')}) FROM ${prefix}${table} WHERE tenant_id=?),0)`);
  const row=await db.get('SELECT '+terms.join('+')+' bytes',Object.keys(tables).map(()=>instance.id));
  return {requests:instance.requests,storageBytes:Number(row?.bytes||0),storageMetric:'logical UTF-8 field bytes; shared indexes/page overhead excluded'};
}
platform.post('/v1/instances',async c=>{
  const input=z.object({app:z.enum(['feedback','forms']),name:z.string().trim().min(1).max(100)}).parse(await c.req.json());
  const instanceId=id(),adminApiKey=id()+id(),created=now();
  const instance:Instance={id:instanceId,owner_hash:c.get('owner'),app:input.app,name:input.name,created,requests:0};
  // Provision everything in one transaction. Only the returned key authenticates
  // this instance; API keys and browser sessions never cross tenant boundaries.
  const ops:Statement[]=[{text:'INSERT INTO instances(id,owner_hash,app,name,created) VALUES(?,?,?,?,?)',values:[instanceId,instance.owner_hash,input.app,input.name,created]}];
  if(input.app==='forms')ops.push({text:'INSERT INTO forms_credentials(tenant_id,id,hash,kind) VALUES(?,?,?,?)',values:[instanceId,id(),await hash(adminApiKey),'api']});
  else for(const q of [
    {text:'INSERT INTO credentials(id,name,hash,kind) VALUES(?,?,?,?)',values:[id(),'Provisioned admin',await hash(adminApiKey),'api']},
    // Hosted sign-in exchanges this key; no password is configured.
    {text:'INSERT INTO boards(id,name,description) VALUES(?,?,?)',values:['ideas','Feature requests','Share an idea or vote for something you love.']}
  ])ops.push(tenantStatement(instanceId,q));
  await c.get('db').batch(ops);
  return c.json({...location(instance,c.env.PUBLIC_ORIGIN||new URL(c.req.url).origin),adminApiKey,usage:{requests:0,storageBytes:(await usage(c.get('db'),instance)).storageBytes}},201);
});
platform.get('/v1/instances',async c=>{const rows=await c.get('db').all<Instance>('SELECT * FROM instances WHERE owner_hash=? ORDER BY created DESC LIMIT 200',[c.get('owner')]);return c.json(await Promise.all(rows.map(async instance=>({...location(instance,c.env.PUBLIC_ORIGIN||new URL(c.req.url).origin),usage:await usage(c.get('db'),instance)}))));});
platform.get('/v1/instances/:id',async c=>{const instance=await c.get('db').get<Instance>('SELECT * FROM instances WHERE id=? AND owner_hash=?',[c.req.param('id'),c.get('owner')]);if(!instance)return c.json({error:'Instance not found'},404);return c.json({...location(instance,c.env.PUBLIC_ORIGIN||new URL(c.req.url).origin),usage:await usage(c.get('db'),instance)});});
platform.delete('/v1/instances/:id',async c=>{
  const instance=await c.get('db').get<Instance>('SELECT * FROM instances WHERE id=? AND owner_hash=?',[c.req.param('id'),c.get('owner')]);if(!instance)return c.json({error:'Instance not found'},404);
  const order=instance.app==='forms'?['deliveries','webhooks','responses','versions','forms','credentials']:['notifications','credentials','changelog_posts','post_tags','comments','votes','posts','tags','changelog','users','boards','settings'];
  const prefix=instance.app==='forms'?'forms_':'hosted_';
  await c.get('db').batch([...order.map(table=>({text:`DELETE FROM ${prefix}${table} WHERE tenant_id=?`,values:[instance.id]})),{text:'DELETE FROM instances WHERE id=? AND owner_hash=?',values:[instance.id,c.get('owner')]}]);return c.json({deleted:true,id:instance.id});
});
platform.get('/i/:tenant',c=>c.redirect('/i/'+c.req.param('tenant')+'/'));
platform.all('/i/:tenant/*',async c=>{
  const db=c.get('db'),tenant=c.req.param('tenant');const instance=await db.get<Instance>('SELECT * FROM instances WHERE id=?',[tenant]);if(!instance)return c.json({error:'Instance not found'},404);
  await db.run('UPDATE instances SET requests=requests+1 WHERE id=?',[tenant]);
  const base='/i/'+tenant;const url=new URL(c.req.url);url.pathname=url.pathname.slice(base.length)||'/';
  if(instance.app==='forms'){
    const forms=createFormsApp(db,{tenant,basePath:base,siteName:instance.name,publicOrigin:c.env.PUBLIC_ORIGIN||url.origin,background:p=>c.executionCtx.waitUntil(p)});
    return forms.fetch(new Request(url,c.req.raw));
  }
  const scoped=tenantStorage(db,tenant);
  const app=createApp(scoped,{siteName:instance.name,publicOrigin:c.env.PUBLIC_ORIGIN||url.origin,ssoSecret:c.env.SSO_SECRET,basePath:base,sessionCookie:'feedback_'+tenant});
  const response=await app.fetch(new Request(url,c.req.raw));
  return response;
});
export default {fetch:platform.fetch,scheduled:async(_event:unknown,env:Env)=>sweepForms(env)};
export async function sweepForms(env:Pick<Env,'DB'>){const db=d1Storage(env.DB);const pending=await db.all('SELECT DISTINCT tenant_id FROM forms_deliveries WHERE sent=0 AND attempts<10 AND next_at<=? LIMIT 20',[Date.now()]);await Promise.all(pending.map(row=>deliverPending(db,row.tenant_id)));}
