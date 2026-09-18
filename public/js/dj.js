(()=>{
const $=s=>document.querySelector(s);
let state=null,es=null,me=null;
const GOCAST='https://gocast.fm/station/red-moon-pub';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
async function api(url,opt){const o={credentials:'same-origin',...opt};if(!(o.body instanceof FormData))o.headers={'Content-Type':'application/json',...(o.headers||{})};const r=await fetch(url,o);let d={};try{d=await r.json()}catch{}if(!r.ok)throw Error(d.error||`HTTP ${r.status}`);return d}
function showMsg(t,error=false){const el=$('#gocastMsg');if(el){el.textContent=t;el.className='form-msg '+(error?'error':'good')}}
function render(){if(!state||!me)return;$('#djLiveState').textContent=state.live?'LIVE / GOCAST':'OFFLINE';$('#djLiveState').classList.toggle('live',!!state.live);$('#djListeners').textContent='GoCast';$('#showTitle').value=state.title||'';const canStaff=['owner','manager','staff'].includes(me.role);$('#staffNav').classList.toggle('hidden',!canStaff);$('#staffNav2').classList.toggle('hidden',!canStaff);$('#gocastStatus').textContent=state.live?'🔴 A Red Moon GoCast adása LIVE.':'⚫ A Red Moon GoCast adása OFFLINE.';$('#gocastStatus').classList.toggle('live',!!state.live);}
async function setLive(on){try{state=(await api('/api/dj/live',{method:'POST',body:JSON.stringify({live:on,title:$('#showTitle').value})})).state;render();showMsg(on?'LIVE állapot bekapcsolva. Most indítsd a GoCast adást a GoCast stúdióban.':'LIVE állapot kikapcsolva. A Red Moon háttérzene visszaindul a publikus oldalakon.');}catch(e){showMsg(e.message,true)}}
async function boot(){try{const d=await api('/api/dj/state');me=d.me;state=d.state;$('#djLoginMsg').classList.add('hidden');$('#djApp').classList.remove('hidden');$('#djUser').textContent=`${me.name.toUpperCase()} · ${me.role.toUpperCase()}`;$('#djWelcome').textContent=`Bejelentkezve: ${me.name} · ${me.role.toUpperCase()}`;render();es=new EventSource('/api/dj/events');es.onmessage=e=>{try{const d=JSON.parse(e.data);if(d.state){state=d.state;render()}}catch{}}}catch(e){location.href='staff.html'}}
$('#openGoCast')?.addEventListener('click',()=>window.open(GOCAST,'_blank','noopener'));
$('#copyGoCast')?.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(GOCAST);showMsg('GoCast link kimásolva.')}catch{showMsg(GOCAST)}});
$('#goLive')?.addEventListener('click',()=>setLive(true));
$('#stopLive')?.addEventListener('click',()=>setLive(false));
$('#djLogout')?.addEventListener('click',async()=>{await api('/api/logout',{method:'POST'});location.href='staff.html'});
boot();
})();
