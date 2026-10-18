import { getCookie,setCookie,deleteCookie } from 'hono/cookie';
import { hash,equal,id } from '../../../dupes/feedback/src/auth.ts';
const enc=new TextEncoder(),cookie='dupes_preview';
const escape=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
async function signature(secret:string,value:string){const key=await crypto.subtle.importKey('raw',enc.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);return Array.from(new Uint8Array(await crypto.subtle.sign('HMAC',key,enc.encode(value))),b=>b.toString(16).padStart(2,'0')).join('');}
function destination(value:string|undefined,origin:string){try{const url=new URL(value||'/',origin);if(url.origin===origin&&!url.pathname.startsWith('/_preview/'))return url.pathname+url.search;}catch{}return '/';}
const loginPage=(next:string,error='')=>'<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Private preview · Dupes</title><style>body{margin:0;background:#faf9f6;color:#292c30;font:16px/1.7 system-ui,sans-serif}main{max-width:400px;margin:12vh auto;padding:30px}h1{font-size:36px;letter-spacing:-1.5px;line-height:1.2}p{color:#747a7c;font-size:14px}label{display:block;font-size:13px}input{box-sizing:border-box;width:100%;padding:13px;border:1px solid #d9d5cc;border-radius:5px;background:white;font:inherit;margin-top:8px}button{margin-top:22px;border:0;background:#b45b43;color:white;padding:13px 20px;border-radius:5px;font:600 13px system-ui;cursor:pointer}.error{color:#a83f32}a{color:#b45b43}</style></head><body><main><p>dupes. / PRIVATE PREVIEW</p><h1>A little look inside.</h1><p>Enter your private preview token to continue. This preview is for invited reviewers.</p><form method="post" action="/_preview/login?next='+encodeURIComponent(next)+'"><label>Preview token<input name="token" type="password" autocomplete="off" required maxlength="200"></label><p class="error" role="alert">'+escape(error)+'</p><button>Open preview →</button></form></main></body></html>';
export async function previewGate(c:any,next:()=>Promise<void>){
  c.header('Cache-Control','no-store');c.header('X-Robots-Tag','noindex, nofollow');
  const secret=c.env.PREVIEW_TOKEN,origin=c.env.PUBLIC_ORIGIN||new URL(c.req.url).origin;
  if(typeof secret!=='string'||secret.length<32)return c.json({error:'Private preview is not configured.'},503);
  const path=c.req.path;
  if(path==='/_preview/login'){
    c.header('Content-Security-Policy',"default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'");
    const target=destination(c.req.query('next'),origin);
    if(c.req.method==='GET')return c.html(loginPage(target));
    if(c.req.method!=='POST')return c.json({error:'Method not allowed'},405);
    if(c.req.header('Origin')!==origin)return c.json({error:'Origin not allowed'},403);
    const size=Number(c.req.header('Content-Length')||0);if(size>4096)return c.json({error:'Request too large'},413);
    const raw=await c.req.text();if(raw.length>4096)return c.json({error:'Request too large'},413);
    const token=new URLSearchParams(raw).get('token')||'';
    if(token.length>200||!equal(await hash(token),await hash(secret)))return c.html(loginPage(target,'Preview token not recognised.'),401);
    const value=id()+'.'+(Math.floor(Date.now()/1000)+8*3600);setCookie(c,cookie,value+'.'+await signature(secret,value),{httpOnly:true,secure:true,sameSite:'Strict',path:'/',maxAge:8*3600});return c.redirect(target,303);
  }
  const header=c.req.header('X-Dupes-Preview-Token');let allowed=!!header&&header.length<=200&&equal(await hash(header),await hash(secret));
  if(!allowed){const parts=(getCookie(c,cookie)||'').split('.');const expiry=Number(parts[1]);if(parts.length===3&&Number.isSafeInteger(expiry)&&expiry>Date.now()/1000&&expiry<Date.now()/1000+8*3600+60)allowed=equal(parts[2],await signature(secret,parts[0]+'.'+parts[1]));}
  if(!allowed){if(c.req.method==='GET'&&(c.req.header('Accept')||'').includes('text/html'))return c.redirect('/_preview/login?next='+encodeURIComponent(c.req.path+new URL(c.req.url).search),302);return c.json({error:'Private preview token required.'},401);}
  if(path==='/_preview/logout'&&c.req.method==='POST'){if(c.req.header('Origin')!==origin)return c.json({error:'Origin not allowed'},403);deleteCookie(c,cookie,{path:'/'});return c.redirect('/_preview/login',303);}
  await next();
}
