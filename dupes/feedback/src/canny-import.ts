import type { Storage, Statement } from './storage.ts';
import { now } from './auth.ts';
import { assertImportable, cannyStatements, type CannySnapshot } from './importer.ts';

// Stepped Canny import for hosts with per-request limits (Workers). Each call
// fetches one Canny page and writes it together with the progress row in one
// atomic batch, so a lost response or retry never half-applies a page. The
// Canny API key arrives with every call and is never stored or logged.
type Phase='boards'|'categories'|'tags'|'users'|'posts'|'votes'|'comments'|'entries'|'finish'|'done';
export type CannyProgress={phase:Phase;boards:string[];board:number;skip:number;cursor?:string;counts:Record<string,number>;started:string;updated:string};
export class CannyImportError extends Error {constructor(message:string,readonly status:400|409|422|429|502,readonly retryAfter?:number){super(message);}}
const SETTING='import:canny',PAGE=25;
const order:Phase[]=['boards','categories','tags','users','posts','votes','comments','entries','finish','done'];
const source:Record<string,{endpoint:string;property:string;mode:'all'|'skip'|'cursor';key:keyof CannySnapshot}>={
  boards:{endpoint:'v1/boards/list',property:'boards',mode:'all',key:'boards'},
  categories:{endpoint:'v1/categories/list',property:'categories',mode:'skip',key:'categories'},
  tags:{endpoint:'v1/tags/list',property:'tags',mode:'skip',key:'tags'},
  users:{endpoint:'v2/users/list',property:'users',mode:'cursor',key:'users'},
  posts:{endpoint:'v1/posts/list',property:'posts',mode:'skip',key:'posts'},
  votes:{endpoint:'v2/votes/list',property:'items',mode:'cursor',key:'votes'},
  comments:{endpoint:'v2/comments/list',property:'items',mode:'cursor',key:'comments'},
  entries:{endpoint:'v1/entries/list',property:'entries',mode:'skip',key:'entries'}
};
const empty=():CannySnapshot=>({boards:[],categories:[],tags:[],users:[],posts:[],votes:[],comments:[],entries:[]});
export async function cannyProgress(db:Storage):Promise<CannyProgress|undefined> {
  const row=await db.get<{value:string}>('SELECT value FROM settings WHERE key=?',[SETTING]);return row?JSON.parse(row.value):undefined;
}
async function cannyPage(key:string,endpoint:string,input:Record<string,unknown>,fetcher:typeof fetch) {
  let response:Response;
  try{response=await fetcher('https://canny.io/api/'+endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({apiKey:key,...input}),signal:AbortSignal.timeout(25000)});}
  catch{throw new CannyImportError('Canny did not respond. Nothing from this step was saved; continue to retry.',502);}
  if(response.status===429)throw new CannyImportError('Canny is rate limiting this import. It continues automatically.',429,Math.min(Math.max(Number(response.headers.get('retry-after'))||10,1),120));
  if(response.status===401||response.status===403||response.status===400)throw new CannyImportError('Canny refused the request (HTTP '+response.status+'). Check that the API key is your Canny secret API key.',422);
  if(!response.ok)throw new CannyImportError('Canny returned HTTP '+response.status+'. Nothing from this step was saved; continue to retry.',502);
  try{return await response.json() as Record<string,any>;}catch{throw new CannyImportError('Canny sent an unexpected response. Nothing from this step was saved.',502);}
}
export async function cannyStep(db:Storage,key:string,options:{restart?:boolean;fetcher?:typeof fetch}={}):Promise<{progress:CannyProgress;done:boolean}> {
  if(!key)throw new CannyImportError('Canny API key is required.',400);
  let progress=await cannyProgress(db);
  if(progress?.phase==='done'&&!options.restart)throw new CannyImportError('This workspace already imported from Canny. Start over to import again; existing Canny items are updated, not duplicated.',409);
  if(!progress||options.restart) {
    try{await assertImportable(db);}catch(e){throw new CannyImportError((e as Error).message,409);}
    progress={phase:'boards',boards:[],board:0,skip:0,counts:{boards:0,users:0,posts:0,votes:0,comments:0,changelog:0},started:now(),updated:now()};
  }
  const next={...progress,counts:{...progress.counts},updated:now()},ops:Statement[]=[];
  const advance=()=>{next.phase=order[order.indexOf(next.phase)+1];next.board=0;next.skip=0;delete next.cursor;};
  if(next.phase==='finish') {
    // Pages arrive separately, so each post first stores Canny's full score;
    // subtract the individual Canny votes now present to get the historical remainder.
    ops.push({text:'UPDATE posts SET imported_votes=max(0,imported_votes-(SELECT count(*) FROM votes v WHERE v.post_id=id AND v.user_id LIKE ?)) WHERE id LIKE ?',values:['canny:%','canny:%']});
    advance();
  }else{
    const step=source[next.phase],perBoard=next.phase==='categories'||next.phase==='tags';
    if(perBoard&&next.board>=next.boards.length)advance();
    else{
      const input:Record<string,unknown>=step.mode==='all'?{}:{limit:PAGE};
      if(perBoard)input.boardID=next.boards[next.board];
      if(step.mode==='skip')input.skip=next.skip;
      if(step.mode==='cursor'&&next.cursor)input.cursor=next.cursor;
      const data=await cannyPage(key,step.endpoint,input,options.fetcher||fetch);
      const items=data[step.property];if(!Array.isArray(items))throw new CannyImportError('Canny sent an unexpected '+next.phase+' response. Nothing from this step was saved.',502);
      const snapshot=empty();snapshot[step.key]=items;
      try{const built=cannyStatements(snapshot);ops.push(...built.ops);for(const [name,count] of Object.entries(built.counts))if(name===next.phase||(name==='changelog'&&next.phase==='entries'))next.counts[name]=(next.counts[name]||0)+count;}
      catch(e){throw new CannyImportError((e as Error).message,422);}
      if(next.phase==='boards')next.boards=items.map(b=>String(b.id));
      const more=step.mode!=='all'&&!!(data.hasNextPage??data.hasMore);
      if(more&&!items.length)throw new CannyImportError('Canny returned an empty page with more results. Nothing from this step was saved.',502);
      if(!more){if(perBoard){next.board++;next.skip=0;}else advance();}
      else if(step.mode==='skip')next.skip+=items.length;
      else{if(typeof data.cursor!=='string'||data.cursor===next.cursor)throw new CannyImportError('Canny paging did not advance. Nothing from this step was saved.',502);next.cursor=data.cursor;}
    }
  }
  ops.push({text:'INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value',values:[SETTING,JSON.stringify(next)]});
  await db.batch(ops);
  return {progress:next,done:next.phase==='done'};
}
