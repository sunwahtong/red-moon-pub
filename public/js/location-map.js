(() => {
  const boot = () => {
    const viewport = document.querySelector('[data-map-viewport]');
    const stage = viewport?.querySelector('[data-map-stage]');
    const surface = viewport?.querySelector('[data-map-surface]');
    const marker = viewport?.querySelector('[data-map-marker]');
    const slider = document.querySelector('[data-map-zoom-slider]');
    const value = document.querySelector('[data-map-zoom-value]');
    if (!viewport || !stage || !surface || !marker) return;

    // The map is a single, opaque surface. No tile seams, no transparent checkerboard.
    const MAP_W = 2174;
    const MAP_H = 2909;
    const MARKER_X = 0.6182;
    const MARKER_Y = 0.7208;
    const MIN_ZOOM = 1;
    const MAX_ZOOM = 5;

    stage.style.width = `${MAP_W}px`;
    stage.style.height = `${MAP_H}px`;
    surface.style.width = `${MAP_W}px`;
    surface.style.height = `${MAP_H}px`;

    let fit = 1;
    let zoom = 1;
    let x = 0, y = 0;
    let dragging = false, pointerId = null;
    let sx=0, sy=0, ox=0, oy=0;
    let lastX=0,lastY=0,lastT=0,vx=0,vy=0,raf=0;
    const touches = new Map();
    let pinchStartDistance=0, pinchStartZoom=1, pinchCenter=null;

    const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
    const rect=()=>viewport.getBoundingClientRect();
    const scale=()=>fit*zoom;

    function calcFit(){
      const r=rect();
      // Leave a small breathing margin so the whole island is visible on load.
      fit=Math.min((r.width-56)/MAP_W,(r.height-40)/MAP_H);
      fit=clamp(fit,0.12,0.75);
    }

    function clampPan(){
      const r=rect(), s=scale();
      const w=MAP_W*s, h=MAP_H*s;
      const maxX=Math.max(0,(w-r.width)/2);
      const maxY=Math.max(0,(h-r.height)/2);
      // At minimum zoom the map is centered; at higher zoom the edges can reach the viewport edges.
      x=clamp(x,-maxX,maxX);
      y=clamp(y,-maxY,maxY);
    }

    function render(){
      clampPan();
      stage.style.transform=`translate3d(calc(-50% + ${x}px), calc(-50% + ${y}px), 0) scale(${scale()})`;
      marker.style.left=`${MAP_W*MARKER_X}px`;
      marker.style.top=`${MAP_H*MARKER_Y}px`;
      const pct=Math.round(zoom*100);
      if(value) value.textContent=`${pct}%`;
      if(slider) slider.value=String(pct);
    }

    function stopInertia(){cancelAnimationFrame(raf);vx=vy=0;}
    function inertia(){
      vx*=0.90; vy*=0.90;
      if(Math.abs(vx)<0.05&&Math.abs(vy)<0.05)return;
      x+=vx; y+=vy; render(); raf=requestAnimationFrame(inertia);
    }

    function zoomAt(next,cx,cy){
      const target=clamp(next,MIN_ZOOM,MAX_ZOOM);
      const r=rect();
      const px=cx-r.left-r.width/2, py=cy-r.top-r.height/2;
      const oldS=scale(), newS=fit*target, ratio=newS/oldS;
      x=px-(px-x)*ratio;
      y=py-(py-y)*ratio;
      zoom=target; render();
    }
    function zoomCenter(delta){
      const r=rect(); zoomAt(zoom+delta,r.left+r.width/2,r.top+r.height/2);
    }
    function reset(){
      stopInertia(); calcFit(); zoom=1; x=0; y=0; render();
    }
    const pt=e=>({x:e.clientX,y:e.clientY});
    const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);

    viewport.addEventListener('wheel',e=>{
      e.preventDefault(); stopInertia();
      zoomAt(zoom*Math.exp(-e.deltaY*0.0017),e.clientX,e.clientY);
    },{passive:false});

    viewport.addEventListener('dblclick',e=>{
      if(e.target.closest('button,input'))return;
      zoomAt(zoom*1.55,e.clientX,e.clientY);
    });

    viewport.addEventListener('pointerdown',e=>{
      if(e.target.closest('button,input'))return;
      stopInertia(); touches.set(e.pointerId,pt(e));
      try{viewport.setPointerCapture(e.pointerId)}catch{}
      if(touches.size===2){
        const a=[...touches.values()];
        pinchStartDistance=Math.max(1,dist(a[0],a[1]));
        pinchStartZoom=zoom;
        pinchCenter={x:(a[0].x+a[1].x)/2,y:(a[0].y+a[1].y)/2};
        dragging=false; viewport.classList.remove('is-dragging'); return;
      }
      dragging=true; pointerId=e.pointerId; sx=e.clientX; sy=e.clientY; ox=x; oy=y;
      lastX=sx;lastY=sy;lastT=performance.now();vx=vy=0;
      viewport.classList.add('is-dragging'); e.preventDefault();
    });

    viewport.addEventListener('pointermove',e=>{
      if(!touches.has(e.pointerId))return;
      touches.set(e.pointerId,pt(e));
      if(touches.size>=2){
        const a=[...touches.values()], d=Math.max(1,dist(a[0],a[1]));
        const c={x:(a[0].x+a[1].x)/2,y:(a[0].y+a[1].y)/2};
        zoomAt(pinchStartZoom*(d/pinchStartDistance),pinchCenter?.x??c.x,pinchCenter?.y??c.y);
        e.preventDefault(); return;
      }
      if(!dragging||e.pointerId!==pointerId)return;
      x=ox+e.clientX-sx; y=oy+e.clientY-sy;
      const now=performance.now(),dt=Math.max(8,now-lastT);
      vx=(e.clientX-lastX)/dt*16; vy=(e.clientY-lastY)/dt*16;
      lastX=e.clientX;lastY=e.clientY;lastT=now;
      render(); e.preventDefault();
    });

    function end(e){
      touches.delete(e.pointerId);
      try{viewport.releasePointerCapture(e.pointerId)}catch{}
      if(touches.size===0){
        if(dragging&&(Math.abs(vx)>0.6||Math.abs(vy)>0.6))raf=requestAnimationFrame(inertia);
        dragging=false;pointerId=null;pinchStartDistance=0;pinchCenter=null;viewport.classList.remove('is-dragging');
      }
    }
    viewport.addEventListener('pointerup',end);
    viewport.addEventListener('pointercancel',end);

    viewport.addEventListener('keydown',e=>{
      const r=rect(),step=Math.max(30,Math.min(r.width,r.height)*0.08);
      if(e.key==='ArrowLeft'){x+=step;render();e.preventDefault()}
      else if(e.key==='ArrowRight'){x-=step;render();e.preventDefault()}
      else if(e.key==='ArrowUp'){y+=step;render();e.preventDefault()}
      else if(e.key==='ArrowDown'){y-=step;render();e.preventDefault()}
      else if(e.key==='+'||e.key==='='){zoomCenter(.25);e.preventDefault()}
      else if(e.key==='-'){zoomCenter(-.25);e.preventDefault()}
      else if(e.key==='0'){reset();e.preventDefault()}
    });

    document.querySelectorAll('[data-map-zoom-in]').forEach(b=>b.addEventListener('click',()=>zoomCenter(.25)));
    document.querySelectorAll('[data-map-zoom-out]').forEach(b=>b.addEventListener('click',()=>zoomCenter(-.25)));
    document.querySelectorAll('[data-map-reset]').forEach(b=>b.addEventListener('click',reset));
    slider?.addEventListener('input',()=>{
      const r=rect(); zoomAt(Number(slider.value)/100,r.left+r.width/2,r.top+r.height/2);
    });

    window.addEventListener('resize',()=>{
      const oldFit=fit; calcFit();
      const ratio=oldFit?fit/oldFit:1; x*=ratio; y*=ratio; render();
    });

    calcFit(); reset();
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true}); else boot();
})();
