/* V53 — Unified visual performance controller + persistent Quality */
(()=>{
  'use strict';

  const KEY='redmoon-quality';
  const VALID=['cinematic','balanced','lite'];
  const LABEL={cinematic:'Cinematic',balanced:'Balanced',lite:'Lite'};
  const root=document.documentElement;

  let saved='';
  try{saved=localStorage.getItem(KEY)||''}catch(_){}
  const initial=VALID.includes(saved)?saved:'cinematic';

  function apply(level){
    VALID.forEach(q=>root.classList.remove('rm-quality-'+q));
    root.classList.add('rm-quality-'+level);
    try{localStorage.setItem(KEY,level)}catch(_){}
    const btn=document.querySelector('#rm-quality-toggle b');
    if(btn) btn.textContent=LABEL[level];
    document.querySelectorAll('.rm-quality-option').forEach(el=>{
      el.classList.toggle('active',el.dataset.quality===level);
    });
    window.dispatchEvent(new CustomEvent('redmoon:qualitychange',{detail:{quality:level}}));
  }

  /* Keep the old smoke/filter look working without the old JS duplicates. */
  if(!document.getElementById('rm49SmokeSvg')){
    const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
    svg.id='rm49SmokeSvg'; svg.setAttribute('aria-hidden','true');
    svg.style.cssText='position:absolute;width:0;height:0;pointer-events:none;overflow:hidden';
    svg.innerHTML='<filter id="rm49SmokeDistort" x="-20%" y="-20%" width="140%" height="140%"><feTurbulence type="fractalNoise" baseFrequency="0.008 0.025" numOctaves="3" seed="21" result="noise"/><feDisplacementMap in="SourceGraphic" in2="noise" scale="32" xChannelSelector="R" yChannelSelector="G"/></filter><filter id="rm49SmokeDistort2" x="-20%" y="-20%" width="140%" height="140%"><feTurbulence type="fractalNoise" baseFrequency="0.012 0.032" numOctaves="3" seed="47" result="noise2"/><feDisplacementMap in="SourceGraphic" in2="noise2" scale="44" xChannelSelector="R" yChannelSelector="G"/></filter>';
    document.body.appendChild(svg);
  }

  const title=document.querySelector('.rm17-title');
  if(title){
    const em=title.querySelector('em');
    if(em) em.setAttribute('data-neon-word',em.textContent.trim());
  }

  /* V50 smoke wisps: only create them when the page actually has the cinematic hero. */
  if(title && !document.querySelector('.rm50-smoke-extra')){
    ['s1','s2','s3'].forEach(cls=>{
      const el=document.createElement('div');
      el.className='rm50-smoke-extra '+cls;
      el.setAttribute('aria-hidden','true');
      document.body.appendChild(el);
    });
  }

  /* One pointer loop replaces V46 + V49 + V50's three overlapping loops. */
  const selector=[
    '.rm17-title','.rm17-section h2','.rm17-page-hero h1','.page-hero h1','.hero h1',
    '.menu-premium-hero h1','.location-intro h1','.location-heading h1','.club-hero h1',
    '.dj-top h1','.staff-head h1','.section h2','.menu-intro h2','.panel-head h2',
    '.featured-bar h2','.event-banner h2','.event-card h2','.story-copy h2'
  ].join(',');
  const heads=[...document.querySelectorAll(selector)];
  heads.forEach(el=>el.classList.add('rm-neon-reactive'));

  if(matchMedia('(pointer:fine)').matches && heads.length){
    let raf=0,x=innerWidth/2,y=innerHeight/2;
    const paint=()=>{
      raf=0;
      heads.forEach(el=>{
        const r=el.getBoundingClientRect();
        if(r.bottom<0||r.top>innerHeight)return;
        const dx=(x-(r.left+r.width/2))/Math.max(1,r.width);
        const dy=(y-(r.top+r.height/2))/Math.max(1,r.height);
        const dist=Math.min(1,Math.hypot(dx,dy));
        el.style.setProperty('--rm-react',((1-dist)*1.08).toFixed(3));
        el.style.setProperty('--rm-local-x',Math.max(0,Math.min(100,((x-r.left)/Math.max(1,r.width))*100)).toFixed(1)+'%');
        el.style.setProperty('--rm-local-y',Math.max(0,Math.min(100,((y-r.top)/Math.max(1,r.height))*100)).toFixed(1)+'%');
      });
    };
    addEventListener('pointermove',e=>{
      x=e.clientX;y=e.clientY;
      if(!raf)raf=requestAnimationFrame(paint);
    },{passive:true});
    addEventListener('scroll',()=>{if(!raf)raf=requestAnimationFrame(paint)},{passive:true});
    paint();
  }

  /* Persistent quality control available on every page. */
  const mount=()=>{
    if(document.getElementById('rm-quality-control'))return;
    const wrap=document.createElement('div');
    wrap.id='rm-quality-control';
    wrap.innerHTML='<button id="rm-quality-toggle" type="button" aria-expanded="false" aria-controls="rm-quality-panel">QUALITY · <b></b></button><div id="rm-quality-panel" role="menu"><strong>VISUAL QUALITY</strong><button class="rm-quality-option" data-quality="cinematic" type="button">Cinematic <i></i></button><button class="rm-quality-option" data-quality="balanced" type="button">Balanced <i></i></button><button class="rm-quality-option" data-quality="lite" type="button">Lite <i></i></button></div>';
    document.body.appendChild(wrap);
    const toggle=wrap.querySelector('#rm-quality-toggle');
    toggle.addEventListener('click',()=>{
      const open=wrap.classList.toggle('open');
      toggle.setAttribute('aria-expanded',String(open));
    });
    wrap.querySelectorAll('.rm-quality-option').forEach(btn=>{
      btn.addEventListener('click',()=>{
        apply(btn.dataset.quality);
        wrap.classList.remove('open');
        toggle.setAttribute('aria-expanded','false');
      });
    });
    document.addEventListener('pointerdown',e=>{
      if(!wrap.contains(e.target))wrap.classList.remove('open');
    },{passive:true});
    apply(initial);
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});
  else mount();
})();
