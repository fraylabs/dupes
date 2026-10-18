import { definition } from './definition.ts';
import { Forms } from './service.ts';
// Only the documented read endpoint is used. Keys stay in the caller's private
// environment; no account, branding or remote media are copied into the app UI.
export async function downloadTypeform(formId:string,key:string){if(!/^[A-Za-z0-9_-]+$/.test(formId)||!key)throw Error('A form ID and private Typeform token are required.');for(let attempt=0;attempt<2;attempt++){const r=await fetch('https://api.typeform.com/forms/'+encodeURIComponent(formId),{headers:{Authorization:'Bearer '+key},redirect:'error',signal:AbortSignal.timeout(30000)});if((r.status===429||r.status>=500)&&attempt===0){await new Promise(resolve=>setTimeout(resolve,Math.min(Number(r.headers.get('retry-after'))||2,30)*1000));continue;}if(!r.ok)throw Error('Typeform returned HTTP '+r.status+'; nothing imported.');return r.json();}throw Error('Import unavailable; nothing imported.');}
export async function importTypeform(service:Forms,source:any){
  if(!source||typeof source.id!=='string')throw Error('The retrieved form definition must include its ID.');
  // Retain the complete original as an admin-only export. Validation rejects
  // unsupported types/actions instead of dropping logic or silently changing it.
  const normalised=definition(source);
  const existing=await service.db.get('SELECT id FROM forms_forms WHERE tenant_id=? AND source_id=?',[service.tenant,'typeform:'+source.id]);
  return service.save(normalised,existing?.id,{id:'typeform:'+source.id,definition:source});
}
