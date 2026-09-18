if(location.protocol==='file:'){ location.replace('http://localhost:8787/staff'); }
const $=s=>document.querySelector(s);
let me=null,products=[],currentShift=null,latestSale=null, presenceTimer=null, heartbeatTimer=null, realtimeSource=null, realtimeRefreshTimer=null, realtimePollTimer=null;
const money=n=>new Intl.NumberFormat('hu-HU').format(Number(n)||0)+' Ft';
const SOUND_BASE='/assets/sounds/';
const soundCache={};
let audioUnlocked=false;
function unlockAudio(){
  if(audioUnlocked)return;
  try{
    const C=window.AudioContext||window.webkitAudioContext;
    if(C){window._audioCtx ||= new C(); if(window._audioCtx.state==='suspended')window._audioCtx.resume();}
    audioUnlocked=true;
  }catch{}
}
document.addEventListener('pointerdown',unlockAudio,{once:true});
document.addEventListener('keydown',unlockAudio,{once:true});
function playSfx(name,volume=0.65){
  unlockAudio();
  try{
    const a=soundCache[name]||new Audio(SOUND_BASE+name+'.wav');
    soundCache[name]=a;
    a.currentTime=0;
    a.volume=volume;
    const p=a.play();
    if(p&&p.catch)p.catch(()=>fallbackSfx(name,volume));
  }catch{fallbackSfx(name,volume)}
}
function fallbackSfx(name,volume){
  try{
    const ctx=window._audioCtx||(window._audioCtx=new (window.AudioContext||window.webkitAudioContext)());
    const now=ctx.currentTime;
    const patterns={
      error:[[170,0,.12],[110,.13,.22]],
      low_stock:[[660,0,.10],[880,.11,.22],[660,.23,.33]],
      success:[[520,0,.08],[660,.09,.17],[790,.18,.32]],
      cash_close:[[392,0,.10],[523,.11,.21],[659,.22,.34],[784,.35,.52]]
    };
    (patterns[name]||patterns.success).forEach(([freq,a,b])=>{
      const o=ctx.createOscillator(),g=ctx.createGain();
      o.type='sine';o.frequency.value=freq;
      g.gain.setValueAtTime(0.0001,now+a);
      g.gain.exponentialRampToValueAtTime(Math.max(.015,volume*.16),now+a+.01);
      g.gain.exponentialRampToValueAtTime(.0001,now+b);
      o.connect(g);g.connect(ctx.destination);o.start(now+a);o.stop(now+b+.02);
    });
  }catch{}
}
let warnedLowStock=new Set();
function checkStockAlerts(list){
  const low=list.filter(p=>p.active&&p.stock>0&&p.stock<=p.minStock);
  const empty=list.filter(p=>p.active&&p.stock<=0);
  const signature=low.map(p=>p.id+':'+p.stock).sort().join('|');
  const previous=window._lowStockSignature||'';
  if(signature!==previous && low.length) playSfx('low_stock',0.7);
  window._lowStockSignature=signature;
  window._emptyStockIds=new Set(empty.map(p=>p.id));
}

const esc=s=>String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));

let _modalResolve=null;
function closeActionModal(result=null){
  const m=$('#actionModal'); if(!m)return;
  m.classList.remove('show');m.setAttribute('aria-hidden','true');
  const resolve=_modalResolve;_modalResolve=null;
  if(resolve)resolve(result);
}
function openActionModal({title,kicker='RED MOON / COMMAND',fields=[],confirmText='MEGERŐSÍTÉS',danger=false}){
  return new Promise(resolve=>{
    _modalResolve=resolve;
    $('#actionModalKicker').textContent=kicker;
    $('#actionModalTitle').textContent=title;
    $('#actionConfirm').textContent=confirmText;
    $('#actionConfirm').classList.toggle('danger-btn',!!danger);
    $('#actionConfirm').classList.toggle('btn-red',!danger);
    $('#actionModalBody').innerHTML=fields.map(f=>{
      const tag=f.type==='textarea'?'textarea':f.type==='select'?'select':'input';
      const attrs=tag==='input'?`type="${f.type||'text'}"`:'';
      const value=f.value??'';
      if(tag==='select')return `<div class="modal-field"><label>${esc(f.label)}</label><select id="modal_${esc(f.id)}">${(f.options||[]).map(o=>`<option value="${esc(o.value)}">${esc(o.label)}</option>`).join('')}</select></div>`;
      return `<div class="modal-field"><label>${esc(f.label)}</label><${tag} id="modal_${esc(f.id)}" ${attrs} ${f.min!=null?`min="${f.min}"`:''} ${f.step?`step="${f.step}"`:''} ${f.required?'required':''} placeholder="${esc(f.placeholder||'')}" ${tag==='textarea'?'':`value="${esc(value)}"`}>${tag==='textarea'?esc(value):''}</${tag}></div>`;
    }).join('');
    $('#actionModal').classList.add('show');$('#actionModal').setAttribute('aria-hidden','false');
    setTimeout(()=>{const first=$('#actionModalBody input,#actionModalBody textarea,#actionModalBody select');if(first){first.focus();if(first.select)first.select()}},30);
  });
}
async function rmForm(opts){
  const result=await openActionModal(opts);
  return result;
}
function submitActionModal(){
  const body=$('#actionModalBody');
  const vals={};
  body.querySelectorAll('input,textarea,select').forEach(el=>{vals[el.id.replace(/^modal_/,'')]=el.value});
  closeActionModal(vals);
}
async function rmAlert(message,title='RED MOON / ÉRTESÍTÉS'){
  await openActionModal({title,kicker:'RED MOON / COMMAND',fields:[{id:'message',label:'ÜZENET',type:'textarea',value:String(message)}],confirmText:'RENDBEN'}).then(()=>{});
}
async function rmConfirm(message,title='MŰVELET MEGERŐSÍTÉSE'){
  const result=await openActionModal({title,kicker:'RED MOON / BIZTONSÁGI ELLENŐRZÉS',fields:[{id:'message',label:'ELLENŐRZÉS',type:'textarea',value:String(message)}],confirmText:'MEGERŐSÍTEM',danger:true});
  return !!result;
}
$('#actionCancel').addEventListener('click',()=>closeActionModal(null));
$('#actionConfirm').addEventListener('click',submitActionModal);
document.querySelectorAll('[data-modal-close]').forEach(el=>el.addEventListener('click',()=>closeActionModal(null)));
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&$('#actionModal')?.classList.contains('show'))closeActionModal(null)});


