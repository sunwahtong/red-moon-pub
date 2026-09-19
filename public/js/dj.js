(()=>{
'use strict';
const $=s=>document.querySelector(s);
let state=null, me=null, es=null, poll=null;
const SOUND_BASE='/assets/sounds/';
const soundCache={};
let audioUnlocked=false;
function unlockAudio(){if(audioUnlocked)return;try{const C=window.AudioContext||window.webkitAudioContext;if(C){window._audioCtx ||= new C();if(window._audioCtx.state==='suspended')window._audioCtx.resume()}audioUnlocked=true}catch{}}
document.addEventListener('pointerdown',unlockAudio,{once:true});
document.addEventListener('keydown',unlockAudio,{once:true});
function playSfx(name,volume=.55){unlockAudio();try{const a=soundCache[name]||new Audio(SOUND_BASE+name+'.wav');soundCache[name]=a;a.currentTime=0;a.volume=volume;const p=a.play();if(p&&p.catch)p.catch(()=>fallbackSfx(name,volume))}catch{fallbackSfx(name,volume)}}
function fallbackSfx(name,volume){try{const ctx=window._audioCtx||(window._audioCtx=new (window.AudioContext||window.webkitAudioContext)());const patterns={live_start:[[523,0,.10],[659,.11,.21],[784,.22,.38]],live_stop:[[784,0,.10],[659,.11,.21],[523,.22,.38]],accept:[[660,0,.08],[880,.09,.20]],decline:[[330,0,.12],[247,.13,.28]],delete:[[440,0,.08],[330,.09,.18],[220,.19,.34]],login:[[523,0,.07],[659,.08,.15],[784,.16,.28]],logout:[[784,0,.07],[659,.08,.15],[523,.16,.28]],copy:[[660,0,.07],[990,.08,.16]],open:[[440,0,.08],[554,.09,.18]],click:[[720,0,.05]]};const now=ctx.currentTime;(patterns[name]||patterns.click).forEach(([f,a,b])=>{const o=ctx.createOscillator(),g=ctx.createGain();o.frequency.value=f;o.type='sine';g.gain.setValueAtTime(.0001,now+a);g.gain.exponentialRampToValueAtTime(Math.max(.012,volume*.14),now+a+.008);g.gain.exponentialRampToValueAtTime(.0001,now+b);o.connect(g);g.connect(ctx.destination);o.start(now+a);o.stop(now+b+.02)})}catch{}}
function showToast(title,message,kind='success'){const m=$('#toastModal');if(!m)return;$('#toastTitle').textContent=title;$('#toastText').textContent=message;const i=m.querySelector('.toast-icon');if(i){i.textContent=kind==='error'?'!':'✓';i.classList.toggle('toast-error',kind==='error')}m.classList.add('show');m.setAttribute('aria-hidden','false');clearTimeout(window._djToastTimer);window._djToastTimer=setTimeout(()=>{m.classList.remove('show');m.setAttribute('aria-hidden','true')},3200)}

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
  const list=$('#djChat'),arr=(state?.chat||[]).filter(m=>Date.now()-new Date(m.at).getTime()<60000).slice(0,8);
  const count=$('#messageCount');if(count)count.textContent=arr.length;
  if(!list)return;
  if(!arr.length){list.innerHTML='<div class="empty-state">Még nincs üzenet.</div>';return}
  list.innerHTML=arr.map(m=>{const k=m.kind||'chat';let badge='';if(k==='request')badge='<span class="chat-kind request-kind">🎵 ZENEKÉRÉS</span>';if(k==='request-accepted')badge='<span class="chat-kind accepted-kind">✓ KÉRÉS ELFOGADVA</span>';if(k==='request-declined')badge='<span class="chat-kind declined-kind">× KÉRÉS ELUTASÍTVA</span>';if(k==='dj')badge='<span class="chat-kind dj-kind">🎧 DJ ÜZENET</span>';const age=Date.now()-new Date(m.at).getTime();const opacity=age>=45000?Math.max(0,Math.min(1,(60000-age)/15000)):1;return `<article class="dj-chat-msg kind-${esc(k)}" style="--chat-opacity:${opacity}"><div class="msg-head"><b>${esc(m.name)}</b><small>${time(m.at)}</small></div><p>${esc(m.text)}</p>${badge}<div class="msg-moderation">${m.ip&&m.ip!=='unknown'?`<span class="msg-ip">IP ${esc(m.ip)}</span><button class="msg-ban" data-chat-ban-ip="${esc(m.ip)}" data-chat-ban-name="${esc(m.name)}">TILTÁS</button>`:''}<button class="msg-delete" data-chat-delete="${esc(m.id)}">TÖRLÉS</button></div></article>`}).join('');
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
    await api('/api/login',{method:'POST',body:JSON.stringify({username:$('#djLoginUsername').value.trim(),password:$('#djLoginPassword').value,portal:'dj'})});
    await enterAfterLogin();
    playSfx('login',.42);
    showToast('DJ KONZOL',`Bejelentkezve: ${me?.name||'DJ'}.`);
    if(!me) throw Error('DJ jogosultság szükséges.');
  }catch(err){
    playSfx('error',.72);
    setLoginError(err.message||'Sikertelen bejelentkezés.');
    $('#djLoginPassword').value='';
  }finally{if(btn)btn.disabled=false}
});
$('#openGoCast')?.addEventListener('click',()=>{playSfx('open',.34);showToast('GoCast stúdió','A GoCast stúdió új lapon megnyílik.');window.open(GOCAST,'_blank','noopener')});
$('#copyGoCast')?.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(GOCAST);playSfx('copy',.32);showToast('GoCast link','A stúdió linkje a vágólapra került.')}catch{showToast('GoCast link','A link nem másolható automatikusan.','error')}});
$('#goLive')?.addEventListener('click',async()=>{try{const d=await api('/api/dj/live',{method:'POST',body:JSON.stringify({live:true,title:$('#showTitle').value})});state=d.state;playSfx('live_start',.62);render();showToast('LIVE ELINDULT',`${state.title||'Red Moon Live'} — az adás most élő a GoCaston.`)}catch(e){playSfx('error',.72);showToast('LIVE INDÍTÁSA SIKERTELEN',e.message,'error')}});
$('#stopLive')?.addEventListener('click',async()=>{try{const d=await api('/api/dj/live',{method:'POST',body:JSON.stringify({live:false})});state=d.state;playSfx('live_stop',.58);render();showToast('LIVE LEÁLLÍTVA','A Red Moon GoCast adása most offline.')}catch(e){playSfx('error',.72);showToast('LIVE LEÁLLÍTÁSA SIKERTELEN',e.message,'error')}});
$('#nameRequestList')?.addEventListener('click',async e=>{const b=e.target.closest('[data-name-action]');if(!b)return;try{const d=await api('/api/club/name-decision',{method:'POST',body:JSON.stringify({id:b.dataset.id,action:b.dataset.nameAction})});state=d.state;playSfx(b.dataset.nameAction==='accept'?'accept':'decline',.48);render();showToast(b.dataset.nameAction==='accept'?'NÉVKÉRELEM ELFOGADVA':'NÉVKÉRELEM ELUTASÍTVA',b.dataset.nameAction==='accept'?'A vendég mostantól használhatja a Clubot.':'A névkérés el lett utasítva.')}catch(err){playSfx('error',.72);showToast('NÉVKÉRELEM SIKERTELEN',err.message,'error')}});
$('#requestList')?.addEventListener('click',async e=>{
  const b=e.target.closest('button[data-id]');if(!b)return;
  try{
    if(b.dataset.action==='delete'){
      const d=await api('/api/dj/request/'+encodeURIComponent(b.dataset.id),{method:'DELETE'});state=d.state;playSfx('delete',.42);showToast('KÉRÉS TÖRÖLVE','A zenei kérés eltávolítva.');
    }else{
      const d=await api('/api/dj/request',{method:'POST',body:JSON.stringify({id:b.dataset.id,action:b.dataset.action})});state=d.state;playSfx(b.dataset.action==='accept'?'accept':'decline',.46);showToast(b.dataset.action==='accept'?'ZENEKÉRÉS ELFOGADVA':'ZENEKÉRÉS ELUTASÍTVA',b.dataset.action==='accept'?'A kérés elfogadva.':'A kérés elutasítva.');
    }
    render();
  }catch(err){playSfx('error',.72);showToast('ZENEKÉRÉS SIKERTELEN',err.message,'error')}
});
$('#djChat')?.addEventListener('click',async e=>{
  const banBtn=e.target.closest('[data-chat-ban-ip]');
  if(banBtn){
    const ip=String(banBtn.dataset.chatBanIp||'').trim(), name=banBtn.dataset.chatBanName||'vendég';
    if(!ip||ip==='unknown'){playSfx('error',.72);showToast('TILTÁS SIKERTELEN','Ehhez a felhasználóhoz nem tartozik érvényes IP-cím.','error');return}
    if(!confirm(`Biztosan letiltod ${name} IP-címét a Chatről?\n\nIP: ${ip}\nIdőtartam: 60 perc`))return;
    banBtn.disabled=true;
    try{
      const d=await api('/api/club/ban',{method:'POST',body:JSON.stringify({ip,minutes:60,reason:`Chat tiltás · ${name}`})});
      state=d.state||state;
      playSfx('delete',.42);
      showToast('CHAT TILTÁS AKTÍV',`${name} IP-címe 60 percre letiltva.`);
      render();
    }catch(err){
      banBtn.disabled=false;
      playSfx('error',.72);
      showToast('TILTÁS SIKERTELEN',err.message,'error');
    }
    return;
  }
  const b=e.target.closest('[data-chat-delete]');if(!b)return;
  try{const d=await api('/api/club/chat/'+encodeURIComponent(b.dataset.chatDelete),{method:'DELETE'});state=d.state;playSfx('delete',.42);render();showToast('ÜZENET TÖRÖLVE','A chatüzenet eltávolítva.')}catch(err){playSfx('error',.72);showToast('ÜZENET TÖRLÉSE SIKERTELEN',err.message,'error')}
});
$('#djChatSend')?.addEventListener('click',async()=>{
  const input=$('#djChatInput');if(!input)return;const text=input.value.trim();if(!text)return;
  const btn=$('#djChatSend');if(btn)btn.disabled=true;
  try{const d=await api('/api/dj/chat',{method:'POST',body:JSON.stringify({text})});state=d.state;input.value='';playSfx('success',.34);render();showToast('DJ ÜZENET ELKÜLDVE','Az üzenet megjelent a Red Moon Club chatjében.')}catch(err){playSfx('error',.72);showToast('ÜZENET KÜLDÉSE SIKERTELEN',err.message,'error')}finally{if(btn)btn.disabled=false}
});
$('#djChatInput')?.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();$('#djChatSend')?.click()}});
$('#djLogout')?.addEventListener('click',async()=>{
  cleanupRealtime();
  try{await api('/api/logout',{method:'POST'})}catch{}
  playSfx('logout',.38);showToast('KIJELENTKEZÉS','Sikeresen kijelentkeztél a DJ konzolból.');me=null;state=null;$('#djLoginPassword').value='';setTimeout(()=>showLogin(''),250);
});
document.querySelectorAll('[data-toast-close]').forEach(el=>el.addEventListener('click',()=>{playSfx('click',.18);$('#toastModal')?.classList.remove('show');$('#toastModal')?.setAttribute('aria-hidden','true')}));
document.addEventListener('click',e=>{const el=e.target.closest('button,a,input[type=button],input[type=submit]');if(!el)return;if(el.dataset.noClickSound==='1')return;if(['goLive','stopLive','openGoCast','copyGoCast','djChatSend','djLogout'].includes(el.id))return;if(el.closest('#nameRequestList,#requestList,#djChat'))return;playSfx('click',.20)},{passive:true});
(async()=>{
  try{await loadState();connectRealtime()}
  catch(e){showLogin(e.message.includes('jogosultság')?e.message:'Jelentkezz be a DJ konzol használatához.')}
})();
})();