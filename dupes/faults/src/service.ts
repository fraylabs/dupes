import type { Storage } from '../../feedback/src/storage.ts';
import { id,hash,now } from '../../feedback/src/auth.ts';

// Bounds for the public store address. The project key ships inside client apps, so it is not a secret.
export const EVENTS_PER_MINUTE=60,GROUPS_PER_PROJECT=1000,KEEP_DAYS=90,MAX_EVENT_BYTES=200*1024;
type Frame={filename?:string;function?:string;lineno?:number;colno?:number;in_app?:boolean};
export type Sample={event_id:string;timestamp:string;level:string;platform:string;release:string;environment:string;tags:Record<string,string>;type:string;value:string;frames:Frame[]};
const clip=(value:unknown,max:number)=>typeof value==='string'?value.slice(0,max):typeof value==='number'&&Number.isFinite(value)?String(value):'';
const whole=(value:unknown)=>typeof value==='number'&&Number.isInteger(value)&&value>=0&&value<1e9?value:undefined;
function tags(input:unknown) {
  const pairs:unknown[][]=Array.isArray(input)?input.filter(Array.isArray):input&&typeof input==='object'?Object.entries(input):[];
  const result:Record<string,string>={};
  for(const [key,value] of pairs.slice(0,30)){const name=clip(key,60);if(name)result[name]=clip(value,200);}
  return result;
}
// Keeps only the documented fields of an error event, each cut to a fixed length. Returns null when there is no fault in it.
export function readEvent(input:any,time=now()):Sample|null {
  if(!input||typeof input!=='object'||Array.isArray(input))return null;
  const chain=Array.isArray(input.exception?.values)?input.exception.values:Array.isArray(input.exception)?input.exception:[];
  const thrown=chain.filter((v:unknown)=>v&&typeof v==='object').at(-1);
  const text=typeof input.message==='string'?input.message:clip(input.message?.formatted,1000)||clip(input.logentry?.formatted,1000)||clip(input.logentry?.message,1000);
  if(!thrown&&!text)return null;
  const frames:Frame[]=(Array.isArray(thrown?.stacktrace?.frames)?thrown.stacktrace.frames:[]).filter((f:unknown)=>f&&typeof f==='object').slice(-60).map((f:any)=>({filename:clip(f.filename,300)||undefined,function:clip(f.function,200)||undefined,lineno:whole(f.lineno),colno:whole(f.colno),in_app:typeof f.in_app==='boolean'?f.in_app:undefined}));
  const stamp=typeof input.timestamp==='number'&&Number.isFinite(input.timestamp)?new Date(input.timestamp*1000):typeof input.timestamp==='string'?new Date(input.timestamp):null;
  return {
    event_id:typeof input.event_id==='string'&&/^[a-f0-9]{32}$/.test(input.event_id)?input.event_id:id().replaceAll('-',''),
    timestamp:stamp&&!Number.isNaN(stamp.getTime())?stamp.toISOString():time,
    level:clip(input.level,20)||'error',platform:clip(input.platform,40),release:clip(input.release,120),environment:clip(input.environment,60),tags:tags(input.tags),
    type:thrown?clip(thrown.type,200)||'Error':'Message',value:thrown?clip(thrown.value,1000):clip(text,1000),frames
  };
}
// Same fault, same fingerprint: the error type with its nearest stack frames (no line numbers, so releases
// stay together), or the type with its message once digits and long identifiers are blanked.
export async function fingerprint(sample:Sample) {
  const named=sample.frames.filter(f=>f.filename||f.function).slice(-8);
  const body=named.length?named.map(f=>(f.filename||'')+'\u0001'+(f.function||'')).join('\u0002'):sample.value.replace(/[0-9a-f]{8,}|\d+/gi,'#');
  return hash(sample.type+'\u0000'+body);
}
type Stored={status:200|400|401|429;body:Record<string,unknown>;retryAfter?:number};
export async function ingest(db:Storage,projectId:number,key:string,input:unknown,time=Date.now()):Promise<Stored> {
  if(!Number.isSafeInteger(projectId)||!/^[a-f0-9]{32}$/.test(key))return {status:401,body:{error:'Unknown project or key.'}};
  const minute=Math.floor(time/60000);
  // One statement checks the key and counts this minute's events for the project.
  const project=await db.get('UPDATE faults_projects SET hits=CASE WHEN minute=? THEN hits+1 ELSE 1 END,minute=? WHERE id=? AND public_key=? RETURNING tenant_id,hits',[minute,minute,projectId,key]);
  if(!project)return {status:401,body:{error:'Unknown project or key.'}};
  if(Number(project.hits)>EVENTS_PER_MINUTE)return {status:429,body:{error:'Too many events this minute.'},retryAfter:60-Math.floor(time/1000)%60};
  const stamp=new Date(time).toISOString(),sample=readEvent(input,stamp);
  if(!sample)return {status:400,body:{error:'Event has no exception or message.'}};
  const print=await fingerprint(sample),place=sample.tags.where||sample.frames.at(-1)?.function||'';
  // A repeat adds to its group and reopens it. A new group is refused once the project holds its maximum.
  const saved=await db.get(`INSERT INTO faults_groups(tenant_id,id,project_id,fingerprint,type,message,location,level,first_seen,last_seen,first_release,last_release,sample)
    SELECT ?,?,?,?,?,?,?,?,?,?,?,?,? WHERE (SELECT count(*) FROM faults_groups WHERE project_id=?)<? OR EXISTS(SELECT 1 FROM faults_groups WHERE project_id=? AND fingerprint=?)
    ON CONFLICT(project_id,fingerprint) DO UPDATE SET count=count+1,status='open',message=excluded.message,location=excluded.location,level=excluded.level,last_seen=excluded.last_seen,last_release=excluded.last_release,sample=excluded.sample RETURNING id`,
    [project.tenant_id,id(),projectId,print,sample.type,sample.value,place.slice(0,200),sample.level,stamp,stamp,sample.release,sample.release,JSON.stringify(sample),projectId,GROUPS_PER_PROJECT,projectId,print]);
  if(!saved)return {status:429,body:{error:'This project holds its maximum number of distinct faults. Delete old ones or wait for them to expire.'},retryAfter:3600};
  await db.run('UPDATE instances SET requests=requests+1 WHERE id=?',[project.tenant_id]);
  return {status:200,body:{id:sample.event_id}};
}
export async function sweepFaults(db:Storage,time=Date.now()) {
  await db.run('DELETE FROM faults_groups WHERE last_seen<?',[new Date(time-KEEP_DAYS*86400000).toISOString()]);
  await db.run('DELETE FROM faults_credentials WHERE expires IS NOT NULL AND expires<?',[time]);
}
const columns='g.id,g.project_id project,p.name project_name,g.type,g.message,g.location,g.level,g.status,g.count,g.first_seen,g.last_seen,g.first_release,g.last_release';
export class Faults {
  constructor(public db:Storage,public tenant:string,public origin:string){}
  address(project:{id:number;public_key:string}){const url=new URL(this.origin);return url.protocol+'//'+project.public_key+'@'+url.host+'/'+project.id;}
  async projects(){return (await this.db.all('SELECT p.id,p.name,p.public_key,p.created,(SELECT count(*) FROM faults_groups g WHERE g.project_id=p.id AND g.status=\'open\') open FROM faults_projects p WHERE p.tenant_id=? ORDER BY p.id',[this.tenant])).map(p=>({id:p.id,name:p.name,created:p.created,open:p.open,dsn:this.address(p as any)}));}
  async createProject(input:unknown){
    const name=typeof input==='string'?input.trim():'';if(!/^[A-Za-z0-9][A-Za-z0-9 ._-]{0,59}$/.test(name))throw Error('Project names use 1 to 60 letters, digits, spaces, dots, dashes or underscores.');
    if(await this.db.get('SELECT 1 FROM faults_projects WHERE tenant_id=? AND name=?',[this.tenant,name]))throw Error('A project with this name already exists.');
    if(Number((await this.db.get('SELECT count(*) total FROM faults_projects WHERE tenant_id=?',[this.tenant]))?.total)>=50)throw Error('This workspace holds its maximum number of projects.');
    const project=await this.db.get<{id:number;public_key:string}>('INSERT INTO faults_projects(tenant_id,name,public_key,created) VALUES(?,?,?,?) RETURNING id,public_key',[this.tenant,name,id().replaceAll('-',''),now()]);
    return {id:project!.id,name,dsn:this.address(project!)};
  }
  async list(input:{project?:unknown;status?:unknown;limit?:unknown;offset?:unknown}={}){
    const status=input.status===undefined?'open':input.status;if(!['open','resolved','all'].includes(status as string))throw Error('Status is open, resolved or all.');
    const limit=input.limit===undefined?50:Number(input.limit),offset=input.offset===undefined?0:Number(input.offset),project=input.project===undefined||input.project===''?undefined:Number(input.project);
    if(!Number.isInteger(limit)||limit<1||limit>200||!Number.isInteger(offset)||offset<0||project!==undefined&&!Number.isSafeInteger(project))throw Error('Invalid filter or pagination.');
    return this.db.all(`SELECT ${columns} FROM faults_groups g JOIN faults_projects p ON p.id=g.project_id WHERE g.tenant_id=?${status==='all'?'':' AND g.status=?'}${project===undefined?'':' AND g.project_id=?'} ORDER BY g.last_seen DESC,g.id LIMIT ? OFFSET ?`,[this.tenant,...(status==='all'?[]:[status]),...(project===undefined?[]:[project]),limit,offset]);
  }
  async get(faultId:string){const row=await this.db.get(`SELECT ${columns},g.sample FROM faults_groups g JOIN faults_projects p ON p.id=g.project_id WHERE g.tenant_id=? AND g.id=?`,[this.tenant,faultId]);return row?{...row,sample:JSON.parse(row.sample) as Sample}:undefined;}
  async setStatus(faultId:string,status:'open'|'resolved'){if(!await this.get(faultId))throw Error('Fault not found');await this.db.run('UPDATE faults_groups SET status=? WHERE tenant_id=? AND id=?',[status,this.tenant,faultId]);return this.get(faultId);}
  async remove(faultId:string){if(!await this.get(faultId))throw Error('Fault not found');await this.db.run('DELETE FROM faults_groups WHERE tenant_id=? AND id=?',[this.tenant,faultId]);return {deleted:true,id:faultId};}
}