function showToast(title,message,kind='success'){
  const modal=$('#toastModal'), icon=$('#toastModal .toast-icon'), titleEl=$('#toastTitle'), textEl=$('#toastText');
  if(!modal||!titleEl||!textEl)return;
  titleEl.textContent=title; textEl.textContent=message;
  if(icon){icon.textContent=kind==='error'?'!':'✓'; icon.classList.toggle('toast-error',kind==='error');}
  modal.classList.add('show'); modal.setAttribute('aria-hidden','false');
  clearTimeout(window._toastTimer); window._toastTimer=setTimeout(()=>{modal.classList.remove('show');modal.setAttribute('aria-hidden','true')},3200);
}
document.querySelectorAll('[data-toast-close]').forEach(el=>el.addEventListener('click',()=>$('#toastModal')?.classList.remove('show')));

function connectRealtime(){
  if(!me)return;
  try{realtimeSource?.close()}catch{}
  clearInterval(realtimePollTimer);
  if(window.EventSource){
    realtimeSource=new EventSource('/api/events');
    realtimeSource.onmessage=ev=>{
      try{
        const data=JSON.parse(ev.data||'{}');
        if(data.type==='session_revoked' && data.targetUserId===me.id){
          playSfx('error',0.75);
          showToast('Munkamenet lezárva','A jelszavadat egy OWNER módosította. Újra be kell jelentkezned.','error');
          setTimeout(()=>location.reload(),900);
          return;
        }
        if(data.type==='presence'){loadPresence();return}
        if(data.type==='state'||data.type==='connected'){
          clearTimeout(realtimeRefreshTimer);
          realtimeRefreshTimer=setTimeout(()=>{if(me)load().catch(()=>{})},80);
        }
      }catch{}
    };
  }
  // Safety net: no F5 is ever needed even if an SSE connection is delayed by a proxy.
  realtimePollTimer=setInterval(()=>{if(me)load().catch(()=>{});},5000);
}

