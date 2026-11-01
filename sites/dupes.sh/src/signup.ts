import { z } from 'zod';
import type { Storage } from '../../../dupes/feedback/src/storage.ts';
import { id,hash,now } from '../../../dupes/feedback/src/auth.ts';
import { connectionAddress,rateLimit } from '../../../packages/platform/src/public-limits.ts';
import { provisionInstance,instanceInput } from '../../../packages/platform/src/worker.ts';
import { sourceLabel,requestSource } from './source-counts.ts';

export async function signup(db:Storage,request:Request,secret:string|undefined,origin:string) {
  const address=connectionAddress(request);if(!address)return {status:503 as const,body:{error:'Signup protection is unavailable. Please try again later.'}};
  let ip;try{ip=await rateLimit(db,secret,'signup-ip',address,5,3600);}catch{return {status:503 as const,body:{error:'Signup protection is unavailable. Please try again later.'}};}
  if(!ip.allowed)return {status:429 as const,retryAfter:ip.retryAfter,body:{error:'Too many signup attempts. Please try again after the rate limit resets.'}};
  const input=z.object({email:z.email().max(254).transform(v=>v.trim().toLowerCase()),website:z.string().max(500).default(''),source:z.string().max(80).optional(),name:instanceInput.shape.name.optional()}).parse(await request.json());
  if(input.website)return {status:202 as const,body:{message:'Request received.'}};
  const email=await rateLimit(db,secret,'signup-email',input.email,2,86400);
  if(!email.allowed)return {status:429 as const,retryAfter:email.retryAfter,body:{error:'This address has reached today’s signup limit. Keep your existing key or try again tomorrow.'}};
  // Email is contact information only. Reusing an address never recovers or
  // grants access to a prior workspace. Outbound verification is not configured.
  const owner=id(),key=id()+id(),created=now();
  // With a board name, the Feedback instance is created by /v1/instances' own
  // writes in the same atomic batch: a failure leaves neither workspace nor board.
  const board=input.name===undefined?undefined:await provisionInstance(owner,{app:'feedback',name:input.name});
  await db.batch([
    {text:'INSERT INTO workspace_keys(hash,owner_hash,created,revoked) VALUES(?,?,?,0)',values:[await hash(key),owner,created]},
    {text:'INSERT INTO workspace_signups(owner_hash,email,created,source,email_verified) VALUES(?,?,?,?,0)',values:[owner,input.email,created,sourceLabel(input.source)||requestSource(request)]},
    ...board?.ops??[]
  ]);
  const workspace={workspaceId:owner,workspaceKey:key,mcpEndpoint:new URL('/v1/mcp',request.url).href,emailVerified:false,instanceLimit:1,notice:'Save this key now. It is shown only in this response, is not emailed, and cannot be recovered by email yet.'};
  if(!board)return {status:201 as const,body:workspace};
  const instance=await board.created(db,origin);
  // A brand-new workspace owns no instance, so the cap cannot refuse this; if it
  // ever does, the page still gets the working key and can create the board.
  if(!instance)return {status:201 as const,body:{...workspace,boardError:'Your workspace was created, but its board was not. Save your key, then create the board.'}};
  return {status:201 as const,body:{...workspace,instanceId:instance.id,url:instance.url,adminUrl:instance.adminUrl,adminApiKey:instance.adminApiKey}};
}
