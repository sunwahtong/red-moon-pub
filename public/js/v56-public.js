(()=>{
 const $=s=>document.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)], esc=s=>String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
 async function api(u,o={}){const r=await fetch(u,{cache:'no-store',headers:{'Content-Type':'application/json'},...o});let d={};try{d=await r.json()}catch{}if(!r.ok)throw Error(d.error||'Hiba');return d}
 const state={eventsSig:'',productsSig:'',reviewsBound:false,eventPoll:null,productPoll:null};

 function renderEmpty(root,home=false){
   if(!root)return;
   root.innerHTML=`<div class="rm-event-empty-state"><div><span class="rm17-label">RED MOON / EVENTS</span><h2>Hamarosan lesz esemény.</h2><p>${home?'Az új rendezvény automatikusan itt jelenik meg.':'Az új rendezvény automatikusan megjelenik ezen az oldalon.'}</p></div><a class="rm17-btn" href="events.html">MINDEN EVENT ↗</a></div>`;
 }

 function getUpcoming(events){
   const now=Date.now();
   return (events||[]).filter(x=>new Date(x.startsAt).getTime()>=now).sort((a,b)=>new Date(a.startsAt)-new Date(b.startsAt));
 }
 function eventSignature(events){return (events||[]).map(x=>[x.id,x.title,x.description,x.place,x.startsAt,x.endsAt,x.active].join('¦')).join('||');}
 function renderHomeEvent(x,root){
   root.innerHTML=`<div class="rm59-home-event-copy"><div><span class="rm17-label">NEXT EVENT · RED MOON</span><h2>${esc(x.title)}</h2><p class="rm17-lead">${esc(x.description||'')} · ${esc(x.place||'Red Moon Pub')}</p></div><div class="rm59-home-event-side"><div class="rm59-home-countdown" data-event-time="${esc(x.startsAt)}"><div><b data-c="d">--</b><span>NAP</span></div><div><b data-c="h">--</b><span>ÓRA</span></div><div><b data-c="m">--</b><span>PERC</span></div><div><b data-c="s">--</b><span>MP</span></div></div><small>HÁTRALÉVŐ IDŐ</small><a class="rm17-btn red" href="events.html">EVENT INFO ↗</a></div></div>`;
 }
 function renderEventsPage(events,root){
   const now=Date.now();
   const upcoming=(events||[]).filter(x=>new Date(x.startsAt).getTime()>=now).sort((a,b)=>new Date(a.startsAt)-new Date(b.startsAt));
   const past=(events||[]).filter(x=>new Date(x.startsAt).getTime()<now).sort((a,b)=>new Date(b.startsAt)-new Date(a.startsAt));
   const ordered=[...upcoming,...past];
   if(!ordered.length){renderEmpty(root,false);return}
   root.innerHTML=ordered.map(x=>{
      const dt=new Date(x.startsAt), isPast=dt.getTime()<now;
      const date=dt.toLocaleDateString('hu-HU',{year:'numeric',month:'long',day:'numeric'});
      const time=dt.toLocaleTimeString('hu-HU',{hour:'2-digit',minute:'2-digit'});
      return `<article class="v64-event-page-item${isPast?' v64-event-page-past':''}">
        <div class="v64-event-page-copy"><span class="rm17-label">${isPast?'PAST EVENT':'NEXT EVENT · RED MOON'}</span><h2>${esc(x.title)}</h2><p>${esc(x.description||'A Red Moon következő eseménye.')}</p><div class="v64-event-page-meta"><span><b>${esc(date)}</b></span><span><b>${esc(time)}</b></span><span><b>${esc(x.place||'Red Moon Pub')}</b></span></div></div>
        <div class="v64-event-page-side"><div class="v64-event-page-countdown${isPast?' live':''}" data-event-time="${esc(x.startsAt)}"><div><b data-c="d">--</b><span>NAP</span></div><div><b data-c="h">--</b><span>ÓRA</span></div><div><b data-c="m">--</b><span>PERC</span></div><div><b data-c="s">--</b><span>MP</span></div></div><small>${isPast?'AZ ESEMÉNY LEZAJLOTT':'HÁTRALÉVŐ IDŐ'}</small><a class="rm17-btn ${isPast?'':'red'}" href="events.html">${isPast?'ARCHÍV':'EVENT INFO'} ↗</a></div>
      </article>`;
   }).join('');
 }
 async function syncEvents(force=false){
   const eventRoot=$('#v56PublicEvents'), homeEvent=$('#homeEventShell');
   if(!eventRoot&&!homeEvent)return;
   try{
     const d=await api('/api/public-events'); const events=d.events||[]; const sig=eventSignature(events);
     // Re-render only when the data really changed. This removes the 15-second visual blink.
     if(!force && sig===state.eventsSig){tickEventCountdowns();return}
     state.eventsSig=sig;
     const upcoming=getUpcoming(events);
     if(eventRoot)renderEventsPage(events,eventRoot);
     if(homeEvent){
       if(upcoming[0])renderHomeEvent(upcoming[0],homeEvent);
       else renderEmpty(homeEvent,true);
     }
     tickEventCountdowns();
   }catch{
     if(eventRoot && !eventRoot.dataset.loaded)eventRoot.innerHTML='<div class="v56-review-empty">A rendezvények jelenleg nem érhetők el.</div>';
   }
 }
 function tickEventCountdowns(){
   $$('[data-event-time]').forEach(el=>{
     const raw=el.dataset.eventTime;if(!raw)return;
     const diff=new Date(raw).getTime()-Date.now();
     if(diff<=0){el.querySelectorAll('[data-c]').forEach(x=>x.textContent='00');el.classList.add('live');return}
     const days=Math.floor(diff/86400000),hours=Math.floor(diff/3600000)%24,mins=Math.floor(diff/60000)%60,secs=Math.floor(diff/1000)%60;
     const vals={d:days,h:hours,m:mins,s:secs};Object.entries(vals).forEach(([k,v])=>{const x=el.querySelector(`[data-c=${k}]`);if(x)x.textContent=String(v).padStart(2,'0')});
   });
 }

 async function syncPublicProducts(){
   const menuGrid=document.querySelector('.drink-grid');
   const hasCards=document.querySelector('.rm17-drink,.featured-grid .drink-card');
   if(!menuGrid&&!hasCards)return;
   try{
     const d=await api('/api/public-products'); const products=d.products||[];
     const sig=products.map(x=>`${x.id}:${x.price}:${x.name}:${x.subtitle||''}:${x.image||''}`).join('|');
     if(menuGrid && (sig!==state.productsSig || menuGrid.dataset.rmRenderedSig!==sig)){
       state.productsSig=sig;
       menuGrid.innerHTML=products.map((x,i)=>`<article class="drink-card"><div class="drink-art"><span class="drink-no">${String(i+1).padStart(2,'0')} / RED MOON</span><div class="moon-glow"></div><img src="${esc(x.image)}" alt="${esc(x.name)}" loading="lazy"></div><div class="drink-info"><div><h3>${esc(x.name)}</h3><p>${esc(x.subtitle||'')}</p></div><div class="drink-price"><strong>${Number(x.price||0).toLocaleString('hu-HU')} Ft</strong><small class="vat-note">Áraink az ÁFÁ-t tartalmazzák.</small></div></div></article>`).join('');
       menuGrid.dataset.rmRenderedSig=sig;
     }
     const byName=new Map(products.map(x=>[String(x.name).trim().toLocaleLowerCase('hu-HU'),x]));
     document.querySelectorAll('.rm17-drink,.featured-grid .drink-card').forEach(card=>{
       const name=card.querySelector('h3')?.textContent?.trim(), product=name&&byName.get(name.toLocaleLowerCase('hu-HU'));if(!product)return;
       const price=card.querySelector('strong');if(price)price.textContent=`${Number(product.price||0).toLocaleString('hu-HU')} Ft`;
       const subtitle=card.querySelector('.drink-info p');if(subtitle)subtitle.textContent=product.subtitle||'';
     });
   }catch{}
 }

 async function loadReviews(){
   const root=$('#v56ReviewsPublic');if(!root)return;
   if(root.dataset.rmReviewsBound!=='1' || !$('#v56ReviewSummary')){
     let rating=5;
     root.innerHTML=`<div class="v56-review-shell"><div class="v56-review-list"><div class="v56-review-list-head"><div><span class="rm17-label">PUBLIC / REVIEWS</span><h2>Vélemények</h2></div><div id="v56ReviewSummary" class="v56-rating-summary">—</div></div><div id="v56ReviewItems" class="v56-review-items"></div></div><form class="v56-review-form" id="v56ReviewForm"><span class="rm17-label">RED MOON / FEEDBACK</span><h2>Mondd el, milyen volt.</h2><p>Névvel és 1–5 csillagos értékeléssel küldhetsz véleményt.</p><div class="v56-field"><label>NÉV</label><input id="v56ReviewName" maxlength="80" required></div><div class="v56-field"><label>ÉRTÉKELÉS</label><div class="v56-stars" id="v56Stars">${[1,2,3,4,5].map(i=>`<button type="button" class="v56-star active" data-r="${i}">★</button>`).join('')}</div></div><div class="v56-field"><label>VÉLEMÉNY</label><textarea id="v56ReviewText" maxlength="600" required></textarea></div><button class="rm17-btn red" type="submit">VÉLEMÉNY KÜLDÉSE ↗</button><div id="v56ReviewMsg" class="v56-review-meta"></div></form></div>`;
     $('#v56Stars').onclick=e=>{const b=e.target.closest('[data-r]');if(!b)return;rating=Number(b.dataset.r);document.querySelectorAll('.v56-star').forEach(x=>x.classList.toggle('active',Number(x.dataset.r)<=rating));};
     $('#v56ReviewForm').onsubmit=async e=>{e.preventDefault();const msg=$('#v56ReviewMsg');try{await api('/api/reviews',{method:'POST',body:JSON.stringify({name:$('#v56ReviewName').value,rating,text:$('#v56ReviewText').value})});msg.textContent='Köszönjük a véleményt.';e.target.reset();rating=5;document.querySelectorAll('.v56-star').forEach(x=>x.classList.add('active'));await loadReviews();}catch(err){msg.textContent=err.message;}};
     root.dataset.rmReviewsBound='1';
   }
   try{const d=await api('/api/reviews');$('#v56ReviewSummary').textContent=`${d.average||0} ★ · ${d.count} vélemény`;$('#v56ReviewItems').innerHTML=(d.reviews||[]).map(x=>`<article class="v57-review"><div class="v57-review-top"><b>${esc(x.name)}</b><span>${new Date(x.at).toLocaleDateString('hu-HU')}</span></div><div class="gold-stars">${'★'.repeat(x.rating)}<i>${'★'.repeat(5-x.rating)}</i></div><blockquote>„${esc(x.text)}”</blockquote><div class="v57-review-bottom"><span>${x.rating}/5</span></div></article>`).join('')||'<div class="v56-review-empty">Még nincs vélemény.</div>';}catch{}
 }

 window.RedMoonPageInit=async function(){
   await Promise.allSettled([syncEvents(true),syncPublicProducts(),loadReviews()]);
 };
 // Initial page + SPA pages.
 window.RedMoonPageInit();
 if(!state.eventPoll)state.eventPoll=setInterval(()=>syncEvents(false),15000);
 if(!state.productPoll)state.productPoll=setInterval(()=>syncPublicProducts(),2500);
 setInterval(tickEventCountdowns,1000);
})();