async function api(url,opt={}){
  try{
    const r=await fetch(url,{credentials:'same-origin',headers:{'Content-Type':'application/json',...(opt.headers||{})},...opt});
    let d={}; try{d=await r.json()}catch{}
    if(!r.ok)throw new Error(d.error||`HTTP ${r.status}`);
    return d;
  }catch(err){
    if(err instanceof TypeError)throw new Error('A Red Moon Staff szerver nem érhető el. Indítsd el a Start_Red_Moon.bat fájlt.');
    throw err;
  }
}
async function boot(){const d=await api('/api/me');if(d.user){me=d.user;showApp()}else showLogin()}
function showLogin(){$('#loginView').classList.remove('hidden');$('#appView').classList.add('hidden')}
function showApp(){
  if(me?.role==='dj'){ location.href='dj.html'; return; }
  $('#loginView').classList.add('hidden');$('#appView').classList.remove('hidden');
  $('#staffUser').textContent=`${me.name.toUpperCase()} · ${me.role.toUpperCase()}`;
  $('#welcome').textContent=`Bejelentkezve: ${me.name} · ${me.role.toUpperCase()}`;
  $('#statRole').textContent=me.role.toUpperCase();
  if(me.role==='manager'||me.role==='owner')$('#managerPanel').classList.remove('hidden');
  if(me.role==='owner')$('#ownerPanel').classList.remove('hidden');
  loadPresence();
  clearInterval(heartbeatTimer); clearInterval(presenceTimer);
  sendPresenceHeartbeat();
  heartbeatTimer=setInterval(sendPresenceHeartbeat,20000);
  presenceTimer=setInterval(loadPresence,15000);
  connectRealtime();
  load();
}
async function sendPresenceHeartbeat(){
  if(!me)return;
  try{await api('/api/presence/heartbeat',{method:'POST',body:'{}'})}catch{}
}
async function loadPresence(){
  if(!me)return;
  const body=$('#presenceBody'),count=$('#presenceCount');
  if(!body||!count)return;
  try{
    const d=await api('/api/presence');
    count.textContent=`${d.onlineCount} ONLINE`;
    body.innerHTML=d.online.length?d.online.map(u=>`<div class="presence-user ${u.id===me.id?'self':''}">
      <span class="presence-dot"></span>
      <div><b>${esc(u.name)}</b><small>${esc(u.role.toUpperCase())}${u.id===me.id?' · TE VAGY':''}</small></div>
      <span class="presence-time">ONLINE</span>
    </div>`).join(''):'<div class="mini-note">Jelenleg nincs aktív dolgozó.</div>';
  }catch{
    count.textContent='—';
    body.innerHTML='<div class="mini-note">Az online lista pillanatnyilag nem érhető el.</div>';
  }
}
async function load(){
  const [p,d,s,sh]=await Promise.all([api('/api/products'),api('/api/dashboard'),api('/api/sales'),api('/api/shifts/current')]);
  products=p.products;currentShift=sh.shift||null;checkStockAlerts(products);
  renderProducts();renderDashboard(d);renderSales(s.sales);renderShift();renderDocumentsHint();if(me.role==='manager'||me.role==='owner')loadNotifications();
  if(me.role==='manager'||me.role==='owner')renderManager();
  if(me.role==='owner'){loadUsers();loadPerformance()}
}
function renderProducts(){
  const active=products.filter(p=>p.active);
  $('#saleProduct').innerHTML=active.map(p=>`<option value="${p.id}">${esc(p.name)} · ${money(p.price)}</option>`).join('');
  updateSalePreview();
  $('#inventory').innerHTML=active.map(p=>`<article class="product-card ${p.stock<=p.minStock?'low':''}">
    <div class="product-card-art"><img src="/${esc(p.image)}" alt="${esc(p.name)}" loading="lazy" onerror="this.style.display='none'"><span class="product-stock">${p.stock} DB</span></div>
    <div class="product-card-body"><b>${esc(p.name)}</b><small>${money(p.price)} · minimum ${p.minStock} db</small></div>
    <button type="button" class="product-add" onclick="quickAddToCart('${esc(p.id)}')" ${p.stock<1?'disabled':''}>${p.stock<1?'ELFOGYOTT':'＋ KOSÁRBA'}</button>
  </article>`).join('');
}
function quickAddToCart(id){
  const p=products.find(x=>x.id===id);
  if(!p||p.stock<1)return;
  const existing=window.saleCart.find(x=>x.productId===p.id);
  if((existing?.qty||0)+1>p.stock){
    playSfx('error',0.8);
    showToast('Nincs elég készlet',`${p.name}: jelenleg ${p.stock} db van.`,'error');
    return;
  }
  if(existing)existing.qty+=1;
  else window.saleCart.push({productId:p.id,name:p.name,price:p.price,qty:1});
  playSfx('success',0.32);
  renderCart();
  updateSalePreview();
}
function renderDashboard(d){
  $('#statRevenue').textContent=money(d.today.revenue);$('#statItems').textContent=d.today.items+' db';$('#statLow').textContent=d.lowStock.length;
  $('#alerts').innerHTML=d.lowStock.length?d.lowStock.map(p=>`<div class="alert"><b>${esc(p.name)} · ${p.stock} db</b><small>Minimum: ${p.minStock} db</small></div>`).join(''):'<div class="alert"><b>Minden rendben.</b><small>Nincs alacsony készlet.</small></div>';
}
function renderSales(sales){
  window._lastSales=sales;
  const canDelete=me && (me.role==='manager'||me.role==='owner');
  $('#salesTable').innerHTML=sales.length?sales.slice(0,20).map(s=>`<tr>
    <td data-label="Idő">${new Date(s.at).toLocaleTimeString('hu-HU',{hour:'2-digit',minute:'2-digit'})}</td>
    <td data-label="Dolgozó">${esc(s.user)}</td><td data-label="Kosár ID"><span class="cart-id">${esc(s.cartId||s.transactionId||'—')}</span></td><td data-label="Termék" class="sale-product-cell">${esc(s.product)}</td><td data-label="Db">${s.qty}</td><td data-label="Összeg">${money(s.total)}</td>
    <td data-label="Kezelés" class="sales-actions">
      ${s.documentId
        ? `<button class="table-action" onclick="loadDocumentById('${esc(s.documentId)}')">MEGNYITÁS</button>`
        : `<button class="table-action" onclick="createDocument('${esc(s.id)}','invoice')">SZÁMLÁZÁS</button>`}
      ${canDelete?`<button class="table-action danger" onclick="deleteSale('${esc(s.id)}')">TÖRLÉS</button>`:''}
    </td>
  </tr>`).join(''):'<tr><td colspan="7">Még nincs eladás.</td></tr>';
}

