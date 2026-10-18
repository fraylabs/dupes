import { resolve } from 'node:path';
import { readFileSync,mkdirSync } from 'node:fs';
import { openStorage } from '../../feedback/src/node-storage.ts';
import { formsMigrations } from './schema.ts';
import { Forms } from './service.ts';
import { downloadTypeform,importTypeform } from './importer.ts';
const args=process.argv.slice(2),opt=(key:string)=>{const i=args.indexOf(key);return i<0?undefined:args[i+1];};
try{const fixture=opt('--fixture'),source=fixture?JSON.parse(readFileSync(resolve(fixture),'utf8')):await downloadTypeform(opt('--form')||'',process.env.TYPEFORM_API_KEY||'');const dir=resolve(process.env.DATA_DIR||'data/forms');mkdirSync(dir,{recursive:true,mode:0o700});const service=new Forms(openStorage(resolve(dir,'forms.sqlite'),formsMigrations),'self');const form=await importTypeform(service,source);console.log('Imported form '+form!.id+' as a draft; '+form!.draft.fields.length+' questions and '+form!.draft.logic.length+' logic rules retained. Publish it after reviewing.');}catch{console.error('Import could not be completed. Check the definition, supported logic and private Typeform key. Nothing was published.');process.exitCode=1;}
