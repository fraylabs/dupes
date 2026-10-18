#!/usr/bin/env node
import { spawn,spawnSync } from 'node:child_process';
import { existsSync,mkdirSync,writeFileSync,chmodSync } from 'node:fs';
import { resolve,dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const bundledRoot=resolve(dirname(fileURLToPath(import.meta.url)),'../runtime');
const bundled=existsSync(resolve(bundledRoot,'package.json'));
const root=bundled?bundledRoot:resolve(dirname(fileURLToPath(import.meta.url)),'../../..');
const require=createRequire(resolve(root,'package.json'));
const args=process.argv.slice(2),[command,product]=args;
const appId=['forms','typeform'].includes(product)?'forms':'feedback',appName=appId==='forms'?'Forms':'Feedback',imageTag='dupes-'+appId+':local';
const opt=name=>{const i=args.indexOf(name);if(i<0)return undefined;if(!args[i+1]||args[i+1].startsWith('--'))throw Error(name+' needs a value');return args[i+1];};
const data=resolve(process.env.DATA_DIR||(bundled?resolve(process.cwd(),appId+'-data'):resolve(root,appId==='forms'?'data/forms':'data')));
const port=process.env.PORT||'3000';
const run=(bin,params,options={})=>{const r=spawnSync(bin,params,{cwd:root,stdio:'inherit',...options});if(r.error)throw Error('Could not run '+bin);if(r.status!==0)process.exit(r.status||1);};
const docker=()=>!args.includes('--node')&&spawnSync('docker',['info'],{stdio:'ignore'}).status===0;
function image(){run('docker',['build','-t',imageTag,root]);}
function ensureNode(){try{require.resolve('tsx');}catch{console.log('Preparing application dependencies…');run('npm',[existsSync(resolve(root,'package-lock.json'))?'ci':'install']);}}
function node(script,params=[],env={}) {ensureNode();const child=spawn(process.execPath,['--import',require.resolve('tsx'),resolve(root,script),...params],{cwd:root,stdio:'inherit',env:{...process.env,DATA_DIR:data,...env}});for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>child.kill(signal));child.on('error',()=>{console.error('Could not start application');process.exit(1);});child.on('exit',(code,signal)=>process.exit(code??(signal?130:1)));}
function dockerArgs(){mkdirSync(data,{recursive:true,mode:0o700});return ['run','--rm','--init',...(process.getuid?['--user',process.getuid()+':'+process.getgid()]:[]),'-v',data+':/data'];}
try {
  if(command==='list'){console.log('feedback   Boards, voting, roadmap, changelog, REST + MCP.\nforms      One question at a time, branching, responses, webhooks, REST + MCP.');}
  else if(command==='up'&&['feedback','forms'].includes(product)) {
    if(args.includes('--hosted')) {
      const platform=opt('--platform')||process.env.DUPES_PLATFORM_URL;
      const apiKey=process.env.DUPES_PLATFORM_API_KEY;
      if(!platform||!apiKey)throw Error('Set DUPES_PLATFORM_URL and DUPES_PLATFORM_API_KEY privately.');
      const url=new URL(platform);if(url.protocol!=='https:'&&!(url.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(url.hostname)))throw Error('Hosted provisioning requires HTTPS (loopback HTTP allowed for development).');
      const access={...(process.env.CF_ACCESS_CLIENT_ID&&process.env.CF_ACCESS_CLIENT_SECRET?{'CF-Access-Client-Id':process.env.CF_ACCESS_CLIENT_ID,'CF-Access-Client-Secret':process.env.CF_ACCESS_CLIENT_SECRET}:{}),...(process.env.DUPES_PREVIEW_TOKEN?{'X-Dupes-Preview-Token':process.env.DUPES_PREVIEW_TOKEN}:{})};
      const response=await fetch(new URL('/v1/instances',url),{method:'POST',redirect:'error',headers:{Authorization:'Bearer '+apiKey,'Content-Type':'application/json',...access},body:JSON.stringify({app:appId,name:opt('--name')||appName}),signal:AbortSignal.timeout(30000)});
      if(!response.ok)throw Error('Provisioning returned HTTP '+response.status+'. Request was not retried; check your instances before retrying.');
      const instance=await response.json();if(!instance.id||!instance.adminApiKey)throw Error('Provisioning returned an invalid result; check your instances before retrying.');
      mkdirSync(data,{recursive:true,mode:0o700});const file=resolve(data,'hosted-'+instance.id+'.json');writeFileSync(file,JSON.stringify(instance,null,2)+'\n',{mode:0o600,flag:'wx'});chmodSync(file,0o600);
      console.log('Hosted '+appName+': '+instance.url+'\nMCP: '+instance.mcpEndpoint+'\nPrivate admin key saved in '+file);
    }else if(docker()){image();const flags=dockerArgs();flags.push('-p',(process.env.HOST||'127.0.0.1')+':'+port+':3000');for(const name of ['ADMIN_PASSWORD','ADMIN_API_KEY','SSO_SECRET','SITE_NAME','PUBLIC_ORIGIN','RESEND_API_KEY','EMAIL_FROM'])if(process.env[name])flags.push('-e',name);run('docker',[...flags,imageTag,'node','--import','tsx','dupes/'+appId+'/src/node.ts']);}
    else node('dupes/'+appId+'/src/node.ts');
  }else if(command==='import'&&product==='canny') {
    const fixture=opt('--fixture'),key=opt('--key')||process.env.CANNY_API_KEY;
    if(!fixture&&!key)throw Error('Set CANNY_API_KEY, use --key <key>, or --fixture <snapshot.json>.');
    if(docker()) {image();const flags=dockerArgs();if(fixture)flags.push('-v',resolve(fixture)+':/import/snapshot.json:ro');else flags.push('-e','CANNY_API_KEY');run('docker',[...flags,'dupes-feedback:local','node','--import','tsx','dupes/feedback/src/import-cli.ts',...(fixture?['--fixture','/import/snapshot.json']:[])],{env:{...process.env,...(key?{CANNY_API_KEY:key}:{})}});}
    else node('dupes/feedback/src/import-cli.ts',fixture?['--fixture',resolve(fixture)]:[],key?{CANNY_API_KEY:key}:{});
  }else if(command==='import'&&product==='typeform') {
    const fixture=opt('--fixture'),key=opt('--key')||process.env.TYPEFORM_API_KEY,formId=opt('--form');if(!fixture&&(!key||!formId))throw Error('Set TYPEFORM_API_KEY privately and --form <id>, or use --fixture <definition.json>.');
    if(docker()){image();const flags=dockerArgs();if(fixture)flags.push('-v',resolve(fixture)+':/import/definition.json:ro');else flags.push('-e','TYPEFORM_API_KEY');run('docker',[...flags,imageTag,'node','--import','tsx','dupes/forms/src/import-cli.ts',...(fixture?['--fixture','/import/definition.json']:['--form',formId])],{env:{...process.env,...(key?{TYPEFORM_API_KEY:key}:{})}});}
    else node('dupes/forms/src/import-cli.ts',fixture?['--fixture',resolve(fixture)]:['--form',formId],key?{TYPEFORM_API_KEY:key}:{});
  }else if(command==='mcp'&&['feedback','forms'].includes(product)) {
    const url=(opt('--url')||'http://localhost:'+port).replace(/\/$/,'')+'/mcp';const client=opt('--client')||'claude';
    const keyEnv=appId==='forms'?'FORMS_API_KEY':'FEEDBACK_API_KEY';
    if(client==='codex')console.log('[mcp_servers.'+appId+']\nurl = '+JSON.stringify(url)+'\nbearer_token_env_var = '+JSON.stringify(keyEnv)+(process.env.DUPES_PREVIEW_TOKEN?'\nenv_http_headers = { "X-Dupes-Preview-Token" = "DUPES_PREVIEW_TOKEN" }':''));
    else console.log(JSON.stringify({mcpServers:{[appId]:{...(client==='claude'?{type:'http'}:{}),url,headers:{...(process.env.DUPES_PREVIEW_TOKEN?{'X-Dupes-Preview-Token':client==='cursor'?'${env:DUPES_PREVIEW_TOKEN}':'${DUPES_PREVIEW_TOKEN}'}:{}),Authorization:client==='cursor'?'Bearer ${env:'+keyEnv+'}':'Bearer ${'+keyEnv+'}'}}}},null,2));
  }else {console.log('dupe list\ndupe up feedback|forms [--node] [--hosted]\ndupe import canny --fixture <snapshot.json>\ndupe import typeform --form <id> (TYPEFORM_API_KEY privately)\ndupe import typeform --fixture <definition.json>\ndupe mcp feedback|forms [--client claude|codex|cursor] [--url <instance-url>]');if(command)process.exitCode=1;}
}catch(e){console.error(e.message||'Command failed');process.exitCode=1;}
