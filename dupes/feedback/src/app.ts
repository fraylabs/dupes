import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { secureHeaders } from 'hono/secure-headers';
import { deleteCookie, getCookie } from 'hono/cookie';
import { z } from 'zod';
import type { Storage } from './storage.ts';
import { Feedback, statuses } from './service.ts';
import { credential, issue, id, hash, now, passwordHash, equal, verifySSO } from './auth.ts';
import { rpc } from './mcp.ts';
import { html, client, css, widget } from './ui.ts';

export function createApp(db:Storage,config:{ssoSecret?:string;siteName?:string;publicOrigin?:string}={}) {
  const service=new Feedback(db);
  const app=new Hono<{Variables:{auth:Record<string,any>|undefined;admin:boolean}}>();
  const limits=new Map<string,{count:number;until:number}>();
  app.use('*',async(c,next)=>secureHeaders({contentSecurityPolicy:{defaultSrc:["'self'"],scriptSrc:["'self'"],styleSrc:["'self'"],imgSrc:["'self'",'data:'],frameAncestors:c.req.path==='/widget'?['*']:["'self'"]},xFrameOptions:false})(c,next));
  app.use('*',bodyLimit({maxSize:2*1024*1024}));
  app.use('*',async(c,next)=>{
    c.header('Cache-Control','no-store');
    const auth=await credential(c,db);c.set('auth',auth);c.set('admin',!!auth&&['admin','api'].includes(auth.kind));
    if(!['GET','HEAD','OPTIONS'].includes(c.req.method)) {
      const origin=c.req.header('Origin');
      const expected=config.publicOrigin||new URL(c.req.url).origin;
      if(origin&&origin!==expected)return c.json({error:'Origin not allowed'},403);
      // Cookie sessions require a browser Origin; scripts use explicit bearer tokens.
      if(getCookie(c,'feedback_session')&&!c.req.header('Authorization')&&!origin)return c.json({error:'Origin required'},403);
      if(!c.get('admin')) {
        const key=auth?.id||c.req.header('x-forwarded-for')?.split(',')[0]||'anonymous';
        const time=Date.now();const bucket=limits.get(key);
        if(!bucket||bucket.until<time)limits.set(key,{count:1,until:time+600000});else if(++bucket.count>100)return c.json({error:'Please try again in a few minutes'},429);
        if(limits.size>10000)for(const [key,value] of limits)if(value.until<time)limits.delete(key);
      }
    }
    await next();
  });
  app.onError((e,c)=>{if(e instanceof z.ZodError)return c.json({error:'Invalid input',issues:e.issues.map(i=>({path:i.path,message:i.message}))},400);if(e instanceof SyntaxError)return c.json({error:'Invalid JSON'},400);return c.json({error:'Request could not be completed'},500);});
  app.use('/api/admin/*',async(c,next)=>{if(!c.get('admin'))return c.json({error:'Admin login required'},401);await next();});
  const voter=async(c:any)=>{
    const auth=c.get('auth');if(auth?.user_id)return auth.user_id as string;
    if(c.get('admin'))return null;
    return undefined;
  };
  app.get('/health',async c=>{await db.get('SELECT 1');return c.json({ok:true,product:'feedback'});});
  app.get('/api/session',async c=>{const auth=c.get('auth');const user=auth?.user_id?await db.get('SELECT id,name FROM users WHERE id=?',[auth.user_id]):null;return c.json({admin:c.get('admin'),user,siteName:config.siteName||'Feedback',statuses});});
  app.post('/api/login',async c=>{
    const {password}=z.object({password:z.string().max(500)}).parse(await c.req.json());
    const stored=await db.get('SELECT value FROM settings WHERE key=?',['admin_password']);
    if(!stored||!equal(await passwordHash(password,stored.value.split(':')[0]),stored.value))return c.json({error:'Password not recognised'},401);
    await issue(c,db,'admin');return c.json({ok:true});
  });
  app.post('/api/logout',async c=>{const a=c.get('auth');if(a&&a.kind!=='api')await db.run('DELETE FROM credentials WHERE id=?',[a.id]);deleteCookie(c,'feedback_session',{path:'/'});return c.json({ok:true});});
  app.post('/api/identify',async c=>{
    const p=z.object({name:z.string().trim().min(1).max(100).optional(),email:z.email().max(254).optional(),token:z.string().max(10000).optional()}).parse(await c.req.json());
    let userId=id();
    if(p.token) {
      if(!config.ssoSecret)return c.json({error:'SSO is not configured'},400);
      let identity;try {identity=await verifySSO(p.token,config.ssoSecret);}catch{return c.json({error:'Invalid SSO token'},401);}
      const existing=await db.get('SELECT id FROM users WHERE external_id=?',[identity.sub]);userId=existing?.id||userId;
      await db.run('INSERT INTO users(id,name,email,external_id,verified) VALUES(?,?,?,?,1) ON CONFLICT(external_id) DO UPDATE SET name=excluded.name,email=excluded.email,verified=1',[userId,identity.name,identity.email||null,identity.sub]);
    } else {
      if(!p.name)return c.json({error:'A name is required'},400);
      // Anonymous email is contact information, never proof of ownership of an imported account.
      const current=c.get('auth');if(current?.kind==='voter'&&current.user_id) {const u=await db.get('SELECT * FROM users WHERE id=?',[current.user_id]);if(u&&!u.verified)userId=u.id;}
      await db.run('INSERT INTO users(id,name,email) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,email=excluded.email',[userId,p.name,p.email||null]);
    }
    await issue(c,db,'voter',userId);return c.json({id:userId});
  });
  app.get('/api/boards',async c=>c.json(await db.all(`SELECT * FROM boards ${c.get('admin')?'':'WHERE private=0'} ORDER BY name`)));
  app.get('/api/tags',async c=>c.json(await db.all(`SELECT t.* FROM tags t JOIN boards b ON b.id=t.board_id ${c.get('admin')?'':'WHERE b.private=0'} ORDER BY t.name`)));
  app.get('/api/posts',async c=>c.json(await service.posts({board:c.req.query('board'),status:c.req.query('status'),q:c.req.query('q'),sort:c.req.query('sort'),limit:Number(c.req.query('limit'))||50,offset:Number(c.req.query('offset'))||0},c.get('admin'))));
  app.get('/api/posts/:id',async c=>{const p=await service.post(c.req.param('id'),c.get('admin'));if(!p)return c.json({error:'Post not found'},404);if(p.merged_into)return c.json({mergedInto:p.merged_into});p.comments=await db.all(`SELECT c.id,c.body,c.admin,c.created,u.name author_name FROM comments c LEFT JOIN users u ON u.id=c.user_id WHERE c.post_id=? ${c.get('admin')?'':p.private_comments?'AND 0':'AND c.private=0'} ORDER BY c.created`,[p.id]);const a=c.get('auth');p.voted=!!a?.user_id&&!!await db.get('SELECT 1 FROM votes WHERE post_id=? AND user_id=?',[p.id,a.user_id]);return c.json(p);});
  app.post('/api/posts',async c=>{const u=await voter(c);if(u===undefined)return c.json({error:'Tell us your name first'},401);return c.json(await service.createPost(await c.req.json(),u,c.get('admin')),201);});
  app.post('/api/posts/:id/vote',async c=>{const u=await voter(c);if(!u)return c.json({error:'Voter identity required'},401);const p=await service.post(c.req.param('id'),c.get('admin'));if(!p||p.merged_into)return c.json({error:'Active post not found'},404);await db.run('INSERT OR IGNORE INTO votes(post_id,user_id,created) VALUES(?,?,?)',[p.id,u,now()]);return c.json({ok:true});});
  app.delete('/api/posts/:id/vote',async c=>{const u=await voter(c);if(!u)return c.json({error:'Voter identity required'},401);const p=await service.post(c.req.param('id'),c.get('admin'));if(!p)return c.json({error:'Post not found'},404);await db.run('DELETE FROM votes WHERE post_id=? AND user_id=?',[p.id,u]);return c.json({ok:true});});
  app.post('/api/posts/:id/comments',async c=>{const u=await voter(c);if(u===undefined)return c.json({error:'Identity required'},401);const p=await service.post(c.req.param('id'),c.get('admin'));if(!p||p.merged_into)return c.json({error:'Active post not found'},404);const input=z.object({body:z.string().trim().min(1).max(20000),private:z.boolean().default(false)}).parse(await c.req.json());const commentId=id();await db.run('INSERT INTO comments(id,post_id,user_id,body,admin,private,created) VALUES(?,?,?,?,?,?,?)',[commentId,p.id,u,input.body,c.get('admin')?1:0,(input.private||p.private_comments)?1:0,now()]);return c.json({id:commentId},201);});
  app.get('/api/changelog',async c=>c.json(await service.entries(c.get('admin'))));
  app.get('/api/roadmap',async c=>{const groups=await Promise.all(['planned','in progress','complete'].map(async s=>[s,await service.posts({status:s,limit:200},c.get('admin'))]));return c.json(Object.fromEntries(groups));});
  app.post('/api/admin/boards',async c=>{const p=z.object({name:z.string().trim().min(1).max(100),description:z.string().max(1000).default(''),private:z.boolean().default(false)}).parse(await c.req.json());const boardId=id();await db.run('INSERT INTO boards(id,name,description,private) VALUES(?,?,?,?)',[boardId,p.name,p.description,p.private?1:0]);return c.json({id:boardId},201);});
  app.patch('/api/admin/boards/:id',async c=>{const p=z.object({name:z.string().trim().min(1).max(100),description:z.string().max(1000).default(''),private:z.boolean().default(false),privateComments:z.boolean().default(false)}).parse(await c.req.json());await db.run('UPDATE boards SET name=?,description=?,private=?,private_comments=? WHERE id=?',[p.name,p.description,p.private?1:0,p.privateComments?1:0,c.req.param('id')]);return c.json({ok:true});});
  app.delete('/api/admin/boards/:id',async c=>{if(await db.get('SELECT 1 FROM posts WHERE board_id=?',[c.req.param('id')]))return c.json({error:'Move or delete posts before deleting the board'},409);await db.batch([{text:'DELETE FROM tags WHERE board_id=?',values:[c.req.param('id')]},{text:'DELETE FROM boards WHERE id=?',values:[c.req.param('id')]}]);return c.json({ok:true});});
  app.post('/api/admin/tags',async c=>{const p=z.object({boardId:z.string(),name:z.string().trim().min(1).max(100),kind:z.enum(['tag','category']).default('tag')}).parse(await c.req.json());const tagId=id();await db.run('INSERT INTO tags(id,board_id,name,kind) VALUES(?,?,?,?)',[tagId,p.boardId,p.name,p.kind]);return c.json({id:tagId},201);});
  app.patch('/api/admin/tags/:id',async c=>{const p=z.object({name:z.string().trim().min(1).max(100)}).parse(await c.req.json());await db.run('UPDATE tags SET name=? WHERE id=?',[p.name,c.req.param('id')]);return c.json({ok:true});});
  app.delete('/api/admin/tags/:id',async c=>{await db.run('DELETE FROM tags WHERE id=?',[c.req.param('id')]);return c.json({ok:true});});
  app.patch('/api/admin/posts/:id',async c=>{const p=z.object({title:z.string().trim().min(1).max(200).optional(),details:z.string().max(20000).optional(),status:z.enum(statuses).optional(),tagIds:z.array(z.string()).max(100).optional()}).parse(await c.req.json());const post=await service.post(c.req.param('id'),true);if(!post||post.merged_into)return c.json({error:'Active post not found'},404);const ops=[];
    for(const key of ['title','details','status'] as const)if(p[key]!==undefined)ops.push({text:`UPDATE posts SET ${key}=? WHERE id=?`,values:[p[key],post.id]});
    if(p.tagIds){for(const t of p.tagIds)if(!await db.get('SELECT 1 FROM tags WHERE id=? AND board_id=?',[t,post.board_id]))return c.json({error:'Tag belongs to another board'},400);ops.push({text:'DELETE FROM post_tags WHERE post_id=?',values:[post.id]});for(const t of new Set(p.tagIds))ops.push({text:'INSERT INTO post_tags(post_id,tag_id) VALUES(?,?)',values:[post.id,t]});}await db.batch(ops);return c.json(await service.post(post.id,true));});
  app.delete('/api/admin/posts/:id',async c=>{if(await db.get('SELECT 1 FROM posts WHERE merged_into=?',[c.req.param('id')]))return c.json({error:'A merged post links to this post'},409);await db.run('DELETE FROM posts WHERE id=?',[c.req.param('id')]);return c.json({ok:true});});
  app.post('/api/admin/posts/:id/merge',async c=>{const p=z.object({targetId:z.string()}).parse(await c.req.json());return c.json(await service.merge(c.req.param('id'),p.targetId));});
  app.delete('/api/admin/comments/:id',async c=>{await db.run('DELETE FROM comments WHERE id=?',[c.req.param('id')]);return c.json({ok:true});});
  app.patch('/api/admin/comments/:id',async c=>{const p=z.object({body:z.string().trim().min(1).max(20000),private:z.boolean().default(false)}).parse(await c.req.json());await db.run('UPDATE comments SET body=?,private=? WHERE id=?',[p.body,p.private?1:0,c.req.param('id')]);return c.json({ok:true});});
  app.post('/api/admin/changelog',async c=>c.json(await service.createEntry(await c.req.json()),201));
  app.patch('/api/admin/changelog/:id',async c=>{
    const p=z.object({title:z.string().trim().min(1).max(200).optional(),body:z.string().min(1).max(50000).optional(),type:z.enum(['new','improved','fixed']).optional(),published:z.boolean().optional()}).parse(await c.req.json());
    const entryId=c.req.param('id');if(!await db.get('SELECT 1 FROM changelog WHERE id=?',[entryId]))return c.json({error:'Entry not found'},404);
    const ops=[];for(const k of ['title','body','type','published'] as const)if(p[k]!==undefined)ops.push({text:`UPDATE changelog SET ${k}=? WHERE id=?`,values:[k==='published'?(p[k]?1:0):p[k],entryId]});
    if(p.published)ops.push({text:'INSERT OR IGNORE INTO notifications(entry_id,user_id) SELECT ?,v.user_id FROM votes v JOIN changelog_posts cp ON cp.post_id=v.post_id WHERE cp.entry_id=?',values:[entryId,entryId]});
    await db.batch(ops);return c.json({ok:true});
  });
  app.delete('/api/admin/changelog/:id',async c=>{await db.run('DELETE FROM changelog WHERE id=?',[c.req.param('id')]);return c.json({ok:true});});
  app.get('/api/admin/users',async c=>c.json(await db.all('SELECT * FROM users LIMIT 200')));
  app.post('/api/admin/users',async c=>{const p=z.object({name:z.string().trim().min(1).max(100),email:z.email().optional(),externalId:z.string().max(200).optional()}).parse(await c.req.json());const userId=id();await db.run('INSERT INTO users(id,name,email,external_id) VALUES(?,?,?,?)',[userId,p.name,p.email||null,p.externalId||null]);return c.json({id:userId},201);});
  app.patch('/api/admin/users/:id',async c=>{const p=z.object({name:z.string().trim().min(1).max(100),email:z.email().optional()}).parse(await c.req.json());await db.run('UPDATE users SET name=?,email=?,verified=0 WHERE id=?',[p.name,p.email||null,c.req.param('id')]);return c.json({ok:true});});
  app.delete('/api/admin/users/:id',async c=>{const u=c.req.param('id');await db.batch([
    {text:'DELETE FROM credentials WHERE user_id=?',values:[u]},
    {text:'DELETE FROM notifications WHERE user_id=?',values:[u]},
    {text:'DELETE FROM votes WHERE user_id=?',values:[u]},
    {text:'UPDATE posts SET author_id=NULL WHERE author_id=?',values:[u]},
    {text:'UPDATE comments SET user_id=NULL WHERE user_id=?',values:[u]},
    {text:'DELETE FROM users WHERE id=?',values:[u]}
  ]);return c.json({ok:true});});
  app.get('/api/admin/posts/:id/votes',async c=>c.json(await db.all('SELECT v.*,u.name,u.email FROM votes v JOIN users u ON u.id=v.user_id WHERE v.post_id=?',[c.req.param('id')])));
  app.post('/api/admin/posts/:id/votes',async c=>{const p=z.object({userId:z.string()}).parse(await c.req.json());await db.run('INSERT OR IGNORE INTO votes(post_id,user_id,created) VALUES(?,?,?)',[c.req.param('id'),p.userId,now()]);return c.json({ok:true});});
  app.delete('/api/admin/posts/:id/votes/:userId',async c=>{await db.run('DELETE FROM votes WHERE post_id=? AND user_id=?',[c.req.param('id'),c.req.param('userId')]);return c.json({ok:true});});
  app.get('/api/admin/keys',async c=>c.json(await db.all("SELECT id,name,expires FROM credentials WHERE kind='api'")));
  app.post('/api/admin/keys',async c=>{const p=z.object({name:z.string().min(1).max(100)}).parse(await c.req.json());const token=id()+id(),keyId=id();await db.run('INSERT INTO credentials(id,name,hash,kind) VALUES(?,?,?,?)',[keyId,p.name,await hash(token),'api']);return c.json({id:keyId,token},201);});
  app.delete('/api/admin/keys/:id',async c=>{await db.run("DELETE FROM credentials WHERE id=? AND kind='api'",[c.req.param('id')]);return c.json({ok:true});});
  app.post('/mcp',async c=>{
    if(!c.get('admin'))return c.json({error:'API key required'},401);
    const protocol=c.req.header('MCP-Protocol-Version');if(protocol&&!['2025-03-26','2025-06-18'].includes(protocol))return c.json({error:'Unsupported MCP protocol version'},400);
    let body;try{body=await c.req.json();}catch{return c.json({jsonrpc:'2.0',id:null,error:{code:-32700,message:'Parse error'}},400);}
    const result=await rpc(service,body);return result?c.json(result):c.body(null,202);
  });
  app.get('/mcp',c=>c.json({error:'Use stateless Streamable HTTP POST'},405));
  app.get('/assets/app.js',c=>c.body(client,200,{'Content-Type':'application/javascript'}));
  app.get('/assets/style.css',c=>c.body(css,200,{'Content-Type':'text/css'}));
  app.get('/widget.js',c=>c.body(widget,200,{'Content-Type':'application/javascript','Cross-Origin-Resource-Policy':'cross-origin'}));
  for(const path of ['/','/roadmap','/changelog','/admin','/widget','/posts/:id'])app.get(path,c=>c.html(html));
  return app;
}
