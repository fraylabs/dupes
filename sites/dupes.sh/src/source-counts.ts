import { z } from 'zod';
import type { Storage } from '../../../dupes/feedback/src/storage.ts';

// Category labels only: no full URLs, arbitrary query strings or IP literals.
export function sourceLabel(input:unknown):string|undefined {
  if(typeof input!=='string')return undefined;
  const value=input.trim().toLowerCase().replace(/\s+/g,'-');
  if(!/^[a-z0-9][a-z0-9_.-]{0,79}$/.test(value)||/^[\d.]+$/.test(value))return undefined;
  return value;
}
export function requestSource(request:Request) {
  const campaign=sourceLabel(new URL(request.url).searchParams.get('utm_source'));
  if(campaign)return campaign;
  try {const ref=new URL(request.headers.get('Referer')||'');if(['http:','https:'].includes(ref.protocol))return sourceLabel(ref.hostname)||'direct';}catch{}
  return 'direct';
}
export function humanAgent(request:Request) {
  const ua=request.headers.get('User-Agent')||'';
  return !!ua.trim()&&!/(?:bot|spider|crawl|slurp|preview|headless|lighthouse|curl|wget|python|node|httpclient|go-http-client|uptime|monitor|facebookexternalhit|whatsapp|telegram)/i.test(ua);
}
export function countablePage(request:Request,response:Response) {
  return request.method==='GET'&&response.status===200&&/^text\/html(?:;|$)/i.test(response.headers.get('Content-Type')||'')&&humanAgent(request)
    &&!/(?:prefetch|prerender)/i.test((request.headers.get('Sec-Purpose')||'')+' '+(request.headers.get('Purpose')||''));
}
export function aggregatePath(request:Request) {
  // Hosted app/form/post identifiers are content references, not useful marketing
  // dimensions. Collapse them so URLs cannot create per-item analytics records.
  return new URL(request.url).pathname.replace(/^\/i\/[^/]+/,'/i/:instance').replace(/\/(posts|admin|f)\/[^/]+/g,'/$1/:item').slice(0,200);
}
export async function recordPage(db:Storage,request:Request) {
  await db.run('INSERT INTO site_daily_visits(day,path,source,views) VALUES(?,?,?,1) ON CONFLICT(day,path,source) DO UPDATE SET views=views+1',[new Date().toISOString().slice(0,10),aggregatePath(request),requestSource(request)]);
}
// Homepage film steps share the daily aggregate table as path "event:<step>".
export const DEMO_STEPS=['demo_play','demo_half'] as const;
export async function recordEvent(db:Storage,step:typeof DEMO_STEPS[number],source:string) {
  await db.run('INSERT INTO site_daily_visits(day,path,source,views) VALUES(?,?,?,1) ON CONFLICT(day,path,source) DO UPDATE SET views=views+1',[new Date().toISOString().slice(0,10),'event:'+step,source]);
}
const day=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value=>{const parsed=new Date(value+'T00:00:00Z');return !Number.isNaN(+parsed)&&parsed.toISOString().slice(0,10)===value;});
export async function sourceStats(db:Storage,input:Record<string,string>) {
  const today=new Date().toISOString().slice(0,10),defaultFrom=new Date(Date.now()-29*86400000).toISOString().slice(0,10);
  const query=z.object({from:day.default(defaultFrom),to:day.default(today),limit:z.coerce.number().int().min(1).max(1000).default(200),offset:z.coerce.number().int().min(0).max(1000000).default(0),source:z.string().max(80).optional()}).parse(input);
  const fromTime=Date.parse(query.from+'T00:00:00Z'),toTime=Date.parse(query.to+'T00:00:00Z');
  if(fromTime>toTime||toTime-fromTime>365*86400000)throw new z.ZodError([{code:'custom',path:['from'],message:'Choose a date range of at most 366 days.'}]);
  const source=query.source===undefined?undefined:sourceLabel(query.source);
  if(query.source!==undefined&&!source)throw new z.ZodError([{code:'custom',path:['source'],message:'Invalid source category.'}]);
  const filter=source?' AND source=?':'',sourceValues=source?[source]:[];
  const visits=await db.all('SELECT day,path,source,views FROM site_daily_visits WHERE day>=? AND day<=?'+filter+' ORDER BY day DESC,path,source LIMIT ? OFFSET ?',[query.from,query.to,...sourceValues,query.limit+1,query.offset]);
  const end=new Date(toTime+86400000).toISOString();
  const signups=await db.all('SELECT substr(created,1,10) day,source,count(*) signups FROM site_waitlist WHERE created>=? AND created<?'+filter+' GROUP BY substr(created,1,10),source ORDER BY day DESC,source LIMIT ? OFFSET ?',[query.from+'T00:00:00.000Z',end,...sourceValues,query.limit+1,query.offset]);
  const hostedSignups=await db.all('SELECT substr(created,1,10) day,source,count(*) signups FROM workspace_signups WHERE created>=? AND created<?'+filter+' GROUP BY substr(created,1,10),source ORDER BY day DESC,source LIMIT ? OFFSET ?',[query.from+'T00:00:00.000Z',end,...sourceValues,query.limit+1,query.offset]);
  const more=visits.length>query.limit||signups.length>query.limit||hostedSignups.length>query.limit;
  return {from:query.from,to:query.to,timezone:'UTC',metric:'HTML page views, not unique people or installs; signups and hostedSignups are current waitlist/workspace entries by signup day',visits:visits.slice(0,query.limit),signups:signups.slice(0,query.limit),hostedSignups:hostedSignups.slice(0,query.limit),nextOffset:more?query.offset+query.limit:null};
}
