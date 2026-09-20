(() => {
  const boot = () => {
    const viewport = document.querySelector('[data-map-viewport]');
    if (!viewport) return;

    const stage = viewport.querySelector('[data-map-stage]');
    const oldImage = viewport.querySelector('[data-map-image]');
    const marker = viewport.querySelector('[data-map-marker]');
    const slider = document.querySelector('[data-map-zoom-slider]');
    const value = document.querySelector('[data-map-zoom-value]');
    if (!stage) return;

    // Tile source generated from the supplied GTA V base map.
    // Native map: 735 × 752 px, tiled into 256 px PNGs, zoom levels 0–3.
    const MAP_W = 735;
    const MAP_H = 752;
    const TILE = 256;
    const MIN_ZOOM = 0;
    const MAX_ZOOM = 3;
    const TILE_ROOT = 'assets/maptiles/';
    const MARKER_X = 0.59;
    const MARKER_Y = 0.73;

    if (oldImage) oldImage.remove();

    stage.innerHTML = '';
    stage.style.width = `${MAP_W}px`;
    stage.style.height = `${MAP_H}px`;

    const tileLayer = document.createElement('div');
    tileLayer.className = 'map-tile-layer';
    const markerLayer = document.createElement('div');
    markerLayer.className = 'map-marker-layer';
    stage.append(tileLayer, markerLayer);
    if (marker) markerLayer.appendChild(marker);

    let baseScale = 1;
    let zoom = 0;
    let panX = 0;
    let panY = 0;
    let tileZoom = -1;
    let dragging = false;
    let activePointer = null;
    let startX = 0, startY = 0, startPanX = 0, startPanY = 0;
    let velocityX = 0, velocityY = 0;
    let lastMoveTime = 0, lastMoveX = 0, lastMoveY = 0;
    let inertiaFrame = 0;
    let pinchStartDistance = 0;
    let pinchStartZoom = 0;
    let pinchCenter = null;
    const pointers = new Map();

    const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

    function viewportRect() { return viewport.getBoundingClientRect(); }

    function selectedTileZoom(z = zoom) {
      return clamp(Math.round(z), 0, MAX_ZOOM);
    }

    function nativeLayerSize(z) {
      return { w: MAP_W * (2 ** z), h: MAP_H * (2 ** z) };
    }

    function currentScale() {
      return baseScale * (2 ** zoom);
    }

    function stageScreenSize() {
      return { w: MAP_W * currentScale(), h: MAP_H * currentScale() };
    }

    function clampPan() {
      const r = viewportRect();
      const s = stageScreenSize();
      // Keep the map inside the viewport when it is larger, but allow a small
      // amount of movement when it is smaller (Google Maps-like feel).
      const margin = 28;
      const maxX = Math.max(margin, (s.w - r.width) / 2 + margin);
      const maxY = Math.max(margin, (s.h - r.height) / 2 + margin);
      panX = clamp(panX, -maxX, maxX);
      panY = clamp(panY, -maxY, maxY);
    }

    function syncUI() {
      const pct = Math.round((2 ** zoom) * 100);
      if (value) value.textContent = `${pct}%`;
      if (slider) slider.value = String(Math.round(zoom * 100));
    }

    function render() {
      clampPan();
      const tz = tileZoom < 0 ? selectedTileZoom() : tileZoom;
      const scale = currentScale() / (2 ** tz);
      stage.style.transform = `translate3d(calc(-50% + ${panX}px), calc(-50% + ${panY}px), 0)`;
      tileLayer.style.transform = `scale(${scale})`;
      tileLayer.style.width = `${MAP_W * (2 ** tz)}px`;
      tileLayer.style.height = `${MAP_H * (2 ** tz)}px`;
      markerLayer.style.transform = `scale(${scale})`;
      markerLayer.style.width = `${MAP_W * (2 ** tz)}px`;
      markerLayer.style.height = `${MAP_H * (2 ** tz)}px`;
      if (marker) {
        marker.style.left = `${MAP_W * MARKER_X * (2 ** tz)}px`;
        marker.style.top = `${MAP_H * MARKER_Y * (2 ** tz)}px`;
      }
      syncUI();
    }

    function loadTiles(z) {
      if (z === tileZoom) return;
      tileZoom = z;
      tileLayer.innerHTML = '';
      const size = nativeLayerSize(z);
      tileLayer.style.width = `${size.w}px`;
      tileLayer.style.height = `${size.h}px`;
      const cols = Math.ceil(size.w / TILE);
      const rows = Math.ceil(size.h / TILE);
      const frag = document.createDocumentFragment();
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const img = document.createElement('img');
          img.className = 'map-tile';
          img.alt = '';
          img.draggable = false;
          img.src = `${TILE_ROOT}${z}/${x}_${y}.png`;
          img.style.left = `${x * TILE}px`;
          img.style.top = `${y * TILE}px`;
          frag.appendChild(img);
        }
      }
      tileLayer.appendChild(frag);
      render();
    }

    function fitBaseScale() {
      const r = viewportRect();
      baseScale = Math.min((r.width - 12) / MAP_W, (r.height - 12) / MAP_H);
      if (!Number.isFinite(baseScale) || baseScale <= 0) baseScale = 1;
    }

    function reset() {
      cancelAnimationFrame(inertiaFrame);
      zoom = 0;
      panX = 0;
      panY = 0;
      loadTiles(0);
      render();
    }

    function zoomAt(nextZoom, clientX, clientY) {
      const target = clamp(nextZoom, MIN_ZOOM, MAX_ZOOM);
      if (Math.abs(target - zoom) < 0.00001) return;
      const r = viewportRect();
      const localX = clientX - r.left - r.width / 2;
      const localY = clientY - r.top - r.height / 2;
      const oldScale = currentScale();
      const newScale = baseScale * (2 ** target);
      const ratio = newScale / oldScale;
      panX = localX - (localX - panX) * ratio;
      panY = localY - (localY - panY) * ratio;
      zoom = target;
      const nextTileZoom = selectedTileZoom(target);
      if (nextTileZoom !== tileZoom) loadTiles(nextTileZoom);
      render();
    }

    function zoomCenter(delta) {
      const r = viewportRect();
      zoomAt(zoom + delta, r.left + r.width / 2, r.top + r.height / 2);
    }

    function stopInertia() {
      cancelAnimationFrame(inertiaFrame);
      velocityX = velocityY = 0;
    }

    function inertia() {
      velocityX *= 0.90;
      velocityY *= 0.90;
      if (Math.abs(velocityX) < 0.05 && Math.abs(velocityY) < 0.05) return;
      panX += velocityX;
      panY += velocityY;
      render();
      inertiaFrame = requestAnimationFrame(inertia);
    }

    function point(e) { return { x: e.clientX, y: e.clientY }; }
    function dist(a,b) { return Math.hypot(a.x-b.x, a.y-b.y); }

    function onPointerDown(e) {
      if (e.target.closest('button,input')) return;
      stopInertia();
      pointers.set(e.pointerId, point(e));
      try { viewport.setPointerCapture(e.pointerId); } catch (_) {}

      if (pointers.size === 2) {
        const pts = [...pointers.values()];
        pinchStartDistance = dist(pts[0], pts[1]);
        pinchStartZoom = zoom;
        pinchCenter = { x:(pts[0].x+pts[1].x)/2, y:(pts[0].y+pts[1].y)/2 };
        dragging = false;
        return;
      }

      dragging = true;
      activePointer = e.pointerId;
      startX = e.clientX; startY = e.clientY;
      startPanX = panX; startPanY = panY;
      lastMoveTime = performance.now();
      lastMoveX = e.clientX; lastMoveY = e.clientY;
      velocityX = velocityY = 0;
      viewport.classList.add('is-dragging');
      e.preventDefault();
    }

    function onPointerMove(e) {
      if (!pointers.has(e.pointerId)) return;
      pointers.set(e.pointerId, point(e));

      if (pointers.size >= 2) {
        const pts = [...pointers.values()];
        const d = dist(pts[0], pts[1]);
        if (!pinchStartDistance) pinchStartDistance = d;
        zoomAt(pinchStartZoom + Math.log2(Math.max(1, d / pinchStartDistance)), pinchCenter.x, pinchCenter.y);
        e.preventDefault();
        return;
      }

      if (!dragging || e.pointerId !== activePointer) return;
      panX = startPanX + e.clientX - startX;
      panY = startPanY + e.clientY - startY;
      const now = performance.now();
      const dt = Math.max(8, now - lastMoveTime);
      velocityX = (e.clientX-lastMoveX) / dt * 16;
      velocityY = (e.clientY-lastMoveY) / dt * 16;
      lastMoveTime = now; lastMoveX = e.clientX; lastMoveY = e.clientY;
      render();
      e.preventDefault();
    }

    function onPointerUp(e) {
      pointers.delete(e.pointerId);
      try { viewport.releasePointerCapture(e.pointerId); } catch (_) {}
      if (pointers.size === 0) {
        if (dragging && (Math.abs(velocityX)>0.5 || Math.abs(velocityY)>0.5)) inertiaFrame=requestAnimationFrame(inertia);
        dragging=false; activePointer=null; pinchStartDistance=0; pinchCenter=null;
        viewport.classList.remove('is-dragging');
      } else if (pointers.size === 1) {
        const [id,pt]=[...pointers.entries()][0];
        activePointer=id; dragging=true; startX=pt.x; startY=pt.y; startPanX=panX; startPanY=panY;
      }
    }

    viewport.addEventListener('wheel', e => {
      e.preventDefault();
      stopInertia();
      const next = zoom - e.deltaY * 0.0024;
      zoomAt(next, e.clientX, e.clientY);
    }, { passive:false });
    viewport.addEventListener('pointerdown', onPointerDown, {passive:false});
    viewport.addEventListener('pointermove', onPointerMove, {passive:false});
    viewport.addEventListener('pointerup', onPointerUp);
    viewport.addEventListener('pointercancel', onPointerUp);
    viewport.addEventListener('contextmenu', e => e.preventDefault());
    viewport.addEventListener('dblclick', e => {
      if (e.target.closest('button,input')) return;
      zoomAt(Math.min(MAX_ZOOM, zoom + 1), e.clientX, e.clientY);
    });

    document.querySelectorAll('[data-map-zoom-in]').forEach(btn => btn.addEventListener('click', () => zoomCenter(0.5)));
    document.querySelectorAll('[data-map-zoom-out]').forEach(btn => btn.addEventListener('click', () => zoomCenter(-0.5)));
    document.querySelectorAll('[data-map-reset]').forEach(btn => btn.addEventListener('click', reset));

    if (slider) {
      slider.min = '0'; slider.max = String(MAX_ZOOM * 100); slider.step = '1';
      slider.addEventListener('input', () => {
        const r=viewportRect();
        zoomAt(Number(slider.value)/100, r.left+r.width/2, r.top+r.height/2);
      });
    }

    window.addEventListener('keydown', e => {
      if (!viewport.matches(':hover') && document.activeElement !== viewport) return;
      if (e.key==='+' || e.key==='=') { e.preventDefault(); zoomCenter(0.5); }
      else if (e.key==='-') { e.preventDefault(); zoomCenter(-0.5); }
      else if (e.key==='0') { e.preventDefault(); reset(); }
      else if (e.key==='ArrowLeft') { e.preventDefault(); panX+=70; render(); }
      else if (e.key==='ArrowRight') { e.preventDefault(); panX-=70; render(); }
      else if (e.key==='ArrowUp') { e.preventDefault(); panY+=70; render(); }
      else if (e.key==='ArrowDown') { e.preventDefault(); panY-=70; render(); }
    });

    const initialize = () => { fitBaseScale(); reset(); };
    window.addEventListener('resize', () => { fitBaseScale(); render(); });
    initialize();
    viewport.tabIndex=0;
    viewport.setAttribute('aria-label','Interaktív GTA V térkép. Húzás, görgős zoom, dupla kattintás és mobilos pinch zoom.');
  };
  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot,{once:true}); else boot();
})();
