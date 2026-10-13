import type { Storage, Statement } from './storage.ts';
import { id, now } from './auth.ts';
import { z } from 'zod';
export const statuses=['open','under review','planned','in progress','complete','closed'] as const;
export const statusSchema=z.enum(statuses);
export const postSchema=z.object({boardId:z.string().min(1),title:z.string().trim().min(1).max(200),details:z.string().max(20000).default('')});
export const entrySchema=z.object({title:z.string().trim().min(1).max(200),body:z.string().min(1).max(50000),type:z.enum(['new','improved','fixed']).default('new'),postIds:z.array(z.string()).max(100).default([]),published:z.boolean().default(true)});
export class Feedback {
  constructor(public db:Storage){}
  async posts(filters:{board?:string;status?:string;q?:string;sort?:string;limit?:number;offset?:number}={},admin=false) {
    const clauses=['p.merged_into IS NULL'];const params:unknown[]=[];
    if(!admin)clauses.push('b.private=0');
    if(filters.board){clauses.push('p.board_id=?');params.push(filters.board);}
    if(filters.status){clauses.push('p.status=?');params.push(statusSchema.parse(filters.status));}
    if(filters.q){clauses.push('(p.title LIKE ? ESCAPE \'\\\' OR p.details LIKE ? ESCAPE \'\\\')');const q='%'+filters.q.replace(/[\\%_]/g,'\\$&')+'%';params.push(q,q);}
    const order=filters.sort==='new'?'p.created DESC':'votes DESC,p.created DESC';
    params.push(Math.min(Math.max(filters.limit||50,1),200),Math.max(filters.offset||0,0));
    const rows=await this.db.all(`SELECT p.*,b.name board_name,u.name author_name,p.imported_votes+(SELECT count(*) FROM votes WHERE post_id=p.id) votes,(SELECT count(*) FROM comments WHERE post_id=p.id AND private=0) comments FROM posts p JOIN boards b ON b.id=p.board_id LEFT JOIN users u ON u.id=p.author_id WHERE ${clauses.join(' AND ')} ORDER BY ${order} LIMIT ? OFFSET ?`,params);
    for(const row of rows)row.tags=await this.db.all('SELECT t.* FROM tags t JOIN post_tags pt ON pt.tag_id=t.id WHERE pt.post_id=?',[row.id]);
    return rows;
  }
  async post(postId:string,admin=false) {
    const row=await this.db.get('SELECT p.*,b.private,b.private_comments,u.name author_name,p.imported_votes+(SELECT count(*) FROM votes WHERE post_id=p.id) votes FROM posts p JOIN boards b ON b.id=p.board_id LEFT JOIN users u ON u.id=p.author_id WHERE p.id=?',[postId]);
    if(!row||(!admin&&row.private))return undefined;
    row.tags=await this.db.all('SELECT t.* FROM tags t JOIN post_tags pt ON pt.tag_id=t.id WHERE pt.post_id=?',[postId]);return row;
  }
  async createPost(input:unknown,userId:string|null,admin=false) {
    const p=postSchema.parse(input);const board=await this.db.get('SELECT * FROM boards WHERE id=?',[p.boardId]);
    if(!board||(!admin&&board.private))throw new Error('Board not found');
    const postId=id();await this.db.run('INSERT INTO posts(id,board_id,author_id,title,details,created) VALUES(?,?,?,?,?,?)',[postId,p.boardId,userId,p.title,p.details,now()]);return this.post(postId,admin);
  }
  async updateStatus(postId:string,status:unknown) {const p=await this.post(postId,true);if(!p)throw new Error('Post not found');if(p.merged_into)throw new Error('Post is merged');await this.db.run('UPDATE posts SET status=? WHERE id=?',[statusSchema.parse(status),postId]);return this.post(postId,true);}
  async merge(source:string,target:string) {
    const a=await this.post(source,true),b=await this.post(target,true);
    if(!a||!b||source===target||a.merged_into||b.merged_into||a.board_id!==b.board_id)throw new Error('Merge requires two active posts on the same board');
    // Every statement checks eligibility inside the atomic batch, so concurrent merges
    // cannot double-add historical votes or move a second request to a stale target.
    const active='EXISTS(SELECT 1 FROM posts s JOIN posts t ON t.id=? WHERE s.id=? AND s.merged_into IS NULL AND t.merged_into IS NULL)';
    const condition=[target,source];
    await this.db.batch([
      {text:`INSERT OR IGNORE INTO votes(post_id,user_id,created) SELECT ?,user_id,created FROM votes WHERE post_id=? AND ${active}`,values:[target,source,...condition]},
      {text:`DELETE FROM votes WHERE post_id=? AND ${active}`,values:[source,...condition]},
      {text:`UPDATE comments SET post_id=? WHERE post_id=? AND ${active}`,values:[target,source,...condition]},
      {text:`INSERT OR IGNORE INTO post_tags(post_id,tag_id) SELECT ?,tag_id FROM post_tags WHERE post_id=? AND ${active}`,values:[target,source,...condition]},
      {text:`INSERT OR IGNORE INTO changelog_posts(entry_id,post_id) SELECT entry_id,? FROM changelog_posts WHERE post_id=? AND ${active}`,values:[target,source,...condition]},
      {text:`DELETE FROM changelog_posts WHERE post_id=? AND ${active}`,values:[source,...condition]},
      {text:`UPDATE posts SET imported_votes=imported_votes+(SELECT imported_votes FROM posts WHERE id=?) WHERE id=? AND ${active}`,values:[source,target,...condition]},
      {text:`UPDATE posts SET merged_into=?,imported_votes=0 WHERE id=? AND ${active}`,values:[target,source,...condition]}
    ]);
    if((await this.post(source,true))?.merged_into!==target)throw new Error('Post was merged by another request');
    return this.post(target,true);
  }
  async entries(admin=false) {
    const rows=await this.db.all(`SELECT * FROM changelog ${admin?'':'WHERE published=1'} ORDER BY created DESC LIMIT 200`);
    for(const row of rows)row.posts=await this.db.all(`SELECT p.id,p.title,p.status FROM posts p JOIN changelog_posts cp ON cp.post_id=p.id JOIN boards b ON b.id=p.board_id WHERE cp.entry_id=? ${admin?'':'AND b.private=0'}`,[row.id]);return rows;
  }
  async createEntry(input:unknown) {
    const e=entrySchema.parse(input);const entryId=id();
    for(const postId of e.postIds)if(!await this.post(postId,true))throw new Error('Linked post not found');
    const statements:Statement[]=[{text:'INSERT INTO changelog(id,title,body,type,published,created) VALUES(?,?,?,?,?,?)',values:[entryId,e.title,e.body,e.type,e.published?1:0,now()]}];
    for(const postId of new Set(e.postIds))statements.push({text:'INSERT INTO changelog_posts(entry_id,post_id) VALUES(?,?)',values:[entryId,postId]});
    if(e.published)for(const postId of new Set(e.postIds))statements.push({text:'INSERT OR IGNORE INTO notifications(entry_id,user_id) SELECT ?,user_id FROM votes WHERE post_id=?',values:[entryId,postId]});
    await this.db.batch(statements);return {id:entryId,...e};
  }
}
