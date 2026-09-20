(() => {
  const boot = () => {
    const viewport = document.querySelector('[data-map-viewport]');
    const stage = viewport?.querySelector('[data-map-stage]');
    const marker = viewport?.querySelector('[data-map-marker]');
    const slider = document.querySelector('[data-map-zoom-slider]');
    const value = document.querySelector('[data-map-zoom-value]');
    const image = viewport?.querySelector('[data-map-image]');
    if (!viewport || !stage || !marker || !image) return;

    const MAP_W = 2940;
    const MAP_H = 3008;
    const MARKER_X = 0.59;
    const MARKER_Y = 0.73;
    const MIN_ZOOM = 0.75;
    const MAX_ZOOM = 4;

    stage.style.width = MAP_W + 'px';
    stage.style.height = MAP_H + 'px';
    image.src = 'assets/gtav-map-highres.png';
    image.draggable = false;

    let fitScale = 1;
    let zoom = 1;
    let panX = 0;
    let panY = 0;
    let dragging = false;
    let activePointer = null;
    let startX = 0, startY = 0, startPanX = 0, startPanY = 0;
    let velocityX = 0, velocityY = 0, lastT = 0, lastX = 0, lastY = 0;
    let inertiaFrame = 0;
    const pointers = new Map();
    let pinchDistance = 0;
    let pinchZoom = 1;
    let pinchCenter = null;

    const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
    const rect = () => viewport.getBoundingClientRect();
    const scale = () => fitScale * zoom;

    function calculateFit() {
      const r = rect();
      const availableW = Math.max(260, r.width - 120);
      const availableH = Math.max(300, r.height - 50);
      fitScale = Math.min(availableW / MAP_W, availableH / MAP_H);
      if (!Number.isFinite(fitScale) || fitScale <= 0) fitScale = 0.22;
    }

    function clampPan() {
      const r = rect();
      const s = scale();
      const mapW = MAP_W * s;
      const mapH = MAP_H * s;
      // At fit the whole map stays visible. After zooming, allow the user
      // to pan only until the map edge reaches the viewport edge.
      const maxX = Math.max(0, (mapW - r.width) / 2);
      const maxY = Math.max(0, (mapH - r.height) / 2);
      const allowance = Math.min(80, Math.max(24, Math.min(r.width, r.height) * 0.08));
      panX = clamp(panX, -maxX - allowance, maxX + allowance);
      panY = clamp(panY, -maxY - allowance, maxY + allowance);
      if (zoom <= 1.001) { panX *= 0.92; panY *= 0.92; }
    }

    function syncUI() {
      const pct = Math.round(zoom * 100);
      if (value) value.textContent = pct + '%';
      if (slider) slider.value = String(Math.round(pct));
    }

    function render() {
      clampPan();
      stage.style.transform = `translate3d(calc(-50% + ${panX}px), calc(-50% + ${panY}px), 0) scale(${scale()})`;
      marker.style.left = (MAP_W * MARKER_X) + 'px';
      marker.style.top = (MAP_H * MARKER_Y) + 'px';
      syncUI();
    }

    function stopInertia() {
      cancelAnimationFrame(inertiaFrame);
      velocityX = velocityY = 0;
    }

    function inertia() {
      velocityX *= 0.91;
      velocityY *= 0.91;
      if (Math.abs(velocityX) < 0.08 && Math.abs(velocityY) < 0.08) return;
      panX += velocityX;
      panY += velocityY;
      render();
      inertiaFrame = requestAnimationFrame(inertia);
    }

    function zoomAt(next, clientX, clientY) {
      const target = clamp(next, MIN_ZOOM, MAX_ZOOM);
      const r = rect();
      const lx = clientX - r.left - r.width / 2;
      const ly = clientY - r.top - r.height / 2;
      const oldScale = scale();
      const newScale = fitScale * target;
      const ratio = newScale / oldScale;
      panX = lx - (lx - panX) * ratio;
      panY = ly - (ly - panY) * ratio;
      zoom = target;
      render();
    }

    function zoomCenter(delta) {
      const r = rect();
      zoomAt(zoom + delta, r.left + r.width / 2, r.top + r.height / 2);
    }

    function reset() {
      stopInertia();
      zoom = 1;
      panX = 0;
      panY = 0;
      calculateFit();
      render();
    }

    function point(e) { return { x: e.clientX, y: e.clientY }; }
    function distance(a,b) { return Math.hypot(a.x-b.x,a.y-b.y); }

    viewport.addEventListener('wheel', e => {
      e.preventDefault();
      stopInertia();
      const factor = Math.exp(-e.deltaY * 0.0016);
      zoomAt(zoom * factor, e.clientX, e.clientY);
    }, { passive:false });

    viewport.addEventListener('dblclick', e => {
      if (e.target.closest('button,input')) return;
      e.preventDefault();
      zoomAt(Math.min(MAX_ZOOM, zoom * 1.55), e.clientX, e.clientY);
    });

    viewport.addEventListener('pointerdown', e => {
      if (e.target.closest('button,input')) return;
      stopInertia();
      pointers.set(e.pointerId, point(e));
      try { viewport.setPointerCapture(e.pointerId); } catch (_) {}
      if (pointers.size === 2) {
        const pts = [...pointers.values()];
        pinchDistance = Math.max(1, distance(pts[0],pts[1]));
        pinchZoom = zoom;
        pinchCenter = { x:(pts[0].x+pts[1].x)/2, y:(pts[0].y+pts[1].y)/2 };
        dragging = false;
        viewport.classList.remove('is-dragging');
        return;
      }
      dragging = true;
      activePointer = e.pointerId;
      startX=e.clientX; startY=e.clientY;
      startPanX=panX; startPanY=panY;
      lastX=e.clientX; lastY=e.clientY; lastT=performance.now();
      velocityX=velocityY=0;
      viewport.classList.add('is-dragging');
      e.preventDefault();
    });

    viewport.addEventListener('pointermove', e => {
      if (!pointers.has(e.pointerId)) return;
      pointers.set(e.pointerId, point(e));
      if (pointers.size >= 2) {
        const pts=[...pointers.values()];
        const d=Math.max(1,distance(pts[0],pts[1]));
        const center={x:(pts[0].x+pts[1].x)/2,y:(pts[0].y+pts[1].y)/2};
        const c=pinchCenter || center;
        zoomAt(pinchZoom * (d/pinchDistance), c.x, c.y);
        e.preventDefault();
        return;
      }
      if (!dragging || e.pointerId !== activePointer) return;
      panX=startPanX + e.clientX-startX;
      panY=startPanY + e.clientY-startY;
      const now=performance.now(), dt=Math.max(8,now-lastT);
      velocityX=(e.clientX-lastX)/dt*16;
      velocityY=(e.clientY-lastY)/dt*16;
      lastX=e.clientX; lastY=e.clientY; lastT=now;
      render();
      e.preventDefault();
    });

    function pointerEnd(e) {
      pointers.delete(e.pointerId);
      try { viewport.releasePointerCapture(e.pointerId); } catch (_) {}
      if (pointers.size===0) {
        if (dragging && (Math.abs(velocityX)>0.6 || Math.abs(velocityY)>0.6)) inertiaFrame=requestAnimationFrame(inertia);
        dragging=false; activePointer=null; pinchDistance=0; pinchCenter=null;
        viewport.classList.remove('is-dragging');
      }
    }
    viewport.addEventListener('pointerup',pointerEnd);
    viewport.addEventListener('pointercancel',pointerEnd);

    viewport.addEventListener('keydown', e => {
      const r=rect();
      const step=Math.max(35,Math.min(r.width,r.height)*0.08);
      if (e.key==='ArrowLeft'){panX+=step;render();e.preventDefault()}
      if (e.key==='ArrowRight'){panX-=step;render();e.preventDefault()}
      if (e.key==='ArrowUp'){panY+=step;render();e.preventDefault()}
      if (e.key==='ArrowDown'){panY-=step;render();e.preventDefault()}
      if (e.key==='+' || e.key==='='){zoomCenter(0.25);e.preventDefault()}
      if (e.key==='-'){zoomCenter(-0.25);e.preventDefault()}
      if (e.key==='0'){reset();e.preventDefault()}
    });

    document.querySelectorAll('[data-map-zoom-in]').forEach(btn => btn.addEventListener('click',()=>zoomCenter(0.25)));
    document.querySelectorAll('[data-map-zoom-out]').forEach(btn => btn.addEventListener('click',()=>zoomCenter(-0.25)));
    document.querySelectorAll('[data-map-reset]').forEach(btn => btn.addEventListener('click',reset));
    slider?.addEventListener('input',()=>{
      const r=rect();
      const pct=Number(slider.value);
      zoomAt(pct/100,r.left+r.width/2,r.top+r.height/2);
    });

    window.addEventListener('resize',()=>{
      const oldFit=fitScale;
      calculateFit();
      if (oldFit>0) {
        const ratio=fitScale/oldFit;
        panX*=ratio; panY*=ratio;
      }
      render();
    });

    viewport.tabIndex=0;
    calculateFit();
    render();
  };
  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();
