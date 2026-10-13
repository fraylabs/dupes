import { readFileSync,mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { openStorage } from './node-storage.ts';
import { downloadCanny,importCanny } from './importer.ts';
const args=process.argv.slice(2);const option=(name:string)=>{const i=args.indexOf(name);return i<0?undefined:args[i+1];};
const fixture=option('--fixture'),key=option('--key')||process.env.CANNY_API_KEY;
if(!fixture&&!key){console.error('Use --fixture <snapshot.json> or CANNY_API_KEY (or --key).');process.exit(1);}
try {
  const snapshot=fixture?JSON.parse(readFileSync(resolve(fixture),'utf8')):await downloadCanny(key!);
  const dir=resolve(process.env.DATA_DIR||'data');mkdirSync(dir,{recursive:true,mode:0o700});
  console.log('Imported Canny:',JSON.stringify(await importCanny(openStorage(resolve(dir,'feedback.sqlite')),snapshot)));
}catch(e){console.error(e instanceof Error?e.message:'Import failed');process.exit(1);}
