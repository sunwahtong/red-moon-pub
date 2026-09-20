(() => {
  const boot = () => {
    const viewport = document.querySelector('[data-map-viewport]');
    if (!viewport) return;
    const stage = viewport.querySelector('[data-map-stage]');
    const marker = viewport.querySelector('[data-map-marker]');
    const slider = document.querySelector('[data-map-zoom-slider]');
    const value = document.querySelector('[data-map-zoom-value]');
    if (!stage) return;

    const MAP_W = 5880;
    const MAP_H = 6016;
    const MAP_URL = 'assets/gtav-map-hires.webp';
    const MARKER_X = 0.59;
    const MARKER_Y = 0.73;
    const MIN_ZOOM = 0;
    const MAX_ZOOM = 3;

    stage.innerHTML = '';
    stage.style.width = `${MAP_W}px`;
    stage.style.height = `${MAP_H}px`;

    const image = document.createElement('img');
    image.className = 'map-image';
    image.src = MAP_URL;
    image.alt = 'GTA V alap térkép';
    image.draggable = false;
    stage.appendChild(image);

    const markerLayer = document.createElement('div');
    markerLayer.className = 'map-marker-layer';
    markerLayer.style.width = `${MAP_W}px`;
    markerLayer.style.height = `${MAP_H}px`;
    if (marker) {
      marker.style.left = `${MAP_W * MARKER_X}px`;
      marker.style.top = `${MAP_H * MARKER_Y}px`;
      markerLayer.appendChild(marker);
    }
    stage.appendChild(markerLayer);

    let fitScale = 1;
    let zoom = 0;
    let panX = 0;
    let panY = 0;
    let dragging = false;
    let activePointer = null;
    let startX = 0, startY = 0, startPanX = 0, startPanY = 0;
    let pinchStartDistance = 0;
    let pinchStartZoom = 0;
    let pinchCenter = null;
    const pointers = new Map();

    const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
    const rect = () => viewport.getBoundingClientRect();
    const scale = () => fitScale * Math.pow(2, zoom);

    function clampPan() {
      const r = rect();
      const s = scale();
      const w = MAP_W * s;
      const h = MAP_H * s;
      const maxX = Math.max(0, (w - r.width) / 2);
      const maxY = Math.max(0, (h - r.height) / 2);
      panX = clamp(panX, -maxX, maxX);
      panY = clamp(panY, -maxY, maxY);
    }

    function syncUI() {
      const pct = Math.round(Math.pow(2, zoom) * 100);
      if (value) value.textContent = `${pct}%`;
      if (slider) slider.value = String(Math.round(zoom * 100));
    }

    function render() {
      clampPan();
      const s = scale();
      stage.style.transform = `translate3d(calc(-50% + ${panX}px), calc(-50% + ${panY}px), 0) scale(${s})`;
      syncUI();
    }

    function fit() {
      const r = rect();
      fitScale = Math.min((r.width - 18) / MAP_W, (r.height - 18) / MAP_H);
      if (!Number.isFinite(fitScale) || fitScale <= 0) fitScale = 0.1;
    }

    function reset() {
      zoom = 0;
      panX = 0;
      panY = 0;
      render();
    }

    function zoomAt(nextZoom, clientX, clientY) {
      const target = clamp(nextZoom, MIN_ZOOM, MAX_ZOOM);
      if (Math.abs(target - zoom) < 0.0001) return;
      const r = rect();
      const localX = clientX - r.left - r.width / 2;
      const localY = clientY - r.top - r.height / 2;
      const oldScale = scale();
      const newScale = fitScale * Math.pow(2, target);
      const ratio = newScale / oldScale;
      panX = localX - (localX - panX) * ratio;
      panY = localY - (localY - panY) * ratio;
      zoom = target;
      render();
    }

    function zoomCenter(delta) {
      const r = rect();
      zoomAt(zoom + delta, r.left + r.width / 2, r.top + r.height / 2);
    }

    function point(e) { return { x: e.clientX, y: e.clientY }; }
    function distance(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }

    function onPointerDown(e) {
      if (e.target.closest('button,input')) return;
      pointers.set(e.pointerId, point(e));
      try { viewport.setPointerCapture(e.pointerId); } catch (_) {}

      if (pointers.size === 2) {
        const pts = [...pointers.values()];
        pinchStartDistance = distance(pts[0], pts[1]);
        pinchStartZoom = zoom;
        pinchCenter = {
          x: (pts[0].x + pts[1].x) / 2,
          y: (pts[0].y + pts[1].y) / 2
        };
        dragging = false;
        return;
      }

      dragging = true;
      activePointer = e.pointerId;
      startX = e.clientX;
      startY = e.clientY;
      startPanX = panX;
      startPanY = panY;
      viewport.classList.add('is-dragging');
      e.preventDefault();
    }

    function onPointerMove(e) {
      if (!pointers.has(e.pointerId)) return;
      pointers.set(e.pointerId, point(e));

      if (pointers.size >= 2 && pinchCenter) {
        const pts = [...pointers.values()];
        const d = distance(pts[0], pts[1]);
        if (!pinchStartDistance) pinchStartDistance = d;
        zoomAt(pinchStartZoom + Math.log2(Math.max(1, d / pinchStartDistance)), pinchCenter.x, pinchCenter.y);
        e.preventDefault();
        return;
      }

      if (!dragging || e.pointerId !== activePointer) return;
      panX = startPanX + e.clientX - startX;
      panY = startPanY + e.clientY - startY;
      render();
      e.preventDefault();
    }

    function onPointerUp(e) {
      pointers.delete(e.pointerId);
      try { viewport.releasePointerCapture(e.pointerId); } catch (_) {}
      if (pointers.size === 0) {
        dragging = false;
        activePointer = null;
        pinchStartDistance = 0;
        pinchCenter = null;
        viewport.classList.remove('is-dragging');
      } else if (pointers.size === 1) {
        const [id, pt] = [...pointers.entries()][0];
        activePointer = id;
        dragging = true;
        startX = pt.x;
        startY = pt.y;
        startPanX = panX;
        startPanY = panY;
      }
    }

    viewport.addEventListener('wheel', e => {
      e.preventDefault();
      const delta = -e.deltaY * 0.0025;
      zoomAt(zoom + delta, e.clientX, e.clientY);
    }, { passive: false });
    viewport.addEventListener('pointerdown', onPointerDown, { passive: false });
    viewport.addEventListener('pointermove', onPointerMove, { passive: false });
    viewport.addEventListener('pointerup', onPointerUp);
    viewport.addEventListener('pointercancel', onPointerUp);
    viewport.addEventListener('contextmenu', e => e.preventDefault());
    viewport.addEventListener('dblclick', e => {
      if (e.target.closest('button,input')) return;
      zoomAt(zoom + 1, e.clientX, e.clientY);
    });

    document.querySelectorAll('[data-map-zoom-in]').forEach(btn => btn.addEventListener('click', () => zoomCenter(0.5)));
    document.querySelectorAll('[data-map-zoom-out]').forEach(btn => btn.addEventListener('click', () => zoomCenter(-0.5)));
    document.querySelectorAll('[data-map-reset]').forEach(btn => btn.addEventListener('click', reset));

    if (slider) {
      slider.min = '0';
      slider.max = String(MAX_ZOOM * 100);
      slider.step = '1';
      slider.addEventListener('input', () => {
        const r = rect();
        const next = Number(slider.value) / 100;
        zoomAt(next, r.left + r.width / 2, r.top + r.height / 2);
      });
    }

    window.addEventListener('keydown', e => {
      if (!viewport.matches(':hover') && document.activeElement !== viewport) return;
      if (e.key === '+' || e.key === '=') { e.preventDefault(); zoomCenter(0.5); }
      else if (e.key === '-') { e.preventDefault(); zoomCenter(-0.5); }
      else if (e.key === '0') { e.preventDefault(); reset(); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); panX += 70; render(); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); panX -= 70; render(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); panY += 70; render(); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); panY -= 70; render(); }
    });

    const initialize = () => { fit(); reset(); };
    window.addEventListener('resize', () => { fit(); render(); });
    viewport.tabIndex = 0;
    viewport.setAttribute('aria-label', 'Interaktív GTA V térkép. Húzás, görgős zoom, dupla kattintás és mobilos pinch zoom.');

    if (image.complete) initialize();
    else image.addEventListener('load', initialize, { once: true });
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
