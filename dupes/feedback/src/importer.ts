import type { Storage, Statement } from './storage.ts';
import { now } from './auth.ts';
import { statuses } from './service.ts';

type Item=Record<string,any>;
export type CannySnapshot={boards:Item[];categories:Item[];tags:Item[];users:Item[];posts:Item[];votes:Item[];comments:Item[];entries:Item[]};
const remoteId=(value:any):string=>{const v=typeof value==='string'?value:value?.id;if(typeof v!=='string'||!v)throw Error('Canny object has no id');return 'canny:'+v;};
export async function downloadCanny(key:string,fetcher:typeof fetch=fetch):Promise<CannySnapshot> {
  if(!key)throw Error('Canny API key is required');
  let nextRequest=0;
  async function request(endpoint:string,input:Item) {
    // Stay below the free plan's 100 requests/minute, and retry a transient response once.
    const delay=Math.max(0,nextRequest-Date.now());if(delay)await new Promise(r=>setTimeout(r,delay));nextRequest=Date.now()+650;
    for(let attempt=0;attempt<2;attempt++) {
      const response=await fetcher('https://canny.io/api/'+endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({apiKey:key,...input}),signal:AbortSignal.timeout(30000)});
      if((response.status===429||response.status>=500)&&attempt===0){const retry=Math.min(Math.max(Number(response.headers.get('retry-after'))||2,1),300);await new Promise(r=>setTimeout(r,retry*1000));continue;}
      if(!response.ok)throw Error('Canny '+endpoint+' returned HTTP '+response.status+'. Import not applied.');
      return response.json();
    }
    throw Error('Canny request failed');
  }
  async function list(endpoint:string,property:string,input:Item={},mode:'all'|'skip'|'cursor'='skip') {
    const result:Item[]=[];let cursor:string|undefined,skip=0;const seen=new Set<string>();
    for(;;) {
      const data=await request(endpoint,{...input,...(mode==='all'?{}:{limit:100}),...(mode==='cursor'&&cursor?{cursor}:{}),...(mode==='skip'?{skip}:{})});
      const items=data[property];if(!Array.isArray(items))throw Error('Unexpected Canny '+endpoint+' response; import not applied.');result.push(...items);
      if(mode==='all'||!(data.hasNextPage??data.hasMore))break;
      if(!items.length)throw Error('Empty Canny page with more results; import not applied.');
      if(mode==='cursor'){if(typeof data.cursor!=='string'||seen.has(data.cursor))throw Error('Canny cursor did not advance; import not applied.');cursor=data.cursor;seen.add(data.cursor);}else skip+=items.length;
    }
    return result;
  }
  const boards=await list('v1/boards/list','boards',{},'all');
  const categories:Item[]=[],tags:Item[]=[];
  for(const board of boards){categories.push(...await list('v1/categories/list','categories',{boardID:board.id},'skip'));tags.push(...await list('v1/tags/list','tags',{boardID:board.id},'skip'));}
  return {boards,categories,tags,users:await list('v2/users/list','users',{},'cursor'),posts:await list('v1/posts/list','posts',{},'skip'),votes:await list('v2/votes/list','items',{},'cursor'),comments:await list('v2/comments/list','items',{},'cursor'),entries:await list('v1/entries/list','entries',{},'skip')};
}
export async function importCanny(db:Storage,s:CannySnapshot) {
  for(const key of ['boards','categories','tags','users','posts','votes','comments','entries'] as const)if(!Array.isArray(s[key]))throw Error('Snapshot missing '+key);
  // Snapshot migration must not resurrect votes on posts already merged locally.
  if(await db.get('SELECT 1 FROM posts WHERE id LIKE ? AND merged_into IS NOT NULL',['canny:%']))throw Error('Imported posts have been merged locally. Restore a pre-merge backup or import into a fresh database. Import not applied.');
  const ops:Statement[]=[];const add=(text:string,values:unknown[])=>ops.push({text,values});
  const userMap=new Map<string,Item>();const remember=(u:Item)=>userMap.set(remoteId(u),{...userMap.get(remoteId(u)),...u});for(const u of s.users)remember(u);
  for(const p of s.posts)if(p.author)remember(p.author);
  for(const v of s.votes)if(v.voter)remember(v.voter);
  for(const c of s.comments)if(c.author)remember(c.author);
  for(const b of s.boards)add('INSERT INTO boards(id,name,description,private,private_comments) VALUES(?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,private=excluded.private,private_comments=excluded.private_comments',[remoteId(b),String(b.name||'Imported board'),'',b.isPrivate?1:0,b.privateComments?1:0]);
  for(const [uid,u] of userMap)add('INSERT INTO users(id,name,email,external_id,verified) VALUES(?,?,?,?,0) ON CONFLICT(id) DO UPDATE SET name=excluded.name,email=excluded.email',[uid,String(u.name||u.alias||'Community'),u.email||null,u.userID?String(u.userID):null]);
  const tagMap=new Map<string,Item>();
  for(const t of s.categories)tagMap.set(remoteId(t),{...t,kind:'category'});
  for(const t of s.tags)tagMap.set(remoteId(t),{...t,kind:'tag'});
  for(const p of s.posts){if(p.category)tagMap.set(remoteId(p.category),{...p.category,board:p.board,kind:'category'});for(const t of p.tags||[])tagMap.set(remoteId(t),{...t,board:p.board,kind:'tag'});}
  for(const [tid,t] of tagMap)add('INSERT INTO tags(id,board_id,name,kind,parent_id) VALUES(?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,kind=excluded.kind',[tid,remoteId(t.board||t.boardID),String(t.name),t.kind,t.parentID?'canny:'+t.parentID:null]);
  const voteMap=new Map<string,Set<string>>();for(const v of s.votes){const pid=remoteId(v.post),uid=remoteId(v.voter);if(!voteMap.has(pid))voteMap.set(pid,new Set());voteMap.get(pid)!.add(uid);}
  for(const p of s.posts) {
    const pid=remoteId(p),status=String(p.status||'open').toLowerCase();if(!statuses.includes(status as any))throw Error('Unsupported Canny status '+status+'; import not applied.');
    const score=Number(p.score??p.voteCount??voteMap.get(pid)?.size??0);if(!Number.isSafeInteger(score)||score<0)throw Error('Invalid Canny vote count');
    add('INSERT INTO posts(id,board_id,author_id,title,details,status,imported_votes,created) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET title=excluded.title,details=excluded.details,status=excluded.status,imported_votes=excluded.imported_votes',[pid,remoteId(p.board),p.author?remoteId(p.author):null,String(p.title),String(p.details||p.plaintextDetails||''),status,Math.max(0,score-(voteMap.get(pid)?.size||0)),p.created||now()]);
    add('DELETE FROM votes WHERE post_id=? AND user_id LIKE ?',[pid,'canny:%']);
    add('DELETE FROM post_tags WHERE post_id=?',[pid]);
    for(const t of [...p.tags||[],...(p.category?[p.category]:[])])add('INSERT OR IGNORE INTO post_tags(post_id,tag_id) VALUES(?,?)',[pid,remoteId(t)]);
  }
  for(const v of s.votes)add('INSERT OR IGNORE INTO votes(post_id,user_id,created) VALUES(?,?,?)',[remoteId(v.post),remoteId(v.voter),v.created||now()]);
  for(const c of s.comments)add('INSERT INTO comments(id,post_id,user_id,body,admin,private,created) VALUES(?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET body=excluded.body,private=excluded.private',[remoteId(c),remoteId(c.post),c.author?remoteId(c.author):null,String(c.value||c.body||''),c.author?.isAdmin?1:0,c.private?1:0,c.created||now()]);
  for(const e of s.entries) {
    const eid=remoteId(e);add('INSERT INTO changelog(id,title,body,type,published,created) VALUES(?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET title=excluded.title,body=excluded.body,published=excluded.published',[eid,String(e.title),String(e.plaintextDetails||e.markdownDetails||e.details||''),e.type||e.types?.[0]||'new',e.publishedAt||e.publishedOn||e.published?1:0,e.publishedAt||e.publishedOn||e.created||now()]);
    add('DELETE FROM changelog_posts WHERE entry_id=?',[eid]);for(const p of e.posts||[])add('INSERT OR IGNORE INTO changelog_posts(entry_id,post_id) VALUES(?,?)',[eid,remoteId(p)]);
  }
  await db.batch(ops);return {boards:s.boards.length,users:userMap.size,posts:s.posts.length,votes:s.votes.length,comments:s.comments.length,changelog:s.entries.length};
}