window.saleCart=window.saleCart||[];
function cartTotal(){return window.saleCart.reduce((sum,i)=>sum+(i.price*i.qty),0)}
function cartUnits(){return window.saleCart.reduce((sum,i)=>sum+i.qty,0)}
function updateSalePreview(){
  const p=products.find(x=>String(x.id)===$('#saleProduct')?.value);
  if(!p)return;
  $('#salePrice').textContent=money(p.price);
  $('#saleStock').textContent=p.stock+' db';
  const q=Math.max(1,Number($('#saleQty').value)||1);
  $('#saleTotal').textContent=money(cartTotal() || p.price*q);
}
function renderCart(){
  const items=$('#cartItems'), count=$('#cartCount'), total=$('#cartTotal'), checkout=$('#checkoutBtn');
  if(!items)return;
  count.textContent=`${cartUnits()} db · ${window.saleCart.length} tétel`;
  total.textContent=money(cartTotal());
  checkout.disabled=window.saleCart.length===0;
  items.innerHTML=window.saleCart.length?window.saleCart.map((i,idx)=>`<div class="cart-item">
    <div class="cart-item-main"><b>${esc(i.name)}</b><small>${money(i.price)} / db</small></div>
    <div class="cart-item-controls">
      <button type="button" class="cart-qty" onclick="changeCartQty(${idx},-1)">−</button>
      <strong>${i.qty}</strong>
      <button type="button" class="cart-qty" onclick="changeCartQty(${idx},1)">+</button>
      <span class="cart-item-total">${money(i.price*i.qty)}</span>
      <button type="button" class="cart-remove" onclick="removeCartItem(${idx})">×</button>
    </div>
  </div>`).join(''):'<div class="mini-note">A kosár üres. Válassz terméket és tedd a kosárba.</div>';
}
function addToCart(){
  const id=$('#saleProduct').value, p=products.find(x=>x.id===id), qty=Math.max(1,Math.floor(Number($('#saleQty').value)||1));
  if(!p)return;
  const existing=window.saleCart.find(x=>x.productId===p.id);
  const already=existing?.qty||0;
  if(already+qty>p.stock){
    playSfx('error',0.8);
    showToast('Nincs elég készlet',`${p.name}: legfeljebb ${p.stock-already} db tehető még a kosárba.`,'error');
    return;
  }
  if(existing)existing.qty+=qty; else window.saleCart.push({productId:p.id,name:p.name,price:p.price,qty});
  playSfx('success',0.38);
  $('#saleQty').value=1;
  renderCart();updateSalePreview();
}
function changeCartQty(idx,delta){
  const item=window.saleCart[idx], p=products.find(x=>x.id===item?.productId);
  if(!item||!p)return;
  const next=item.qty+delta;
  if(next<=0){window.saleCart.splice(idx,1)}
  else if(next>p.stock){playSfx('error',0.7);showToast('Nincs elég készlet',`${p.name}: ${p.stock} db érhető el.`,'error');return}
  else item.qty=next;
  renderCart();updateSalePreview();
}
function removeCartItem(idx){if(!window.saleCart[idx])return;playSfx('click',0.28);window.saleCart.splice(idx,1);renderCart();updateSalePreview()}
function clearCart(){if(!window.saleCart.length)return;window.saleCart=[];playSfx('click',0.28);renderCart();updateSalePreview()}

