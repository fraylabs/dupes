import { serve } from '@hono/node-server';
import { mkdirSync, existsSync, writeFileSync, readFileSync, chmodSync } from 'node:fs';
import { resolve } from 'node:path';
import { openStorage } from './node-storage.ts';
import { passwordHash, id } from './auth.ts';
import { createApp } from './app.ts';

const dir=resolve(process.env.DATA_DIR||'data');mkdirSync(dir,{recursive:true,mode:0o700});
const db=openStorage(resolve(dir,'feedback.sqlite'));
const passwordFile=resolve(dir,'admin-password');
if(!await db.get("SELECT 1 FROM settings WHERE key='admin_password'")) {
  const password=process.env.ADMIN_PASSWORD||(existsSync(passwordFile)?readFileSync(passwordFile,'utf8').trim():id()+id());
  if(password.length<12)throw Error('ADMIN_PASSWORD must have at least 12 characters');
  if(!process.env.ADMIN_PASSWORD)writeFileSync(passwordFile,password+'\n',{mode:0o600});
  await db.run("INSERT INTO settings(key,value) VALUES('admin_password',?)",[await passwordHash(password)]);
}
chmodSync(resolve(dir,'feedback.sqlite'),0o600);
if(!await db.get('SELECT 1 FROM boards'))await db.run('INSERT INTO boards(id,name,description) VALUES(?,?,?)',['ideas','Feature requests','What would make this product better for you? Share an idea or vote for one you love.']);
const app=createApp(db,{ssoSecret:process.env.SSO_SECRET,siteName:process.env.SITE_NAME,publicOrigin:process.env.PUBLIC_ORIGIN});
const port=Number(process.env.PORT||3000),hostname=process.env.HOST||'127.0.0.1';
const server=serve({fetch:app.fetch,port,hostname},()=>console.log('Feedback is ready at '+(process.env.PUBLIC_ORIGIN||'http://'+hostname+':'+port)+'\nAdmin password: your private data folder / admin-password (or your configured ADMIN_PASSWORD).'));
let mailing=false;
const timer=setInterval(async()=>{
  if(mailing||!process.env.RESEND_API_KEY||!process.env.EMAIL_FROM)return;mailing=true;
  try {
    const queued=await db.all('SELECT n.entry_id,n.user_id,u.email,e.title,e.body FROM notifications n JOIN users u ON u.id=n.user_id JOIN changelog e ON e.id=n.entry_id WHERE n.sent=0 AND u.verified=1 AND u.email IS NOT NULL AND e.published=1 LIMIT 20');
    for(const n of queued) {
      const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+process.env.RESEND_API_KEY,'Content-Type':'application/json','Idempotency-Key':'feedback/'+n.entry_id+'/'+n.user_id},body:JSON.stringify({from:process.env.EMAIL_FROM,to:[n.email],subject:n.title,text:n.body}),signal:AbortSignal.timeout(15000)});
      if(response.ok)await db.run('UPDATE notifications SET sent=1 WHERE entry_id=? AND user_id=?',[n.entry_id,n.user_id]);
      else console.error('Email delivery deferred (HTTP '+response.status+').');
    }
  }catch {console.error('Email delivery deferred.');}finally {mailing=false;}
},30000);
const stop=()=>{clearInterval(timer);server.close(()=>process.exit(0));};process.once('SIGTERM',stop);process.once('SIGINT',stop);
