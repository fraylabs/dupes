import type { Storage } from '../../../dupes/feedback/src/storage.ts';

export function connectionAddress(request:Request) {
  // Cloudflare supplies this header at the edge. Never trust X-Forwarded-For.
  const address=request.headers.get('CF-Connecting-IP');
  return address&&address.length<=64?address:null;
}
export async function rateLimit(db:Storage,secret:string|undefined,scope:string,subject:string,limit:number,seconds:number) {
  if(!secret||secret.length<32)throw Error('Abuse protection is not configured');
  const time=Date.now(),window=Math.floor(time/(seconds*1000)),expires=(window+1)*seconds*1000;
  const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  const signature=await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(scope+'\0'+window+'\0'+subject));
  const bucket=Array.from(new Uint8Array(signature),v=>v.toString(16).padStart(2,'0')).join('');
  await db.run('INSERT INTO public_rate_limits(bucket,scope,hits,expires) VALUES(?,?,1,?) ON CONFLICT(bucket) DO UPDATE SET hits=MIN(hits+1,?)',[bucket,scope,expires,limit+1]);
  const row=await db.get('SELECT hits FROM public_rate_limits WHERE bucket=?',[bucket]);
  return {allowed:Number(row?.hits)<=limit,retryAfter:Math.max(1,Math.ceil((expires-time)/1000))};
}
