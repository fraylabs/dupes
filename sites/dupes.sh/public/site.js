// Remember only the landing source category for this tab, never a visitor ID.
// Navigation within the site retains it; a new campaign/external entry resets it.
const pageSource=document.querySelector('meta[name="dupes-source"]')?.content||'direct';
let landingSource=pageSource;
try{
  let external=false;try{external=!!document.referrer&&new URL(document.referrer).origin!==location.origin;}catch{}
  const savedSource=sessionStorage.getItem('dupes-landing-source');
  if(new URL(location.href).searchParams.has('utm_source')||external||!savedSource)sessionStorage.setItem('dupes-landing-source',pageSource);
  landingSource=sessionStorage.getItem('dupes-landing-source')||pageSource;
}catch{}
const film=document.querySelector('#demo-film');
if(film){
  // Plays muted only while on screen; reduced-motion visitors start it themselves.
  // Each step is counted once per page load as an anonymous daily total.
  const sent={},track=step=>{if(sent[step])return;sent[step]=true;fetch('/api/event',{method:'POST',keepalive:true,headers:{'Content-Type':'application/json'},body:JSON.stringify({step,source:landingSource})}).catch(()=>{});};
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  if('IntersectionObserver' in window)new IntersectionObserver(entries=>{if(reduced)return;if(entries.some(e=>e.isIntersecting))film.play().catch(()=>{});else film.pause();},{threshold:.5}).observe(film);
  film.addEventListener('play',()=>track('demo_play'));
  film.addEventListener('timeupdate',()=>{if(film.currentTime>=12)track('demo_half');});
}
const form=document.querySelector('#waitlist-form');
if(form){
  const status=document.querySelector('#form-status'),leave=document.querySelector('#leave-waitlist');
  const saved=()=>{try{return JSON.parse(localStorage.getItem('dupes-waitlist')||'null');}catch{return null;}};
  if(saved())leave.hidden=false;
  form.addEventListener('submit',async e=>{
    e.preventDefault();const button=form.querySelector('button');button.disabled=true;status.textContent='Saving your request…';
    const fields=new FormData(form),email=String(fields.get('email')).trim().toLowerCase();
    try{
      const response=await fetch('/api/waitlist',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,consent:fields.get('consent')==='on',website:fields.get('website')||'',source:landingSource})});
      if(!response.ok)throw Error('We couldn’t save that. Check your email and try again.');
      const data=await response.json();let storage=true;
      try{if(saved()?.email!==email)localStorage.setItem('dupes-waitlist',JSON.stringify({email,token:data.removalToken}));}catch{storage=false;}
      status.textContent=storage?'Request received. If this address is new, it’s now on the list.':'Request received. Browser storage is unavailable, so keep this private removal token: '+data.removalToken;
      status.className='success';leave.hidden=!storage;
    }catch(error){status.textContent=error.message;status.className='error';}finally{button.disabled=false;}
  });
  leave.addEventListener('click',async()=>{
    const signup=saved();if(!signup)return;leave.disabled=true;
    try{const response=await fetch('/api/waitlist',{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:signup.token})});if(!response.ok)throw Error('Please try removing your signup again.');localStorage.removeItem('dupes-waitlist');leave.hidden=true;status.textContent='Your signup has been removed.';status.className='success';}catch(error){status.textContent=error.message;}finally{leave.disabled=false;}
  });
}
const signupForm=document.querySelector('#signup-form');
if(signupForm){
  const status=document.querySelector('#signup-status'),keyCard=document.querySelector('#workspace-created'),createForm=document.querySelector('#create-instance-form');
  let workspaceKey;
  const showError=error=>{status.textContent=error.message;status.className='error';};
  signupForm.addEventListener('submit',async e=>{
    e.preventDefault();const button=signupForm.querySelector('button');button.disabled=true;status.textContent='Creating your workspace…';
    const fields=new FormData(signupForm);
    try{
      const response=await fetch('/api/signup',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:String(fields.get('email')).trim(),website:fields.get('website')||'',source:landingSource})});
      const data=await response.json();if(!response.ok)throw Error(data.error||'Workspace creation failed.');
      if(!data.workspaceKey){status.textContent=data.message||'Request received.';return;}
      workspaceKey=data.workspaceKey;document.querySelector('#workspace-key').value=workspaceKey;
      keyCard.hidden=false;signupForm.hidden=true;createForm.hidden=false;status.textContent='Your workspace is ready. Save your key before creating your app.';status.className='success';
    }catch(error){showError(error);}finally{button.disabled=false;}
  });
  for(const kind of ['workspace','instance']){
    const input=document.querySelector('#'+kind+'-key');
    document.querySelector('#show-'+kind+'-key').addEventListener('click',e=>{const show=input.type==='password';input.type=show?'text':'password';e.currentTarget.textContent=show?'Hide':'Show';});
    document.querySelector('#copy-'+kind+'-key').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(input.value);status.textContent='Key copied. Keep it somewhere private.';}catch{status.textContent='Copy is unavailable. Use Show and save the key privately.';}});
  }
  createForm.addEventListener('submit',async e=>{
    e.preventDefault();if(!workspaceKey){showError(Error('This page no longer has your key. Use your saved workspace key with the CLI.'));return;}
    const button=createForm.querySelector('button');button.disabled=true;status.textContent='Starting Feedback…';
    try{
      const response=await fetch('/v1/instances',{method:'POST',headers:{Authorization:'Bearer '+workspaceKey,'Content-Type':'application/json'},body:JSON.stringify({app:'feedback',name:String(new FormData(createForm).get('name')).trim()})});
      const data=await response.json();if(!response.ok)throw Error(data.error||'Your app could not be created.');
      const url=new URL(data.url);if(url.origin!==location.origin||!url.pathname.startsWith('/i/'))throw Error('The app returned an unexpected address. Keep your workspace key and contact support.');
      document.querySelector('#instance-key').value=data.adminApiKey;
      const open=document.querySelector('#open-instance');open.href=data.url;open.textContent='Open your Feedback board ↗';
      const admin=document.querySelector('#open-admin');admin.href=data.adminUrl;
      document.querySelector('#instance-created').hidden=false;createForm.hidden=true;
      status.textContent='Feedback is ready. Save its admin key too; use it at the admin sign-in.';status.className='success';
    }catch(error){showError(error);}finally{button.disabled=false;}
  });
  // Secrets live only in this document and are never written to browser storage.
  window.addEventListener('pagehide',()=>{workspaceKey=undefined;for(const input of document.querySelectorAll('[data-private-key]'))input.value='';});
}