function renderShift(){
  if(!currentShift){
    $('#shiftBar').innerHTML=`<div><span class="shift-dot"></span><b>KASSZA ZÁRVA</b><div class="mini-note">Eladás előtt nyiss műszakot.</div></div><button class="btn btn-red" onclick="openShift()">MŰSZAK / KASSZA NYITÁSA</button>`;
    $('#shiftPanelBody').innerHTML=`<div class="mini-note">A kassza jelenleg zárva van.</div><div class="action-row" style="margin-top:12px"><button class="btn btn-red" onclick="openShift()">KASSZA NYITÁSA</button></div>`;
  }else{
    const rev=currentShift.id?0:0;
    $('#shiftBar').innerHTML=`<div><span class="shift-dot open"></span><b>KASSZA NYITVA</b><div class="shift-meta"><span>Indította: ${esc(currentShift.startedByName)}</span><span>Nyitás: ${new Date(currentShift.startedAt).toLocaleString('hu-HU')}</span><span>Műszakban: ${esc((currentShift.members||[]).join(', '))}</span></div></div><button class="btn btn-red" onclick="closeShift()">MŰSZAK / KASSZA ZÁRÁSA</button>`;
    const canAddMember=me && (me.id===currentShift.startedById || me.role==='manager' || me.role==='owner');
    $('#shiftPanelBody').innerHTML=`<div class="kpi-grid"><div class="kpi"><span class="muted">Indító</span><strong>${esc(currentShift.startedByName)}</strong></div><div class="kpi"><span class="muted">Nyitás</span><strong>${new Date(currentShift.startedAt).toLocaleTimeString('hu-HU',{hour:'2-digit',minute:'2-digit'})}</strong></div><div class="kpi"><span class="muted">Műszak tagjai</span><strong>${esc((currentShift.members||[]).join(', '))}</strong></div></div><div class="shift-member-actions" style="margin-top:15px">${canAddMember?'<button class="btn btn-ghost" type="button" onclick="addShiftMember()">＋ MŰSZAKTAG HOZZÁADÁSA</button>':''}<button class="btn btn-red" onclick="closeShift()">KASSZA ZÁRÁSA</button></div>`;
  }
}
async function openShift(){
  const data=await rmForm({title:'Kasszanyitás',kicker:'RED MOON / CASH REGISTER · OPEN',fields:[
    {id:'opening',label:'KEZDŐ KASSZA ÖSSZEGE (FT)',type:'number',value:'0',min:0,step:'1',required:true},
    {id:'members',label:'MŰSZAKBAN LÉVŐK NEVEI',value:me?.name||'',placeholder:'Nevek vesszővel elválasztva',required:true}
  ],confirmText:'KASSZA NYITÁSA'});
  if(!data)return;
  const opening=Number(data.opening);const members=String(data.members||'').split(',').map(x=>x.trim()).filter(Boolean);
  if(!Number.isFinite(opening)||opening<0||!members.length){await rmAlert('Add meg a kezdő kassza összegét és legalább egy műszaktagot.','Hiányzó adatok');return}
  try{await api('/api/shifts/open',{method:'POST',body:JSON.stringify({openingCash:opening,members})});playSfx('cash_open',0.7);await rmAlert('A műszak és a kassza sikeresen megnyílt.','Kassza megnyitva');await load()}catch(e){await rmAlert(e.message,'Kasszanyitás sikertelen')}
}
async function addShiftMember(){
  if(!currentShift)return;
  try{
    const d=await api('/api/shifts/eligible-members');
    if(!d.users?.length){await rmAlert('Minden elérhető dolgozó már benne van a műszakban.','Műszaktagok');return}
    const data=await rmForm({title:'Műszaktag hozzáadása',kicker:'RED MOON / SHIFT · TEAM CONTROL',fields:[
      {id:'userId',label:'DOLGOZÓ KIVÁLASZTÁSA',type:'select',value:d.users[0].id,options:d.users.map(x=>({value:x.id,label:`${x.name} · ${x.role.toUpperCase()}`}))}
    ],confirmText:'HOZZÁADÁS'});
    if(!data?.userId)return;
    const added=await api('/api/shifts/members',{method:'POST',body:JSON.stringify({userId:data.userId})});
    currentShift=added.shift;
    playSfx('success',0.42);
    showToast('Műszaktag hozzáadva',`${added.member.name} bekerült a jelenlegi műszakba.`,'success');
    renderShift();
    await loadPresence();
  }catch(e){playSfx('error',0.7);await rmAlert(e.message,'Műszaktag hozzáadása sikertelen')}
}
async function closeShift(){
  if(!currentShift)return;
  const data=await rmForm({title:'Kasszazárás',kicker:'RED MOON / CASH REGISTER · CLOSE',fields:[
    {id:'closing',label:'ZÁRÓ KASSZA ÖSSZEGE (FT)',type:'number',value:'0',min:0,step:'1',required:true},
    {id:'notes',label:'ZÁRÁSI MEGJEGYZÉS · OPCIONÁLIS',type:'textarea',value:'',placeholder:'Megjegyzés'}
  ],confirmText:'KASSZA ZÁRÁSA'});
  if(!data)return;
  const closing=Number(data.closing);if(!Number.isFinite(closing)||closing<0){await rmAlert('Adj meg érvényes záró kassza összeget.','Hibás összeg');return}
  try{const d=await api('/api/shifts/close',{method:'POST',body:JSON.stringify({closingCash:closing,notes:String(data.notes||'')})});playSfx('cash_close',0.65);showShiftCloseDocument(d.shift,d.transfer);currentShift=null;await load()}catch(e){await rmAlert(e.message,'Kasszazárás sikertelen')}
}
function showShiftCloseDocument(s,t){
  $('#docTitle').textContent='Műszakzárási dokumentáció';
  $('#docContent').innerHTML=`<div class="receipt-paper"><h2>RED MOON PUB</h2><p><b>Műszakazonosító:</b> ${esc(s.id)}</p><div class="receipt-line"><span>Nyitás</span><b>${new Date(s.startedAt).toLocaleString('hu-HU')}</b></div><div class="receipt-line"><span>Zárás</span><b>${new Date(s.endedAt).toLocaleString('hu-HU')}</b></div><div class="receipt-line"><span>Indította</span><b>${esc(s.startedByName)}</b></div><div class="receipt-line"><span>Zárta</span><b>${esc(s.closedByName)}</b></div><div class="receipt-line"><span>Műszakban</span><b>${esc((s.members||[]).join(', '))}</b></div><div class="receipt-line"><span>Eladások</span><b>${s.salesCount} db</b></div><div class="receipt-line"><span>Eladott tételek</span><b>${s.items} db</b></div><div class="receipt-line"><span>Bevétel</span><b>${money(s.revenue)}</b></div><div class="receipt-line"><span>Záró kassza</span><b>${money(s.closingCash)}</b></div><hr><p><b>Az elszámolandó összeg átutalása:</b></p><p>Számlaszám: <b>${t.account}</b><br>Név: <b>${t.name}</b><br><b>Közlemény: Zárási idő: ${new Date(s.endedAt).toLocaleString('hu-HU')}</b><br>Összeg: <b>${money(t.amount)}</b></p></div><div class="action-row" style="margin-top:12px"><button class="btn btn-red" onclick="printCurrentDoc()">NYOMTATÁS</button></div>`;
  $('#docModal').classList.add('show');
  window._printHtml=$('#docContent').innerHTML;
}
async function renderDocumentsHint(){
  const box=$('#documentsBody');
  if(!box)return;
  try{
    const d=await api('/api/documents');
    box.innerHTML=`<div class="doc-note">A számlázás <b>nem kötelező</b>. Eladáskor vagy később is elkészíthető.</div>`+
      (d.documents.length?`<div class="doc-list">${d.documents.slice(0,100).map(x=>`<div class="doc-item">
        <span><b>${esc(x.id)}</b><small>${new Date(x.createdAt).toLocaleString('hu-HU')} · ${esc(x.createdByName)}</small></span>
        <span class="doc-actions"><strong>${money(x.total)}</strong>
          <button class="table-action" onclick='showDocument(${JSON.stringify(x).replace(/</g,'\\u003c')})'>MEGNYITÁS</button>
          ${me.role==='owner'?`<button class="table-action danger" onclick="deleteInvoice('${esc(x.id)}')">TÖRLÉS</button>`:''}
        </span>
      </div>`).join('')}</div>`:'<div class="mini-note">Még nincs kiállított számla.</div>');
  }catch(e){box.innerHTML='<div class="mini-note">A számlák megnyitásához MANAGER vagy OWNER jogosultság szükséges.</div>'}
}

function updateLatestDocButtons(){}

