(() => {
  const boot = () => {
    const viewport = document.querySelector('[data-map-viewport]');
    const stage = viewport?.querySelector('[data-map-stage]');
    if (!viewport || !stage) return;

    const slider = document.querySelector('[data-map-zoom-slider]');
    const value = document.querySelector('[data-map-zoom-value]');
    const marker = viewport.querySelector('[data-map-marker]');

    // Opaque PNG: avoids transparent/WebP rendering problems in some browsers.
    const MAP_URL = 'assets/gtav-map-hires.png';
    const MIN_ZOOM = 0;
    const MAX_ZOOM = 3;
    const MARKER_X = 0.59;
    const MARKER_Y = 0.73;

    stage.innerHTML = '';
    stage.style.position = 'absolute';
    stage.style.left = '50%';
    stage.style.top = '50%';
    stage.style.transformOrigin = 'center center';
    stage.style.pointerEvents = 'none';
    stage.style.zIndex = '5';

    const image = new Image();
    image.className = 'map-image';
    image.alt = 'GTA V alap térkép';
    image.draggable = false;
    image.decoding = 'async';
    image.src = MAP_URL;
    stage.appendChild(image);

    const markerLayer = document.createElement('div');
    markerLayer.className = 'map-marker-layer';
    markerLayer.style.position = 'absolute';
    markerLayer.style.inset = '0';
    markerLayer.style.pointerEvents = 'none';
    markerLayer.style.zIndex = '6';
    if (marker) {
      marker.style.position = 'absolute';
      marker.style.left = `${MARKER_X * 100}%`;
      marker.style.top = `${MARKER_Y * 100}%`;
      markerLayer.appendChild(marker);
    }
    stage.appendChild(markerLayer);

    let mapW = 5880;
    let mapH = 6016;
    let fitScale = 0.1;
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

    const getLocalPoint = (clientX, clientY) => {
      const r = rect();
      return { x: clientX - r.left - r.width / 2, y: clientY - r.top - r.height / 2 };
    };

    function clampPan() {
      const r = rect();
      const s = scale();
      const w = mapW * s;
      const h = mapH * s;
      const maxX = Math.max(0, (w - r.width) / 2);
      const maxY = Math.max(0, (h - r.height) / 2);
      panX = clamp(panX, -maxX, maxX);
      panY = clamp(panY, -maxY, maxY);
    }

    function syncUI() {
      if (value) value.textContent = `${Math.round(Math.pow(2, zoom) * 100)}%`;
      if (slider) slider.value = String(Math.round(zoom * 100));
    }

    function render() {
      clampPan();
      const s = scale();
      stage.style.width = `${mapW}px`;
      stage.style.height = `${mapH}px`;
      stage.style.transform = `translate3d(calc(-50% + ${panX}px), calc(-50% + ${panY}px), 0) scale(${s})`;
      syncUI();
    }

    function fit() {
      const r = rect();
      fitScale = Math.min((r.width - 28) / mapW, (r.height - 28) / mapH);
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
      const oldScale = scale();
      if (Math.abs(target - zoom) < 0.00001) return;
      const newScale = fitScale * Math.pow(2, target);
      const p = getLocalPoint(clientX, clientY);
      const ratio = newScale / oldScale;
      panX = p.x - (p.x - panX) * ratio;
      panY = p.y - (p.y - panY) * ratio;
      zoom = target;
      render();
    }

    function zoomCenter(delta) {
      const r = rect();
      zoomAt(zoom + delta, r.left + r.width / 2, r.top + r.height / 2);
    }

    const point = e => ({ x: e.clientX, y: e.clientY });
    const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

    function onPointerDown(e) {
      if (e.target.closest('button,input')) return;
      pointers.set(e.pointerId, point(e));
      try { viewport.setPointerCapture(e.pointerId); } catch (_) {}

      if (pointers.size === 2) {
        const pts = [...pointers.values()];
        pinchStartDistance = distance(pts[0], pts[1]);
        pinchStartZoom = zoom;
        pinchCenter = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };
        dragging = false;
        e.preventDefault();
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
        if (pinchStartDistance > 0) {
          zoomAt(pinchStartZoom + Math.log2(Math.max(0.1, d / pinchStartDistance)), pinchCenter.x, pinchCenter.y);
        }
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
      zoomAt(zoom - e.deltaY * 0.0025, e.clientX, e.clientY);
    }, { passive: false });
    viewport.addEventListener('pointerdown', onPointerDown, { passive: false });
    viewport.addEventListener('pointermove', onPointerMove, { passive: false });
    viewport.addEventListener('pointerup', onPointerUp);
    viewport.addEventListener('pointercancel', onPointerUp);
    viewport.addEventListener('contextmenu', e => e.preventDefault());
    viewport.addEventListener('dblclick', e => {
      if (!e.target.closest('button,input')) zoomAt(zoom + 0.75, e.clientX, e.clientY);
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
        zoomAt(Number(slider.value) / 100, r.left + r.width / 2, r.top + r.height / 2);
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

    const initialize = () => {
      mapW = image.naturalWidth || mapW;
      mapH = image.naturalHeight || mapH;
      fit();
      reset();
    };

    image.addEventListener('error', () => {
      viewport.classList.add('map-load-error');
      const msg = document.createElement('div');
      msg.className = 'map-load-message';
      msg.innerHTML = '<strong>A térkép nem töltődött be.</strong><span>Frissítsd az oldalt, vagy ellenőrizd az assets/gtav-map-hires.png fájlt.</span>';
      viewport.appendChild(msg);
    }, { once: true });

    window.addEventListener('resize', () => { fit(); render(); });
    viewport.tabIndex = 0;
    viewport.setAttribute('aria-label', 'Interaktív GTA V térkép. Húzás, görgős zoom, dupla kattintás és mobilos pinch zoom.');

    if (image.complete && image.naturalWidth) initialize();
    else image.addEventListener('load', initialize, { once: true });
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
