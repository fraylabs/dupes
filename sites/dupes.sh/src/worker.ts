import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { z } from 'zod';
import platform,{sweepForms} from '../../../packages/platform/src/worker.ts';
import { d1Storage } from '../../../dupes/feedback/src/d1-storage.ts';
import { hash,id,now } from '../../../dupes/feedback/src/auth.ts';
import { page,voteNotice } from './pages.ts';
import { sitemapPaths,rssFeed } from './content.ts';
import { platformOwner } from '../../../packages/platform/src/workspace-auth.ts';
import { requestSource,sourceLabel,countablePage,recordPage,sourceStats } from './source-counts.ts';
type Env={DB:Parameters<typeof d1Storage>[0];ASSETS:{fetch(request:Request):Promise<Response>};PLATFORM_API_KEYS:string;PUBLIC_ORIGIN?:string;SSO_SECRET?:string};
const app=new Hono<{Bindings:Env}>();
app.use('*',async(c,next)=>{await next();c.header('X-Content-Type-Options','nosniff');c.header('Referrer-Policy','strict-origin-when-cross-origin');if(!c.req.path.startsWith('/i/')&&!c.req.path.startsWith('/v1/'))c.header('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self'; frame-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");});
app.use('*',async(c,next)=>{
  await next();
  if(countablePage(c.req.raw,c.res))try{await recordPage(d1Storage(c.env.DB),c.req.raw);}catch{console.error('Aggregate page count could not be saved');}
});
app.onError((e,c)=>c.json({error:e instanceof z.ZodError||e instanceof SyntaxError?'Please check your form.':'We could not save this request. Please try again.'},e instanceof z.ZodError||e instanceof SyntaxError?400:500));
app.use('/api/waitlist',bodyLimit({maxSize:4096}));
app.use('/api/waitlist',async(c,next)=>{c.header('Cache-Control','no-store');if(c.req.header('Origin')!==(c.env.PUBLIC_ORIGIN||new URL(c.req.url).origin))return c.json({error:'Origin not allowed'},403);await next();});
app.post('/api/waitlist',async c=>{
  const input=z.object({email:z.email().max(254).transform(v=>v.trim().toLowerCase()),consent:z.literal(true),website:z.string().max(500).default(''),source:z.string().max(80).optional()}).parse(await c.req.json());
  const removalToken=id()+id();
  if(!input.website)await d1Storage(c.env.DB).run('INSERT OR IGNORE INTO site_waitlist(email,created,consent_version,removal_hash,source) VALUES(?,?,?,?,?)',[input.email,now(),'hosted-availability-v1',await hash(removalToken),sourceLabel(input.source)||requestSource(c.req.raw)]);
  // Identical response for new, duplicate and honeypot requests; no email enumeration.
  return c.json({ok:true,removalToken},202);
});
app.delete('/api/waitlist',async c=>{
  const input=z.object({token:z.string().min(64).max(100)}).parse(await c.req.json());
  await d1Storage(c.env.DB).run('DELETE FROM site_waitlist WHERE removal_hash=?',[await hash(input.token)]);return c.json({ok:true});
});
app.all('/api/waitlist',c=>c.json({error:'Method not allowed'},405));
app.get('/robots.txt',c=>c.text('User-agent: *\nDisallow: /v1/\nDisallow: /api/\nSitemap: '+(c.env.PUBLIC_ORIGIN||new URL(c.req.url).origin)+'/sitemap.xml\n'));
app.get('/sitemap.xml',c=>{const o=c.env.PUBLIC_ORIGIN||new URL(c.req.url).origin;return c.body('<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+sitemapPaths.map(p=>'<url><loc>'+o+p+'</loc></url>').join('')+'</urlset>',200,{'Content-Type':'application/xml'});});
app.get('/blog/rss.xml',c=>c.body(rssFeed(c.env.PUBLIC_ORIGIN||new URL(c.req.url).origin),200,{'Content-Type':'application/rss+xml; charset=utf-8'}));
app.get('/health',async c=>{await d1Storage(c.env.DB).get('SELECT count(*) FROM site_waitlist');return c.json({ok:true,product:'dupes-site'});});
app.get('/v1/stats',async c=>{
  c.header('Cache-Control','no-store');
  const bearer=c.req.header('Authorization')?.match(/^Bearer (.+)$/)?.[1];
  if(!bearer)return c.json({error:'Platform API key required'},401);
  const db=d1Storage(c.env.DB);
  if(!await platformOwner(db,c.env.PLATFORM_API_KEYS,bearer))return c.json({error:'Platform API key not recognised'},401);
  return c.json(await sourceStats(db,c.req.query()));
});
async function forward(c:any) {
  const response=await platform.fetch(c.req.raw,c.env,c.executionCtx);
  if(c.req.path.startsWith('/i/next-dupe/')&&response.headers.get('Content-Type')?.includes('text/html')) {
    const html=(await response.text()).replace('</head>','<link rel="stylesheet" href="/board-legal.css"></head>').replace('</body>','<footer class="board-legal">'+voteNotice+'</footer></body>');
    const headers=new Headers(response.headers);headers.delete('Content-Length');return new Response(html,{status:response.status,headers});
  }
  return response;
}
app.all('/i/*',forward);app.all('/v1/*',forward);
app.get('*',async c=>{
  const html=page(c.req.path);if(html){c.header('Cache-Control','no-store');return c.html(html.replace('</head>','<meta name="dupes-source" content="'+requestSource(c.req.raw)+'"></head>'));}
  if(c.req.path.startsWith('/images/')||c.req.path.startsWith('/reference/')||['/styles.css','/board-legal.css','/site.js'].includes(c.req.path))return c.env.ASSETS.fetch(c.req.raw);
  return c.text('Page not found',404);
});
export default {fetch:app.fetch,scheduled:async(_event:unknown,env:Env)=>sweepForms(env)};
