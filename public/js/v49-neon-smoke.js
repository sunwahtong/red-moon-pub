(()=>{
  'use strict';
  // Bespoke reactive headline light: the outline catches the cursor without becoming a floodlight.
  const selectors=[
    '.rm17-title','.rm17-section h2','.rm17-page-hero h1','.page-hero h1','.hero h1',
    '.menu-premium-hero h1','.location-intro h1','.location-heading h1','.club-hero h1',
    '.dj-top h1','.staff-head h1','.section h2','.menu-intro h2','.panel-head h2',
    '.featured-bar h2','.event-banner h2','.event-card h2','.story-copy h2'
  ];
  const heads=Array.from(document.querySelectorAll(selectors.join(',')));
  heads.forEach(el=>el.classList.add('rm49-reactive'));

  // SVG turbulence gives the smoke a less geometric, more fluid edge.
  if(!document.getElementById('rm49SmokeSvg')){
    const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
    svg.id='rm49SmokeSvg';
    svg.setAttribute('aria-hidden','true');
    svg.style.cssText='position:absolute;width:0;height:0;pointer-events:none;overflow:hidden';
    svg.innerHTML=`<filter id="rm49SmokeDistort" x="-20%" y="-20%" width="140%" height="140%"><feTurbulence type="fractalNoise" baseFrequency="0.008 0.025" numOctaves="3" seed="21" result="noise"/><feDisplacementMap in="SourceGraphic" in2="noise" scale="32" xChannelSelector="R" yChannelSelector="G"/></filter><filter id="rm49SmokeDistort2" x="-20%" y="-20%" width="140%" height="140%"><feTurbulence type="fractalNoise" baseFrequency="0.012 0.032" numOctaves="3" seed="47" result="noise2"/><feDisplacementMap in="SourceGraphic" in2="noise2" scale="44" xChannelSelector="R" yChannelSelector="G"/></filter>`;
    document.body.appendChild(svg);
  }

  if(!heads.length || !matchMedia('(pointer:fine)').matches) return;
  let raf=0,lastX=innerWidth/2,lastY=innerHeight/2;
  const paint=()=>{
    raf=0;
    heads.forEach(el=>{
      const r=el.getBoundingClientRect();
      if(r.bottom<0||r.top>innerHeight)return;
      const dx=(lastX-(r.left+r.width/2))/Math.max(1,r.width);
      const dy=(lastY-(r.top+r.height/2))/Math.max(1,r.height);
      const dist=Math.min(1,Math.sqrt(dx*dx+dy*dy));
      el.style.setProperty('--rm-react',((1-dist)*1.15).toFixed(3));
      el.style.setProperty('--rm-local-x',Math.max(0,Math.min(100,((lastX-r.left)/Math.max(1,r.width))*100)).toFixed(1)+'%');
      el.style.setProperty('--rm-local-y',Math.max(0,Math.min(100,((lastY-r.top)/Math.max(1,r.height))*100)).toFixed(1)+'%');
    });
  };
  document.addEventListener('pointermove',e=>{lastX=e.clientX;lastY=e.clientY;if(!raf)raf=requestAnimationFrame(paint)},{passive:true});
  window.addEventListener('scroll',()=>{if(!raf)raf=requestAnimationFrame(paint)},{passive:true});
  paint();
})();
