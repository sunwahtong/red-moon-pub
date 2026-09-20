(() => {
  const boot = () => {
    const viewport = document.querySelector('[data-map-viewport]');
    const stage = document.querySelector('[data-map-stage]');
    const image = document.querySelector('[data-map-image]');
    if (!viewport || !stage || !image) return;

    const slider = document.querySelector('[data-map-zoom-slider]');
    const value = document.querySelector('[data-map-zoom-value]');

    const MIN_ZOOM = 1;
    const MAX_ZOOM = 8;
    const WHEEL_STEP = 0.18;
    const EDGE = 70;

    let baseScale = 1;
    let zoom = 1;
    let panX = 0;
    let panY = 0;
    let dragging = false;
    let activePointer = null;
    let startX = 0, startY = 0, startPanX = 0, startPanY = 0;
    let pinchStartDistance = 0;
    let pinchStartZoom = 1;
    let pinchCenter = null;
    let lastMoveTime = 0, lastMoveX = 0, lastMoveY = 0;
    let velocityX = 0, velocityY = 0, inertiaFrame = 0;

    const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

    function mapSize() {
      return {
        w: (image.naturalWidth || 735) * baseScale * zoom,
        h: (image.naturalHeight || 752) * baseScale * zoom
      };
    }

    function clampPan() {
      const rect = viewport.getBoundingClientRect();
      const size = mapSize();
      const maxX = Math.max(EDGE, (size.w - rect.width) / 2 + EDGE);
      const maxY = Math.max(EDGE, (size.h - rect.height) / 2 + EDGE);
      panX = clamp(panX, -maxX, maxX);
      panY = clamp(panY, -maxY, maxY);
    }

    function syncUI() {
      const pct = Math.round(zoom * 100);
      if (value) value.textContent = `${pct}%`;
      if (slider) slider.value = String(pct);
    }

    function render() {
      clampPan();
      const scale = baseScale * zoom;
      stage.style.transform = `translate3d(calc(-50% + ${panX}px), calc(-50% + ${panY}px), 0) scale(${scale})`;
      syncUI();
    }

    function fitBaseScale() {
      const rect = viewport.getBoundingClientRect();
      const nw = image.naturalWidth || 735;
      const nh = image.naturalHeight || 752;
      // Fit the whole GTA map in the viewer, while leaving room for the controls.
      baseScale = Math.min((rect.width - 48) / nw, (rect.height - 48) / nh);
      if (!Number.isFinite(baseScale) || baseScale <= 0) baseScale = 1;
    }

    function reset() {
      cancelAnimationFrame(inertiaFrame);
      zoom = 1;
      panX = 0;
      panY = 0;
      render();
    }

    function zoomAt(nextZoom, clientX, clientY) {
      const rect = viewport.getBoundingClientRect();
      const target = clamp(nextZoom, MIN_ZOOM, MAX_ZOOM);
      if (Math.abs(target - zoom) < 0.0001) return;

      // Keep the point under the cursor/finger stationary while zooming.
      const localX = clientX - rect.left - rect.width / 2;
      const localY = clientY - rect.top - rect.height / 2;
      const ratio = target / zoom;
      panX = localX - (localX - panX) * ratio;
      panY = localY - (localY - panY) * ratio;
      zoom = target;
      render();
    }

    function zoomCenter(delta) {
      const rect = viewport.getBoundingClientRect();
      zoomAt(zoom + delta, rect.left + rect.width / 2, rect.top + rect.height / 2);
    }

    function stopInertia() {
      cancelAnimationFrame(inertiaFrame);
      velocityX = velocityY = 0;
    }

    function runInertia() {
      velocityX *= 0.92;
      velocityY *= 0.92;
      if (Math.abs(velocityX) < 0.08 && Math.abs(velocityY) < 0.08) return;
      panX += velocityX;
      panY += velocityY;
      render();
      inertiaFrame = requestAnimationFrame(runInertia);
    }

    function pointerPosition(e) {
      return {x: e.clientX, y: e.clientY};
    }

    function distance(a, b) {
      return Math.hypot(a.x - b.x, a.y - b.y);
    }

    const pointers = new Map();

    function onPointerDown(e) {
      if (e.target.closest('button,input')) return;
      stopInertia();
      pointers.set(e.pointerId, pointerPosition(e));
      viewport.setPointerCapture?.(e.pointerId);

      if (pointers.size === 2) {
        const pts = [...pointers.values()];
        pinchStartDistance = distance(pts[0], pts[1]);
        pinchStartZoom = zoom;
        pinchCenter = {x:(pts[0].x + pts[1].x)/2, y:(pts[0].y + pts[1].y)/2};
        dragging = false;
        return;
      }

      dragging = true;
      activePointer = e.pointerId;
      startX = e.clientX;
      startY = e.clientY;
      startPanX = panX;
      startPanY = panY;
      lastMoveTime = performance.now();
      lastMoveX = e.clientX;
      lastMoveY = e.clientY;
      velocityX = velocityY = 0;
      viewport.classList.add('is-dragging');
    }

    function onPointerMove(e) {
      if (!pointers.has(e.pointerId)) return;
      pointers.set(e.pointerId, pointerPosition(e));

      if (pointers.size >= 2) {
        const pts = [...pointers.values()];
        const d = distance(pts[0], pts[1]);
        if (!pinchStartDistance) {
          pinchStartDistance = d;
          pinchStartZoom = zoom;
        }
        const next = clamp(pinchStartZoom * (d / pinchStartDistance), MIN_ZOOM, MAX_ZOOM);
        zoomAt(next, pinchCenter.x, pinchCenter.y);
        e.preventDefault();
        return;
      }

      if (!dragging || e.pointerId !== activePointer) return;
      panX = startPanX + e.clientX - startX;
      panY = startPanY + e.clientY - startY;

      const now = performance.now();
      const dt = Math.max(8, now - lastMoveTime);
      velocityX = (e.clientX - lastMoveX) / dt * 16;
      velocityY = (e.clientY - lastMoveY) / dt * 16;
      lastMoveTime = now;
      lastMoveX = e.clientX;
      lastMoveY = e.clientY;

      render();
      e.preventDefault();
    }

    function onPointerUp(e) {
      pointers.delete(e.pointerId);
      try { viewport.releasePointerCapture?.(e.pointerId); } catch (_) {}

      if (pointers.size === 0) {
        if (dragging && (Math.abs(velocityX) > 0.5 || Math.abs(velocityY) > 0.5)) {
          inertiaFrame = requestAnimationFrame(runInertia);
        }
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
      stopInertia();
      const factor = Math.exp(-e.deltaY * 0.0017);
      zoomAt(zoom * factor, e.clientX, e.clientY);
    }, {passive:false});

    viewport.addEventListener('pointerdown', onPointerDown, {passive:false});
    viewport.addEventListener('pointermove', onPointerMove, {passive:false});
    viewport.addEventListener('pointerup', onPointerUp);
    viewport.addEventListener('pointercancel', onPointerUp);
    viewport.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse' && dragging) onPointerUp(e); });

    viewport.addEventListener('dblclick', e => {
      if (e.target.closest('button,input')) return;
      e.preventDefault();
      zoomAt(zoom < 2 ? 2 : Math.min(MAX_ZOOM, zoom * 1.75), e.clientX, e.clientY);
    });

    viewport.addEventListener('contextmenu', e => e.preventDefault());

    window.addEventListener('keydown', e => {
      if (!viewport.matches(':hover') && document.activeElement !== viewport) return;
      if (e.key === '+' || e.key === '=') { e.preventDefault(); zoomCenter(WHEEL_STEP); }
      if (e.key === '-') { e.preventDefault(); zoomCenter(-WHEEL_STEP); }
      if (e.key === '0') { e.preventDefault(); reset(); }
      if (e.key === 'ArrowLeft') { panX += 60; render(); }
      if (e.key === 'ArrowRight') { panX -= 60; render(); }
      if (e.key === 'ArrowUp') { panY += 60; render(); }
      if (e.key === 'ArrowDown') { panY -= 60; render(); }
    });

    document.querySelectorAll('[data-map-zoom-in]').forEach(btn => btn.addEventListener('click', () => zoomCenter(WHEEL_STEP * 2)));
    document.querySelectorAll('[data-map-zoom-out]').forEach(btn => btn.addEventListener('click', () => zoomCenter(-WHEEL_STEP * 2)));
    document.querySelectorAll('[data-map-reset]').forEach(btn => btn.addEventListener('click', reset));

    if (slider) {
      slider.min = String(MIN_ZOOM * 100);
      slider.max = String(MAX_ZOOM * 100);
      slider.step = '1';
      slider.addEventListener('input', () => {
        const rect = viewport.getBoundingClientRect();
        zoomAt(Number(slider.value) / 100, rect.left + rect.width/2, rect.top + rect.height/2);
      });
    }

    const initialize = () => {
      fitBaseScale();
      reset();
    };

    if (image.complete && image.naturalWidth) initialize();
    else image.addEventListener('load', initialize, {once:true});

    window.addEventListener('resize', () => {
      const old = baseScale;
      fitBaseScale();
      // Keep the current visual zoom level after resize.
      if (old > 0) render();
    });

    image.addEventListener('dragstart', e => e.preventDefault());
    viewport.tabIndex = 0;
    viewport.setAttribute('aria-label', 'Interaktív GTA V térkép. Húzás, görgős zoom, dupla kattintás és mobilos pinch zoom.');
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, {once:true});
  else boot();
})();
