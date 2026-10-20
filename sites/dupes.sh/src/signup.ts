import { z } from 'zod';
import type { Storage } from '../../../dupes/feedback/src/storage.ts';
import { id,hash,now } from '../../../dupes/feedback/src/auth.ts';
import { connectionAddress,rateLimit } from '../../../packages/platform/src/public-limits.ts';
import { sourceLabel,requestSource } from './source-counts.ts';

export async function signup(db:Storage,request:Request,secret:string|undefined) {
  const address=connectionAddress(request);if(!address)return {status:503 as const,body:{error:'Signup protection is unavailable. Please try again later.'}};
  let ip;try{ip=await rateLimit(db,secret,'signup-ip',address,5,3600);}catch{return {status:503 as const,body:{error:'Signup protection is unavailable. Please try again later.'}};}
  if(!ip.allowed)return {status:429 as const,retryAfter:ip.retryAfter,body:{error:'Too many signup attempts. Please try again after the rate limit resets.'}};
  const input=z.object({email:z.email().max(254).transform(v=>v.trim().toLowerCase()),website:z.string().max(500).default(''),source:z.string().max(80).optional()}).parse(await request.json());
  if(input.website)return {status:202 as const,body:{message:'Request received.'}};
  const email=await rateLimit(db,secret,'signup-email',input.email,2,86400);
  if(!email.allowed)return {status:429 as const,retryAfter:email.retryAfter,body:{error:'This address has reached today’s signup limit. Keep your existing key or try again tomorrow.'}};
  // Email is contact information only. Reusing an address never recovers or
  // grants access to a prior workspace. Outbound verification is not configured.
  const owner=id(),key=id()+id(),created=now();
  await db.batch([
    {text:'INSERT INTO workspace_keys(hash,owner_hash,created,revoked) VALUES(?,?,?,0)',values:[await hash(key),owner,created]},
    {text:'INSERT INTO workspace_signups(owner_hash,email,created,source,email_verified) VALUES(?,?,?,?,0)',values:[owner,input.email,created,sourceLabel(input.source)||requestSource(request)]}
  ]);
  return {status:201 as const,body:{workspaceId:owner,workspaceKey:key,mcpEndpoint:new URL('/v1/mcp',request.url).href,emailVerified:false,instanceLimit:1,notice:'Save this key now. It is shown only in this response, is not emailed, and cannot be recovered by email yet.'}};
}
