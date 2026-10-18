import { cpSync,mkdirSync,readFileSync,writeFileSync,existsSync,rmSync } from 'node:fs';
import { resolve,dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const pkg=JSON.parse(readFileSync(resolve(root,'package.json'),'utf8'));
const lock=JSON.parse(readFileSync(resolve(root,'package-lock.json'),'utf8'));
const cli=resolve(root,'packages/cli'),runtime=resolve(cli,'runtime');
// Only generated, ignored release output is replaced. No checkout/history changes.
rmSync(runtime,{recursive:true,force:true});mkdirSync(runtime,{recursive:true});
const dependencies=Object.fromEntries(Object.keys(pkg.dependencies).map(name=>[name,lock.packages['node_modules/'+name].version]));
writeFileSync(resolve(runtime,'package.json'),JSON.stringify({name:'dupes-app-runtime',private:true,type:'module',license:'AGPL-3.0-only',dependencies,engines:{node:'>=22'}},null,2)+'\n');
for(const name of ['feedback','forms'])if(existsSync(resolve(root,'dupes',name)))cpSync(resolve(root,'dupes',name),resolve(runtime,'dupes',name),{recursive:true,filter:p=>!p.includes('node_modules')&&!p.includes('.sqlite')});
for(const name of ['LICENSE','NOTICE','TRADEMARKS.md'])cpSync(resolve(root,name),resolve(runtime,name));
if(existsSync(resolve(root,'fixtures')))cpSync(resolve(root,'fixtures'),resolve(runtime,'fixtures'),{recursive:true});
writeFileSync(resolve(runtime,'Dockerfile'),'FROM node:22-bookworm-slim\nWORKDIR /app\nCOPY package.json ./\nRUN npm install --omit=dev\nCOPY . .\nRUN mkdir /data && chown node:node /data\nUSER node\nENV DATA_DIR=/data HOST=0.0.0.0 PORT=3000\nVOLUME /data\nEXPOSE 3000\nCMD ["node","--import","tsx","dupes/feedback/src/node.ts"]\n');
if(process.argv.includes('--runtime-only')){console.log('Prepared bundled application source (AGPL-3.0-only).');process.exit(0);}
const output=resolve(root,'release');mkdirSync(output,{recursive:true});
const packed=spawnSync('npm',['pack','--ignore-scripts','--json','--pack-destination',output],{cwd:cli,encoding:'utf8'});
if(packed.status!==0)throw Error('CLI packaging failed; nothing published.');
const info=JSON.parse(packed.stdout)[0],archive=resolve(output,info.filename);
const commit=spawnSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).stdout.trim();
writeFileSync(resolve(output,'manifest.json'),JSON.stringify({package:info.id,file:info.filename,sha256:createHash('sha256').update(readFileSync(archive)).digest('hex'),commit,published:false,files:info.files.map(f=>f.path)},null,2)+'\n');
console.log('Release prepared: release/'+info.filename+'\nSource commit: '+commit+'\nNothing published. After Brian approves, run npm run release:publish -- --approved-by-brian.');