async function deleteSale(id){
  if(!(me && (me.role==='manager'||me.role==='owner')))return;
  const sale=(window._lastSales||[]).find(x=>x.id===id);
  const label=sale?`${sale.product} · ${money(sale.total)}`:'ezt az eladást';
  const extra=sale?.documentId?`\n\nAz eladáshoz tartozó számla megmarad. Számlát csak OWNER tud törölni a Számla fülön.`:'';
  if(!await rmConfirm(`Biztosan törlöd: ${label}\n\nA készlet az eladott mennyiséggel vissza lesz állítva.${extra}`,'Eladás törlése'))return;
  try{await api('/api/sales/'+encodeURIComponent(id),{method:'DELETE'});playSfx('success',0.45);await load()}
  catch(e){playSfx('error',0.8);await rmAlert(e.message,'Művelet sikertelen')}
}
async function deleteInvoice(id){
  if(me?.role!=='owner'){playSfx('error',0.6);await rmAlert('Számlát csak OWNER jogosultsággal lehet törölni.','Nincs jogosultság');return}
  if(!await rmConfirm(`Biztosan törlöd a(z) ${id} számlát?\n\nAz eredeti eladás ettől nem törlődik.`,'Számla törlése'))return;
  try{await api('/api/documents/'+encodeURIComponent(id),{method:'DELETE'});playSfx('success',0.45);await load()}
  catch(e){playSfx('error',0.8);await rmAlert(e.message,'Művelet sikertelen')}
}
async function createDocument(saleId,type){
  const data=await rmForm({title:'Számla létrehozása',kicker:'RED MOON / DOCUMENTS · INVOICE',fields:[
    {id:'name',label:'SZÁMLÁZÁSI NÉV',value:'',placeholder:'Név / cégnév',required:true},
    {id:'address',label:'SZÁMLÁZÁSI CÍM',value:'',placeholder:'Cím',required:true},
    {id:'tax',label:'ADÓSZÁM · OPCIONÁLIS',value:'',placeholder:'Adószám'}
  ],confirmText:'SZÁMLA LÉTREHOZÁSA'});
  if(!data)return;
  const name=String(data.name||'').trim(),address=String(data.address||'').trim(),tax=String(data.tax||'').trim();
  if(!name||!address){await rmAlert('A számlázási név és cím megadása kötelező.','Hiányzó számlázási adatok');return}
  try{const d=await api('/api/documents',{method:'POST',body:JSON.stringify({saleId,type:'invoice',customer:{name,address,taxNumber:tax}})});showDocument(d.document);await load()}catch(e){await rmAlert(e.message,'Számlázás sikertelen')}
}
function showDocument(doc){
  const label='SZÁMLA';
  $('#docTitle').textContent=`${label} · ${doc.id}`;
  const items=Array.isArray(doc.items)?doc.items:[];
  $('#docContent').innerHTML=`<div class="receipt-paper"><h2>RED MOON PUB</h2><p><b>${label}</b><br>Dokumentum: ${esc(doc.id)}<br>Dátum: ${new Date(doc.createdAt).toLocaleString('hu-HU')}</p><p><b>Vásárló:</b> ${esc(doc.customer.name)}${doc.customer.address?'<br>'+esc(doc.customer.address):''}${doc.customer.taxNumber?'<br>Adószám: '+esc(doc.customer.taxNumber):''}</p>${items.map(item=>`<div class="receipt-line"><span>${esc(item.product)} × ${item.qty}</span><b>${money(item.total)}</b></div>`).join('')}<div class="receipt-line"><span>Fizetés</span><b>${doc.paymentMethod}</b></div><div class="receipt-line"><span>ÖSSZESEN</span><b>${money(doc.total)}</b></div><p style="margin-top:18px">Red Moon Pub · Zhen Yu Xiao</p></div><div class="action-row" style="margin-top:12px"><button class="btn btn-red" onclick="printCurrentDoc()">NYOMTATÁS</button></div>`;
  $('#docModal').classList.add('show');window._printHtml=$('#docContent').innerHTML;
}
function closeDoc(){$('#docModal').classList.remove('show')}
async function loadDocumentById(id){
  try{
    const d=await api('/api/documents');
    const doc=d.documents.find(x=>x.id===id);
    if(doc)showDocument(doc); else await rmAlert('A számla nem található.','Dokumentum')
  }catch(e){await rmAlert(e.message,'Művelet sikertelen')}
}
function printCurrentDoc(){if(!window._printHtml)return;const w=window.open('','_blank','width=700,height=900');w.document.write('<html><head><title>Red Moon Document</title><style>body{font-family:Arial;padding:30px}.receipt-paper{max-width:560px;margin:auto;border:1px solid #ddd;padding:28px}.receipt-line{display:flex;justify-content:space-between;border-bottom:1px dashed #999;padding:9px 0}</style></head><body>'+window._printHtml+'</body></html>');w.document.close();w.focus();w.print()}

