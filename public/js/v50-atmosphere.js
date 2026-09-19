(()=>{
  'use strict';
  const title=document.querySelector('.rm17-title');
  if(title){
    const em=title.querySelector('em');
    if(em) em.setAttribute('data-neon-word',em.textContent.trim());
  }

  // Add three independent wisps so the smoke has depth and irregular motion.
  const addWisp=(cls)=>{
    const el=document.createElement('div');
    el.className='rm50-smoke-extra '+cls;
    el.setAttribute('aria-hidden','true');
    document.body.appendChild(el);
  };
  if(!document.querySelector('.rm50-smoke-extra')){
    addWisp('s1'); addWisp('s2'); addWisp('s3');
  }

  // Keep the hero title subtly reactive to cursor position without making it flash.
  const heads=[...document.querySelectorAll('.rm17-title,.rm17-section h2,.rm17-page-hero h1,.page-hero h1,.hero h1,.menu-premium-hero h1,.location-intro h1,.location-heading h1,.club-hero h1,.dj-top h1,.staff-head h1,.section h2,.menu-intro h2,.panel-head h2,.featured-bar h2,.event-banner h2,.event-card h2,.story-copy h2')];
  heads.forEach(h=>h.classList.add('rm-neon-reactive'));
  if(!matchMedia('(pointer:fine)').matches) return;
  let raf=0,x=innerWidth/2,y=innerHeight/2;
  const paint=()=>{
    raf=0;
    heads.forEach(el=>{
      const r=el.getBoundingClientRect();
      if(r.bottom<0||r.top>innerHeight)return;
      const dx=(x-(r.left+r.width/2))/Math.max(1,r.width);
      const dy=(y-(r.top+r.height/2))/Math.max(1,r.height);
      const dist=Math.min(1,Math.hypot(dx,dy));
      el.style.setProperty('--rm-react',((1-dist)*.92).toFixed(3));
    });
  };
  addEventListener('pointermove',e=>{x=e.clientX;y=e.clientY;if(!raf)raf=requestAnimationFrame(paint)},{passive:true});
  addEventListener('scroll',()=>{if(!raf)raf=requestAnimationFrame(paint)},{passive:true});
  paint();
})();
