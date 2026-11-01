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
// Each step is counted once per page load as an anonymous daily total.
const sent={},track=step=>{if(sent[step])return;sent[step]=true;fetch('/api/event',{method:'POST',keepalive:true,headers:{'Content-Type':'application/json'},body:JSON.stringify({step,source:landingSource})}).catch(()=>{});};
const film=document.querySelector('#demo-film');
if(film){
  // Plays muted only while on screen; reduced-motion visitors start it themselves.
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
  const status=document.querySelector('#signup-status');
  const showError=error=>{status.textContent=error.message;status.className='error';};
  signupForm.addEventListener('submit',async e=>{
    e.preventDefault();const button=signupForm.querySelector('button');button.disabled=true;status.textContent='Creating your board…';status.className='';
    track('signup_submit');
    const fields=new FormData(signupForm);
    try{
      const response=await fetch('/api/signup',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:String(fields.get('email')).trim(),name:String(fields.get('name')).trim(),website:fields.get('website')||'',source:landingSource})});
      const data=await response.json();if(!response.ok)throw Error(data.error||'Your board could not be created.');
      if(!data.workspaceKey){status.textContent=data.message||'Request received.';return;}
      document.querySelector('#workspace-key').value=data.workspaceKey;
      const workspace=document.querySelector('#workspace-created');workspace.hidden=false;signupForm.hidden=true;
      if(!data.url){workspace.open=true;status.textContent='Your workspace is ready, but the board was not created. Save the workspace key and run the CLI command below.';status.className='error';return;}
      const url=new URL(data.url);if(url.origin!==location.origin||!url.pathname.startsWith('/i/'))throw Error('The board returned an unexpected address. Keep your workspace key and contact support.');
      document.querySelector('#instance-key').value=data.adminApiKey;
      document.querySelector('#open-instance').href=url.href;
      if(data.adminUrl){const admin=document.querySelector('#open-admin');admin.href=data.adminUrl;admin.hidden=false;}
      document.querySelector('#instance-created').hidden=false;
      status.textContent='Your board is ready. Save its admin key, then open it.';status.className='success';
    }catch(error){showError(error);}finally{button.disabled=false;}
  });
  document.querySelector('#open-instance').addEventListener('click',()=>track('signup_board_open'));
  for(const kind of ['workspace','instance']){
    const input=document.querySelector('#'+kind+'-key');
    document.querySelector('#show-'+kind+'-key').addEventListener('click',e=>{const show=input.type==='password';input.type=show?'text':'password';e.currentTarget.textContent=show?'Hide':'Show';});
    document.querySelector('#copy-'+kind+'-key').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(input.value);status.textContent='Key copied. Keep it somewhere private.';status.className='success';}catch{status.textContent='Copy is unavailable. Use Show and save the key privately.';}});
  }
  // Secrets live only in this document and are never written to browser storage.
  window.addEventListener('pagehide',()=>{for(const input of document.querySelectorAll('[data-private-key]'))input.value='';});
}
