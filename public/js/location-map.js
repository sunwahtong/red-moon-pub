(() => {
  const boot = () => {
    const viewport = document.querySelector('[data-map-viewport]');
    const stage = document.querySelector('[data-map-stage]');
    const image = document.querySelector('[data-map-image]');
    if (!viewport || !stage || !image) return;

    let zoom = 1;
    let baseScale = 1;
    let x = 0, y = 0;
    let dragging = false;
    let startX = 0, startY = 0, startPanX = 0, startPanY = 0;
    const MIN = 0.75, MAX = 5, STEP = 0.2;
    const clamp = (v,a,b) => Math.max(a, Math.min(b,v));
    const slider = document.querySelector('[data-map-zoom-slider]');
    const value = document.querySelector('[data-map-zoom-value]');

    function fitScale() {
      const nw = image.naturalWidth || 534;
      const nh = image.naturalHeight || 720;
      const pad = 18;
      // Fit the complete map into the viewport on first load.
      baseScale = Math.min((viewport.clientWidth - pad) / nw, (viewport.clientHeight - pad) / nh);
      if (!Number.isFinite(baseScale) || baseScale <= 0) baseScale = 1;
    }

    function sync() {
      const pct = Math.round(zoom * 100);
      if (value) value.textContent = pct + '%';
      if (slider) slider.value = String(pct);
    }

    function render() {
      const s = baseScale * zoom;
      stage.style.transform = `translate3d(calc(-50% + ${x}px), calc(-50% + ${y}px), 0) scale(${s})`;
      sync();
    }

    function reset() {
      zoom = 1; x = 0; y = 0; render();
    }

    function zoomAt(next, clientX, clientY) {
      const rect = viewport.getBoundingClientRect();
      const old = zoom;
      const target = clamp(next, MIN, MAX);
      if (target === old) return;
      const px = clientX - rect.left - rect.width / 2 - x;
      const py = clientY - rect.top - rect.height / 2 - y;
      const ratio = target / old;
      zoom = target;
      x += px * (1 - ratio);
      y += py * (1 - ratio);
      render();
    }

    function centerZoom(delta) {
      const r = viewport.getBoundingClientRect();
      zoomAt(zoom + delta, r.left + r.width / 2, r.top + r.height / 2);
    }

    function start() { fitScale(); reset(); }
    if (image.complete && image.naturalWidth) start();
    else image.addEventListener('load', start, {once:true});

    window.addEventListener('resize', () => { fitScale(); render(); });

    viewport.addEventListener('wheel', e => {
      e.preventDefault();
      zoomAt(zoom + (e.deltaY < 0 ? STEP : -STEP), e.clientX, e.clientY);
    }, {passive:false});

    viewport.addEventListener('pointerdown', e => {
      if (e.button !== 0 || e.target.closest('button,input')) return;
      dragging = true;
      viewport.setPointerCapture(e.pointerId);
      startX=e.clientX; startY=e.clientY; startPanX=x; startPanY=y;
      viewport.classList.add('is-dragging');
    });

    viewport.addEventListener('pointermove', e => {
      if (!dragging) return;
      x=startPanX+e.clientX-startX;
      y=startPanY+e.clientY-startY;
      render();
    });

    const stop = e => {
      if (!dragging) return;
      dragging=false;
      viewport.classList.remove('is-dragging');
      try { viewport.releasePointerCapture(e.pointerId); } catch (_) {}
    };
    viewport.addEventListener('pointerup', stop);
    viewport.addEventListener('pointercancel', stop);

    document.querySelectorAll('[data-map-zoom-in]').forEach(b => b.addEventListener('click', () => centerZoom(STEP)));
    document.querySelectorAll('[data-map-zoom-out]').forEach(b => b.addEventListener('click', () => centerZoom(-STEP)));
    document.querySelectorAll('[data-map-reset]').forEach(b => b.addEventListener('click', reset));

    if (slider) {
      slider.addEventListener('input', () => {
        const next=Number(slider.value)/100;
        const r=viewport.getBoundingClientRect();
        zoomAt(next,r.left+r.width/2,r.top+r.height/2);
      });
    }

    viewport.addEventListener('dblclick', e => {
      e.preventDefault();
      zoomAt(zoom >= 2 ? 1 : 2, e.clientX, e.clientY);
    });

    image.addEventListener('dragstart', e => e.preventDefault());
    reset();
  };
  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();