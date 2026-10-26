import { readFileSync } from 'node:fs';
import { resolve,dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
if(!process.argv.includes('--confirm'))throw Error('Pass --confirm to publish. This script has not published anything.');
const remote=process.env.DUPES_PUBLIC_GIT_REMOTE;
if(!remote||!/^git@github\.com:[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\.git$/.test(remote))throw Error('Set DUPES_PUBLIC_GIT_REMOTE to the repository SSH URL.');
function run(bin,args,options={}){const r=spawnSync(bin,args,{cwd:root,encoding:'utf8',...options});if(r.status!==0)throw Error(bin+' failed; reconcile its remote state before retrying.');return r.stdout?.trim();}
const manifest=JSON.parse(readFileSync(resolve(root,'release/manifest.json'),'utf8'));
if(manifest.commit!==run('git',['rev-parse','HEAD'])||run('git',['status','--porcelain']))throw Error('Prepare a release from the current clean commit first.');
const archive=resolve(root,'release',manifest.file);
if(createHash('sha256').update(readFileSync(archive)).digest('hex')!==manifest.sha256)throw Error('Release archive changed; prepare it again.');
const login=process.env.DUPES_PUBLISH_GH_LOGIN;
if(login&&JSON.parse(run('gh',['api','user'])).login!==login)throw Error('GitHub writes must authenticate as '+login+'.');
// The public repository and npm scope must already exist. Never create accounts.
run('git',['push',remote,'HEAD:refs/heads/main'],{stdio:'inherit'});
run('npm',['publish',archive,'--access','public'],{stdio:'inherit'});
console.log('Source and prepared CLI published.');
