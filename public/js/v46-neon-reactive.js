(()=>{
  'use strict';
  const selectors=[
    '.rm17-title','.rm17-section h2','.rm17-page-hero h1','.page-hero h1','.hero h1',
    '.menu-premium-hero h1','.location-intro h1','.location-heading h1','.club-hero h1',
    '.dj-top h1','.staff-head h1','.section h2','.menu-intro h2','.panel-head h2',
    '.featured-bar h2','.event-banner h2','.event-card h2','.story-copy h2'
  ];
  const heads=Array.from(document.querySelectorAll(selectors.join(',')));
  heads.forEach(el=>el.classList.add('rm-neon-reactive'));
  if(!heads.length || !matchMedia('(pointer:fine)').matches) return;
  let raf=0,lastX=0,lastY=0;
  function paint(){
    raf=0;
    heads.forEach(el=>{
      const r=el.getBoundingClientRect();
      if(r.bottom<0||r.top>innerHeight) return;
      const x=Math.max(0,Math.min(100,((lastX-r.left)/Math.max(1,r.width))*100));
      const y=Math.max(0,Math.min(100,((lastY-r.top)/Math.max(1,r.height))*100));
      el.style.setProperty('--rm-local-x',x.toFixed(1)+'%');
      el.style.setProperty('--rm-local-y',y.toFixed(1)+'%');
      const dx=(lastX-(r.left+r.width/2))/Math.max(1,r.width);
      const dy=(lastY-(r.top+r.height/2))/Math.max(1,r.height);
      const dist=Math.min(1,Math.sqrt(dx*dx+dy*dy));
      el.style.setProperty('--rm-react',String((1-dist).toFixed(3)));
    });
  }
  document.addEventListener('pointermove',e=>{
    lastX=e.clientX;lastY=e.clientY;
    if(!raf) raf=requestAnimationFrame(paint);
  },{passive:true});
  window.addEventListener('scroll',()=>{if(!raf) raf=requestAnimationFrame(paint)},{passive:true});
  paint();
})();
