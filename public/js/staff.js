if(location.protocol==='file:'){ location.replace('http://localhost:8787/staff'); }
const $=s=>document.querySelector(s);
let me=null,products=[],currentShift=null,latestSale=null, presenceTimer=null, heartbeatTimer=null, realtimeSource=null, realtimeRefreshTimer=null, realtimePollTimer=null; window.me=null; window.products=[];
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
      if(f.type==='multiselect')return `<div class="modal-field modal-multiselect"><label>${esc(f.label)}</label><div class="modal-check-grid">${(f.options||[]).map((o,i)=>`<label class="modal-check"><input type="checkbox" name="modal_${esc(f.id)}" value="${esc(o.value)}" ${Array.isArray(f.value)&&f.value.includes(String(o.value))?'checked':''}><span><b>${esc(o.label)}</b>${o.meta?`<small>${esc(o.meta)}</small>`:''}</span></label>`).join('')}</div></div>`;
      if(f.readonly)return `<div class="modal-field modal-fixed-message"><label>${esc(f.label)}</label><div class="modal-fixed-text">${esc(value)}</div></div>`;
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
  body.querySelectorAll('input,textarea,select').forEach(el=>{
    const key=el.type==='checkbox'
      ? String(el.name||'').replace(/^modal_/,'')
      : String(el.id||'').replace(/^modal_/,'');
    if(el.type==='checkbox' && key){
      if(!Array.isArray(vals[key]))vals[key]=[];
      if(el.checked)vals[key].push(el.value);
    }else if(el.type!=='checkbox' && key){vals[key]=el.value}
  });
  closeActionModal(vals);
}
async function rmAlert(message,title='RED MOON / ÉRTESÍTÉS'){
  await openActionModal({title,kicker:'RED MOON / COMMAND',fields:[{id:'message',label:'ÜZENET',type:'textarea',value:String(message),readonly:true}],confirmText:'RENDBEN'}).then(()=>{});
}
async function rmConfirm(message,title='MŰVELET MEGERŐSÍTÉSE'){
  const result=await openActionModal({title,kicker:'RED MOON / BIZTONSÁGI ELLENŐRZÉS',fields:[{id:'message',label:'ELLENŐRZÉS',type:'textarea',value:String(message),readonly:true}],confirmText:'MEGERŐSÍTEM',danger:true});
  return !!result;
}
$('#actionCancel').addEventListener('click',()=>closeActionModal(null));
$('#actionConfirm').addEventListener('click',submitActionModal);
document.querySelectorAll('[data-modal-close]').forEach(el=>el.addEventListener('click',()=>closeActionModal(null)));
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&$('#actionModal')?.classList.contains('show'))closeActionModal(null)});
// V40.2 — consistent click feedback across Command Center
document.addEventListener('click',e=>{const el=e.target.closest('button,a,input[type=button],input[type=submit],select');if(!el)return;if(el.dataset.noClickSound==='1')return;if(el.closest('#actionModal,.sales-actions,.doc-actions,.cart-box,.inventory'))return;if(['actionCancel','actionConfirm'].includes(el.id))return;playSfx('click',.18)},{passive:true});


