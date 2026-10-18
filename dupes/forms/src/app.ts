import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { secureHeaders } from 'hono/secure-headers';
import { getCookie,setCookie,deleteCookie } from 'hono/cookie';
import { z } from 'zod';
import type { Storage } from '../../feedback/src/storage.ts';
import { id,hash,now } from '../../feedback/src/auth.ts';
import { Forms } from './service.ts';
import { walk } from './definition.ts';
import { importTypeform } from './importer.ts';
import { deliverPending,type Delivery } from './webhooks.ts';
import { formsRPC } from './mcp.ts';
import { html,css,client,embed } from './ui.ts';
export function createFormsApp(db:Storage,config:{tenant:string;basePath?:string;siteName?:string;publicOrigin?:string;background?:(p:Promise<unknown>)=>void;sendWebhook?:Delivery}) {
  const service=new Forms(db,config.tenant),base=config.basePath||'',cookieName='forms_'+config.tenant,cookiePath=base+'/';
  const app=new Hono<{Variables:{auth:any}}>();
  app.use('*',async(c,next)=>secureHeaders({contentSecurityPolicy:{defaultSrc:["'self'"],scriptSrc:["'self'"],styleSrc:["'self'"],imgSrc:["'self'"],frameAncestors:c.req.path.endsWith('/embed')?['*']:["'self'"]},crossOriginResourcePolicy:c.req.path==='/embed.js'?'cross-origin':'same-origin',xFrameOptions:false})(c,next));
  app.use('*',bodyLimit({maxSize:1024*1024}));
  app.use('*',async(c,next)=>{c.header('Cache-Control','no-store');const bearer=c.req.header('Authorization')?.match(/^Bearer (.+)$/)?.[1],token=bearer||getCookie(c,cookieName);const auth=token?await db.get('SELECT id,kind FROM forms_credentials WHERE tenant_id=? AND hash=? AND (expires IS NULL OR expires>?)',[config.tenant,await hash(token),Date.now()]):undefined;c.set('auth',auth);if(!['GET','HEAD','OPTIONS'].includes(c.req.method)){const origin=c.req.header('Origin');if(origin&&origin!==(config.publicOrigin||new URL(c.req.url).origin))return c.json({error:'Origin not allowed'},403);if(getCookie(c,cookieName)&&!bearer&&!origin)return c.json({error:'Origin required'},403);}await next();});
  app.onError((e,c)=>c.json({error:e instanceof z.ZodError?'Please check the submitted values.':e instanceof SyntaxError?'Invalid JSON.':(e as any).cause?'Request could not be completed.':e.message},(e as any).cause?500:400));
  app.get('/health',async c=>{await db.get('SELECT 1 FROM forms_forms WHERE tenant_id=? LIMIT 1',[config.tenant]);return c.json({ok:true,product:'forms'});});
  app.get('/api/session',c=>c.json({admin:!!c.get('auth'),siteName:config.siteName||'Forms'}));
  app.post('/api/login',async c=>{const input=z.object({apiKey:z.string().min(20).max(200)}).parse(await c.req.json());const key=await db.get("SELECT id FROM forms_credentials WHERE tenant_id=? AND hash=? AND kind='api' AND (expires IS NULL OR expires>?)",[config.tenant,await hash(input.apiKey),Date.now()]);if(!key)return c.json({error:'Admin API key not recognised.'},401);const token=id()+id();await db.run('INSERT INTO forms_credentials(tenant_id,id,hash,kind,expires) VALUES(?,?,?,?,?)',[config.tenant,id(),await hash(token),'browser',Date.now()+30*86400000]);setCookie(c,cookieName,token,{httpOnly:true,sameSite:'Lax',secure:new URL(c.req.url).protocol==='https:',path:cookiePath,maxAge:30*86400});return c.json({ok:true});});
  app.post('/api/logout',async c=>{const auth=c.get('auth');if(auth?.kind==='browser')await db.run('DELETE FROM forms_credentials WHERE tenant_id=? AND id=?',[config.tenant,auth.id]);deleteCookie(c,cookieName,{path:cookiePath});return c.json({ok:true});});
  app.use('/api/forms/*',async(c,next)=>{if(!c.get('auth'))return c.json({error:'Admin API key required.'},401);await next();});
  app.use('/api/forms',async(c,next)=>{if(!c.get('auth'))return c.json({error:'Admin API key required.'},401);await next();});
  app.get('/api/forms',async c=>c.json(await service.list()));
  app.post('/api/forms',async c=>c.json(await service.save(await c.req.json()),201));
  app.get('/api/forms/:id',async c=>{const form=await service.get(c.req.param('id'));return form?c.json(form):c.json({error:'Form not found'},404);});
  app.put('/api/forms/:id',async c=>{if(!await service.get(c.req.param('id')))return c.json({error:'Form not found'},404);return c.json(await service.save(await c.req.json(),c.req.param('id')));});
  app.delete('/api/forms/:id',async c=>{const formId=c.req.param('id');await db.batch([
    {text:'DELETE FROM forms_webhooks WHERE tenant_id=? AND form_id=?',values:[config.tenant,formId]},
    {text:'DELETE FROM forms_responses WHERE tenant_id=? AND form_id=?',values:[config.tenant,formId]},
    {text:'DELETE FROM forms_versions WHERE tenant_id=? AND form_id=?',values:[config.tenant,formId]},
    {text:'DELETE FROM forms_forms WHERE tenant_id=? AND id=?',values:[config.tenant,formId]}
  ]);return c.json({ok:true});});
  app.post('/api/forms/:id/publish',async c=>{if(!await service.get(c.req.param('id')))return c.json({error:'Form not found'},404);return c.json(await service.publish(c.req.param('id')));});
  app.post('/api/forms/:id/archive',async c=>{await service.archive(c.req.param('id'));return c.json({ok:true});});
  const pagination=(c:any)=>z.object({limit:z.coerce.number().int().min(1).max(1000).default(100),offset:z.coerce.number().int().min(0).default(0)}).parse(c.req.query());
  app.get('/api/forms/:id/responses',async c=>{const {limit,offset}=pagination(c);return c.json(await service.responses(c.req.param('id'),limit,offset));});
  app.get('/api/forms/:id/responses.csv',async c=>{const stream=await service.csv(c.req.param('id'));return c.body(stream,200,{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="responses.csv"'});});
  app.post('/api/forms/import/typeform',async c=>c.json(await importTypeform(service,await c.req.json()),201));
  app.get('/api/forms/:id/webhooks',async c=>c.json(await service.hooks(c.req.param('id'))));
  app.post('/api/forms/:id/webhooks',async c=>{const input=z.object({url:z.url().max(2000)}).parse(await c.req.json());return c.json(await service.addHook(c.req.param('id'),input.url),201);});
  app.delete('/api/forms/:id/webhooks/:hook',async c=>{await db.run('DELETE FROM forms_webhooks WHERE tenant_id=? AND form_id=? AND id=?',[config.tenant,c.req.param('id'),c.req.param('hook')]);return c.json({ok:true});});
  app.get('/api/forms/:id/deliveries',async c=>c.json(await service.deliveries(c.req.param('id'))));
  app.post('/api/forms/:id/deliveries/:delivery/retry',async c=>{await db.run('UPDATE forms_deliveries SET attempts=0,next_at=0 WHERE tenant_id=? AND id=? AND sent=0 AND hook_id IN(SELECT id FROM forms_webhooks WHERE tenant_id=? AND form_id=?)',[config.tenant,c.req.param('delivery'),config.tenant,c.req.param('id')]);const job=deliverPending(db,config.tenant,config.sendWebhook);if(config.background)config.background(job);else await job;return c.json({ok:true});});
  app.get('/api/public/forms/:id',async c=>{const form=await service.publicForm(c.req.param('id'));return form?c.json(form):c.json({error:'Form is not published.'},404);});
  app.post('/api/public/forms/:id/step',async c=>{const form=await service.publicForm(c.req.param('id'));if(!form)return c.json({error:'Form is not published.'},404);const input=z.object({version:z.number().int(),answers:z.record(z.string(),z.unknown()),hidden:z.record(z.string(),z.string().max(2000)).default({})}).parse(await c.req.json());if(input.version!==form.version)return c.json({error:'This form changed. Please reload.'},409);return c.json(walk(form.definition,input.answers,input.hidden));});
  app.post('/api/public/forms/:id/responses',async c=>{const result=await service.submit(c.req.param('id'),await c.req.json());const job=deliverPending(db,config.tenant,config.sendWebhook);if(config.background)config.background(job);else await job;return c.json(result,201);});
  app.post('/mcp',async c=>{if(!c.get('auth'))return c.json({error:'Admin API key required.'},401);const result=await formsRPC(service,await c.req.json());return result?c.json(result):c.body(null,202);});
  app.get('/mcp',c=>c.json({error:'Use authenticated Streamable HTTP POST.'},405));
  app.get('/assets/style.css',c=>c.text(css,200,{'Content-Type':'text/css; charset=utf-8'}));
  app.get('/assets/app.js',c=>c.text('const BASE='+JSON.stringify(base)+';\n'+client,200,{'Content-Type':'application/javascript; charset=utf-8'}));
  app.get('/embed.js',c=>c.text(embed,200,{'Content-Type':'application/javascript; charset=utf-8'}));
  for(const path of ['/','/admin','/admin/:id','/f/:id','/f/:id/embed'])app.get(path,c=>c.html(html.replaceAll('/assets/',base+'/assets/')));
  return app;
}
