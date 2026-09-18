(()=>{
'use strict';
const $=s=>document.querySelector(s);
let state=null, me=null, es=null, poll=null;
const GOCAST='https://gocast.fm/station/red-moon-pub';
const DJ_ROLES=new Set(['dj','manager','owner']);
const STAFF_ROLES=new Set(['staff','manager','owner']);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
async function api(url,opt){
  const o={credentials:'same-origin',...opt};
  if(!(o.body instanceof FormData)) o.headers={'Content-Type':'application/json',...(o.headers||{})};
  const r=await fetch(url,o);
  let d={}; try{d=await r.json()}catch{}
  if(!r.ok) throw Error(d.error||`HTTP ${r.status}`);
  return d;
}
function setLoginError(msg=''){const e=$('#djLoginError');if(e)e.textContent=msg;}
function showLogin(msg=''){
  $('#djLoginView')?.classList.remove('hidden');
  $('#djApp')?.classList.add('hidden');
  setLoginError(msg);
  $('#djLoginUsername')?.focus();
}
function showApp(){
  $('#djLoginView')?.classList.add('hidden');
  $('#djApp')?.classList.remove('hidden');
}
function time(a){return a?new Date(a).toLocaleTimeString('hu-HU',{hour:'2-digit',minute:'2-digit'}):''}
function cleanupRealtime(){
  if(es){es.close();es=null}
  if(poll){clearInterval(poll);poll=null}
}
function renderNameRequests(){const list=$('#nameRequestList'),arr=state?.nameRequests||[];const count=$('#nameRequestCount');if(count)count.textContent=arr.length;if(!list)return;if(!arr.length){list.innerHTML='<div class="empty-state">Nincs függő névkérelem.</div>';return}list.innerHTML=arr.map(r=>`<article class="request-item pending"><div class="request-main"><div class="request-avatar">👤</div><div><b>${esc(r.name)}</b><span>${time(r.at)}</span></div></div><div class="request-actions"><button class="btn btn-red" data-name-action="accept" data-id="${esc(r.id)}">✓ ELFOGAD</button><button class="btn btn-ghost" data-name-action="decline" data-id="${esc(r.id)}">ELUTASÍT</button></div></article>`).join('')}
function renderRequests(){
  const list=$('#requestList'),arr=state?.requests||[];
  const count=$('#requestCount'); if(count)count.textContent=arr.length;
  if(!list)return;
  if(!arr.length){list.innerHTML='<div class="empty-state">Még nincs zenei kérés.</div>';return}
  list.innerHTML=arr.map(r=>`<article class="request-item ${esc(r.status||'pending')}">
    <div class="request-main"><div class="request-avatar">♪</div><div><b>${esc(r.item?.name||r.title||'Ismeretlen szám')}</b><span>${esc(r.name||'Vendég')} · ${time(r.at)}</span></div></div>
    <div class="request-status">${r.status==='accepted'?'ELFOGADVA':r.status==='declined'?'ELUTASÍTVA':'ÚJ KÉRÉS'}</div>
    <div class="request-actions">${r.status==='pending'?`<button class="btn btn-red" data-action="accept" data-id="${esc(r.id)}">✓ ELFOGAD</button><button class="btn btn-ghost" data-action="decline" data-id="${esc(r.id)}">ELUTASÍT</button>`:''}<button class="btn btn-danger" data-action="delete" data-id="${esc(r.id)}">🗑 TÖRLÉS</button></div>
  </article>`).join('');
}
function renderChat(){
  const list=$('#djChat'),arr=(state?.chat||[]).filter(m=>Date.now()-new Date(m.at).getTime()<30000);
  const count=$('#messageCount');if(count)count.textContent=arr.length;
  if(!list)return;
  if(!arr.length){list.innerHTML='<div class="empty-state">Még nincs üzenet.</div>';return}
  list.innerHTML=arr.map(m=>`<article class="dj-chat-msg"><div class="msg-head"><b>${esc(m.name)}</b><small>${time(m.at)}</small></div><p>${esc(m.text)}</p><button class="msg-delete" data-chat-delete="${esc(m.id)}">TÖRLÉS</button></article>`).join('');
}
function render(){
  if(!state||!me)return;
  const live=!!state.live;
  const st=$('#djLiveState');if(st){st.textContent=live?'LIVE / GOCAST':'OFFLINE';st.classList.toggle('live',live)}
  const title=$('#djLiveTitle');if(title)title.textContent=state.title||'Red Moon Live';
  const input=$('#showTitle');if(input && document.activeElement!==input)input.value=state.title||'';
  const user=$('#djUser');if(user)user.textContent=`${String(me.name||'').toUpperCase()} · ${String(me.role||'').toUpperCase()}`;
  const welcome=$('#djWelcome');if(welcome)welcome.textContent=`Bejelentkezve: ${me.name} · ${String(me.role).toUpperCase()}`;
  const canStaff=STAFF_ROLES.has(me.role);
  $('#staffNav')?.classList.toggle('hidden',!canStaff);
  $('#staffNav2')?.classList.toggle('hidden',!canStaff);
  const gs=$('#gocastStatus');if(gs){gs.textContent=live?'🔴 A Red Moon GoCast adása LIVE.':'⚫ A Red Moon GoCast adása OFFLINE.';gs.classList.toggle('live',live)}
  renderNameRequests();renderRequests();renderChat();
}
async function loadState(){
  const d=await api('/api/dj/state');
  if(!d.me || !DJ_ROLES.has(d.me.role)) throw Error('Ehhez a DJ konzolhoz DJ, MANAGER vagy OWNER jogosultság szükséges.');
  me=d.me;state=d.state;showApp();render();
}
function connectRealtime(){
  cleanupRealtime();
  try{
    es=new EventSource('/api/dj/events');
    es.onmessage=e=>{try{const d=JSON.parse(e.data);if(d.state){state=d.state;render()}}catch{}};
    es.onerror=()=>{if(es){es.close();es=null}};
  }catch{}
  poll=setInterval(()=>loadState().catch(()=>{}),10000);
}
async function enterAfterLogin(){
  try{await loadState();connectRealtime();setLoginError('')}
  catch(e){showLogin(e.message)}
}
$('#djLoginForm')?.addEventListener('submit',async e=>{
  e.preventDefault();setLoginError('');
  const btn=e.currentTarget.querySelector('button[type=submit]');if(btn)btn.disabled=true;
  try{
    await api('/api/login',{method:'POST',body:JSON.stringify({username:$('#djLoginUsername').value.trim(),password:$('#djLoginPassword').value})});
    await enterAfterLogin();
    if(!me) throw Error('DJ jogosultság szükséges.');
  }catch(err){
    setLoginError(err.message||'Sikertelen bejelentkezés.');
    $('#djLoginPassword').value='';
  }finally{if(btn)btn.disabled=false}
});
$('#openGoCast')?.addEventListener('click',()=>window.open(GOCAST,'_blank','noopener'));
$('#copyGoCast')?.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(GOCAST);const e=$('#gocastMsg');if(e)e.textContent='GoCast link kimásolva.'}catch{const e=$('#gocastMsg');if(e)e.textContent=GOCAST}});
$('#goLive')?.addEventListener('click',async()=>{try{const d=await api('/api/dj/live',{method:'POST',body:JSON.stringify({live:true,title:$('#showTitle').value})});state=d.state;render()}catch(e){const x=$('#gocastMsg');if(x)x.textContent=e.message}});
$('#stopLive')?.addEventListener('click',async()=>{try{const d=await api('/api/dj/live',{method:'POST',body:JSON.stringify({live:false})});state=d.state;render()}catch(e){const x=$('#gocastMsg');if(x)x.textContent=e.message}});
$('#nameRequestList')?.addEventListener('click',async e=>{const b=e.target.closest('[data-name-action]');if(!b)return;try{const d=await api('/api/club/name-decision',{method:'POST',body:JSON.stringify({id:b.dataset.id,action:b.dataset.nameAction})});state=d.state;render()}catch(err){const x=$('#gocastMsg');if(x)x.textContent=err.message}});
$('#requestList')?.addEventListener('click',async e=>{
  const b=e.target.closest('button[data-id]');if(!b)return;
  try{
    if(b.dataset.action==='delete'){
      const d=await api('/api/dj/request/'+encodeURIComponent(b.dataset.id),{method:'DELETE'});state=d.state;
    }else{
      const d=await api('/api/dj/request',{method:'POST',body:JSON.stringify({id:b.dataset.id,action:b.dataset.action})});state=d.state;
    }
    render();
  }catch(err){const x=$('#gocastMsg');if(x)x.textContent=err.message}
});
$('#djChat')?.addEventListener('click',async e=>{
  const b=e.target.closest('[data-chat-delete]');if(!b)return;
  try{const d=await api('/api/club/chat/'+encodeURIComponent(b.dataset.chatDelete),{method:'DELETE'});state=d.state;render()}catch(err){const x=$('#gocastMsg');if(x)x.textContent=err.message}
});
$('#djLogout')?.addEventListener('click',async()=>{
  cleanupRealtime();
  try{await api('/api/logout',{method:'POST'})}catch{}
  me=null;state=null;$('#djLoginPassword').value='';showLogin('');
});
(async()=>{
  try{await loadState();connectRealtime()}
  catch(e){showLogin(e.message.includes('jogosultság')?e.message:'Jelentkezz be a DJ konzol használatához.')}
})();
})();