function renderManager(){
  $('#managerInventory').innerHTML=products.filter(p=>p.active).map(p=>`<div class="manager-row"><div class="manager-product"><img class="stock-thumb manager-thumb" src="/${esc(p.image)}" alt="${esc(p.name)}" loading="lazy" onerror="this.style.display='none'"><div><b>${esc(p.name)}</b><div class="role">ITAL · ${money(p.price)}</div></div></div><span>${p.stock} db</span><input data-stock="${p.id}" type="number" min="0" value="${p.stock}" style="width:80px;background:#090506;border:1px solid #3a171f;color:white;padding:7px"><button data-save="${p.id}">MENTÉS</button></div>`).join('');
  document.querySelectorAll('[data-save]').forEach(b=>b.onclick=async()=>{const id=b.dataset.save;const inp=document.querySelector(`[data-stock="${id}"]`);try{const newStock=Number(inp.value);const saved=await api('/api/inventory/adjust',{method:'POST',body:JSON.stringify({productId:id,stock:newStock})});if(newStock===0)playSfx('error',0.75);else if(newStock<=products.find(p=>p.id===id)?.minStock)playSfx('low_stock',0.7);else playSfx('success',0.5);showToast('Raktár frissítve',`${saved.product.name}: ${newStock} db sikeresen feltöltve.`,'success');await load()}catch(e){await rmAlert(e.message,'Művelet sikertelen')}})
}
async function loadUsers(){
  const d=await api('/api/users');
  $('#usersList').innerHTML='<div class="mini-note" style="margin:12px 0">OWNER jogosultsággal meglévő fiókok is szerkeszthetők. Saját fiók nem törölhető; az utolsó OWNER rang nem vehető el.</div>'+d.users.map(u=>`<div class="user-row">
    <div><b>${esc(u.name)}</b><small class="user-meta">${esc(u.username)}</small></div>
    <span class="role">${u.role.toUpperCase()}</span>
    <div class="user-actions"><button class="table-action" onclick='editUser(${JSON.stringify(u).replace(/</g,'\\u003c')})'>SZERKESZTÉS</button><button class="danger-btn" onclick="deleteUser('${esc(u.id)}','${esc(u.name)}')">TÖRLÉS</button></div>
  </div>`).join('')
}
async function editUser(user){
  if(me?.role!=='owner')return;
  const data=await rmForm({title:`Fiók szerkesztése · ${user.name}`,kicker:'RED MOON / OWNER · ACCOUNT CONTROL',fields:[
    {id:'name',label:'TELJES NÉV',value:user.name,required:true},
    {id:'username',label:'FELHASZNÁLÓNÉV',value:user.username,required:true},
    {id:'role',label:'JOGOSULTSÁG',type:'select',value:user.role,options:[{value:'staff',label:'STAFF'},{value:'manager',label:'MANAGER'},{value:'owner',label:'OWNER'}]},
    {id:'password',label:'ÚJ JELSZÓ · OPCIONÁLIS',type:'password',value:'',placeholder:'Hagyd üresen, ha nem változik'}
  ],confirmText:'FIÓK MENTÉSE'});
  if(!data)return;
  const payload={name:String(data.name||'').trim(),username:String(data.username||'').trim(),role:String(data.role||'staff')};
  if(String(data.password||''))payload.password=String(data.password);
  if(!payload.name||!payload.username){await rmAlert('A név és a felhasználónév kötelező.','Hiányzó adatok');return}
  if(user.id===me.id && payload.role!=='owner'){await rmAlert('A saját OWNER rangodat ebből a fiókból nem veheted el.','Jogosultság');return}
  try{
    const d=await api('/api/users/'+encodeURIComponent(user.id),{method:'PATCH',body:JSON.stringify(payload)});
    if(user.id===me.id)me=d.user;
    await loadUsers(); await loadPresence();
    await rmAlert('A fiók adatai frissültek.','Fiók mentve');
  }catch(e){await rmAlert(e.message,'Fiók szerkesztése sikertelen')}
}
async function deleteUser(id,name){if(!await rmConfirm(`Biztosan törlöd: ${name}?`,'Fiók törlése'))return;try{await api('/api/users/'+encodeURIComponent(id),{method:'DELETE'});await loadUsers();await rmAlert('A fiók törölve.','Fiók törölve')}catch(e){await rmAlert(e.message,'Fiók törlése sikertelen')}}
async function deleteClosedShift(id){
  const shift=(window._ownerShiftData||[]).find(s=>s.id===id);
  const when=shift?new Date(shift.startedAt).toLocaleString('hu-HU'):'ezt a műszakot';
  const ok=await rmConfirm(`Biztosan törlöd a(z) ${when} időpontban indított lezárt műszakot? Az eladások, kapcsolódó számlák és a teljesítményadat is törlődik, a készlet visszaáll.`, 'Lezárt műszak törlése');
  if(!ok)return;
  try{
    const d=await api('/api/shifts/'+encodeURIComponent(id),{method:'DELETE'});
    playSfx('success',0.75);
    await rmAlert(`A műszak törölve. Eladások: ${d.deletedSales} · Számlák: ${d.deletedInvoices}`, 'Műszak törölve');
    await loadPerformance();
    await load();
  }catch(e){playSfx('error',0.9);await rmAlert(e.message,'Műszak törlése sikertelen')}
}

async function loadPerformance(){
  try{
    const d=await api('/api/owner/performance');
    $('#performance').innerHTML=`<h3>Műszak teljesítmény — csak OWNER</h3>`+(d.staff.length?`<div class="table-wrap"><table><thead><tr><th>Dolgozó</th><th>Műszak</th><th>Bevétel</th><th>Eladás</th><th>Db</th><th>Óra</th></tr></thead><tbody>${d.staff.map(x=>`<tr><td>${esc(x.name)}</td><td>${x.shifts}</td><td>${money(x.revenue)}</td><td>${x.sales}</td><td>${x.items}</td><td>${x.hours.toFixed(1)}</td></tr>`).join('')}</tbody></table></div>`:'<div class="mini-note">Még nincs lezárt műszak.</div>');
    window._ownerShiftData=d.shiftBreakdown||[];
    $('#ownerShifts').innerHTML=`<h3>Lezárt műszakok — dolgozói bontás</h3><div class="mini-note">A lezárt műszak törlése az adott műszak eladásait és kapcsolódó számláit is törli, a készletet pedig visszaállítja.</div><div class="table-wrap"><table><thead><tr><th>Nyitás</th><th>Zárás</th><th>Műszakban</th><th>Dolgozói teljesítmény</th><th>Bevétel</th><th>Művelet</th></tr></thead><tbody>${d.shiftBreakdown.map(s=>`<tr><td>${new Date(s.startedAt).toLocaleString('hu-HU')}</td><td>${new Date(s.endedAt).toLocaleString('hu-HU')}</td><td>${esc((s.members||[]).join(', '))}</td><td>${s.employees.length?s.employees.map(x=>`${esc(x.name)}: ${money(x.revenue)} / ${x.items} db`).join('<br>'):'Nincs rögzített eladás'}</td><td>${money(s.revenue)}</td><td><button class="table-action danger-action" onclick="deleteClosedShift('${s.id}')">TÖRLÉS</button></td></tr>`).join('')}</tbody></table></div>`;
  }catch(e){$('#performance').innerHTML='<div class="mini-note danger">Owner statisztika nem tölthető be.</div>'}
}

