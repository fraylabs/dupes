import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { secureHeaders } from 'hono/secure-headers';
import { getCookie,setCookie,deleteCookie } from 'hono/cookie';
import { z } from 'zod';
import type { Storage } from '../../feedback/src/storage.ts';
import { id,hash } from '../../feedback/src/auth.ts';
import { Faults } from './service.ts';
import { faultsRPC } from './mcp.ts';
import { html,css,client } from './ui.ts';
// The private side of Faults: everything here needs the instance admin key. Apps send events to the
// platform's public store address instead, which needs only a project's own key.
export function createFaultsApp(db:Storage,config:{tenant:string;basePath?:string;publicOrigin:string}) {
  const service=new Faults(db,config.tenant,config.publicOrigin),base=config.basePath||'',cookieName='faults_'+config.tenant,cookiePath=base+'/';
  const app=new Hono<{Variables:{auth:any}}>();
  app.use('*',secureHeaders({contentSecurityPolicy:{defaultSrc:["'self'"],scriptSrc:["'self'"],styleSrc:["'self'"],imgSrc:["'self'"],frameAncestors:["'none'"]}}));
  app.use('*',bodyLimit({maxSize:64*1024}));
  app.use('*',async(c,next)=>{
    c.header('Cache-Control','no-store');
    const bearer=c.req.header('Authorization')?.match(/^Bearer (.+)$/)?.[1],token=bearer||getCookie(c,cookieName);
    const auth=token?await db.get('SELECT id,kind FROM faults_credentials WHERE tenant_id=? AND hash=? AND (expires IS NULL OR expires>?)',[config.tenant,await hash(token),Date.now()]):undefined;
    c.set('auth',auth&&!(bearer&&auth.kind!=='api')?auth:undefined);
    if(!['GET','HEAD','OPTIONS'].includes(c.req.method)){const origin=c.req.header('Origin');if(origin&&origin!==config.publicOrigin)return c.json({error:'Origin not allowed'},403);if(getCookie(c,cookieName)&&!bearer&&!origin)return c.json({error:'Origin required'},403);}
    await next();
  });
  app.onError((e,c)=>c.json({error:e instanceof z.ZodError?'Please check the submitted values.':e instanceof SyntaxError?'Invalid JSON.':(e as any).cause?'Request could not be completed.':e.message},(e as any).cause?500:e.message==='Fault not found'?404:400));
  app.get('/health',async c=>{await db.get('SELECT 1 FROM faults_projects WHERE tenant_id=? LIMIT 1',[config.tenant]);return c.json({ok:true,product:'faults'});});
  app.get('/api/session',c=>c.json({admin:!!c.get('auth')}));
  app.post('/api/login',async c=>{
    const input=z.object({apiKey:z.string().min(20).max(200)}).parse(await c.req.json());
    const key=await db.get("SELECT id FROM faults_credentials WHERE tenant_id=? AND hash=? AND kind='api' AND (expires IS NULL OR expires>?)",[config.tenant,await hash(input.apiKey),Date.now()]);
    if(!key)return c.json({error:'Admin API key not recognised.'},401);
    const token=id()+id();
    await db.run('INSERT INTO faults_credentials(tenant_id,id,hash,kind,expires) VALUES(?,?,?,?,?)',[config.tenant,id(),await hash(token),'browser',Date.now()+30*86400000]);
    setCookie(c,cookieName,token,{httpOnly:true,sameSite:'Lax',secure:new URL(c.req.url).protocol==='https:',path:cookiePath,maxAge:30*86400});
    return c.json({ok:true});
  });
  app.post('/api/logout',async c=>{const auth=c.get('auth');if(auth?.kind==='browser')await db.run('DELETE FROM faults_credentials WHERE tenant_id=? AND id=?',[config.tenant,auth.id]);deleteCookie(c,cookieName,{path:cookiePath});return c.json({ok:true});});
  for(const path of ['/api/projects','/api/faults','/api/faults/*'])app.use(path,async(c,next)=>{if(!c.get('auth'))return c.json({error:'Admin API key required.'},401);await next();});
  app.get('/api/projects',async c=>c.json(await service.projects()));
  app.post('/api/projects',async c=>c.json(await service.createProject((await c.req.json())?.name),201));
  app.get('/api/faults',async c=>c.json(await service.list(c.req.query())));
  app.get('/api/faults/:id',async c=>{const fault=await service.get(c.req.param('id'));return fault?c.json(fault):c.json({error:'Fault not found'},404);});
  app.post('/api/faults/:id/resolve',async c=>c.json(await service.setStatus(c.req.param('id'),'resolved')));
  app.post('/api/faults/:id/reopen',async c=>c.json(await service.setStatus(c.req.param('id'),'open')));
  app.delete('/api/faults/:id',async c=>c.json(await service.remove(c.req.param('id'))));
  app.post('/mcp',async c=>{if(!c.get('auth'))return c.json({error:'Admin API key required.'},401);const result=await faultsRPC(service,await c.req.json());return result?c.json(result):c.body(null,202);});
  app.get('/mcp',c=>c.json({error:'Use authenticated Streamable HTTP POST.'},405));
  app.get('/assets/style.css',c=>c.text(css,200,{'Content-Type':'text/css; charset=utf-8'}));
  app.get('/assets/app.js',c=>c.text('const BASE='+JSON.stringify(base)+';\n'+client,200,{'Content-Type':'application/javascript; charset=utf-8'}));
  for(const path of ['/','/admin'])app.get(path,c=>c.html(html.replaceAll('/assets/',base+'/assets/')));
  return app;
}
