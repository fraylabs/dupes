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
