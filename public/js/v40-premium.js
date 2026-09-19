(() => {
  const qs = (s,r=document)=>r.querySelector(s);
  const qsa = (s,r=document)=>[...r.querySelectorAll(s)];
  document.documentElement.dataset.rmVersion='40';
  const nav=qs('header.nav');
  const onScroll=()=>nav?.classList.toggle('rm-scrolled',window.scrollY>18);
  onScroll(); addEventListener('scroll',onScroll,{passive:true});
  const page=(location.pathname.split('/').pop()||'index.html').toLowerCase();
  qsa('header.nav nav a').forEach(a=>{
    const href=(a.getAttribute('href')||'').split('#')[0].split('/').pop().toLowerCase();
    a.classList.toggle('active',href===page || (page===''&&href==='index.html'));
  });
  qsa('.rm17-section,.rm17-event,.rm17-drink,.rm17-owner,.rm17-event-card,.rm17-journal-card,.rm17-vip-card,.drink-card,.club-panel,.dj-panel,.panel').forEach((el,i)=>{
    el.classList.add('rm40-reveal');
    el.style.setProperty('--rm-delay',`${Math.min(i%5,4)*55}ms`);
  });
  if('IntersectionObserver' in window){
    const io=new IntersectionObserver(entries=>entries.forEach(e=>{if(e.isIntersecting){e.target.classList.add('rm40-in');io.unobserve(e.target)}}),{threshold:.08,rootMargin:'0px 0px -35px'});
    qsa('.rm40-reveal').forEach(el=>io.observe(el));
  }else qsa('.rm40-reveal').forEach(el=>el.classList.add('rm40-in'));
  // Lightweight pointer glow on premium cards; disabled for touch devices.
  if(matchMedia('(pointer:fine)').matches){
    qsa('.rm17-drink,.rm17-owner,.rm17-journal-card,.rm17-vip-card,.drink-card,.dj-panel,.club-player,.club-side,.club-chat').forEach(card=>{
      card.addEventListener('pointermove',e=>{
        const r=card.getBoundingClientRect(),x=((e.clientX-r.left)/r.width)*100,y=((e.clientY-r.top)/r.height)*100;
        card.style.setProperty('--mx',`${x}%`);card.style.setProperty('--my',`${y}%`);
      });
      card.addEventListener('pointerleave',()=>{card.style.removeProperty('--mx');card.style.removeProperty('--my')});
    });
  }
  // Keep mobile menu usable even on pages that did not ship their own tiny handler.
  const hamb=qs('#hamb'),menu=qs('header.nav nav');
  if(hamb&&menu&&!hamb.dataset.rm40){hamb.dataset.rm40='1';hamb.addEventListener('click',()=>menu.classList.toggle('open'));}
})();
