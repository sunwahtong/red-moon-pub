
(() => {
  const $ = (s,root=document)=>root.querySelector(s);
  const $$ = (s,root=document)=>Array.from(root.querySelectorAll(s));
  const esc = s => String(s ?? '').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const money = n => Number(n||0).toLocaleString('hu-HU')+' Ft';
  const app = $('#appView');
  if(!app) return;

  async function api(url,opt={}){
    const r=await fetch(url,{credentials:'same-origin',headers:{'Content-Type':'application/json',...(opt.headers||{})},...opt});
    let d={}; try{d=await r.json()}catch{}
    if(!r.ok) throw new Error(d.error||`HTTP ${r.status}`);
    return d;
  }
  function toast(title,msg,error=false){
    let t=$('#v57Toast');
    if(!t){t=document.createElement('div');t.id='v57Toast';t.className='v57-toast';document.body.appendChild(t)}
    t.innerHTML=`<b>${esc(title)}</b><span>${esc(msg)}</span>`;
    t.classList.toggle('error',!!error); t.classList.add('show');
    clearTimeout(t._tm); t._tm=setTimeout(()=>t.classList.remove('show'),3600);
  }
  function confirmBox(title,msg){
    return new Promise(resolve=>{
      let m=$('#v57Confirm');
      if(!m){m=document.createElement('div');m.id='v57Confirm';m.className='v57-modal';document.body.appendChild(m)}
      m.innerHTML=`<div class="v57-dialog"><div class="v57-kicker">RED MOON / CONFIRMATION</div><h3>${esc(title)}</h3><p>${esc(msg)}</p><div class="v57-dialog-actions"><button class="v57-btn ghost" data-c="0">MÉGSE</button><button class="v57-btn danger" data-c="1">MEGERŐSÍTÉS</button></div></div>`;
      m.classList.add('show');
      $$('.v57-dialog-actions button',m).forEach(b=>b.onclick=()=>{m.classList.remove('show');resolve(b.dataset.c==='1')});
    });
  }
  function formModal(title,fields){
    return new Promise(resolve=>{
      let m=$('#v57FormModal');
      if(!m){m=document.createElement('div');m.id='v57FormModal';m.className='v57-modal';document.body.appendChild(m)}
      m.innerHTML=`<div class="v57-dialog"><div class="v57-kicker">RED MOON / COMMAND</div><h3>${esc(title)}</h3><div class="v57-form-grid">${fields.map(f=>{
        if(f.type==='textarea') return `<label class="v57-field ${f.wide?'wide':''}"><span>${esc(f.label)}</span><textarea name="${esc(f.id)}" placeholder="${esc(f.placeholder||'')}">${esc(f.value||'')}</textarea></label>`;
        if(f.type==='select') return `<label class="v57-field"><span>${esc(f.label)}</span><select name="${esc(f.id)}">${(f.options||[]).map(o=>`<option value="${esc(o.value)}" ${String(o.value)===String(f.value??'')?'selected':''}>${esc(o.label)}</option>`).join('')}</select></label>`;
        return `<label class="v57-field ${f.wide?'wide':''}"><span>${esc(f.label)}</span><input name="${esc(f.id)}" type="${f.type||'text'}" value="${esc(f.value||'')}" placeholder="${esc(f.placeholder||'')}" ${f.required?'required':''}></label>`;
      }).join('')}</div><div class="v57-dialog-actions"><button class="v57-btn ghost" data-c="0">MÉGSE</button><button class="v57-btn red" data-c="1">MENTÉS</button></div></div>`;
      m.classList.add('show');
      $$('.v57-dialog-actions button',m).forEach(b=>b.onclick=()=>{
        if(b.dataset.c==='0'){m.classList.remove('show');resolve(null);return}
        const out={};
        $$('input[name],select[name],textarea[name]',m).forEach(el=>out[el.name]=el.value);
        m.classList.remove('show');resolve(out);
      });
    });
  }

  // Keep the mature staff.js DOM alive (it owns authentication), but replace its visual workspace.
  const original = Array.from(app.children);
  original.forEach(el=>el.classList.add('v57-original-hidden'));
  app.classList.add('v57-command-app');
  const shell=document.createElement('div');
  shell.id='v57Shell';
  shell.innerHTML=`
    <aside class="v57-sidebar">
      <div class="v57-brand"><span>RED MOON / PRIVATE</span><strong>COMMAND<br><em>CENTER</em></strong></div>
      <nav>
        <button data-view="overview">01 · Áttekintés</button>
        <button data-view="pos">02 · Eladás</button>
        <button data-view="stock">03 · Készlet</button>
        <button data-view="shifts">04 · Műszakok</button>
        <button data-view="employees">05 · Dolgozók</button>
        <button data-view="reviews">06 · Vélemények</button>
        <button data-view="prices">07 · MENU / ÁRAK</button>
        <button data-view="management">08 · Vezetés</button>
        <button data-view="documents" data-role-view="manager">09 · SZÁMLÁK / NYUGTÁK</button>
        <button data-view="profile">10 · Saját profil</button>
      </nav>
      <div class="v57-side-user"><small>BEJELENTKEZVE</small><b id="v57SideName">—</b><span id="v57SideRole">—</span></div>
    </aside>
    <section class="v57-workspace">
      <header class="v57-topbar">
        <div><span>RED MOON / COMMAND CENTER</span><h1 id="v57Title">Áttekintés</h1><p id="v57Welcome"></p><div id="v57GlobalShift" class="v57-global-shift"></div></div>
        <button id="v57Logout" class="v57-logout">KIJELENTKEZÉS <b>↗</b></button>
      </header>
      <div id="v57Views"></div>
    </section>`;
  app.appendChild(shell);

  const views=$('#v57Views');
  const viewDefs=[
    ['overview','Áttekintés'],['pos','Eladás'],['stock','Készlet'],['shifts','Műszakok'],['employees','Dolgozók'],['reviews','Vélemények'],['prices','Menu / Árak'],['management','Vezetés'],['documents','Számlák / Nyugták'],['profile','Saját profil']
  ];
  viewDefs.forEach(([id,title])=>{
    const s=document.createElement('section'); s.className='v57-view'; s.dataset.view=id; s.innerHTML=`<div class="v57-section-head"><span>RED MOON / ${id.toUpperCase()}</span><h2>${esc(title)}</h2></div><div class="v57-view-body" id="v57-${id}"></div>`; views.appendChild(s);
  });

  let products=[], me=null, shift=null, active='overview', cart=new Map(), refreshTimer=null;

  function setView(id){
    active=id; updateGlobalShiftBanner(); $$('.v57-view').forEach(v=>v.classList.toggle('active',v.dataset.view===id));
    $$('.v57-sidebar nav button').forEach(b=>b.classList.toggle('active',b.dataset.view===id));
    const title=viewDefs.find(x=>x[0]===id)?.[1]||'Command Center'; $('#v57Title').textContent=title;
    renderActive();
  }
  $$('.v57-sidebar nav button').forEach(b=>b.onclick=()=>setView(b.dataset.view));
  $('#v57Logout').onclick=async()=>{if(await confirmBox('Kijelentkezés','Biztosan kijelentkezel a Command Centerből?')){await api('/api/logout',{method:'POST'});location.reload()}};

  function updateGlobalShiftBanner(){
    const el=$('#v57GlobalShift'); if(!el)return;
    if(!shift){el.innerHTML='<span class=\"shift-state-dot closed\"></span><b>NINCS AKTÍV MŰSZAK</b><span>Műszak jelenleg nem fut.</span>';return}
    const members=(shift.members||[]).join(', ')||'nincs rögzített tag';
    el.innerHTML=`<span class=\"shift-state-dot open\"></span><b>JELENLEG MŰSZAK MEGY</b><span>Tagok: ${esc(members)}</span>`;
  }
  function roleAllowed(role){return ['manager','owner'].includes(role)}
  function isOwner(){return me?.role==='owner'}
  function productSection(p){
    const raw=String(p?.section||'').trim().toLowerCase();
    const id=String(p?.id||'').trim().toLowerCase();
    const n=String(p?.name||'').toLowerCase().trim();
    // A Red Moon alap ital-katalógusának fix részlegei. Ez név/ID alapján is
    // működik, így egy régi adatbázisban sem kerül Barracho/Kőbaltás az Egyéb alá.
    const explicit={
      'p_barracho':'beer','p_kobaltas':'beer','p_sornyito':'accessories',
      'p_syrah':'wine','p_two_roosters':'wine','p_vinewood':'wine','p_bleuterd':'wine',
      'p_ragga':'spirits','p_mount_bourbon':'spirits','p_chernekov':'spirits','p_cazafortunas':'spirits','p_sinmisito':'spirits',
      'p_ecola':'nonalcoholic','p_sprunk':'nonalcoholic','p_raine':'nonalcoholic'
    };
    if(explicit[id])return explicit[id];
    if(raw==='nonalcoholic' || raw==='alcoholfree' || raw==='alcohol-free')return 'nonalcoholic';
    if(raw && ['beer','wine','spirits','nonalcoholic','accessories'].includes(raw))return raw;
    if(n==='barracho'||n==='kőbaltás'||n==='kobaltas')return 'beer';
    if(n.includes('sörnyitó')||n.includes('sornyito'))return 'accessories';
    if(/\b(e-cola|e cola|sprunk|raine|ásványvíz|mineral water|alkoholmentes)\b/.test(n))return 'nonalcoholic';
    if(/\b(sör|beer|lager|ale|ipa|pils)\b/.test(n))return 'beer';
    if(/\b(bor|wine|rozé|rose|pezsgő|prosecco|champagne)\b/.test(n))return 'wine';
    if(/whiskey|whisky|vodka|tequila|rum|gin|brandy|cognac|pálink|bourbon/.test(n))return 'spirits';
    if(String(p?.category||'')==='food')return 'other';
    return 'other';
  }
  const POS_SECTIONS=[
    ['all','Összes'],['beer','Sörök'],['wine','Borok / Pezsgők'],['spirits','Tömény Italok'],['nonalcoholic','Alkoholmentes Italok'],['accessories','Kellékek']
  ];
  function sectionLabel(id){return POS_SECTIONS.find(x=>x[0]===id)?.[1]||'Egyéb';}
  function currentShiftMember(){return !!(shift && Array.isArray(shift.memberIds) && me && shift.memberIds.includes(me.id))}

  async function loadBase(){
    try{
      const [md,pd,sd]=await Promise.all([api('/api/me'),api('/api/products'),api('/api/shifts/current')]);
      me=md.user; products=pd.products||[]; shift=sd.shift||null; window.me=me; window.products=products; updateGlobalShiftBanner();
      $('#v57SideName').textContent=me?.name||'—'; $('#v57SideRole').textContent=(me?.role||'STAFF').toUpperCase();
      $('#v57Welcome').textContent=`Bejelentkezve: ${me?.name||''} · ${(me?.role||'').toUpperCase()}`;
      const docNav=$('.v57-sidebar nav [data-view=documents]'); if(docNav) docNav.style.display=['manager','owner'].includes(me?.role)?'flex':'none';
      if(me?.role==='dj'){location.href='dj.html';return}
      renderActive();
    }catch(e){toast('Command Center hiba',e.message,true)}
  }

  async function renderActive(){
    if(!me)return;
    if(active==='overview') return renderOverview();
    if(active==='pos') return renderPOS();
    if(active==='stock') return renderStock();
    if(active==='shifts') return renderShifts();
    if(active==='employees') return renderEmployees();
    if(active==='reviews') return renderReviews();
    if(active==='prices') return renderPrices();
    if(active==='management') return renderManagement();
    if(active==='documents') return renderDocuments();
    if(active==='profile') return renderProfile();
  }

  async function renderOverview(){
    const host=$('#v57-overview'); if(host.dataset.ready==='1')return;
    host.dataset.ready='1';
    host.innerHTML=`<div class="v57-grid four">
      <article class="v57-card stat"><span>OVERALL BEVÉTEL</span><strong id="v57Overall">—</strong><small>Minden lezárt és aktuális eladás összege</small></article>
      <article class="v57-card stat"><span>AKTUÁLIS MŰSZAK</span><strong id="v57ShiftStatus">—</strong><small id="v57ShiftMembers">—</small></article>
      <article class="v57-card stat"><span>KÉSZLET</span><strong>${products.filter(p=>p.active).length}</strong><small>aktív termék</small></article>
      <article class="v57-card stat"><span>JOGOSULTSÁG</span><strong>${esc(me.role.toUpperCase())}</strong><small>Command Center hozzáférés</small></article>
    </div>
    <div class="v57-grid three">
      <div class="v57-card"><div class="v57-card-head"><div><span>LOW STOCK</span><h3>Alacsony készlet</h3></div><button class="v57-mini" id="v57RefreshOverview">↻</button></div><div id="v57LowStock" class="v57-list"></div></div>
      <div class="v57-card"><div class="v57-card-head"><div><span>LIVE / SHIFT</span><h3>Műszak állapota</h3></div></div><div id="v57OverviewShift"></div></div>
      <div class="v57-card"><div class="v57-card-head"><div><span>LIVE / TEAM</span><h3>Online dolgozók</h3></div><span class="v57-badge" id="v57OnlineCount">—</span></div><div id="v57OnlineList" class="v57-online-list"><div class="v57-empty">Betöltés…</div></div></div>
    </div>`;
    $('#v57RefreshOverview').onclick=()=>{host.dataset.ready='';renderOverview()};
    try{
      const d=await api('/api/dashboard');$('#v57Overall').textContent=money(d.overallRevenue);
      const low=(d.lowStock||[]);$('#v57LowStock').innerHTML=low.length?low.map(p=>`<div class="v57-row"><div><b>${esc(p.name)}</b><small>${p.stock} db / minimum ${p.minStock}</small></div><em>${p.stock<=0?'ELFOGYOTT':'ALACSONY'}</em></div>`).join(''):'<div class="v57-empty">Nincs alacsony készlet.</div>';
    }catch{}
    updateShiftOverview();
    loadOnlineOverview();
  }
  async function loadOnlineOverview(){
    const host=$('#v57OnlineList'), count=$('#v57OnlineCount');
    if(!host||!count)return;
    try{
      const d=await api('/api/presence');
      count.textContent=(d.onlineCount||0)+' ONLINE';
      host.innerHTML=(d.online||[]).length ? (d.online||[]).map(u=>'<div class="v57-online-row"><span class="v57-online-dot"></span><div><b>'+esc(u.name)+'</b><small>'+esc(String(u.role||'staff').toUpperCase())+(u.id===me?.id?' · TE VAGY':'')+'</small></div><em>ONLINE</em></div>').join('') : '<div class="v57-empty">Jelenleg nincs online dolgozó.</div>';
    }catch(e){
      host.innerHTML='<div class="v57-empty">Az online lista pillanatnyilag nem érhető el.</div>';
      count.textContent='—';
    }
  }
  function updateShiftOverview(){
    const open=shift; $('#v57ShiftStatus').textContent=open?'NYITVA':'ZÁRVA'; $('#v57ShiftMembers').textContent=open?`${(open.members||[]).join(', ')||'nincs tag'}`:'Nincs aktív műszak';
    const h=$('#v57OverviewShift'); if(!h)return;
    h.innerHTML=open?`<div class="v57-shift-card"><b>Nyitotta: ${esc(open.startedByName)}</b><span>${new Date(open.startedAt).toLocaleString('hu-HU')}</span><span>${currentShiftMember()?'Te a műszak tagja vagy.':'Nem vagy a műszak tagja.'}</span><strong>${money(open.revenue||0)}</strong></div>`:`<div class="v57-empty">Nincs nyitott műszak.</div>`;
  }

  function renderPOS(){
    const host=$('#v57-pos');
    // A hat kért részleg mindig látszik; az Összes az összes aktív ital/kellék nézete.
    const cats=POS_SECTIONS.map(x=>x[0]);
    host.innerHTML=`<div class="v57-pos-layout">
      <div class="v57-card"><div class="v57-card-head"><div><span>POS / CATALOG</span><h3>Eladható termékek</h3><small>${currentShiftMember()?'Aktív műszaktagként értékesíthetsz.':'Csak az aktuális műszak tagjai értékesíthetnek.'}</small></div><span class="v57-badge">${currentShiftMember()?'ELADHATÓ':'MŰSZAKON KÍVÜL'}</span></div>
      <div class="v57-category-tabs">${cats.map((c,i)=>`<button class="v57-cat ${i===0?'active':''}" data-cat="${esc(c)}">${esc(sectionLabel(c))}</button>`).join('')}</div>
      <div id="v57ProductsGrid" class="v57-products-grid"></div></div>
      <aside class="v57-card v57-cart"><div class="v57-card-head"><div><span>CART</span><h3>Kosár</h3></div><button id="v57ClearCart" class="v57-mini">ÜRÍTÉS</button></div><div id="v57CartItems"></div><div class="v57-cart-total"><span>ÖSSZESEN</span><strong id="v57CartTotal">0 Ft</strong></div><div class="v57-pay"><button class="active" data-pay="cash"><span class="pay-icon pay-cash">$</span><span>Készpénz</span></button><button data-pay="transfer"><span class="pay-icon pay-transfer">▣</span><span>Átutalás</span></button></div><button id="v57Checkout" class="v57-btn red wide">ELADÁS RÖGZÍTÉSE ↗</button><p id="v57SaleMsg" class="v57-note"></p></aside>
    </div>
    <section class="v57-card v59-sales-log"><div class="v57-card-head"><div><span>SALES / CART HISTORY</span><h3>Eladások</h3><small>Minden kosár saját Cart ID-t kap. Egy kosár több tételből is állhat.</small></div></div><div id="v59SalesHistory" class="v57-list"><div class="v57-empty">Betöltés…</div></div></section>`;
    $$('.v57-cat').forEach(b=>b.onclick=()=>{$$('.v57-cat').forEach(x=>x.classList.remove('active'));b.classList.add('active');renderProductGrid(b.dataset.cat)});
    $('#v57ClearCart').onclick=()=>{cart.clear();renderCart()};
    $$('.v57-pay button').forEach(b=>b.onclick=()=>{$$('.v57-pay button').forEach(x=>x.classList.remove('active'));b.classList.add('active')});
    $('#v57Checkout').onclick=checkout;
    renderProductGrid(cats[0]||'all');
    renderCart();
    renderSalesHistory();
  }
  async function renderSalesHistory(){
    const host=$('#v59SalesHistory'); if(!host)return;
    try{
      const d=await api('/api/sales');
      const grouped=new Map();
      (d.sales||[]).forEach(s=>{const key=s.cartId||s.transactionId||s.id;if(!grouped.has(key))grouped.set(key,[]);grouped.get(key).push(s)});
      const rows=[...grouped.values()].slice(0,80).map(items=>{
        const first=items[0], total=items.reduce((a,x)=>a+Number(x.total||0),0);
        return `<article class="v59-sale-card"><div><b>${esc(first.cartId||first.transactionId||'—')}</b><small>${new Date(first.at).toLocaleString('hu-HU')} · ${esc(first.user||'')}</small></div><div class="v59-sale-items">${items.map(x=>`<span class="v59-sale-item">${esc(x.product)} × ${x.qty}</span>`).join('')}</div><div class="v59-sale-total"><strong>${money(total)}</strong><span class="payment-chip ${first.paymentMethod==='transfer'?'transfer':'cash'}"><i>${first.paymentMethod==='transfer'?'▣':'$'}</i>${first.paymentMethod==='transfer'?'ÁTUTALÁS':'KÉSZPÉNZ'}</span></div>${['manager','owner'].includes(me?.role)?`<div class="v59-sale-actions"><button class="v57-mini" data-receipt-sale="${esc(first.id)}">NYUGTA</button><button class="v57-mini" data-invoice-sale="${esc(first.id)}">SZÁMLA</button><button class="v57-mini danger" data-delete-sale="${esc(first.id)}">ELADÁS TÖRLÉSE</button></div>`:''}</article>`;
      }).join('');
      host.innerHTML=rows||'<div class="v57-empty">Még nincs rögzített eladás.</div>';
      host.querySelectorAll('[data-delete-sale]').forEach(b=>b.onclick=()=>deleteSaleV57(b.dataset.deleteSale));
      host.querySelectorAll('[data-invoice-sale]').forEach(b=>b.onclick=()=>createInvoiceV57(b.dataset.invoiceSale));
      host.querySelectorAll('[data-receipt-sale]').forEach(b=>b.onclick=()=>showReceiptV57(b.dataset.receiptSale));
      window._v57Sales=d.sales||[];
    }catch(e){host.innerHTML=`<div class="v57-empty">Az eladási napló nem tölthető be.</div>`}
  }
  async function deleteSaleV57(id){
    if(!['manager','owner'].includes(me?.role))return;
    const sale=(window._v57Sales||[]).find(x=>x.id===id);
    if(!sale)return;
    const ok=await confirmBox('Eladás törlése',`${sale.product} × ${sale.qty} · ${money(sale.total)}\n\nA törlés azonnal visszateszi a termék mennyiségét a készletbe. A kapcsolódó számla nem törlődik; azt csak OWNER törölheti a Számlák / Nyugták fülön.`);
    if(!ok)return;
    try{const d=await api('/api/sales/'+encodeURIComponent(id),{method:'DELETE'}); toast('Eladás törölve',`${d.restoredStock||sale.qty} db visszakerült a készletbe.`); await loadBase(); setView('pos');}catch(e){toast('Törlés sikertelen',e.message,true)}
  }
  async function createInvoiceV57(id){
    if(!['manager','owner'].includes(me?.role))return;
    if(typeof window.createDocument==='function'){ await window.createDocument(id,'invoice'); return; }
    toast('Számlázás','A számlázó modul nem érhető el ebben a munkamenetben.',true);
  }
  async function showReceiptV57(id){
    if(typeof window.createReceipt==='function'){
      await window.createReceipt(id);
      return;
    }
    try{
      const d=await api('/api/documents');
      const sale=(window._v57Sales||[]).find(x=>x.id===id);
      const doc=d.documents?.find(x=>x.type==='receipt' && (x.saleId===id || (sale && x.transactionId===(x.transactionId||''))));
      if(doc && typeof window.showDocument==='function') window.showDocument(doc);
      else toast('Nyugta','A nyugta nem található.',true);
    }catch(e){toast('Nyugta','A nyugta nem tölthető be.',true)}
  }
  async function renderDocuments(){
    const host=$('#v57-documents'); if(!host)return;
    if(!['manager','owner'].includes(me?.role)){host.innerHTML='<div class="v57-empty">Ehhez a fülhöz MANAGER vagy OWNER jogosultság szükséges.</div>';return;}
    try{const d=await api('/api/documents');const docs=d.documents||[];const invoices=docs.filter(x=>x.type==='invoice'),receipts=docs.filter(x=>x.type==='receipt');
      const section=(title,kicker,list,kind)=>`<div class="v57-card document-section-card"><div class="v57-card-head"><div><span>${kicker}</span><h3>${title}</h3><small>Maximum 6 dokumentum látszik egyszerre · továbbiakhoz görgess.</small></div><span class="v57-badge">${list.length} DB</span></div><div class="v57-doc-scroll">${list.map(x=>`<div class="v57-row"><div><b>${esc(x.id)}</b><small>${new Date(x.createdAt).toLocaleString('hu-HU')} · ${esc(x.createdByName||'')}</small></div><strong>${money(x.total)}</strong><div class="v57-doc-actions"><button class="v57-mini" data-open-doc="${esc(x.id)}">MEGNYITÁS</button>${kind==='invoice'&&me?.role==='owner'?`<button class="v57-mini danger" data-delete-doc="${esc(x.id)}">TÖRLÉS</button>`:''}</div></div>`).join('')||'<div class="v57-empty">Nincs még ilyen dokumentum.</div>'}</div></div>`;
      host.innerHTML=section('Számlák','DOCUMENTS / INVOICES',invoices,'invoice')+section('Nyugták','DOCUMENTS / RECEIPTS',receipts,'receipt');
      host.querySelectorAll('[data-open-doc]').forEach(b=>b.onclick=()=>window.loadDocumentById?.(b.dataset.openDoc));
      host.querySelectorAll('[data-delete-doc]').forEach(b=>b.onclick=async()=>{if(!await confirmBox('Számla törlése',`Biztosan törlöd a(z) ${b.dataset.deleteDoc} számlát? Az eredeti eladás ettől nem törlődik.`))return;try{await api('/api/documents/'+encodeURIComponent(b.dataset.deleteDoc),{method:'DELETE'});toast('Számla törölve','A számla eltávolításra került.');renderDocuments()}catch(e){toast('Törlés sikertelen',e.message,true)}});
    }catch(e){host.innerHTML=`<div class="v57-empty">A dokumentumok nem tölthetők be: ${esc(e.message)}</div>`}
  }

  function renderProductGrid(cat){
    const grid=$('#v57ProductsGrid'); if(!grid)return;
    const list=products.filter(p=>p.active&&(cat==='all' ? ['drink','food'].includes(String(p.category||'')) : productSection(p)===cat));
    grid.innerHTML=list.length?list.map(p=>`<button class="v57-product ${p.stock<1?'sold':''}" data-p="${esc(p.id)}" ${(!currentShiftMember()||p.stock<1)?'disabled':''}>
      <span class="v57-product-img">${p.image?`<img src="/${esc(p.image)}" alt="${esc(p.name)}" loading="lazy">`:'<span class="no-img">RM</span>'}</span>
      <span class="v57-product-info"><b>${esc(p.name)}</b><small>${esc(p.subtitle||'Red Moon Pub')}</small><strong>${money(p.price)}</strong><em>${p.stock>0?p.stock+' db':'ELFOGYOTT'}</em></span>
    </button>`).join(''):'<div class="v57-empty">Nincs eladható termék ebben a kategóriában.</div>';
    $$('.v57-product',grid).forEach(b=>b.onclick=()=>{const id=b.dataset.p;cart.set(id,(cart.get(id)||0)+1);renderCart()});
  }
  function renderCart(){
    const host=$('#v57CartItems'); if(!host)return;
    let total=0, count=0; const rows=[];
    for(const [id,qty] of cart){const p=products.find(x=>x.id===id);if(!p)continue;const line=p.price*qty;total+=line;count+=qty;rows.push(`<div class="v57-cart-row"><div><b>${esc(p.name)}</b><small>${qty} × ${money(p.price)}</small></div><div><strong>${money(line)}</strong><button data-minus="${esc(id)}">−</button><button data-plus="${esc(id)}">+</button></div></div>`)}
    host.innerHTML=rows.join('')||'<div class="v57-empty">A kosár üres.</div>';
    $('#v57CartTotal').textContent=money(total);
    $$('#v57CartItems [data-minus]').forEach(b=>b.onclick=()=>{const n=(cart.get(b.dataset.minus)||0)-1;if(n<=0)cart.delete(b.dataset.minus);else cart.set(b.dataset.minus,n);renderCart()});
    $$('#v57CartItems [data-plus]').forEach(b=>b.onclick=()=>{const id=b.dataset.plus, p=products.find(x=>x.id===id);if(p&& (cart.get(id)||0)<p.stock)cart.set(id,(cart.get(id)||0)+1);renderCart()});
  }
  async function checkout(){
    if(!currentShiftMember()){toast('Eladás tiltva','Előbb lépj be az aktuális műszakba.',true);return}
    const items=[...cart.entries()].map(([productId,qty])=>({productId,qty})); if(!items.length){toast('Kosár üres','Válassz terméket.',true);return}
    const payment=$('.v57-pay button.active')?.dataset.pay||'cash';
    try{const d=await api('/api/sales',{method:'POST',body:JSON.stringify({items,paymentMethod:payment})});cart.clear();products=products.map(p=>{const s=d.sales?.find(x=>x.productId===p.id);return s?{...p,stock:p.stock-s.qty}:p});renderPOS();toast('Eladás rögzítve',`${money(d.total)} · ${d.cartId||''}`)}catch(e){$('#v57SaleMsg').textContent=e.message;toast('Eladás sikertelen',e.message,true)}
  }

  async function renderStock(){
    const host=$('#v57-stock'); const can=roleAllowed(me.role);
    const activeProducts=products.filter(p=>p.active);
    host.innerHTML=`<div class="v57-grid two">
      <div class="v57-card"><div class="v57-card-head"><div><span>STOCK / RESTOCK</span><h3>Készletfeltöltés</h3><small>Kosár alapú feltöltés — egyszerre több terméket is hozzáadhatsz.</small></div><span class="v57-badge">${can?'MANAGER / OWNER':'NINCS JOG'}</span></div>
      ${can?`<div class="v57-restock-layout"><div class="v57-form-grid">
        <label class="v57-field"><span>TERMÉK</span><select id="v57RestockProduct">${activeProducts.map(p=>`<option value="${esc(p.id)}">${esc(p.name)} · ${p.stock} db</option>`).join('')}</select></label>
        <label class="v57-field"><span>MENNYISÉG</span><div class="v57-plus"><button type="button" data-q="1">+1</button><button type="button" data-q="5">+5</button><button type="button" data-q="10">+10</button></div><input id="v57RestockQty" type="number" min="1" value="1"></label>
        <label class="v57-field"><span>BESZERZÉSI EGYSÉGÁR</span><input id="v57RestockCost" type="number" min="0" value="0"></label>
        <label class="v57-field"><span>FORRÁS</span><select id="v57RestockSource"><option value="nagyker">Nagyker</option><option value="bolt">Bolt</option></select></label>
      </div><button id="v57RestockAdd" class="v57-btn ghost wide">＋ FELTÖLTÉSI KOSÁRBA</button>
      <div class="v57-card restock-cart-card"><div class="v57-card-head"><div><span>RESTOCK / CART</span><h3>Feltöltési kosár</h3></div><button id="v57ClearRestock" class="v57-mini danger">ÜRÍTÉS</button></div><div id="v57RestockCart" class="v57-list"><div class="v57-empty">A feltöltési kosár üres.</div></div><div class="v57-cart-total"><span>ÖSSZES BESZERZÉS</span><strong id="v57RestockTotal">0 Ft</strong></div><button id="v57RestockSave" class="v57-btn red wide">KÉSZLET FELTÖLTÉSE ↗</button></div></div>`:'<div class="v57-empty">A készletfeltöltés Manager / Owner jogosultságú művelet.</div>'}
      </div>
      <div class="v57-card"><div class="v57-card-head"><div><span>INVENTORY</span><h3>Aktuális készlet</h3><small>Nyitáskor a pontos darabszámot kizárólag az OWNER állíthatja be. Ez nem készletfeltöltés és nem kerül a feltöltési naplóba.</small></div><span class="v57-badge">${isOwner()?'OWNER / NYITÓKÉSZLET':'CSAK MEGTEKINTÉS'}</span></div><div class="v57-list">${activeProducts.map(p=>`<div class="v57-row inventory-opening-row"><div><b>${esc(p.name)}</b><small>${esc(sectionLabel(productSection(p)))} · minimum ${p.minStock}</small></div><div class="inventory-opening-actions"><strong class="${p.stock<=p.minStock?'warn':''}">${p.stock} db</strong>${isOwner()?`<button type="button" class="v57-mini" data-opening-stock="${esc(p.id)}">BEÁLLÍTÁS</button>`:''}</div></div>`).join('')||'<div class="v57-empty">Nincs aktív termék.</div>'}</div></div>
    </div>
    <div class="v57-card"><div class="v57-card-head"><div><span>RESTOCK / LOG</span><h3>Feltöltési napló</h3><small>Az Owner egyes naplóbejegyzéseket törölhet.</small></div></div><div id="v57RestockLogs" class="v57-log-scroll"></div></div>`;
    $$('#v57-stock [data-opening-stock]').forEach(b=>b.onclick=async()=>{
      if(!isOwner()) return;
      const product=products.find(x=>x.id===b.dataset.openingStock); if(!product)return;
      const data=await formModal('Nyitókészlet beállítása',[{id:'stock',label:'PONTOS DARABSZÁM',type:'number',value:product.stock,min:0,required:true},{id:'note',label:'MEGJEGYZÉS · OPCIONÁLIS',placeholder:'Pl. nyitás előtti leltár'}]);
      if(!data)return;
      const stock=Math.floor(Number(data.stock));
      if(!Number.isInteger(stock)||stock<0){toast('Hibás darabszám','A készlet csak 0 vagy pozitív egész szám lehet.',true);return}
      try{
        const d=await api('/api/inventory/adjust',{method:'POST',body:JSON.stringify({productId:product.id,stock})});
        products=products.map(x=>x.id===product.id?d.product:x); renderStock(); toast('Nyitókészlet beállítva',`${product.name}: ${stock} db · nem került feltöltésként naplózásra.`);
      }catch(e){toast('Készlet beállítása sikertelen',e.message,true)}
    });
    if(!can)return;
    const restockCart=new Map();
    const renderRestockCart=()=>{
      let total=0;
      const rows=[];
      for(const [id,item] of restockCart){const p=products.find(x=>x.id===id);if(!p)continue;const line=item.qty*item.unitCost;total+=line;rows.push(`<div class="v57-row restock-cart-row"><div><b>${esc(p.name)} × ${item.qty}</b><small>${money(item.unitCost)} / db · ${esc(item.source)}</small></div><div class="restock-cart-actions"><strong>${money(line)}</strong><button class="v57-mini" data-rminus="${esc(id)}">−</button><button class="v57-mini" data-rplus="${esc(id)}">+</button><button class="v57-mini danger" data-rremove="${esc(id)}">×</button></div></div>`)}
      $('#v57RestockCart').innerHTML=rows.join('')||'<div class="v57-empty">A feltöltési kosár üres.</div>';
      $('#v57RestockTotal').textContent=money(total);
      $$('#v57RestockCart [data-rminus]').forEach(b=>b.onclick=()=>{const x=restockCart.get(b.dataset.rminus);if(!x)return;x.qty--;if(x.qty<=0)restockCart.delete(b.dataset.rminus);renderRestockCart()});
      $$('#v57RestockCart [data-rplus]').forEach(b=>b.onclick=()=>{const x=restockCart.get(b.dataset.rplus);if(!x)return;x.qty++;renderRestockCart()});
      $$('#v57RestockCart [data-rremove]').forEach(b=>b.onclick=()=>{restockCart.delete(b.dataset.rremove);renderRestockCart()});
    };
    $$('#v57-stock [data-q]').forEach(b=>b.onclick=()=>$('#v57RestockQty').value=Number($('#v57RestockQty').value||0)+Number(b.dataset.q));
    $('#v57RestockAdd').onclick=()=>{const id=$('#v57RestockProduct').value,p=products.find(x=>x.id===id),qty=Math.floor(Number($('#v57RestockQty').value)),unitCost=Number($('#v57RestockCost').value),source=$('#v57RestockSource').value;if(!p||qty<1||unitCost<0){toast('Hibás feltöltési tétel','Termék, mennyiség és beszerzési ár szükséges.',true);return}const old=restockCart.get(id);restockCart.set(id,{qty:(old?.qty||0)+qty,unitCost,source});$('#v57RestockQty').value=1;renderRestockCart();toast('Feltöltési kosár','A termék bekerült a feltöltési kosárba.')};
    $('#v57ClearRestock').onclick=()=>{restockCart.clear();renderRestockCart()};
    $('#v57RestockSave').onclick=async()=>{if(!restockCart.size){toast('Üres kosár','Tegyél legalább egy terméket a feltöltési kosárba.',true);return}try{const items=[...restockCart.entries()].map(([productId,x])=>({productId,qty:x.qty,unitCost:x.unitCost,source:x.source}));const d=await api('/api/restock',{method:'POST',body:JSON.stringify({items})});products=products.map(p=>d.products?.find(x=>x.id===p.id)||p);restockCart.clear();renderStock();toast('Készlet feltöltve',`${d.logs?.length||0} termék került feltöltésre.`)}catch(e){toast('Feltöltés sikertelen',e.message,true)}};
    try{const d=await api('/api/restock/logs');const logs=d.logs||[];$('#v57RestockLogs').innerHTML=logs.map(x=>`<div class="v57-row"><div><b>${esc(x.product)} · +${x.qty} db</b><small>${esc(x.user)} · ${esc(x.source)} · ${money(x.totalCost)}</small></div><div class="restock-log-right"><span>${new Date(x.at).toLocaleString('hu-HU')}</span>${isOwner()?`<button class="v57-mini danger" data-del-restock="${esc(x.id)}">TÖRLÉS</button>`:''}</div></div>`).join('')||'<div class="v57-empty">Nincs feltöltési napló.</div>';
      $$('#v57RestockLogs [data-del-restock]').forEach(b=>b.onclick=async()=>{if(!(await confirmBox('Feltöltési napló törlése','Csak a naplóbejegyzés törlődik, a készlet mennyisége nem változik.')))return;try{await api('/api/restock/logs/'+encodeURIComponent(b.dataset.delRestock),{method:'DELETE'});toast('Napló törölve','A feltöltési bejegyzés eltávolítva lett.');renderStock()}catch(e){toast('Törlés sikertelen',e.message,true)}})
    }catch{ $('#v57RestockLogs').innerHTML='<div class="v57-empty">A feltöltési napló nem érhető el.</div>' }
  }

  async function renderShifts(){
    const host=$('#v57-shifts'); const can=roleAllowed(me.role);
    let users=[]; try{users=(await api('/api/shifts/available-members')).users||[]}catch{}
    const eligible=shift ? users.filter(u=>!(shift.memberIds||[]).includes(u.id)) : users;
    host.innerHTML=`<div class="v57-grid two">
      <div class="v57-card">
        <div class="v57-card-head"><div><span>SHIFT / CONTROL</span><h3>${shift?'Aktív műszak':'Műszak indítása'}</h3><small>Műszaknyitás, zárás és aktív műszaktagok kezelése egy helyen.</small></div><span class="v57-badge">${shift?'NYITVA':'ZÁRVA'}</span></div>
        ${shift?`<div class="v57-shift-card">
          <b>${esc(shift.startedByName)}</b><span>${new Date(shift.startedAt).toLocaleString('hu-HU')}</span>
          <strong>${money(shift.revenue||0)}</strong>
          ${currentShiftMember()?'<em>TE MŰSZAKTAG VAGY</em>':'<em class="bad">NEM VAGY MŰSZAKTAG</em>'}
          <div class="v57-shift-team-list">${(shift.memberIds||[]).map(id=>{const u=users.find(x=>x.id===id);const name=u?.name||shift.members?.[shift.memberIds.indexOf(id)]||'Ismeretlen';const avatar=u?.avatar?`<img src="${esc(u.avatar)}" alt="">`:`<span class="v57-team-initial">${esc((name||'RM').slice(0,2).toUpperCase())}</span>`;return `<div class="v57-team-member"><div class="v57-team-avatar">${avatar}</div><div><b>${esc(name)}</b><small>${esc((u?.role||'staff').toUpperCase())}</small></div><span class="v57-team-status">MŰSZAKBAN</span></div>`}).join('')||'<div class="v57-empty">Nincs rögzített műszaktag.</div>'}</div>
        </div>
        <div class="v57-shift-actions">
          <div class="v57-form-grid compact"><label class="v57-field"><span>ZÁRÓ KASSZA</span><input id="v57ClosingCash" type="number" min="0" value="0"></label><label class="v57-field"><span>MEGJEGYZÉS</span><input id="v57CloseNote" placeholder="Opcionális"></label></div>
          <div class="action-row"><button id="v57CloseShift" class="v57-btn red">MŰSZAK ZÁRÁSA</button></div>
        </div>
        <div class="v57-shift-members-box"><div class="v57-card-head compact-head"><div><span>TEAM / LIVE</span><h3>Műszaktag hozzáadása</h3></div></div>
          ${can||shift.startedById===me.id?`<div class="v57-form-grid"><label class="v57-field wide"><span>DOLGOZÓ</span><select id="v57AddShiftMember"><option value="">Válassz dolgozót…</option>${eligible.filter(u=>u.role!=='dj').map(u=>`<option value="${esc(u.id)}">${esc(u.name)} · ${esc(u.role.toUpperCase())}</option>`).join('')}</select></label></div><button id="v57AddShiftMemberBtn" class="v57-btn ghost">+ MŰSZAKTAG HOZZÁADÁSA</button>`:'<p class="v57-note">A műszaktagokat csak a műszak indítója, Manager vagy Owner módosíthatja.</p>'}
        </div>`
        :`<div class="v57-form-grid"><label class="v57-field"><span>KEZDŐ KASSZA</span><input id="v57OpeningCash" type="number" min="0" value="0"></label><label class="v57-field wide"><span>MŰSZAKTAGOK</span><div class="v57-checks">${users.filter(u=>u.role!=='dj').map(u=>`<label><input type="checkbox" value="${esc(u.id)}" ${u.id===me.id?'checked':''}> ${esc(u.name)} · ${esc(u.role)}</label>`).join('')}</div></label></div><button id="v57OpenShift" class="v57-btn red">MŰSZAK INDÍTÁSA ↗</button>`}
      </div>
      <div class="v57-card"><div class="v57-card-head"><div><span>HISTORY / CLOSURES</span><h3>Lezárt műszakok</h3><small>Manager és Owner hozzáférés.</small></div></div><div id="v57ShiftHistory" class="v57-list v57-scroll-area"></div></div>
    </div>`;
    if(shift){
      $('#v57CloseShift').onclick=async()=>{
        if(!can && shift.startedById!==me.id){toast('Nincs jogosultság','Ezt a műszakot csak az indító, Manager vagy Owner zárhatja.',true);return}
        if(!(await confirmBox('Műszak lezárása','A műszak lezárása után új műszakot kell nyitni az értékesítés folytatásához.')))return;
        try{const d=await api('/api/shifts/close',{method:'POST',body:JSON.stringify({closingCash:Number($('#v57ClosingCash').value),notes:$('#v57CloseNote').value})});toast('Műszak lezárva',`Műszak ID: ${d.shift.id}`);if(typeof window.showShiftCloseDocument==='function')window.showShiftCloseDocument(d.shift,d.transfer);await loadBase();renderShifts()}catch(e){toast('Műszakzárás sikertelen',e.message,true)}
      };
      $('#v57AddShiftMemberBtn')?.addEventListener('click',async()=>{const userId=$('#v57AddShiftMember').value;if(!userId){toast('Hiányzó dolgozó','Válassz egy munkatársat.',true);return}try{await api('/api/shifts/members',{method:'POST',body:JSON.stringify({userId})});toast('Műszaktag hozzáadva','A dolgozó azonnal értékesíthet az aktív műszakban.');await loadBase();renderShifts()}catch(e){toast('Műszaktag hozzáadása sikertelen',e.message,true)}});
    }else $('#v57OpenShift').onclick=async()=>{try{const ids=$$('#v57-shifts input[type=checkbox]:checked').map(x=>x.value);await api('/api/shifts/open',{method:'POST',body:JSON.stringify({openingCash:Number($('#v57OpeningCash').value),memberIds:ids})});toast('Műszak megnyitva','A műszaktagok mentve lettek.');await loadBase();renderShifts()}catch(e){toast('Műszakindítás sikertelen',e.message,true)}};
    try{const d=await api('/api/shifts');$('#v57ShiftHistory').innerHTML=`<div class="v57-log-scroll">${(d.shifts||[]).map(x=>`<div class="v57-row shift-history-row-ui"><div><b>${esc(x.id||'—')}</b><small>${new Date(x.startedAt).toLocaleString('hu-HU')} · ${esc(x.startedByName)} → ${esc(x.closedByName||'—')} · ${money(x.revenue||0)}</small><small>${(x.members||[]).map(esc).join(', ')}</small></div><div class="shift-history-actions"><span>${x.status==='closed'?'LEZÁRT':'NYITVA'}</span>${x.status==='closed'?`<button class="v57-mini" onclick="openShiftClosure('${esc(x.id)}')">ZÁRÁSI LAP</button>${isOwner()?`<button class="v57-mini danger" onclick="deleteClosedShiftV57('${esc(x.id)}')">TÖRLÉS</button>`:''}`:''}</div></div>`).join('')||'<div class="v57-empty">Nincs műszaktörténet.</div>'}</div>`}catch(e){$('#v57ShiftHistory').innerHTML='<div class="v57-empty">A műszaklista Manager / Owner jogosultsághoz kötött.</div>'}
  }

  window.openShiftClosure=async function(id){try{const d=await api('/api/shifts/'+encodeURIComponent(id));const s=d.shift;const t=s.closure?.transfer||{amount:s.overallRevenue||s.revenue||0,account:'21541444-70524373',name:'Zhen Yu Xiao',reference:s.id};if(typeof window.showShiftCloseDocument==='function')window.showShiftCloseDocument(s,t);else toast('Zárási lap','A dokumentum nézet nem érhető el.',true)}catch(e){toast('Zárási lap nem nyitható meg',e.message,true)}};
  window.deleteClosedShiftV57=async function(id){if(!isOwner())return;if(!(await confirmBox('Műszak törlése',`Biztosan törlöd a lezárt ${id} műszakot? A műszakhoz tartozó eladások, dokumentumok és készlet-visszaállítás is megtörténik.`)))return;try{const d=await api('/api/shifts/'+encodeURIComponent(id),{method:'DELETE'});toast('Műszak törölve',`${id} · ${d.deletedSales||0} eladás visszavonva.`);await loadBase();renderShifts()}catch(e){toast('Műszak törlése sikertelen',e.message,true)}};

  async function renderEmployees(){
    const host=$('#v57-employees'); let users=[]; try{users=(await api('/api/employees')).users||[]}catch(e){host.innerHTML='<div class="v57-empty">Nem tölthető be az alkalmazotti lista.</div>';return}
    host.innerHTML=`<div class="v57-card"><div class="v57-card-head"><div><span>TEAM DIRECTORY</span><h3>Alkalmazottak</h3><small>Minden Staff felhasználó láthatja · módosítani és törölni csak Owner tud.</small></div><span class="v57-badge">${users.length} FŐ</span></div><div class="v57-people-grid v57-scroll-area">${users.map(u=>`<article class="v57-person"><div class="v57-person-avatar">${u.avatar?`<img src="${esc(u.avatar)}" alt="Profilkép">`:(esc((u.nickname||u.name||'RM').slice(0,2).toUpperCase()))}</div><div><b>${esc(u.name)}</b><small>${esc(u.nickname||'Nincs becenév')} · ${esc(u.username)}</small><span>${esc(u.role.toUpperCase())}</span></div>${isOwner()?`<div class="v57-person-actions"><button class="v57-mini" data-edit-user="${esc(u.id)}">SZERKESZTÉS</button>${u.id!==me.id?`<button class="v57-mini danger" data-delete-user="${esc(u.id)}">FIÓK TÖRLÉSE</button>`:''}</div>`:''}</article>`).join('')}</div></div>`;
    $$('#v57-employees [data-edit-user]').forEach(b=>b.onclick=async()=>{const u=users.find(x=>x.id===b.dataset.editUser);if(!u)return;const d=await formModal('Fiók szerkesztése',[{id:'name',label:'NÉV',value:u.name,required:true},{id:'username',label:'FELHASZNÁLÓNÉV',value:u.username,required:true},{id:'role',label:'RANG',type:'select',value:u.role,options:[{value:'staff',label:'Staff'},{value:'manager',label:'Manager'},{value:'owner',label:'Owner'},{value:'dj',label:'DJ Access'}]},{id:'password',label:'ÚJ JELSZÓ',type:'password',placeholder:'Üresen hagyva nem változik'}]);if(!d)return;try{await api('/api/users/'+encodeURIComponent(u.id),{method:'PATCH',body:JSON.stringify(d)});toast('Fiók frissítve',u.name);renderEmployees()}catch(e){toast('Mentés sikertelen',e.message,true)}})
    $$('#v57-employees [data-delete-user]').forEach(b=>b.onclick=async()=>{const u=users.find(x=>x.id===b.dataset.deleteUser);if(!u)return;if(!(await confirmBox('Fiók törlése',`A(z) ${u.name} fiókja és aktív munkamenetei törlődnek. Ez nem vonható vissza.`)) )return;try{await api('/api/users/'+encodeURIComponent(u.id),{method:'DELETE'});toast('Fiók törölve',u.name);renderEmployees()}catch(e){toast('Fiók törlése sikertelen',e.message,true)}})
  }

  async function renderReviews(){
    const host=$('#v57-reviews');let d;try{d=await api('/api/reviews')}catch(e){host.innerHTML='<div class="v57-empty">A vélemények nem érhetők el.</div>';return}
    host.innerHTML=`<div class="v57-card"><div class="v57-card-head"><div><span>PUBLIC / FEEDBACK</span><h3>Vélemények kezelése</h3></div><span class="v57-badge">${d.average||0} ★ · ${d.count||0} DB</span></div><div class="v57-review-grid v57-scroll-area">${(d.reviews||[]).map(x=>`<article class="v57-review"><div class="v57-review-top"><b>${esc(x.name)}</b><span>${new Date(x.at).toLocaleDateString('hu-HU')}</span></div><div class="gold-stars">${'★'.repeat(x.rating)}<i>${'★'.repeat(5-x.rating)}</i></div><blockquote>„${esc(x.text)}”</blockquote><div class="v57-review-bottom"><span>${x.rating}/5</span>${isOwner()?`<button class="v57-mini danger" data-del-review="${esc(x.id)}">TÖRLÉS</button>`:''}</div></article>`).join('')||'<div class="v57-empty">Még nincs vélemény.</div>'}</div></div>`;
    $$('#v57-reviews [data-del-review]').forEach(b=>b.onclick=async()=>{if(!(await confirmBox('Vélemény törlése','A vélemény véglegesen törlődik a nyilvános listából.')) )return;try{await api('/api/reviews/'+encodeURIComponent(b.dataset.delReview),{method:'DELETE'});toast('Vélemény törölve','A művelet bekerült az Owner naplóba.');renderReviews()}catch(e){toast('Törlés sikertelen',e.message,true)}})
  }

  async function renderPrices(){
    const host=$('#v57-prices');const editable=isOwner();
    host.innerHTML=`<div class="v57-card"><div class="v57-card-head"><div><span>PRICE CONTROL / OWNER</span><h3>Árvezérlés</h3><small>Az eladási ár módosítása azonnal megjelenik a publikus itallapon. Az árak az ÁFÁ-t tartalmazzák.</small></div><span class="v57-badge">${editable?'OWNER':'CSAK MEGTEKINTÉS'}</span></div><div class="v57-price-list">${products.filter(p=>p.active).map(p=>`<article class="v57-price-row"><div class="v57-price-img">${p.image?`<img src="/${esc(p.image)}">`:'RM'}</div><div class="v57-price-main"><b>${esc(p.name)}</b><small>${esc(p.subtitle||'Red Moon Pub')} · ${p.category==='drink'?'Ital':'Étel'}</small></div><div class="v57-price-edit"><strong>${money(p.price)}</strong>${editable?`<button class="v57-mini" data-price="${esc(p.id)}">ÁR MÓDOSÍTÁSA</button><button class="v57-mini danger" data-delete-product="${esc(p.id)}">TÖRLÉS</button>`:''}</div></article>`).join('')}</div></div>${roleAllowed(me.role)?`<div class="v57-card" style="margin-top:16px"><div class="v57-card-head"><div><span>CATALOG / PRODUCT CONTROL</span><h3>Új termék</h3><small>Név, kategória, kép, rövid aláírás, ár és kezdő készlet.</small></div></div><div class="v57-form-grid"><label class="v57-field"><span>NÉV</span><input id="v57NewProductName" placeholder="Termék neve"></label><label class="v57-field"><span>KATEGÓRIA</span><select id="v57NewProductCategory"><option value="drink">Ital</option><option value="food">Étel</option></select></label><label class="v57-field"><span>RÉSZLEG</span><select id="v57NewProductSection">${POS_SECTIONS.filter(x=>x[0]!=='all').map(x=>`<option value="${x[0]}">${esc(x[1])}</option>`).join('')}</select></label><label class="v57-field"><span>ELADÁSI ÁR</span><input id="v57NewProductPrice" type="number" min="0" value="0"></label><label class="v57-field"><span>KEZDŐ KÉSZLET</span><input id="v57NewProductStock" type="number" min="0" value="0"></label><label class="v57-field"><span>MINIMUM KÉSZLET</span><input id="v57NewProductMin" type="number" min="0" value="0"></label><label class="v57-field"><span>KÉP ÚTVONAL / URL</span><input id="v57NewProductImage" placeholder="assets/menu/...png"></label><label class="v57-field wide"><span>RÖVID ALÁÍRÁS</span><input id="v57NewProductSubtitle" placeholder="Red Moon Pub · ..."></label></div><button id="v57CreateProduct" class="v57-btn red">TERMÉK HOZZÁADÁSA ↗</button></div>`:''}`;
    $$('#v57-prices [data-price]').forEach(b=>b.onclick=async()=>{
      const p=products.find(x=>x.id===b.dataset.price); if(!p)return;
      const d=await formModal('Ár & termék-aláírás',[
        {id:'price',label:'ÚJ ELADÁSI ÁR (Ft)',type:'number',value:p.price,required:true},
        {id:'subtitle',label:'RÖVID ALÁÍRÁS / LEÍRÁS',type:'textarea',value:p.subtitle||'',wide:true,placeholder:'Prémium Red Moon válogatás · jéggel ajánlva.'}
      ]);
      if(!d)return;
      try{
        const out=await api('/api/products/'+encodeURIComponent(p.id),{method:'PATCH',body:JSON.stringify({price:Number(d.price),subtitle:String(d.subtitle||'').trim()})});
        products=products.map(x=>x.id===p.id?out.product:x);
        toast('Termék frissítve',p.name+' · '+money(out.product.price));
        renderPrices();
      }catch(e){toast('Módosítás sikertelen',e.message,true)}
    })
    $$('#v57-prices [data-delete-product]').forEach(b=>b.onclick=async()=>{const p=products.find(x=>x.id===b.dataset.deleteProduct);if(!p)return;if(!(await confirmBox('Termék törlése',`${p.name} kikerül az eladható termékek közül. A korábbi eladási napló megmarad.`)))return;try{const out=await api('/api/products/'+encodeURIComponent(p.id),{method:'DELETE'});products=products.map(x=>x.id===p.id?out.product:x);toast('Termék törölve',p.name);renderPrices()}catch(e){toast('Törlés sikertelen',e.message,true)}})
    
    $('#v57CreateProduct')?.addEventListener('click',async()=>{const name=$('#v57NewProductName').value.trim();if(!name){toast('Hiányzó név','A termék neve kötelező.',true);return}try{const out=await api('/api/products',{method:'POST',body:JSON.stringify({name,category:$('#v57NewProductCategory').value,section:$('#v57NewProductSection').value,price:Number($('#v57NewProductPrice').value),stock:Number($('#v57NewProductStock').value),minStock:Number($('#v57NewProductMin').value),image:$('#v57NewProductImage').value.trim(),subtitle:$('#v57NewProductSubtitle').value.trim()})});products.push(out.product);toast('Termék hozzáadva',out.product.name);renderPrices()}catch(e){toast('Termék hozzáadása sikertelen',e.message,true)}})
  }

  async function renderManagement(){
    const host=$('#v57-management');const owner=isOwner();
    host.innerHTML=`<div class="v57-grid two">
      <div class="v57-card"><div class="v57-card-head"><div><span>OWNER / FINANCE</span><h3>Overall bevétel</h3></div></div><div id="v57Finance"></div></div>
      <div class="v57-card"><div class="v57-card-head"><div><span>OWNER / EVENTS</span><h3>Rendezvények</h3></div>${owner?'<button id="v57NewEvent" class="v57-btn red">＋ ÚJ</button>':''}</div><div id="v57Events"></div></div>
    </div>
    ${owner?`<div class="v57-grid two"><div class="v57-card"><div class="v57-card-head"><div><span>OWNER / ACCOUNTS</span><h3>Fiókok</h3></div><button id="v57NewUser" class="v57-btn red">＋ ÚJ FIÓK</button></div><div id="v57Users"></div></div><div class="v57-card"><div class="v57-card-head"><div><span>OWNER / AUDIT</span><h3>Teljes rendszer napló</h3><small>Owner minden rögzített műveletet lát.</small></div></div><div id="v57Audit"></div></div></div>`:''}
    ${!owner?`<div class="v57-card"><div class="v57-card-head"><div><span>MANAGER / COMMAND</span><h3>Készletértesítések</h3><small>A Manager itt csak a készletfeltöltési értesítéseket látja.</small></div></div><div id="v57Notifications"></div></div>`:''}`;
    try{const d=await api('/api/finance/overall');$('#v57Finance').innerHTML=`<div class="v57-finance"><strong>${money(d.overallRevenue)}</strong><span>OVERALL BEVÉTEL</span><small>Nyers összeg: ${money(d.rawRevenue)} · nullázási offset: ${money(d.offset)}</small>${owner?'<button id="v57ResetFinance" class="v57-btn ghost">OVERALL NULLÁZÁSA</button>':''}</div>`;$('#v57ResetFinance')?.addEventListener('click',async()=>{if(await confirmBox('Overall nullázása','Az eladások nem törlődnek, csak a kijelzett számláló nullázódik.')){await api('/api/finance/reset',{method:'POST',body:'{}'});renderManagement();toast('Overall nullázva','Az eladási adatok megmaradtak.')}})}catch{}
    try{const d=await api('/api/public-events');$('#v57Events').innerHTML=(d.events||[]).map(x=>`<div class="v57-row"><div><b>${esc(x.title)}</b><small>${new Date(x.startsAt).toLocaleString('hu-HU')} · ${esc(x.place)}</small></div><span>${x.description?esc(x.description):''}</span></div>`).join('')||'<div class="v57-empty">Nincs rendezvény.</div>'}catch{}
    if(owner){
      $('#v57NewEvent')?.addEventListener('click',async()=>{const d=await formModal('Új rendezvény',[{id:'title',label:'CÍM',required:true},{id:'startsAt',label:'KEZDÉS',type:'datetime-local',required:true},{id:'place',label:'HELYSZÍN',value:'Red Moon Pub'},{id:'description',label:'LEÍRÁS',type:'textarea',wide:true}]);if(!d)return;try{await api('/api/events/create',{method:'POST',body:JSON.stringify(d)});toast('Rendezvény létrehozva','A publikus Rendezvények oldalon megjelent.');renderManagement()}catch(e){toast('Rendezvény sikertelen',e.message,true)}})
      let users=[];try{users=(await api('/api/users')).users||[]}catch{}
      $('#v57Users').innerHTML=users.map(u=>`<div class="v57-row"><div><b>${esc(u.name)}</b><small>${esc(u.username)} · ${esc(u.role.toUpperCase())}</small></div><button class="v57-mini" data-u="${esc(u.id)}">SZERKESZTÉS</button></div>`).join('')||'<div class="v57-empty">Nincs fiók.</div>';
      $$('#v57Users [data-u]').forEach(b=>b.onclick=async()=>{const u=users.find(x=>x.id===b.dataset.u);const d=await formModal('Fiók szerkesztése',[{id:'name',label:'NÉV',value:u.name,required:true},{id:'username',label:'FELHASZNÁLÓNÉV',value:u.username,required:true},{id:'role',label:'RANG',type:'select',value:u.role,options:[{value:'staff',label:'Staff'},{value:'manager',label:'Manager'},{value:'owner',label:'Owner'},{value:'dj',label:'DJ Access'}]},{id:'password',label:'ÚJ JELSZÓ',type:'password'}]);if(!d)return;try{await api('/api/users/'+encodeURIComponent(u.id),{method:'PATCH',body:JSON.stringify(d)});toast('Fiók frissítve',u.name);renderManagement()}catch(e){toast('Fiók frissítés sikertelen',e.message,true)}})
      $('#v57NewUser')?.addEventListener('click',async()=>{const d=await formModal('Új fiók',[{id:'name',label:'NÉV',required:true},{id:'username',label:'FELHASZNÁLÓNÉV',required:true},{id:'password',label:'JELSZÓ',type:'password',required:true},{id:'role',label:'RANG',type:'select',value:'staff',options:[{value:'staff',label:'Staff'},{value:'manager',label:'Manager'},{value:'owner',label:'Owner'},{value:'dj',label:'DJ Access'}]}]);if(!d)return;try{await api('/api/users',{method:'POST',body:JSON.stringify(d)});toast('Fiók létrehozva',d.name);renderManagement()}catch(e){toast('Fiók létrehozás sikertelen',e.message,true)}})
      try{const d=await api('/api/audit');$('#v57Audit').innerHTML=`<div class="v57-log-scroll">${(d.audit||[]).map(x=>`<div class="v57-row"><div><b>${esc(x.action)}</b><small>${esc(x.user)} · ${esc(x.role)} · ${esc(x.details)}</small></div><span>${new Date(x.at).toLocaleString('hu-HU')}</span></div>`).join('')||'<div class="v57-empty">Nincs napló.</div>'}</div>`}catch(e){$('#v57Audit').innerHTML='<div class="v57-empty">Az audit csak Owner számára érhető el.</div>'}
    }else{
      try{const d=await api('/api/notifications');$('#v57Notifications').innerHTML=(d.notifications||[]).map(x=>`<div class="v57-row"><div><b>${esc(x.title)}</b><small>${esc(x.message)}</small></div><span>${new Date(x.at).toLocaleString('hu-HU')}</span></div>`).join('')||'<div class="v57-empty">Nincs készletfeltöltési értesítés.</div>'}catch(e){}
    }
  }

  async function renderProfile(){
    const host=$('#v57-profile');let d;try{d=await api('/api/me')}catch(e){return}
    const u=d.user;
    host.innerHTML=`<div class="v57-card v57-profile-card"><div class="v57-profile-avatar" id="v57ProfileAvatar">${u.avatar?`<img src="${esc(u.avatar)}" alt="Profilkép">`:`<span>${esc((u.name||'RM').slice(0,2).toUpperCase())}</span>`}</div><div><div class="v57-card-head"><div><span>ACCOUNT / IDENTITY</span><h3>Saját profil</h3><small>${esc(u.role.toUpperCase())} · ${esc(u.username)}</small></div></div><div class="v57-form-grid"><label class="v57-field wide"><span>NÉV</span><input id="v57ProfName" value="${esc(u.name||'')}"></label><label class="v57-field wide"><span>PROFILKÉP</span><input id="v57ProfFile" type="file" accept="image/png,image/jpeg,image/webp"><small>PNG/JPG/WebP · maximum 25 MB · feltöltés után kör alakban kiválaszthatod a kívánt részletet.</small></label></div><button id="v57SaveProfile" class="v57-btn red">PROFIL MENTÉSE ↗</button></div></div>`;
    let croppedAvatar=u.avatar||'';
    $('#v57ProfFile').onchange=async()=>{const f=$('#v57ProfFile').files?.[0];if(!f)return;if(f.size>25*1024*1024){toast('Túl nagy kép','A profilkép maximum 25 MB lehet.',true);$('#v57ProfFile').value='';return}try{croppedAvatar=await cropAvatar(f);$('#v57ProfileAvatar').innerHTML=`<img src="${esc(croppedAvatar)}">`;toast('Profilkép kiválasztva','A kör alakú kivágás elkészült.');}catch(e){if(e.message!=='A kivágás megszakítva.')toast('Kép feldolgozása sikertelen',e.message,true)}};
    $('#v57SaveProfile').onclick=async()=>{try{const out=await api('/api/profile',{method:'PATCH',body:JSON.stringify({name:$('#v57ProfName').value,avatar:croppedAvatar})});me=out.user;window.me=me;$('#v57SideName').textContent=me.name;toast('Profil mentve','A profil módosításai mentve lettek.');renderProfile()}catch(e){toast('Profil mentés sikertelen',e.message,true)}}
  }

  function cropAvatar(file){
    return new Promise((resolve,reject)=>{
      const reader=new FileReader();
      reader.onerror=reject;
      reader.onload=()=>{
        const img=new Image();
        img.onerror=reject;
        img.onload=()=>{
          const size=320, canvas=document.createElement('canvas');
          canvas.width=canvas.height=size;
          const ctx=canvas.getContext('2d');
          let zoom=1, scale=Math.max(size/img.width,size/img.height), x=(size-img.width*scale)/2, y=(size-img.height*scale)/2;
          let dragging=false,sx=0,sy=0,ox=0,oy=0;
          const modal=document.createElement('div');
          modal.className='v57-crop-modal';
          modal.innerHTML='<div class="v57-crop-box"><div class="v57-kicker">RED MOON / PROFILE IMAGE</div><h3>Profilkép kivágása</h3><div class="v57-crop-stage"><canvas width="320" height="320"></canvas><div class="v57-crop-ring"></div></div><label class="v57-field"><span>NAGYÍTÁS</span><input class="v57-crop-zoom" type="range" min="1" max="3" step="0.01" value="1"></label><p>Húzd a képet a körben a kívánt részre.</p><div class="v57-dialog-actions"><button class="v57-btn ghost" data-crop="cancel">MÉGSE</button><button class="v57-btn red" data-crop="ok">KIVÁLASZTÁS</button></div></div>';
          document.body.appendChild(modal);
          const stage=modal.querySelector('canvas');
          const outCtx=stage.getContext('2d');
          const zoomEl=modal.querySelector('.v57-crop-zoom');
          function clamp(){
            const w=img.width*scale*zoom, h=img.height*scale*zoom;
            x=Math.min(size/2+w/2,Math.max(size/2-w/2,x+w/2))-w/2;
            y=Math.min(size/2+h/2,Math.max(size/2-h/2,y+h/2))-h/2;
          }
          function draw(){
            outCtx.clearRect(0,0,size,size);
            outCtx.save();
            outCtx.translate(x+img.width*scale*zoom/2,y+img.height*scale*zoom/2);
            outCtx.scale(scale*zoom,scale*zoom);
            outCtx.drawImage(img,-img.width/2,-img.height/2);
            outCtx.restore();
          }
          function reset(){x=(size-img.width*scale*zoom)/2;y=(size-img.height*scale*zoom)/2;clamp();draw()}
          reset();
          zoomEl.oninput=()=>{zoom=Number(zoomEl.value);reset()};
          stage.onpointerdown=e=>{dragging=true;sx=e.clientX;sy=e.clientY;ox=x;oy=y;stage.setPointerCapture(e.pointerId)};
          stage.onpointermove=e=>{if(!dragging)return;x=ox+e.clientX-sx;y=oy+e.clientY-sy;clamp();draw()};
          stage.onpointerup=()=>{dragging=false};
          stage.onpointercancel=()=>{dragging=false};
          modal.querySelector('[data-crop="cancel"]').onclick=()=>{modal.remove();reject(new Error('A kivágás megszakítva.'))};
          modal.querySelector('[data-crop="ok"]').onclick=()=>{const result=stage.toDataURL('image/jpeg',.9);modal.remove();resolve(result)};
        };
        img.src=reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  // Refresh product/state while staying in the Command Center.
  let refreshBusy=false;
  async function refresh(){
    if(refreshBusy || !me || app.classList.contains('hidden'))return;
    refreshBusy=true;
    try{
      const [pd,sd]=await Promise.all([api('/api/products'),api('/api/shifts/current')]);
      products=pd.products||[]; shift=sd.shift||null; window.products=products; updateGlobalShiftBanner();
      if(active==='pos'){
        const selected=$('.v57-cat.active')?.dataset.cat || products.find(p=>p.active)?.category || 'drink';
        renderProductGrid(selected); renderCart(); renderSalesHistory();
      }else if(active==='prices' || active==='stock'){
        // Do not rebuild the visible workspace on the 5s poll: rebuilding inputs/lists caused the Command Center to flicker.
      }else if(active==='overview'){
        updateShiftOverview();
        loadOnlineOverview();
        const overall=$('#v57Overall'); if(overall){try{const d=await api('/api/dashboard');overall.textContent=money(d.overallRevenue)}catch{}}
      }else if(active==='shifts'){
        // Keep the shift screen stable; explicit actions refresh its full layout.
      }
    }catch{}
    finally{refreshBusy=false}
  }
  function init(){if(app.classList.contains('hidden'))return; loadBase().then(()=>setView('overview'))}
  const obs=new MutationObserver(init);obs.observe(app,{attributes:true,attributeFilter:['class']});
  setTimeout(init,400);
  clearInterval(refreshTimer);refreshTimer=setInterval(refresh,5000);
})();
