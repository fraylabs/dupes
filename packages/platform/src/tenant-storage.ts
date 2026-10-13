import type { Storage, Statement } from '../../../dupes/feedback/src/storage.ts';

// This adapter accepts only the closed SQL grammar used by Feedback. Never pass
// client-supplied SQL to it. Reads use tenant-filtered CTEs; all mutation targets,
// conflict keys and foreign keys include tenant_id. The core stays identical.
export const tenantTables: Record<string,string> = {
  boards:'id,name,description,private,private_comments',
  users:'id,name,email,external_id,verified',
  tags:'id,board_id,name,kind,parent_id',
  posts:'id,board_id,author_id,title,details,status,imported_votes,merged_into,created',
  post_tags:'post_id,tag_id', votes:'post_id,user_id,created',
  comments:'id,post_id,user_id,body,admin,private,created',
  changelog:'id,title,body,type,published,created',
  changelog_posts:'entry_id,post_id', credentials:'id,name,hash,kind,user_id,expires',
  settings:'key,value', notifications:'entry_id,user_id,sent'
};
export function tenantStatement(tenant:string,statement:Statement):Statement {
  let text=statement.text,values=statement.values||[];
  const table=(name:string)=>{if(!Object.hasOwn(tenantTables,name))throw Error('Unknown tenant table');return 'hosted_'+name;};
  if(/^INSERT /i.test(text)) {
    const match=text.match(/^INSERT( OR IGNORE)? INTO (\w+)\(([^)]+)\) (VALUES\(|SELECT )/i);
    if(!match)throw Error('Unsupported tenant insert');
    text=text.replace(match[0],`INSERT${match[1]||''} INTO ${table(match[2])}(tenant_id,${match[3]}) ${match[4]}?,`);
    text=text.replace(/ON CONFLICT\(([^)]+)\)/g,'ON CONFLICT(tenant_id,$1)');
    values=[tenant,...values];
  }else if(/^UPDATE /i.test(text)) {
    const match=text.match(/^UPDATE (\w+) SET /i);
    if(!match)throw Error('Unsupported tenant update');
    // Insert the tenant bind at the original outer WHERE position, after SET binds.
    const where=outerWhere(text);if(where<0)throw Error('Unbounded tenant update refused');
    const before=text.slice(0,where),after=text.slice(where+6);
    const binds=countBinds(before);
    text=before.replace(/^UPDATE (\w+)/,(_,name)=>'UPDATE '+table(name))+' WHERE tenant_id=? AND ('+after+')';
    values=[...values.slice(0,binds),tenant,...values.slice(binds)];
  }else if(/^DELETE FROM /i.test(text)) {
    const match=text.match(/^DELETE FROM (\w+) WHERE /i);if(!match)throw Error('Unbounded tenant deletion refused');
    text=text.replace(match[0],`DELETE FROM ${table(match[1])} WHERE tenant_id=? AND (`)+')';values=[tenant,...values];
  }else if(!/^SELECT /i.test(text))throw Error('Unsupported tenant SQL');
  const referenced=new Set<string>();
  for(const match of text.matchAll(/\b(?:FROM|JOIN) (\w+)/gi))if(Object.hasOwn(tenantTables,match[1]))referenced.add(match[1]);
  if(referenced.size){text='WITH '+[...referenced].map(name=>`${name} AS (SELECT ${tenantTables[name]} FROM hosted_${name} WHERE tenant_id=?)`).join(',')+' '+text;values=[...[...referenced].map(()=>tenant),...values];}
  return {text,values};
}
function scan(text:string,visit:(char:string,index:number,depth:number)=>void) {
  let depth=0,quote='';for(let i=0;i<text.length;i++) {const char=text[i];if(quote){if(char===quote){if(text[i+1]===quote)i++;else quote='';}continue;}if(char==="'"||char==='"'||char==='`'){quote=char;continue;}if(char==='(')depth++;if(char===')')depth--;visit(char,i,depth);}
}
function outerWhere(text:string){let found=-1;scan(text,(char,i,depth)=>{if(found<0&&depth===0&&text.slice(i,i+7)===' WHERE ')found=i;});return found;}
function countBinds(text:string){let count=0;scan(text,char=>{if(char==='?')count++;});return count;}
export function tenantStorage(db:Storage,tenant:string):Storage {
  const scoped=(text:string,values:unknown[]=[])=>tenantStatement(tenant,{text,values});
  return {
    async all<T>(text:string,values:unknown[]=[]) {const q=scoped(text,values);return db.all<T>(q.text,q.values);},
    async get<T>(text:string,values:unknown[]=[]) {const q=scoped(text,values);return db.get<T>(q.text,q.values);},
    async run(text,values=[]) {const q=scoped(text,values);await db.run(q.text,q.values);},
    async batch(statements) {await db.batch(statements.map(q=>tenantStatement(tenant,q)));}
  };
}