function showToast(title,message,kind='success'){
  const modal=$('#toastModal'), icon=$('#toastModal .toast-icon'), titleEl=$('#toastTitle'), textEl=$('#toastText');
  if(!modal||!titleEl||!textEl)return;
  titleEl.textContent=title; textEl.textContent=message;
  if(icon){icon.textContent=kind==='error'?'!':'✓'; icon.classList.toggle('toast-error',kind==='error');}
  modal.classList.add('show'); modal.setAttribute('aria-hidden','false');
  clearTimeout(window._toastTimer); window._toastTimer=setTimeout(()=>{modal.classList.remove('show');modal.setAttribute('aria-hidden','true')},3200);
}
document.querySelectorAll('[data-toast-close]').forEach(el=>el.addEventListener('click',()=>{playSfx('click',.18);$('#toastModal')?.classList.remove('show')}));

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
async function boot(){
  const d=await api('/api/me');
  if(d.user){if(d.user.portal==='dj' || d.user.role==='dj'){showLogin();$('#loginError').textContent='Ez DJ fiók. A DJ konzolban lehet vele belépni.';return;}me=d.user;showApp();return;}
  showAccessChooser();
}
function showAccessChooser(){
  document.body.classList.add('staff-unauth');
  $('#accessChooser')?.classList.remove('hidden');
  $('#loginView')?.classList.add('hidden');
  $('#appView')?.classList.add('hidden');
}
function showLogin(){
  document.body.classList.add('staff-unauth');
  $('#accessChooser')?.classList.add('hidden');
  $('#loginView')?.classList.remove('hidden');
  $('#appView')?.classList.add('hidden');
  setTimeout(()=>$('#username')?.focus(),60);
}
$('#openCashAccess')?.addEventListener('click',e=>{e.preventDefault();location.href='staff-login.html';});
$('#backToAccess')?.addEventListener('click',()=>{playSfx('click',.18);showAccessChooser();});
function showApp(){
  document.body.classList.remove('staff-unauth');
  $('#accessChooser')?.classList.add('hidden');
  $('#loginView')?.classList.add('hidden');
  window.me=me;
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
  products=p.products;window.products=products;window.me=me;currentShift=sh.shift||null;checkStockAlerts(products);
  renderProducts();renderDashboard(d);renderSales(s.sales);renderShift();renderDocumentsHint();if(me.role==='manager'||me.role==='owner')loadNotifications();
  if(me.role==='manager'||me.role==='owner')renderManager();
  if(me.role==='owner'){loadUsers();loadPerformance()}
}
function renderProducts(){
  const active=products.filter(p=>p.active);
  $('#saleProduct').innerHTML=active.map(p=>`<option value="${p.id}">${esc(p.name)} · ${money(p.price)}</option>`).join('');
  let catalog=document.querySelector('.staff-sale-catalog');
  if(!catalog){catalog=document.createElement('div');catalog.className='staff-sale-catalog';$('#saleProduct').parentElement.insertBefore(catalog,$('#saleProduct'));}
  catalog.innerHTML=active.map(p=>`<button type="button" class="staff-sale-product ${p.stock<1?'soldout':''}" data-product-id="${esc(p.id)}" ${p.stock<1?'disabled':''}><span class="staff-sale-art"><img src="/${esc(p.image)}" alt="${esc(p.name)}" loading="lazy" onerror="this.style.display='none'"></span><span class="staff-sale-info"><b>${esc(p.name)}</b><small>${money(p.price)}</small><em>${p.stock>0?p.stock+' db készleten':'ELFOGYOTT'}</em></span></button>`).join('');
  catalog.querySelectorAll('[data-product-id]').forEach(btn=>btn.addEventListener('click',()=>{const sel=$('#saleProduct');sel.value=btn.dataset.productId;sel.dispatchEvent(new Event('change',{bubbles:true}));catalog.querySelectorAll('.staff-sale-product').forEach(x=>x.classList.toggle('active',x===btn));}));
  updateSalePreview();
  $('#inventory').innerHTML=active.map(p=>`<article class="product-card ${p.stock<=p.minStock?'low':''}">
    <div class="product-card-art"><img src="/${esc(p.image)}" alt="${esc(p.name)}" loading="lazy" onerror="this.style.display='none'"><span class="product-stock">${p.stock} DB</span></div>
    <div class="product-card-body"><b>${esc(p.name)}</b><small>${money(p.price)} · minimum ${p.minStock} db</small></div>
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
  $('#statRevenue').textContent=money(d.overallRevenue ?? d.today.revenue);const firstLabel=document.querySelector('.stat-grid article span');if(firstLabel)firstLabel.textContent='OVERALL BEVÉTEL';$('#statItems').textContent=d.today.items+' db';$('#statLow').textContent=d.lowStock.length;
  $('#alerts').innerHTML=d.lowStock.length?d.lowStock.map(p=>`<div class="alert"><b>${esc(p.name)} · ${p.stock} db</b><small>Minimum: ${p.minStock} db</small></div>`).join(''):'<div class="alert"><b>Minden rendben.</b><small>Nincs alacsony készlet.</small></div>';
}
function renderSales(sales){
  window._lastSales=sales;
  const canDelete=me && (me.role==='manager'||me.role==='owner');
  const groups=new Map();
  (sales||[]).forEach(s=>{
    const key=String(s.cartId||s.transactionId||s.id);
    if(!groups.has(key))groups.set(key,[]);
    groups.get(key).push(s);
  });
  const carts=[...groups.entries()].slice(0,30).map(([cartId,items])=>({cartId,items,total:items.reduce((a,x)=>a+Number(x.total||0),0),qty:items.reduce((a,x)=>a+Number(x.qty||0),0),at:items[0]?.at,user:items[0]?.user,paymentMethod:items[0]?.paymentMethod,documentId:items.find(x=>x.documentId)?.documentId||null,receiptId:items.find(x=>x.receiptId)?.receiptId||null}));
  window._saleCarts=carts;
  $('#salesTable').innerHTML=carts.length?carts.map(c=>{
    const lines=c.items.map(x=>`${esc(x.product)} × ${x.qty}`).join('<br>');
    const doc=c.documentId?`<button class="table-action" onclick="loadDocumentById('${esc(c.documentId)}')">SZÁMLÁZVA</button>`:`<button class="table-action" onclick="createDocument('${esc(c.items[0].id)}','invoice')">SZÁMLÁZÁS</button>`;
    const receipt=c.receiptId?`<button class="table-action" onclick="loadDocumentById('${esc(c.receiptId)}')">NYUGTA</button>`:`<button class="table-action" onclick="createReceipt('${esc(c.items[0].id)}')">NYUGTA</button>`;
    return `<tr>
      <td data-label="Idő">${new Date(c.at).toLocaleTimeString('hu-HU',{hour:'2-digit',minute:'2-digit'})}</td>
      <td data-label="Dolgozó">${esc(c.user)}</td>
      <td data-label="Kosár ID"><span class="cart-id">${esc(c.cartId)}</span></td>
      <td data-label="Tartalom" class="sale-product-cell">${lines}</td>
      <td data-label="Db">${c.qty}</td>
      <td data-label="Összeg">${money(c.total)}</td>
      <td data-label="Fizetés">${paymentBadge(c.paymentMethod)}</td>
      <td data-label="Kezelés" class="sales-actions">${doc}${receipt}${canDelete?`<button class="table-action danger" onclick="deleteSaleCart('${esc(c.cartId)}')">KOSÁR TÖRLÉSE</button>`:''}</td>
    </tr>`;
  }).join(''):'<tr><td colspan="8">Még nincs eladás.</td></tr>';
}

window.saleCart=window.saleCart||[];
function cartTotal(){return window.saleCart.reduce((sum,i)=>sum+(i.price*i.qty),0)}
function cartUnits(){return window.saleCart.reduce((sum,i)=>sum+i.qty,0)}
function setPaymentMethod(method){
  const m=method==='transfer'?'transfer':'cash';
  const select=document.querySelector('#paymentMethod'); if(select)select.value=m;
  document.querySelectorAll('.payment-choice').forEach(b=>b.classList.toggle('active',b.dataset.payment===m));
}
function paymentBadge(method){
  const m=method==='transfer'?'transfer':'cash';
  return m==='transfer' ? '<span class="payment-badge transfer" title="Átutalás" aria-label="Átutalás"><span>📱</span><b>Átutalás</b></span>' : '<span class="payment-badge cash" title="Készpénz" aria-label="Készpénz"><span>💵</span><b>Készpénz</b></span>';
}
function updateSalePreview(){
  const p=products.find(x=>String(x.id)===$('#saleProduct')?.value);
  if(!p)return;
  $('#salePrice').textContent=money(p.price);
  $('#saleStock').textContent=p.stock+' db';
  const q=Math.max(1,Number($('#saleQty').value)||1);
  $('#saleTotal').textContent=money(cartTotal() || p.price*q);
  document.querySelectorAll('.staff-sale-product').forEach(x=>x.classList.toggle('active',x.dataset.productId===p.id));
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
    $('#shiftBar').innerHTML=`<div><span class="shift-dot open"></span><b>KASSZA NYITVA</b><div class="shift-meta"><span>Műszak ID: ${esc(currentShift.id)}</span><span>Indította: ${esc(currentShift.startedByName)}</span><span>Nyitás: ${new Date(currentShift.startedAt).toLocaleString('hu-HU')}</span><span>Műszakban: ${esc((currentShift.members||[]).join(', '))}</span></div></div><button class="btn btn-red" onclick="closeShift()">MŰSZAK / KASSZA ZÁRÁSA</button>`;
    const canAddMember=me && (me.id===currentShift.startedById || me.role==='manager' || me.role==='owner');
    $('#shiftPanelBody').innerHTML=`<div class="kpi-grid"><div class="kpi"><span class="muted">Műszak ID</span><strong>${esc(currentShift.id)}</strong></div><div class="kpi"><span class="muted">Indító</span><strong>${esc(currentShift.startedByName)}</strong></div><div class="kpi"><span class="muted">Nyitás</span><strong>${new Date(currentShift.startedAt).toLocaleTimeString('hu-HU',{hour:'2-digit',minute:'2-digit'})}</strong></div><div class="kpi"><span class="muted">Műszak tagjai</span><strong>${esc((currentShift.members||[]).join(', '))}</strong></div></div><div class="shift-member-actions" style="margin-top:15px">${canAddMember?'<button class="btn btn-ghost" type="button" onclick="addShiftMember()">＋ MŰSZAKTAG HOZZÁADÁSA</button>':''}<button class="btn btn-red" onclick="closeShift()">KASSZA ZÁRÁSA</button></div>`;
  }
}
async function openShift(){
  try{
    const people=await api('/api/shifts/available-members');
    const users=(people.users||[]).filter(x=>x.role!=='dj');
    if(!users.length){await rmAlert('Nincs hozzáadható meglévő dolgozói fiók.','Műszaktagok');return}
    const selected=users.filter(x=>x.id===me?.id).map(x=>x.id);
    const data=await rmForm({title:'Kasszanyitás',kicker:'RED MOON / CASH REGISTER · OPEN',fields:[
      {id:'opening',label:'KEZDŐ KASSZA ÖSSZEGE (FT)',type:'number',value:'0',min:0,step:'1',required:true},
      {id:'members',label:'MŰSZAKTAGOK KIVÁLASZTÁSA',type:'multiselect',value:selected,options:users.map(x=>({value:x.id,label:x.name,meta:x.role.toUpperCase()}))}
    ],confirmText:'KASSZA NYITÁSA'});
    if(!data)return;
    const opening=Number(data.opening);const memberIds=Array.isArray(data.members)?data.members:[];
    if(!Number.isFinite(opening)||opening<0||!memberIds.length){await rmAlert('Add meg a kezdő kassza összegét és válassz legalább egy műszaktagot.','Hiányzó adatok');return}
    await api('/api/shifts/open',{method:'POST',body:JSON.stringify({openingCash:opening,memberIds})});
    playSfx('cash_open',0.7);await rmAlert('A műszak és a kassza sikeresen megnyílt.','Kassza megnyitva');await load();
  }catch(e){await rmAlert(e.message,'Kasszanyitás sikertelen')}
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
  $('#docTitle').textContent=`Műszakzárás · ${s.id}`;
  const members=(s.memberHistory||[]).map(m=>`<div class="shift-history-row"><span>${esc(m.name)}</span><small>${new Date(m.joinedAt).toLocaleString('hu-HU')} · ${esc(m.reason||'csatlakozott')}</small></div>`).join('');
  const cash=Number(s.cashRevenue||0), transfer=Number(s.transferRevenue||0), overall=Number(s.overallRevenue??s.revenue??0);
  $('#docContent').innerHTML=`<div class="receipt-paper premium-document shift-document">
    <div class="document-brand"><span class="document-orb"></span><div><strong>RED MOON PUB</strong><small>SEE CITY · SHIFT CLOSING REPORT</small></div></div>
    <div class="document-title-block"><span>MŰSZAKZÁRÁSI JELENTÉS</span><h2>${esc(s.id)}</h2></div>
    <div class="document-grid">
      <div><small>NYITÁS</small><b>${new Date(s.startedAt).toLocaleString('hu-HU')}</b></div>
      <div><small>ZÁRÁS</small><b>${new Date(s.endedAt).toLocaleString('hu-HU')}</b></div>
      <div><small>INDÍTOTTA</small><b>${esc(s.startedByName)}</b></div>
      <div><small>ZÁRTA</small><b>${esc(s.closedByName)}</b></div>
    </div>
    <div class="document-section"><label>MŰSZAK TAGJAI</label>${members||'<div class="mini-note">Nincs rögzített tagelőzmény.</div>'}</div>
    <div class="document-totals">
      <div><span>KP ÖSSZESEN</span><strong>${money(cash)}</strong></div>
      <div><span>ÁTUTALÁS ÖSSZESEN</span><strong>${money(transfer)}</strong></div>
      <div class="overall"><span>OVERALL</span><strong>${money(overall)}</strong></div>
    </div>
    <div class="document-section compact"><div class="receipt-line"><span>Eladások</span><b>${s.salesCount} kosár</b></div><div class="receipt-line"><span>Eladott tételek</span><b>${s.items} db</b></div><div class="receipt-line"><span>Záró kassza</span><b>${money(s.closingCash)}</b></div></div>
    <div class="transfer-card"><small>ELUTALANDÓ TELJES VÉGÖSSZEG</small><strong>${money(overall)}</strong><div class="bank-line"><span>Számlaszám</span><b>${esc(t.account)}</b></div><div class="bank-line"><span>Név</span><b>${esc(t.name)}</b></div><div class="bank-line"><span>Közlemény</span><b>${esc(s.id)}</b></div></div>
    ${s.notes?`<div class="document-note"><small>MEGJEGYZÉS</small>${esc(s.notes)}</div>`:''}
  </div>`;
  $('#docModal').classList.add('show');
}
async function renderDocumentsHint(){
  const box=$('#documentsBody'); if(!box)return;
  try{const d=await api('/api/documents');const docs=d.documents||[];const invoices=docs.filter(x=>x.type==='invoice'),receipts=docs.filter(x=>x.type==='receipt');
    const section=(title,list,kind)=>`<div class="document-section-card"><div class="doc-note"><b>${title}</b><br>Maximum 6 dokumentum látszik egyszerre · továbbiakhoz görgess.</div><div class="v57-doc-scroll">${list.map(x=>`<div class="doc-item"><span><b>${esc(x.id)}</b><small>${new Date(x.createdAt).toLocaleString('hu-HU')} · ${esc(x.createdByName||'Red Moon')}</small></span><span class="doc-actions"><strong>${money(x.total)}</strong><button class="table-action" onclick='showDocument(${JSON.stringify(x).replace(/</g,'\u003c')})'>MEGNYITÁS</button>${kind==='invoice'&&me.role==='owner'?`<button class="table-action danger" onclick="deleteInvoice('${esc(x.id)}')">TÖRLÉS</button>`:''}${kind==='receipt'&&['manager','owner'].includes(me?.role)?`<button class="table-action danger" onclick="deleteReceipt('${esc(x.id)}')">TÖRLÉS</button>`:''}</span></div>`).join('')||'<div class="mini-note">Még nincs ilyen dokumentum.</div>'}</div></div>`;
    box.innerHTML=`<div class="doc-note"><b>SZÁMLÁK / NYUGTÁK</b><br>Manager és Owner megtekintheti az elkészült dokumentumokat. Számlát kizárólag OWNER törölhet.</div>`+section('SZÁMLÁK',invoices,'invoice')+section('NYUGTÁK',receipts,'receipt');
  }catch(e){box.innerHTML='<div class="mini-note">A dokumentumok megnyitásához MANAGER vagy OWNER jogosultság szükséges.</div>'}
}

function updateLatestDocButtons(){}

async function deleteSaleCart(cartId){
  if(!(me && (me.role==='manager'||me.role==='owner')))return;
  const cart=(window._saleCarts||[]).find(x=>x.cartId===cartId);
  if(!cart)return;
  const detail=cart.items.map(x=>`${x.product} × ${x.qty}`).join('\n');
  if(!await rmConfirm(`Biztosan törlöd a teljes kosarat: ${cartId}?\n\n${detail}\n\nA teljes kosár minden tétele egyszerre törlődik, és az összes mennyiség azonnal visszakerül a készletbe. A kapcsolódó számla megmarad. A nyugta automatikusan törlődik.`,'TELJES KOSÁR TÖRLÉSE'))return;
  try{const d=await api('/api/sales/cart/'+encodeURIComponent(cartId),{method:'DELETE'});playSfx('success',0.5);await rmAlert(`A teljes kosár törölve.\n\nTételek: ${d.deletedSales}\nVisszaadott érték: ${money(d.deletedTotal)}\nA készlet minden érintett termékkel visszaállt.`,'Kosár törölve');await load()}
  catch(e){playSfx('error',0.8);await rmAlert(e.message,'Kosár törlése sikertelen')}
}
async function deleteSale(id){
  const sale=(window._lastSales||[]).find(x=>x.id===id); if(sale?.cartId)return deleteSaleCart(sale.cartId);
}
async function deleteInvoice(id){
  if(me?.role!=='owner'){playSfx('error',0.6);await rmAlert('Számlát csak OWNER jogosultsággal lehet törölni.','Nincs jogosultság');return}
  if(!await rmConfirm(`Biztosan törlöd a(z) ${id} számlát?\n\nAz eredeti eladás ettől nem törlődik.`,'Számla törlése'))return;
  try{await api('/api/documents/'+encodeURIComponent(id),{method:'DELETE'});playSfx('success',0.45);await load()}
  catch(e){playSfx('error',0.8);await rmAlert(e.message,'Művelet sikertelen')}
}
async function deleteReceipt(id){
  if(!['manager','owner'].includes(me?.role)){playSfx('error',0.6);await rmAlert('Nyugtát csak MANAGER vagy OWNER jogosultsággal lehet törölni.','Nincs jogosultság');return}
  if(!await rmConfirm(`Biztosan törlöd a(z) ${id} nyugtát?\n\nAz eredeti eladás nem törlődik, csak a nyugta kerül eltávolításra.`,'Nyugta törlése'))return;
  try{await api('/api/documents/'+encodeURIComponent(id),{method:'DELETE'});playSfx('success',0.45);await rmAlert('A nyugta törölve lett.','Nyugta törölve');await load()}
  catch(e){playSfx('error',0.8);await rmAlert(e.message,'Nyugta törlése sikertelen')}
}

async function createReceipt(saleId){
  try{const d=await api('/api/receipts',{method:'POST',body:JSON.stringify({saleId})});showDocument(d.document);await load()}
  catch(e){await rmAlert(e.message,'Nyugta készítése sikertelen')}
}

async function createDocument(saleId,type){
  const existingSale=(window._lastSales||[]).find(x=>x.id===saleId);
  if(existingSale?.documentId){
    await rmAlert('Az eladás már ki lett számlázva.','Az eladás már ki lett számlázva.');
    return;
  }
  const existingCart=(window._saleCarts||[]).find(c=>c.items?.some(x=>x.id===saleId));
  if(existingCart?.documentId){
    await rmAlert('Az eladás már ki lett számlázva.','Az eladás már ki lett számlázva.');
    return;
  }
  const data=await rmForm({title:'Számla létrehozása',kicker:'RED MOON / DOCUMENTS · INVOICE',fields:[
    {id:'name',label:'SZÁMLÁZÁSI NÉV',value:'',placeholder:'Név / cégnév',required:true},
    {id:'address',label:'SZÁMLÁZÁSI CÍM',value:'',placeholder:'Cím',required:true},
    {id:'tax',label:'ADÓSZÁM · OPCIONÁLIS',value:'',placeholder:'Adószám'}
  ],confirmText:'SZÁMLA LÉTREHOZÁSA'});
  if(!data)return;
  const name=String(data.name||'').trim(),address=String(data.address||'').trim(),tax=String(data.tax||'').trim();
  if(!name||!address){await rmAlert('A számlázási név és cím megadása kötelező.','Hiányzó számlázási adatok');return}
  try{
    const d=await api('/api/documents',{method:'POST',body:JSON.stringify({saleId,type:'invoice',customer:{name,address,taxNumber:tax}})});
    if(d.alreadyExists){
      await rmAlert('Az eladás már ki lett számlázva.','Az eladás már ki lett számlázva.');
      await load();
      return;
    }
    showDocument(d.document);await load()
  }catch(e){await rmAlert(e.message,'Számlázás sikertelen')}
}
function showDocument(doc){
  const isReceipt=doc.type==='receipt';
  const label=isReceipt?'NYUGTA':'SZÁMLA';
  $('#docTitle').textContent=`${label} · ${doc.id}`;
  const items=Array.isArray(doc.items)?doc.items:[];
  const customer=doc.customer||{};
  $('#docContent').innerHTML=`<div class="receipt-paper premium-document ${isReceipt?'receipt-document':'invoice-document'}">
    <div class="document-brand"><span class="document-orb"></span><div><strong>RED MOON PUB</strong><small>SEE CITY · ${isReceipt?'OFFICIAL RECEIPT':'INVOICE DOCUMENT'}</small></div></div>
    <div class="document-title-block"><span>${label}</span><h2>${esc(doc.id)}</h2><small>${new Date(doc.createdAt).toLocaleString('hu-HU')}</small></div>
    <div class="document-customer"><div><small>${isReceipt?'TRANZAKCIÓ':'VÁSÁRLÓ'}</small><b>${isReceipt?esc(doc.transactionId||'—'):esc(customer.name||'—')}</b></div>${!isReceipt&&customer.address?`<div><small>SZÁMLÁZÁSI CÍM</small><b>${esc(customer.address)}</b></div>`:''}${!isReceipt&&customer.taxNumber?`<div><small>ADÓSZÁM</small><b>${esc(customer.taxNumber)}</b></div>`:''}</div>
    <div class="document-items">${items.map(item=>`<div class="receipt-line"><span>${esc(item.product)} <small>× ${item.qty}</small></span><b>${money(item.total)}</b></div>`).join('')}</div>
    <div class="document-payment"><span>FIZETÉS</span><b>${doc.paymentMethod==='transfer'?'📱 ÁTUTALÁS':'💵 KÉSZPÉNZ'}</b></div>
    <div class="document-grand"><span>ÖSSZESEN</span><strong>${money(doc.total)}</strong></div>
    <div class="document-footer">RED MOON PUB · SEE CITY RP · ZHEN YU XIAO</div>
  </div>`;
  $('#docModal').classList.add('show');
}
function closeDoc(){$('#docModal').classList.remove('show')}
async function loadDocumentById(id){
  try{
    const d=await api('/api/documents');
    const doc=d.documents.find(x=>x.id===id);
    if(doc)showDocument(doc); else await rmAlert('A számla nem található.','Dokumentum')
  }catch(e){await rmAlert(e.message,'Művelet sikertelen')}
}
function renderManager(){
  $('#managerInventory').innerHTML=products.filter(p=>p.active).map(p=>`<div class="manager-row"><div class="manager-product"><img class="stock-thumb manager-thumb" src="/${esc(p.image)}" alt="${esc(p.name)}" loading="lazy" onerror="this.style.display='none'"><div><b>${esc(p.name)}</b><div class="role">ITAL · ${money(p.price)}</div></div></div><span>${p.stock} db</span><input data-stock="${p.id}" type="number" min="0" value="${p.stock}" style="width:80px;background:#090506;border:1px solid #3a171f;color:white;padding:7px">${me?.role==='owner'?`<input data-price="${p.id}" type="number" min="0" value="${p.price}" style="width:95px;background:#090506;border:1px solid #3a171f;color:white;padding:7px" title="Eladási ár">`:''}<button data-save="${p.id}">MENTÉS</button></div>`).join('');
  document.querySelectorAll('[data-save]').forEach(b=>b.onclick=async()=>{const id=b.dataset.save;const inp=document.querySelector(`[data-stock="${id}"]`);try{const newStock=Number(inp.value);const saved=await api('/api/inventory/adjust',{method:'POST',body:JSON.stringify({productId:id,stock:newStock})});if(me?.role==='owner'){const priceEl=document.querySelector(`[data-price="${id}"]`);if(priceEl)await api('/api/products/'+encodeURIComponent(id),{method:'PATCH',body:JSON.stringify({price:Number(priceEl.value)})});}if(newStock===0)playSfx('error',0.75);else if(newStock<=products.find(p=>p.id===id)?.minStock)playSfx('low_stock',0.7);else playSfx('success',0.5);showToast('Raktár frissítve',`${saved.product.name}: ${newStock} db sikeresen feltöltve.`,'success');await load()}catch(e){await rmAlert(e.message,'Művelet sikertelen')}})
}
function formatLastActive(at){
  if(!at)return 'Még nem lépett be';
  const d=new Date(at);
  if(Number.isNaN(d.getTime()))return 'Ismeretlen';
  return d.toLocaleString('hu-HU',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'});
}
async function loadUsers(){
  const d=await api('/api/users');
  $('#usersList').innerHTML='<div class="mini-note" style="margin:12px 0">OWNER jogosultsággal meglévő fiókok is szerkeszthetők. Saját fiók nem törölhető; az utolsó OWNER rang nem vehető el.</div>'+d.users.map(u=>`<div class="user-row">
    <div class="user-main"><b>${esc(u.name)}</b>${u.nickname?`<small class="user-meta">${esc(u.nickname)}</small>`:''}<small class="user-meta">${esc(u.username)}</small><small class="user-last-active">UTOLSÓ AKTIVITÁS · ${esc(formatLastActive(u.lastActiveAt))}</small></div>
    <span class="role">${u.role.toUpperCase()}</span>
    <div class="user-actions"><button class="table-action" onclick='editUser(${JSON.stringify(u).replace(/</g,'\\u003c')})'>SZERKESZTÉS</button><button class="danger-btn" onclick="deleteUser('${esc(u.id)}','${esc(u.name)}')">Törlés</button></div>
  </div>`).join('')
}
async function editUser(user){
  if(me?.role!=='owner')return;
  const data=await rmForm({title:`Fiók szerkesztése · ${user.name}`,kicker:'RED MOON / OWNER · ACCOUNT CONTROL',fields:[
    {id:'name',label:'TELJES NÉV',value:user.name,required:true},
    {id:'nickname',label:'BECENÉV · OPCIONÁLIS',value:user.nickname||'',placeholder:'Pl. Rei'},
    {id:'username',label:'FELHASZNÁLÓNÉV',value:user.username,required:true},
    {id:'role',label:'JOGOSULTSÁG',type:'select',value:user.role,options:[{value:'staff',label:'STAFF'},{value:'manager',label:'MANAGER'},{value:'owner',label:'OWNER'},{value:'dj',label:'DJ ACCESS'}]},
    {id:'password',label:'ÚJ JELSZÓ · OPCIONÁLIS',type:'password',value:'',placeholder:'Hagyd üresen, ha nem változik'}
  ],confirmText:'FIÓK MENTÉSE'});
  if(!data)return;
  const payload={name:String(data.name||'').trim(),nickname:String(data.nickname||'').trim(),username:String(data.username||'').trim(),role:String(data.role||'staff')};
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
    $('#ownerShifts').innerHTML=`<h3>Lezárt műszakok — dolgozói bontás</h3><div class="mini-note">A lezárt műszak törlése az adott műszak eladásait és kapcsolódó számláit is törli, a készletet pedig visszaállítja.</div><div class="table-wrap"><table><thead><tr><th>Nyitás</th><th>Zárás</th><th>Műszakban</th><th>Dolgozói teljesítmény</th><th>Bevétel</th><th>Művelet</th></tr></thead><tbody>${d.shiftBreakdown.map(s=>`<tr><td>${new Date(s.startedAt).toLocaleString('hu-HU')}</td><td>${new Date(s.endedAt).toLocaleString('hu-HU')}</td><td>${esc((s.members||[]).join(', '))}</td><td>${s.employees.length?s.employees.map(x=>`${esc(x.name)}: ${money(x.revenue)} / ${x.items} db`).join('<br>'):'Nincs rögzített eladás'}</td><td>${money(s.revenue)}</td><td><button class="table-action danger-action" onclick="deleteClosedShift('${s.id}')">Törlés</button></td></tr>`).join('')}</tbody></table></div>`;
  }catch(e){$('#performance').innerHTML='<div class="mini-note danger">Owner statisztika nem tölthető be.</div>'}
}

$('#loginForm').addEventListener('submit',async e=>{
  e.preventDefault(); $('#loginError').textContent='';
  try{
    const d=await api('/api/login',{method:'POST',body:JSON.stringify({username:$('#username').value,password:$('#password').value,portal:'staff'})});
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
document.querySelectorAll('.payment-choice').forEach(btn=>btn.addEventListener('click',()=>{setPaymentMethod(btn.dataset.payment);playSfx('click',0.42)}));
setPaymentMethod(document.querySelector('#paymentMethod')?.value||'cash');
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

$('#productForm').addEventListener('submit',async e=>{e.preventDefault();try{await api('/api/products',{method:'POST',body:JSON.stringify({name:$('#pName').value,category:$('#pCategory').value,price:Number($('#pPrice').value),stock:Number($('#pStock').value),minStock:Number($('#pMin').value),subtitle:$('#pSubtitle').value,image:$('#pImage').value})});e.target.reset();await load();playSfx('success',0.5);showToast('Raktár frissítve','Az új termék sikeresen hozzáadva.','success')}catch(err){await rmAlert(err.message,'Termék létrehozása sikertelen')}});
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

window.load=load;
