import type { Storage,Statement } from '../../feedback/src/storage.ts';
import { id,now } from '../../feedback/src/auth.ts';
import { definition,walk,fail } from './definition.ts';
export function webhookURL(input:string){const url=new URL(input);if(url.protocol!=='https:'||url.username||url.password||url.port&&url.port!=='443'||!url.hostname.includes('.')||url.hostname.endsWith('.')||/(?:^|\.)(?:localhost|local|internal|test|invalid)$/.test(url.hostname)||/^[\d.]+$/.test(url.hostname)||url.hostname.includes(':'))fail('Webhooks require a public HTTPS hostname on port 443.');url.hash='';return url.href;}
export class Forms {
  constructor(public db:Storage,public tenant:string){}
  async list(){return this.db.all('SELECT id,title,version,created,updated,published IS NOT NULL AS live FROM forms_forms WHERE tenant_id=? ORDER BY updated DESC LIMIT 200',[this.tenant]);}
  async get(formId:string){const row=await this.db.get('SELECT * FROM forms_forms WHERE tenant_id=? AND id=?',[this.tenant,formId]);return row?{...row,draft:JSON.parse(row.draft),published:row.published?JSON.parse(row.published):null,source_json:row.source_json?JSON.parse(row.source_json):null}:undefined;}
  async save(input:unknown,formId=id(),source?:{id:string;definition:unknown}){const d=definition(input),time=now();const existing=await this.get(formId);if(!existing&&(!/^[A-Za-z0-9_-]{1,120}$/.test(formId)))fail('Invalid form reference.');await this.db.run('INSERT INTO forms_forms(tenant_id,id,title,draft,source_id,source_json,created,updated) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(tenant_id,id) DO UPDATE SET title=excluded.title,draft=excluded.draft,updated=excluded.updated,source_id=COALESCE(excluded.source_id,forms_forms.source_id),source_json=COALESCE(excluded.source_json,forms_forms.source_json)',[this.tenant,formId,d.title,JSON.stringify(d),source?.id||null,source?JSON.stringify(source.definition):null,time,time]);return this.get(formId);}
  async publish(formId:string){const form=await this.get(formId);if(!form)fail('Form not found');definition(form.draft);const version=form.version+1;await this.db.batch([
    {text:'INSERT INTO forms_versions(tenant_id,form_id,version,definition) VALUES(?,?,?,?)',values:[this.tenant,formId,version,JSON.stringify(form.draft)]},
    {text:'UPDATE forms_forms SET published=?,version=?,updated=? WHERE tenant_id=? AND id=? AND version=?',values:[JSON.stringify(form.draft),version,now(),this.tenant,formId,form.version]}
  ]);return this.get(formId);}
  async archive(formId:string){await this.db.run('UPDATE forms_forms SET published=NULL,updated=? WHERE tenant_id=? AND id=?',[now(),this.tenant,formId]);}
  async publicForm(formId:string){const form=await this.get(formId);if(!form?.published)return undefined;return {id:form.id,title:form.published.title,definition:form.published,version:form.version};}
  async responses(formId:string,limit=100,offset=0){return (await this.db.all('SELECT id,form_id,version,answers,hidden,variables,ending,created FROM forms_responses WHERE tenant_id=? AND form_id=? ORDER BY created DESC LIMIT ? OFFSET ?',[this.tenant,formId,Math.min(Math.max(limit,1),1000),Math.max(offset,0)])).map(r=>({...r,answers:JSON.parse(r.answers),hidden:JSON.parse(r.hidden),variables:JSON.parse(r.variables)}));}
  async submit(formId:string,input:any){const form=await this.publicForm(formId);if(!form)fail('Form not found');if(input.version!==form.version)fail('This form changed. Please reload it before submitting.');if(typeof input.submissionId!=='string'||!/^[a-f0-9-]{36}$/.test(input.submissionId))fail('A valid submission ID is required.');
    const previous=await this.db.get('SELECT id,form_id FROM forms_responses WHERE tenant_id=? AND id=?',[this.tenant,input.submissionId]);if(previous){if(previous.form_id!==formId)fail('Submission ID already used.');return {id:previous.id,duplicate:true};}
    const route=walk(form.definition,input.answers,input.hidden||{});if(!route.done)fail('Please complete the remaining questions.');const responseId=input.submissionId,created=now();
    const payload=JSON.stringify({event_id:responseId,event_type:'form_response',form_id:formId,version:form.version,response:{id:responseId,answers:route.answers,hidden:route.hidden,variables:route.variables,ending:route.ending?.ref,created}});
    const ops:Statement[]=[{text:'INSERT OR IGNORE INTO forms_responses(tenant_id,id,form_id,version,answers,hidden,variables,ending,created) SELECT ?,?,?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM forms_forms WHERE tenant_id=? AND id=? AND published IS NOT NULL AND version=?)',values:[this.tenant,responseId,formId,form.version,JSON.stringify(route.answers),JSON.stringify(route.hidden),JSON.stringify(route.variables),route.ending?.ref||'default',created,this.tenant,formId,form.version]}];
    for(const hook of await this.db.all('SELECT id FROM forms_webhooks WHERE tenant_id=? AND form_id=? AND enabled=1',[this.tenant,formId]))ops.push({text:'INSERT OR IGNORE INTO forms_deliveries(tenant_id,id,hook_id,response_id,payload) SELECT ?,?,?,?,? WHERE EXISTS(SELECT 1 FROM forms_responses WHERE tenant_id=? AND id=?)',values:[this.tenant,id(),hook.id,responseId,payload,this.tenant,responseId]});
    await this.db.batch(ops);if(!await this.db.get('SELECT 1 FROM forms_responses WHERE tenant_id=? AND id=?',[this.tenant,responseId]))fail('This form changed. Please reload it before submitting.');return {id:responseId,ending:route.ending};
  }
  async csv(formId:string){
    const cutoff=now(),versions=await this.db.all('SELECT definition FROM forms_versions WHERE tenant_id=? AND form_id=? ORDER BY version',[this.tenant,formId]);
    const keys=[...new Set<string>(versions.flatMap(row=>{const d=JSON.parse(row.definition);return [...d.fields.map((f:any)=>'answer:'+f.ref),...d.hidden.map((k:string)=>'hidden:'+k),...Object.keys(d.variables).map(k=>'variable:'+k)];}))];
    const cell=(value:any)=>{let s=Array.isArray(value)?value.join('; '):value===null||value===undefined?'':String(value);if(/^[\s]*[=+\-@\t\r]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';};
    const encode=(row:any[])=>new TextEncoder().encode(row.map(cell).join(',')+'\r\n');
    let cursorTime=cutoff,cursorId='~';const service=this;
    return new ReadableStream<Uint8Array>({
      start(controller){controller.enqueue(encode(['id','created','version','ending',...keys]));},
      async pull(controller){try{
        const rows=await service.db.all('SELECT id,created,version,ending,answers,hidden,variables FROM forms_responses WHERE tenant_id=? AND form_id=? AND created<=? AND (created<? OR (created=? AND id<?)) ORDER BY created DESC,id DESC LIMIT 1000',[service.tenant,formId,cutoff,cursorTime,cursorTime,cursorId]);
        for(const r of rows){const answers=JSON.parse(r.answers),hidden=JSON.parse(r.hidden),variables=JSON.parse(r.variables);controller.enqueue(encode([r.id,r.created,r.version,r.ending,...keys.map(k=>{const [group,...parts]=k.split(':');return (group==='answer'?answers:group==='hidden'?hidden:variables)[parts.join(':')];})]));}
        if(rows.length<1000)controller.close();else{cursorTime=rows.at(-1)!.created;cursorId=rows.at(-1)!.id;}
      }catch{controller.error(Error('Response export could not complete.'));}}
    });
  }
  async hooks(formId:string){return this.db.all('SELECT id,form_id,url,enabled,created FROM forms_webhooks WHERE tenant_id=? AND form_id=?',[this.tenant,formId]);}
  async addHook(formId:string,url:string){if(!await this.get(formId))fail('Form not found');const secret=id()+id(),hookId=id();await this.db.run('INSERT INTO forms_webhooks(tenant_id,id,form_id,url,secret,created) VALUES(?,?,?,?,?,?)',[this.tenant,hookId,formId,webhookURL(url),secret,now()]);return {id:hookId,secret};}
  async deliveries(formId:string){return this.db.all('SELECT d.id,d.response_id,d.attempts,d.next_at,d.sent,d.last_status FROM forms_deliveries d JOIN forms_webhooks h ON h.tenant_id=d.tenant_id AND h.id=d.hook_id WHERE d.tenant_id=? AND h.form_id=? ORDER BY d.next_at DESC LIMIT 100',[this.tenant,formId]);}
}
