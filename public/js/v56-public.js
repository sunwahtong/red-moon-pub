(()=>{
 const $=s=>document.querySelector(s), esc=s=>String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
 async function api(u,o={}){const r=await fetch(u,{cache:'no-store',headers:{'Content-Type':'application/json'},...o});let d={};try{d=await r.json()}catch{}if(!r.ok)throw Error(d.error||'Hiba');return d}
 const reviewRoot=$('#v56ReviewsPublic');
 if(reviewRoot){
  let rating=5;
  reviewRoot.innerHTML=`<div class="v56-review-shell"><div class="v56-review-list"><div class="v56-review-list-head"><div><span class="rm17-label">PUBLIC / REVIEWS</span><h2>Vélemények</h2></div><div id="v56ReviewSummary" class="v56-rating-summary">—</div></div><div id="v56ReviewItems" class="v56-review-items"></div></div><form class="v56-review-form" id="v56ReviewForm"><span class="rm17-label">RED MOON / FEEDBACK</span><h2>Mondd el, milyen volt.</h2><p>Névvel és 1–5 csillagos értékeléssel küldhetsz véleményt.</p><div class="v56-field"><label>NÉV</label><input id="v56ReviewName" maxlength="80" required></div><div class="v56-field"><label>ÉRTÉKELÉS</label><div class="v56-stars" id="v56Stars">${[1,2,3,4,5].map(i=>`<button type="button" class="v56-star active" data-r="${i}">★</button>`).join('')}</div></div><div class="v56-field"><label>VÉLEMÉNY</label><textarea id="v56ReviewText" maxlength="600" required></textarea></div><button class="rm17-btn red" type="submit">VÉLEMÉNY KÜLDÉSE ↗</button><div id="v56ReviewMsg" class="v56-review-meta"></div></form></div>`;
  $('#v56Stars').onclick=e=>{const b=e.target.closest('[data-r]');if(!b)return;rating=Number(b.dataset.r);document.querySelectorAll('.v56-star').forEach(x=>x.classList.toggle('active',Number(x.dataset.r)<=rating));};
  async function loadReviews(){const d=await api('/api/reviews');$('#v56ReviewSummary').textContent=`${d.average||0} ★ · ${d.count} vélemény`;$('#v56ReviewItems').innerHTML=(d.reviews||[]).map(x=>`<article class="v57-review"><div class="v57-review-top"><b>${esc(x.name)}</b><span>${new Date(x.at).toLocaleDateString('hu-HU')}</span></div><div class="gold-stars">${'★'.repeat(x.rating)}<i>${'★'.repeat(5-x.rating)}</i></div><blockquote>„${esc(x.text)}”</blockquote><div class="v57-review-bottom"><span>${x.rating}/5</span></div></article>`).join('')||'<div class="v56-review-empty">Még nincs vélemény.</div>';}
  $('#v56ReviewForm').onsubmit=async e=>{e.preventDefault();const msg=$('#v56ReviewMsg');try{await api('/api/reviews',{method:'POST',body:JSON.stringify({name:$('#v56ReviewName').value,rating,text:$('#v56ReviewText').value})});msg.textContent='Köszönjük a véleményt.';e.target.reset();rating=5;document.querySelectorAll('.v56-star').forEach(x=>x.classList.add('active'));await loadReviews();}catch(err){msg.textContent=err.message;}};
  loadReviews();
 }

 const menuGrid=document.querySelector('.drink-grid');
 const syncPublicProducts=async()=>{
  try{
   const d=await api('/api/public-products');
   const products=d.products||[];
   if(menuGrid){
    const sig=products.map(x=>`${x.id}:${x.price}:${x.name}`).join('|');
    if(menuGrid.dataset.rm59Sig!==sig){
      menuGrid.dataset.rm59Sig=sig;
      menuGrid.innerHTML=products.map((x,i)=>`<article class="drink-card"><div class="drink-art"><span class="drink-no">${String(i+1).padStart(2,'0')} / RED MOON</span><div class="moon-glow"></div><img src="${esc(x.image)}" alt="${esc(x.name)}" loading="lazy"><span class="art-caption">RED MOON / SEE CITY RP</span></div><div class="drink-info"><div><h3>${esc(x.name)}</h3><p>${esc(x.subtitle||'Red Moon Pub · SeeCity RP')}</p></div><div class="drink-price"><strong>${Number(x.price||0).toLocaleString('hu-HU')} Ft</strong><small class="vat-note">Áraink az ÁFÁ-t tartalmazzák.</small></div></div></article>`).join('');
    }
   }
   const byName=new Map(products.map(x=>[String(x.name).trim().toLocaleLowerCase('hu-HU'),x]));
   document.querySelectorAll('.rm17-drink,.featured-grid .drink-card').forEach(card=>{
    const name=card.querySelector('h3')?.textContent?.trim(); const product=name&&byName.get(name.toLocaleLowerCase('hu-HU')); if(!product)return;
    const price=card.querySelector('strong'); if(price)price.textContent=`${Number(product.price||0).toLocaleString('hu-HU')} Ft`;
    let vat=card.querySelector('.vat-note'); if(!vat){vat=document.createElement('small');vat.className='vat-note';card.querySelector('.drink-info')?.appendChild(vat)} if(vat)vat.textContent='Áraink az ÁFÁ-t tartalmazzák.';
   });
  }catch{}
 };
 if(menuGrid || document.querySelector('.rm17-drink,.featured-grid .drink-card')){syncPublicProducts();setInterval(syncPublicProducts,2000)}

 const eventRoot=$('#v56PublicEvents');
 const homeEvent=document.querySelector('#tonight .rm17-event');
 if(eventRoot || homeEvent){
  if(eventRoot) document.querySelectorAll('.rm17-events-list > .rm17-event-card').forEach(x=>x.classList.add('v56-hidden-static-event'));
  const renderHomeEvent=(x,root)=>{root.innerHTML=`<div class="rm59-home-event-copy"><div><span class="rm17-label">NEXT EVENT · RED MOON</span><h2>${esc(x.title)}</h2><p class="rm17-lead">${esc(x.description||'')} · ${esc(x.place||'Red Moon Pub')}</p></div><div class="rm59-event-side"><div class="rm59-event-count" data-event-time="${esc(x.startsAt)}">—</div><small>hátralévő idő</small><a class="rm17-btn red" href="events.html">EVENT INFO ↗</a></div></div>`};
  const loadEvents=async()=>{try{
   const d=await api('/api/public-events'); const events=d.events||[];
   if(eventRoot) eventRoot.innerHTML=events.map(x=>`<article class="v56-event-card-live"><div><span class="v56-event-live">RED MOON EVENT</span><h3>${esc(x.title)}</h3><small>${new Date(x.startsAt).toLocaleString('hu-HU')} · ${esc(x.place)}</small><p>${esc(x.description||'')}</p></div><div><div class="v56-countdown" data-event-time="${esc(x.startsAt)}">—</div><small>hátralévő idő</small></div></article>`).join('')||'<div class="v56-review-empty">Nincs közzétett rendezvény.</div>';
   if(homeEvent){if(events[0])renderHomeEvent(events[0],homeEvent);else homeEvent.innerHTML='<div class="rm59-home-event-copy"><div><span class="rm17-label">RED MOON / TONIGHT</span><h2>Hamarosan új esemény.</h2><p class="rm17-lead">Az új rendezvény automatikusan itt jelenik meg.</p></div><div class="rm59-event-side"><a class="rm17-btn" href="events.html">RENDEZVÉNYEK ↗</a></div></div>';}
  }catch{if(eventRoot)eventRoot.innerHTML='<div class="v56-review-empty">A rendezvények jelenleg nem érhetők el.</div>';}};
  const tick=()=>document.querySelectorAll('[data-event-time]').forEach(el=>{const d=Math.max(0,new Date(el.dataset.eventTime)-Date.now());const days=Math.floor(d/86400000),hours=Math.floor(d/3600000)%24,mins=Math.floor(d/60000)%60,secs=Math.floor(d/1000)%60;el.textContent=d?`${days}n ${String(hours).padStart(2,'0')}:${String(mins).padStart(2,'0')}:${String(secs).padStart(2,'0')}`:'MOST';});
  loadEvents().then(tick);setInterval(tick,1000);setInterval(loadEvents,15000);
 }

})();
