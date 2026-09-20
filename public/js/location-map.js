(() => {
  const boot = () => {
    const viewport = document.querySelector('[data-map-viewport]');
    const stage = document.querySelector('[data-map-stage]');
    const image = document.querySelector('[data-map-image]');
    if (!viewport || !stage || !image) return;

    const slider = document.querySelector('[data-map-zoom-slider]');
    const zoomValue = document.querySelector('[data-map-zoom-value]');
    const search = document.querySelector('[data-map-search]');
    const sidebar = document.querySelector('[data-map-sidebar]');
    const sidebarToggle = document.querySelector('[data-map-sidebar-toggle]');
    const fullscreen = document.querySelector('[data-map-fullscreen]');
    const locate = document.querySelector('[data-map-locate]');
    const marker = document.querySelector('[data-map-marker]');
    const markerCard = document.querySelector('[data-map-marker-card]');
    const result = document.querySelector('[data-map-result]');

    const MAP_SRC = 'assets/gtav-map-hires.png';
    const MIN = 0;
    const MAX = 4;
    const STEP = 0.5;
    const MARKER_X = 0.59;
    const MARKER_Y = 0.73;
    let mapW = 5880, mapH = 6016;
    let fitScale = 0.1, zoom = 0, panX = 0, panY = 0;
    let dragging = false, activePointer = null;
    let startX = 0, startY = 0, startPanX = 0, startPanY = 0;
    let pinchDistance = 0, pinchZoom = 0, pinchCenter = null;
    const pointers = new Map();

    // Keep the source image in the DOM as a reliable preload, but render the map
    // as a CSS background on the stage. This avoids the percentage-sized image
    // sizing conflicts from the previous versions of the page.
    image.src = MAP_SRC;
    image.draggable = false;
    image.style.position = 'absolute';
    image.style.width = '1px';
    image.style.height = '1px';
    image.style.opacity = '0';
    image.style.pointerEvents = 'none';
    image.setAttribute('aria-hidden', 'true');

    stage.classList.add('v64-map-stage');
    stage.innerHTML = '';
    stage.appendChild(image);
    stage.style.width = `${mapW}px`;
    stage.style.height = `${mapH}px`;
    stage.style.backgroundImage = `url("${MAP_SRC}")`;
    stage.style.backgroundRepeat = 'no-repeat';
    stage.style.backgroundPosition = 'center center';
    stage.style.backgroundSize = '100% 100%';
    stage.style.backgroundColor = '#111';

    const layer = document.createElement('div');
    layer.className = 'v64-marker-layer';
    layer.style.width = `${mapW}px`;
    layer.style.height = `${mapH}px`;
    stage.appendChild(layer);
    if (marker) {
      marker.style.left = `${MARKER_X * 100}%`;
      marker.style.top = `${MARKER_Y * 100}%`;
      layer.appendChild(marker);
    }

    const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
    const rect = () => viewport.getBoundingClientRect();
    const scale = () => fitScale * Math.pow(2, zoom);
    const local = (x, y) => { const r = rect(); return {x:x-r.left-r.width/2,y:y-r.top-r.height/2}; };

    function clampPan(){
      const r = rect(), s = scale(), w = mapW*s, h = mapH*s;
      const mx = Math.max(0,(w-r.width)/2), my = Math.max(0,(h-r.height)/2);
      panX = clamp(panX,-mx,mx); panY = clamp(panY,-my,my);
    }
    function ui(){
      const percent = Math.round(Math.pow(2,zoom)*100);
      if(zoomValue) zoomValue.textContent = `${percent}%`;
      if(slider) slider.value = String(Math.round(zoom*100));
    }
    function render(){
      clampPan();
      const s=scale();
      stage.style.transform=`translate3d(calc(-50% + ${panX}px),calc(-50% + ${panY}px),0) scale(${s})`;
      ui();
    }
    function fit(){
      const r=rect();
      fitScale=Math.min((r.width-12)/mapW,(r.height-12)/mapH);
      if(!Number.isFinite(fitScale)||fitScale<=0) fitScale=.1;
    }
    function reset(){ zoom=0; panX=0; panY=0; render(); markerCard?.classList.remove('is-open'); }
    function zoomAt(next,x,y){
      const target=clamp(next,MIN,MAX);
      if(Math.abs(target-zoom)<.0001){render();return;}
      const old=scale(), neu=fitScale*Math.pow(2,target), p=local(x,y), ratio=neu/old;
      panX=p.x-(p.x-panX)*ratio;
      panY=p.y-(p.y-panY)*ratio;
      zoom=target; render();
    }
    function zoomCenter(delta){ const r=rect(); zoomAt(zoom+delta,r.left+r.width/2,r.top+r.height/2); }
    function focusMarker(){
      const r=rect();
      zoomAt(Math.max(1.15,zoom),r.left+r.width/2,r.top+r.height/2);
      const s=scale();
      panX=(.5-MARKER_X)*mapW*s;
      panY=(.5-MARKER_Y)*mapH*s;
      render();
      markerCard?.classList.add('is-open');
    }

    const point=e=>({x:e.clientX,y:e.clientY});
    const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
    function down(e){
      if(e.target.closest('button,input,.v64-sidebar')) return;
      pointers.set(e.pointerId,point(e));
      try{viewport.setPointerCapture(e.pointerId)}catch{}
      if(pointers.size===2){
        const [a,b]=[...pointers.values()];
        pinchDistance=dist(a,b); pinchZoom=zoom; pinchCenter={x:(a.x+b.x)/2,y:(a.y+b.y)/2};
        dragging=false; e.preventDefault(); return;
      }
      dragging=true; activePointer=e.pointerId; startX=e.clientX; startY=e.clientY; startPanX=panX; startPanY=panY;
      viewport.classList.add('is-dragging'); e.preventDefault();
    }
    function move(e){
      if(!pointers.has(e.pointerId)) return;
      pointers.set(e.pointerId,point(e));
      if(pointers.size>=2 && pinchCenter){
        const [a,b]=[...pointers.values()]; const d=dist(a,b);
        if(pinchDistance>0) zoomAt(pinchZoom+Math.log2(Math.max(.1,d/pinchDistance)),pinchCenter.x,pinchCenter.y);
        e.preventDefault(); return;
      }
      if(!dragging||e.pointerId!==activePointer)return;
      panX=startPanX+e.clientX-startX; panY=startPanY+e.clientY-startY; render(); e.preventDefault();
    }
    function up(e){
      pointers.delete(e.pointerId); try{viewport.releasePointerCapture(e.pointerId)}catch{}
      if(!pointers.size){dragging=false;activePointer=null;pinchDistance=0;pinchCenter=null;viewport.classList.remove('is-dragging');}
      else if(pointers.size===1){const [id,p]=[...pointers.entries()][0];activePointer=id;dragging=true;startX=p.x;startY=p.y;startPanX=panX;startPanY=panY;}
    }

    viewport.addEventListener('pointerdown',down,{passive:false});
    viewport.addEventListener('pointermove',move,{passive:false});
    viewport.addEventListener('pointerup',up); viewport.addEventListener('pointercancel',up);
    viewport.addEventListener('contextmenu',e=>e.preventDefault());
    viewport.addEventListener('wheel',e=>{e.preventDefault();zoomAt(zoom-(e.deltaY*.0028),e.clientX,e.clientY)},{passive:false});
    viewport.addEventListener('dblclick',e=>{if(!e.target.closest('button,input,.v64-sidebar'))zoomAt(zoom+.75,e.clientX,e.clientY)});

    document.querySelectorAll('[data-map-zoom-in]').forEach(b=>b.addEventListener('click',()=>zoomCenter(STEP)));
    document.querySelectorAll('[data-map-zoom-out]').forEach(b=>b.addEventListener('click',()=>zoomCenter(-STEP)));
    document.querySelectorAll('[data-map-reset]').forEach(b=>b.addEventListener('click',reset));
    if(slider){slider.min='0';slider.max=String(MAX*100);slider.step='1';slider.addEventListener('input',()=>{const r=rect();zoomAt(Number(slider.value)/100,r.left+r.width/2,r.top+r.height/2)})}
    locate?.addEventListener('click',focusMarker);
    marker?.addEventListener('click',e=>{e.stopPropagation();focusMarker()});
    fullscreen?.addEventListener('click',async()=>{
      const shell=document.querySelector('.v64-map-shell');
      try{ if(!document.fullscreenElement) await shell.requestFullscreen(); else await document.exitFullscreen(); }catch{}
    });
    sidebarToggle?.addEventListener('click',()=>sidebar?.classList.toggle('is-open'));

    const categories=[...document.querySelectorAll('[data-map-category]')];
    categories.forEach(cat=>cat.addEventListener('click',()=>{
      categories.forEach(x=>x.classList.remove('is-active')); cat.classList.add('is-active');
      const q=String(cat.dataset.mapCategory||'');
      if(result) result.textContent=q==='all'?'Összes helyszín':'1 helyszín';
    }));
    search?.addEventListener('input',()=>{
      const q=search.value.trim().toLowerCase();
      const hit=!q||'red moon pub'.includes(q)||'red moon'.includes(q)||'pub'.includes(q);
      if(marker) marker.style.display=hit?'flex':'none';
      if(result) result.textContent=hit?(q?'1 találat':'Összes helyszín'):'Nincs találat';
    });

    window.addEventListener('keydown',e=>{
      if(e.target.matches('input,textarea,select')) return;
      if(e.key==='+'||e.key==='='){e.preventDefault();zoomCenter(STEP)}
      else if(e.key==='-'){e.preventDefault();zoomCenter(-STEP)}
      else if(e.key==='0'){e.preventDefault();reset()}
      else if(e.key==='ArrowLeft'){e.preventDefault();panX+=70;render()}
      else if(e.key==='ArrowRight'){e.preventDefault();panX-=70;render()}
      else if(e.key==='ArrowUp'){e.preventDefault();panY+=70;render()}
      else if(e.key==='ArrowDown'){e.preventDefault();panY-=70;render()}
    });

    const init=()=>{
      // Use the actual source dimensions when available. The CSS background
      // itself does not depend on the image element's layout size.
      mapW=image.naturalWidth||5880;
      mapH=image.naturalHeight||6016;
      stage.style.width=`${mapW}px`;
      stage.style.height=`${mapH}px`;
      layer.style.width=`${mapW}px`;
      layer.style.height=`${mapH}px`;
      stage.style.backgroundSize='100% 100%';
      fit();
      reset();
      viewport.classList.remove('map-load-error');
    };
    image.addEventListener('load',init,{once:true});
    image.addEventListener('error',()=>viewport.classList.add('map-load-error'),{once:true});
    if(image.complete&&image.naturalWidth)init();
    window.addEventListener('resize',()=>{fit();render()});
    viewport.tabIndex=0;
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