$('#loginForm').addEventListener('submit',async e=>{
  e.preventDefault(); $('#loginError').textContent='';
  try{
    const d=await api('/api/login',{method:'POST',body:JSON.stringify({username:$('#username').value,password:$('#password').value})});
    me=d.user; playSfx('success',0.58); showApp(); showToast('Sikeres bejelentkezés',`Üdv a Command Centerben, ${me.name}.`,'success');
  }catch(err){
    playSfx('error',0.82); $('#loginError').textContent=err.message; showToast('Sikertelen bejelentkezés','Hibás felhasználónév vagy jelszó.','error');
  }
});
$('#logoutBtn').addEventListener('click',async()=>{await api('/api/logout',{method:'POST'});location.reload()});
$('#saleProduct').addEventListener('change',updateSalePreview);
$('#saleQty').addEventListener('input',updateSalePreview);
$('#qtyMinus').onclick=()=>{$('#saleQty').value=Math.max(1,Number($('#saleQty').value)-1);updateSalePreview()};
$('#qtyPlus').onclick=()=>{$('#saleQty').value=Number($('#saleQty').value)+1;updateSalePreview()};
$('#addToCartBtn').onclick=addToCart;
$('#clearCartBtn').onclick=clearCart;
$('#refreshBtn').onclick=load;
$('#saleForm').addEventListener('submit',async e=>{
  e.preventDefault();const msg=$('#saleMsg');msg.textContent='';
  try{
    if(!window.saleCart.length){playSfx('error',0.8);throw new Error('A kosár üres — előbb tegyél legalább egy terméket a kosárba.')}
    const fresh=window.saleCart.map(i=>({ ...i, stock:products.find(p=>p.id===i.productId)?.stock??0 }));
    for(const i of fresh){
      if(i.qty>i.stock)throw new Error(`NINCS ELÉG KÉSZLET — ${i.name}: jelenleg ${i.stock} db van.`);
    }
    const d=await api('/api/sales',{method:'POST',body:JSON.stringify({
      items:window.saleCart.map(i=>({productId:i.productId,qty:i.qty})),
      paymentMethod:$('#paymentMethod').value
    })});
    latestSale=d.sales?.[0]||d.sale;
    playSfx('success',0.55);
    const first=latestSale;
    const invoiceBtn=first?` · <button type="button" class="btn" onclick="createDocument('${first.id}','invoice')">SZÁMLA KÉSZÍTÉSE</button>`:'';
    msg.style.color='#69e0ac';
    msg.innerHTML=`Kosár eladva · <b>${esc(d.cartId||d.transactionId||'—')}</b> · ${d.sales?.length||1} tétel · ${money(d.total)}${invoiceBtn}`;
    window.saleCart=[];$('#saleQty').value=1;renderCart();await load();
  }catch(err){playSfx('error',0.8);msg.style.color='#ff657a';msg.textContent=err.message}
});
renderCart();

$('#productForm').addEventListener('submit',async e=>{e.preventDefault();try{await api('/api/products',{method:'POST',body:JSON.stringify({name:$('#pName').value,category:$('#pCategory').value,price:Number($('#pPrice').value),stock:Number($('#pStock').value),minStock:Number($('#pMin').value)})});e.target.reset();await load();playSfx('success',0.5);showToast('Raktár frissítve','Az új termék sikeresen hozzáadva.','success')}catch(err){await rmAlert(err.message,'Termék létrehozása sikertelen')}});
$('#userForm').addEventListener('submit',async e=>{e.preventDefault();try{await api('/api/users',{method:'POST',body:JSON.stringify({name:$('#uName').value,username:$('#uUsername').value,password:$('#uPassword').value,role:$('#uRole').value})});e.target.reset();await loadUsers();await rmAlert('A felhasználó létrehozva.','Fiók létrehozva')}catch(err){await rmAlert(err.message,'Fiók létrehozása sikertelen')}});
boot().catch(e=>{console.error(e);showLogin();if($('#loginError'))$('#loginError').textContent=e.message});

async function loadNotifications(){
  const panel=$('#notificationsPanel'), body=$('#notificationsBody');
  if(!panel||!body)return;
  try{
    const d=await api('/api/notifications');
    const unread=d.notifications.filter(n=>!n.read);
    panel.classList.toggle('has-unread',unread.length>0);
    body.innerHTML=d.notifications.length?d.notifications.map(n=>`<button class="notification ${n.read?'read':'unread'}" onclick="markNotification('${n.id}')"><span class="notification-dot"></span><span><b>${esc(n.title)}</b><small>${esc(n.message)}<br>${new Date(n.at).toLocaleString('hu-HU')}</small></span></button>`).join(''):'<div class="mini-note">Nincs új értesítés.</div>';
  }catch{}
}
async function markNotification(id){
  try{await api('/api/notifications/read',{method:'POST',body:JSON.stringify({id})});await loadNotifications()}catch{}
}
setInterval(()=>{if(me&&(me.role==='manager'||me.role==='owner'))loadNotifications()},15000);
