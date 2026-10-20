import type { Storage,Statement } from '../../../dupes/feedback/src/storage.ts';
import { id } from '../../../dupes/feedback/src/auth.ts';

export const DEMO_ID='demo';
// Original fictional examples, not imported customer content. All displayed
// historical vote totals and comments are explicitly labelled sample data.
export const demoPosts=[
  ['weekly-digest','A weekly digest of what changed','One short email with the requests our team follows and what shipped.','planned',64],
  ['dark-appearance','A calmer view after sunset','A dark appearance for late evening planning sessions.','in progress',48],
  ['csv-export','Download requests as a CSV','Bring request titles, vote totals and statuses into our own reports.','complete',91],
  ['pin-announcement','Pin a welcome note to a board','Help new visitors understand what this board is for.','open',23],
  ['keyboard-shortcuts','Move through requests with the keyboard','Quickly move between a list of requests and their details.','under review',35],
  ['follow-tags','Follow a topic across boards','Keep track of accessibility requests in one place.','planned',52],
  ['mobile-voting','Make voting easier on small screens','A larger vote button when reading on the train.','complete',37],
  ['release-filters','Filter the changelog by improvement type','Find fixes separately from new features.','open',17]
] as const;
export async function resetDemo(db:Storage,day=new Date().toISOString().slice(0,10)) {
  const state=await db.get('SELECT reset_day FROM demo_state WHERE id=?',[DEMO_ID]);
  if(state?.reset_day>=day)return false;
  const token=id(),stamp=day+'T00:00:00.000Z';
  const guard='EXISTS(SELECT 1 FROM demo_state WHERE id=? AND reset_day=? AND reset_token=?)',g=[DEMO_ID,day,token];
  const ops:Statement[]=[{text:'UPDATE demo_state SET reset_day=?,reset_token=? WHERE id=? AND reset_day<?',values:[day,token,DEMO_ID,day]}];
  for(const table of ['notifications','credentials','changelog_posts','post_tags','comments','votes','posts','tags','changelog','users','boards','settings'])ops.push({text:`DELETE FROM hosted_${table} WHERE tenant_id=? AND ${guard}`,values:[DEMO_ID,...g]});
  const insert=(table:string,columns:string,values:unknown[])=>ops.push({text:`INSERT INTO ${table}(${columns}) SELECT ${values.map(()=>'?').join(',')} WHERE ${guard}`,values:[...values,...g]});
  // Existing demo registration survives daily resets. Its reserved owner has no key.
  ops.push({text:`INSERT OR IGNORE INTO instances(id,owner_hash,app,name,created) SELECT ?,?,?,?,? WHERE ${guard}`,values:[DEMO_ID,'public-demo-reserved','feedback','Feedback demo',stamp,...g]});
  insert('hosted_boards','tenant_id,id,name,description',[DEMO_ID,'ideas','Product ideas','Fictional sample requests. Try posting, voting and commenting; this demo resets daily.']);
  for(const [user,name]of [['sample-maya','Maya (sample)'],['sample-noah','Noah (sample)'],['sample-rin','Rin (sample)']])insert('hosted_users','tenant_id,id,name',[DEMO_ID,user,name]);
  for(const [post,title,details,status,votes]of demoPosts)insert('hosted_posts','tenant_id,id,board_id,author_id,title,details,status,imported_votes,created',[DEMO_ID,post,'ideas','sample-maya',title,details,status,votes,stamp]);
  for(const [comment,post,user,body,admin]of [
    ['sample-comment-1','weekly-digest','sample-noah','A Friday summary would help us plan the following week.',0],
    ['sample-comment-2','weekly-digest','sample-rin','We have this planned. Which day would work best for you?',1],
    ['sample-comment-3','dark-appearance','sample-noah','Please keep contrast high for small text.',0],
    ['sample-comment-4','csv-export','sample-rin','Sample reply: this request is complete in our fictional product.',1]
  ])insert('hosted_comments','tenant_id,id,post_id,user_id,body,admin,created',[DEMO_ID,comment,post,user,body,admin,stamp]);
  for(const [entry,title,body,post]of [
    ['sample-release-csv','Your feedback, ready for a spreadsheet','Sample release: export a board and work with your requests in your own tools.','csv-export'],
    ['sample-release-mobile','A little more room to vote','Sample release: the voting control is easier to reach on a small screen.','mobile-voting']
  ]){insert('hosted_changelog','tenant_id,id,title,body,type,published,created',[DEMO_ID,entry,title,body,'improved',1,stamp]);insert('hosted_changelog_posts','tenant_id,entry_id,post_id',[DEMO_ID,entry,post]);}
  await db.batch(ops);
  return true;
}
export async function publicMaintenance(db:Storage) {
  await resetDemo(db);
  await db.run('DELETE FROM public_rate_limits WHERE expires<=?',[Date.now()]);
}
