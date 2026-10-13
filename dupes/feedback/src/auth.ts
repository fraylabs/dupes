import { getCookie, setCookie } from 'hono/cookie';
import type { Context } from 'hono';
import type { Storage } from './storage.ts';
export const id = () => crypto.randomUUID();
export const now = () => new Date().toISOString();
const enc = new TextEncoder();
export async function hash(value: string) {return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',enc.encode(value))),x=>x.toString(16).padStart(2,'0')).join('');}
export async function passwordHash(value:string,salt=id()) {
  const key=await crypto.subtle.importKey('raw',enc.encode(value),'PBKDF2',false,['deriveBits']);
  const bits=await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt:enc.encode(salt),iterations:210000},key,256);
  return salt+':'+Array.from(new Uint8Array(bits),x=>x.toString(16).padStart(2,'0')).join('');
}
export function equal(a:string,b:string) {if(a.length!==b.length)return false;let x=0;for(let i=0;i<a.length;i++)x|=a.charCodeAt(i)^b.charCodeAt(i);return x===0;}
export async function credential(c:Context,db:Storage,cookieName='feedback_session') {
  const bearer=c.req.header('Authorization')?.match(/^Bearer (.+)$/)?.[1];
  const token=bearer||getCookie(c,cookieName);
  if(!token)return undefined;
  const row=await db.get('SELECT * FROM credentials WHERE hash=? AND (expires IS NULL OR expires>?)',[await hash(token),Date.now()]);
  if(row && bearer && row.kind!=='api' && row.kind!=='voter')return undefined;
  return row;
}
export async function issue(c:Context,db:Storage,kind:string,userId:string|null=null,cookieName='feedback_session',cookiePath='/') {
  const token=id()+id(); const expires=Date.now()+30*86400000;
  await db.run('INSERT INTO credentials(id,name,hash,kind,user_id,expires) VALUES(?,?,?,?,?,?)',[id(),'Browser',await hash(token),kind,userId,expires]);
  setCookie(c,cookieName,token,{httpOnly:true,sameSite:'Lax',secure:new URL(c.req.url).protocol==='https:',path:cookiePath,maxAge:30*86400});
  return token;
}
export async function verifySSO(token:string,secret:string):Promise<{sub:string;email?:string;name:string}> {
  const parts=token.split('.');if(parts.length!==3)throw new Error('Invalid SSO token');
  const decode=(s:string)=>Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
  const header=JSON.parse(new TextDecoder().decode(decode(parts[0])));
  if(header.alg!=='HS256')throw new Error('SSO requires HS256');
  const key=await crypto.subtle.importKey('raw',enc.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['verify']);
  if(!await crypto.subtle.verify('HMAC',key,decode(parts[2]),enc.encode(parts[0]+'.'+parts[1])))throw new Error('Invalid SSO signature');
  const p=JSON.parse(new TextDecoder().decode(decode(parts[1])));
  if(typeof p.exp!=='number'||p.exp<=Date.now()/1000||p.aud!=='feedback'||typeof p.sub!=='string'||!p.sub||p.sub.length>200||typeof p.name!=='string'||p.name.length>100)throw new Error('Invalid SSO claims');
  if(p.email!==undefined&&(typeof p.email!=='string'||p.email.length>254||!p.email.includes('@')))throw new Error('Invalid SSO email');
  return p;
}
