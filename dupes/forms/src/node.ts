import { serve } from '@hono/node-server';
import { mkdirSync,existsSync,readFileSync,writeFileSync,chmodSync } from 'node:fs';
import { resolve } from 'node:path';
import { openStorage } from '../../feedback/src/node-storage.ts';
import { hash,id } from '../../feedback/src/auth.ts';
import { formsMigrations } from './schema.ts';
import { createFormsApp } from './app.ts';
import { deliverPending } from './webhooks.ts';
import { nodeDelivery } from './node-webhooks.ts';
const tenant='self',dir=resolve(process.env.DATA_DIR||'data/forms');mkdirSync(dir,{recursive:true,mode:0o700});
const db=openStorage(resolve(dir,'forms.sqlite'),formsMigrations);
await db.run('CREATE TABLE IF NOT EXISTS forms_settings(tenant_id TEXT NOT NULL,key TEXT NOT NULL,value TEXT NOT NULL,PRIMARY KEY(tenant_id,key))');
if(!await db.get("SELECT 1 FROM forms_settings WHERE tenant_id=? AND key='initialized'",[tenant])){
  const file=resolve(dir,'admin-api-key'),key=process.env.ADMIN_API_KEY||(existsSync(file)?readFileSync(file,'utf8').trim():id()+id());if(key.length<32)throw Error('ADMIN_API_KEY must have at least 32 characters.');if(!process.env.ADMIN_API_KEY)writeFileSync(file,key+'\n',{mode:0o600});
  await db.batch([{text:'INSERT INTO forms_credentials(tenant_id,id,hash,kind) VALUES(?,?,?,?)',values:[tenant,id(),await hash(key),'api']},{text:"INSERT INTO forms_settings(tenant_id,key,value) VALUES(?,'initialized','1')",values:[tenant]}]);
}
chmodSync(resolve(dir,'forms.sqlite'),0o600);
const active=new Set<Promise<unknown>>();const background=(p:Promise<unknown>)=>{active.add(p);p.catch(()=>{}).finally(()=>active.delete(p));};
const app=createFormsApp(db,{tenant,siteName:process.env.SITE_NAME,publicOrigin:process.env.PUBLIC_ORIGIN,sendWebhook:nodeDelivery,background});
const port=Number(process.env.PORT||3000),hostname=process.env.HOST||'127.0.0.1';
const server=serve({fetch:app.fetch,port,hostname},()=>console.log('Forms is ready at '+(process.env.PUBLIC_ORIGIN||'http://'+hostname+':'+port)+'\nSign in with your private data folder / admin-api-key (or configured ADMIN_API_KEY).'));
let delivering=false;const timer=setInterval(()=>{if(delivering)return;delivering=true;background(deliverPending(db,tenant,nodeDelivery).finally(()=>{delivering=false;}));},30000);
function stop(){clearInterval(timer);server.close(()=>{Promise.allSettled([...active]).finally(()=>process.exit(0));});}process.once('SIGTERM',stop);process.once('SIGINT',stop);
