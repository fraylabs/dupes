import type { Storage } from '../../feedback/src/storage.ts';
import { webhookURL } from './service.ts';
import { id } from '../../feedback/src/auth.ts';
export type Delivery=(url:string,body:string,headers:Record<string,string>)=>Promise<number>;
export const publicFetch:Delivery=async(url,body,headers)=>{const response=await fetch(webhookURL(url),{method:'POST',body,headers,redirect:'manual',signal:AbortSignal.timeout(10000)});await response.body?.cancel();return response.status;};
export async function deliverPending(db:Storage,tenant:string,send:Delivery=publicFetch){
  const pending=await db.all('SELECT d.id,d.payload,d.attempts,h.url,h.secret FROM forms_deliveries d JOIN forms_webhooks h ON h.tenant_id=d.tenant_id AND h.id=d.hook_id WHERE d.tenant_id=? AND d.sent=0 AND d.attempts<10 AND d.next_at<=? AND d.leased_until<=? AND h.enabled=1 ORDER BY d.next_at LIMIT 10',[tenant,Date.now(),Date.now()]);
  for(const job of pending){const lease=id();await db.run('UPDATE forms_deliveries SET lease_token=?,leased_until=? WHERE tenant_id=? AND id=? AND sent=0 AND leased_until<=?',[lease,Date.now()+120000,tenant,job.id,Date.now()]);const owned=await db.get('SELECT lease_token FROM forms_deliveries WHERE tenant_id=? AND id=?',[tenant,job.id]);if(owned?.lease_token!==lease)continue;let status=0;try{
    const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(job.secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);const signature=btoa(String.fromCharCode(...new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(job.payload)))));
    status=await send(job.url,job.payload,{'Content-Type':'application/json','X-Dupes-Signature':'sha256='+signature,'X-Dupes-Delivery':job.id,'Idempotency-Key':job.id});
  }catch{/* Never log destinations, response bodies or secrets. Retry metadata is visible to the owner. */}
    await db.run('UPDATE forms_deliveries SET attempts=attempts+1,next_at=?,sent=?,last_status=?,leased_until=0,lease_token=NULL WHERE tenant_id=? AND id=? AND sent=0 AND lease_token=?',[Date.now()+Math.min(3600000,60000*2**job.attempts),status>=200&&status<300?1:0,status||null,tenant,job.id,lease]);
  }
}
