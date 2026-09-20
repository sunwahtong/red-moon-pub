(() => {
  const viewport = document.querySelector('[data-map-viewport]');
  const image = document.querySelector('[data-map-image]');
  if (!viewport || !image) return;

  let scale = 1;
  let x = 0;
  let y = 0;
  let dragging = false;
  let startX = 0;
  let startY = 0;
  let startMapX = 0;
  let startMapY = 0;

  const MIN = 0.75;
  const MAX = 4;
  const STEP = 0.18;

  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

  function render() {
    image.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${scale})`;
    const value = document.querySelector('[data-map-zoom-value]');
    if (value) value.textContent = `${Math.round(scale * 100)}%`;
  }

  function reset() {
    scale = 1;
    x = 0;
    y = 0;
    render();
  }

  function zoomAt(nextScale, clientX, clientY) {
    const rect = viewport.getBoundingClientRect();
    const px = clientX - rect.left;
    const py = clientY - rect.top;
    const old = scale;
    scale = clamp(nextScale, MIN, MAX);
    const ratio = scale / old;
    x = px - (px - x) * ratio;
    y = py - (py - y) * ratio;
    render();
  }

  viewport.addEventListener('wheel', (event) => {
    event.preventDefault();
    zoomAt(scale + (event.deltaY < 0 ? STEP : -STEP), event.clientX, event.clientY);
  }, { passive: false });

  viewport.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;
    dragging = true;
    viewport.setPointerCapture(event.pointerId);
    startX = event.clientX;
    startY = event.clientY;
    startMapX = x;
    startMapY = y;
    viewport.classList.add('is-dragging');
  });

  viewport.addEventListener('pointermove', (event) => {
    if (!dragging) return;
    x = startMapX + event.clientX - startX;
    y = startMapY + event.clientY - startY;
    render();
  });

  function stopDrag(event) {
    dragging = false;
    viewport.classList.remove('is-dragging');
    if (event?.pointerId != null) {
      try { viewport.releasePointerCapture(event.pointerId); } catch (_) {}
    }
  }

  viewport.addEventListener('pointerup', stopDrag);
  viewport.addEventListener('pointercancel', stopDrag);
  viewport.addEventListener('pointerleave', () => {
    if (dragging) viewport.classList.add('is-dragging');
  });

  document.querySelector('[data-map-zoom-in]')?.addEventListener('click', () => {
    const r = viewport.getBoundingClientRect();
    zoomAt(scale + STEP, r.left + r.width / 2, r.top + r.height / 2);
  });
  document.querySelector('[data-map-zoom-out]')?.addEventListener('click', () => {
    const r = viewport.getBoundingClientRect();
    zoomAt(scale - STEP, r.left + r.width / 2, r.top + r.height / 2);
  });
  document.querySelector('[data-map-reset]')?.addEventListener('click', reset);

  // Touch / trackpad-friendly double click zoom.
  viewport.addEventListener('dblclick', (event) => {
    zoomAt(scale >= 2 ? 1 : 2, event.clientX, event.clientY);
  });

  image.addEventListener('dragstart', e => e.preventDefault());
  render();
})();
