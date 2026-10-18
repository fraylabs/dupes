import { lookup } from 'node:dns/promises';
import { request } from 'node:https';
import { isIP } from 'node:net';
import { webhookURL } from './service.ts';
import type { Delivery } from './webhooks.ts';
function publicIP(ip:string){if(isIP(ip)===4){const [a,b]=ip.split('.').map(Number);return !(a===0||a===10||a===127||a===169&&b===254||a===172&&b>=16&&b<=31||a===192&&b===168||a===100&&b>=64&&b<=127||a===192&&b===0||a===198&&(b===18||b===19)||a>=224);}const v=ip.toLowerCase();return isIP(v)===6&&v.startsWith('2')&&!v.startsWith('2001:db8')&&!v.startsWith('2001:0:');}
// Pin the validated public address in the HTTPS connection's DNS callback.
// Hostname/certificate validation stays intact and redirects are never followed.
export const nodeDelivery:Delivery=async(input,body,headers)=>{
  const url=new URL(webhookURL(input)),addresses=await lookup(url.hostname,{all:true});
  if(!addresses.length||addresses.some(a=>!publicIP(a.address)))throw Error('Webhook destination is not public.');const target=addresses[0];
  return new Promise<number>((resolve,reject)=>{const req=request(url,{method:'POST',headers:{...headers,'Content-Length':Buffer.byteLength(body)},lookup:((_host:any,_options:any,callback:any)=>_options?.all?callback(null,[target]):callback(null,target.address,target.family)) as any},response=>{response.resume();resolve(response.statusCode||0);});req.setTimeout(10000,()=>req.destroy(Error('Webhook timed out')));req.once('error',reject);req.end(body);});
};
