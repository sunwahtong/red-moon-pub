(() => {
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];
  const isIndex = /(^|\/)index\.html?$/.test(location.pathname) || /\/$/.test(location.pathname);
  const STORAGE = {
    volume: 'redmoon-volume',
    sound: 'redmoon-sound',
    time: 'redmoon-audio-time'
  };

  const audio = new Audio('assets/red-moon.mp3');
  audio.loop = true;
  audio.preload = 'auto';
  audio.autoplay = false;

  let volume = Number.parseInt(localStorage.getItem(STORAGE.volume) || '45', 10);
  if (!Number.isFinite(volume)) volume = 45;
  volume = Math.max(0, Math.min(100, volume));
  audio.volume = volume / 100;

  let soundOn = localStorage.getItem(STORAGE.sound) === 'on';
  let restoredTime = false;
  const savedTime = Number.parseFloat(localStorage.getItem(STORAGE.time) || '0');
  const hasSavedTime = Number.isFinite(savedTime) && savedTime > 0;

  const restoreTime = () => {
    if (restoredTime || !hasSavedTime || !Number.isFinite(audio.duration) || audio.duration <= 0) return;
    try {
      const safe = Math.min(savedTime, Math.max(0, audio.duration - 0.25));
      audio.currentTime = safe;
    } catch {}
    restoredTime = true;
  };
  audio.addEventListener('loadedmetadata', restoreTime, { once: false });
  if (audio.readyState >= 1) restoreTime();

  const saveTime = () => {
    if (!Number.isFinite(audio.currentTime) || audio.currentTime < 0) return;
    localStorage.setItem(STORAGE.time, String(audio.currentTime));
  };
  let lastSavedAt = 0;
  audio.addEventListener('timeupdate', () => {
    const now = performance.now();
    if (now - lastSavedAt > 650) {
      saveTime();
      lastSavedAt = now;
    }
  });
  addEventListener('pagehide', saveTime, { capture: true });
  addEventListener('beforeunload', saveTime, { capture: true });

  const soundWrap = $('.sound-wrap');
  if (!soundWrap) {
    const nav = $('.nav');
    const wrap = document.createElement('div');
    wrap.className = 'sound-wrap';
    wrap.innerHTML = `
      <button class="sound" id="soundBtn" type="button" aria-label="Zene ki- és bekapcsolása" aria-expanded="false" aria-pressed="false">
        <span id="soundIcon">)))</span><span>AMBIENCE</span>
      </button>
      <div class="volume-panel" id="volumePanel" aria-label="Hangerő">
        <div class="volume-head"><span>VOLUME</span><strong id="volumeValue">45%</strong></div>
        <input id="volumeSlider" type="range" min="0" max="100" value="45" aria-label="Zene hangereje">
      </div>`;
    nav?.appendChild(wrap);
  }

  const btn = $('#soundBtn');
  const icon = $('#soundIcon');
  const slider = $('#volumeSlider');
  const value = $('#volumeValue');
  const panel = $('#volumePanel');

  function paintSound() {
    if (btn) {
      btn.setAttribute('aria-pressed', String(soundOn && !audio.paused));
      btn.setAttribute('aria-expanded', String(panel?.classList.contains('open') || false));
    }
    if (icon) icon.textContent = soundOn && !audio.paused ? ')))' : '—';
    if (slider) slider.value = String(volume);
    if (value) value.textContent = `${volume}%`;
  }

  async function playAudio() {
    if (!soundOn || volume <= 0) return false;
    restoreTime();
    audio.volume = volume / 100;
    try {
      await audio.play();
      paintSound();
      return true;
    } catch {
      paintSound();
      return false;
    }
  }

  async function startFromGesture() {
    soundOn = true;
    localStorage.setItem(STORAGE.sound, 'on');
    restoreTime();
    audio.volume = volume / 100;
    try {
      await audio.play();
      paintSound();
      return true;
    } catch {
      paintSound();
      return false;
    }
  }

  function stopAudio() {
    saveTime();
    audio.pause();
    soundOn = false;
    localStorage.setItem(STORAGE.sound, 'off');
    paintSound();
  }

  btn?.addEventListener('click', async () => {
    panel?.classList.toggle('open');
    if (soundOn && !audio.paused) stopAudio();
    else await startFromGesture();
    paintSound();
  });

  slider?.addEventListener('input', async () => {
    volume = Number(slider.value);
    localStorage.setItem(STORAGE.volume, String(volume));
    audio.volume = volume / 100;
    if (volume === 0) {
      if (!audio.paused) stopAudio();
      return;
    }
    if (soundOn && audio.paused) await playAudio();
    paintSound();
  });

  panel?.addEventListener('click', e => e.stopPropagation());
  document.addEventListener('click', e => {
    if (!soundWrap?.contains(e.target)) panel?.classList.remove('open');
  });

  // The cinematic loader exists only on the home page. Entering it starts/resumes the track.
  if (isIndex && loaderExists()) {
    const loader = $('#loader');
    const enter = $('#enterRedMoon');
    document.documentElement.classList.add('rm-index-lock');
    const showReady = () => {
      loader?.classList.add('ready');
      enter?.removeAttribute('disabled');
    };
    if (document.readyState === 'complete') showReady();
    else addEventListener('load', showReady, { once: true });

    enter?.addEventListener('click', async () => {
      enter.disabled = true;
      await startFromGesture();
      loader?.classList.add('gone');
      document.documentElement.classList.remove('rm-index-lock');
      setTimeout(() => loader?.remove(), 1250);
    }, { once: true });
  } else {
    $('#loader')?.remove();
  }

  // Other pages resume from the exact saved position. Autoplay may be denied by a browser;
  // in that case the first user interaction resumes it without resetting the timestamp.
  if (!isIndex && soundOn) {
    playAudio();
    const resume = () => {
      playAudio();
      cleanup();
    };
    const cleanup = () => ['pointerdown', 'keydown', 'touchstart'].forEach(evt => document.removeEventListener(evt, resume, true));
    ['pointerdown', 'keydown', 'touchstart'].forEach(evt => document.addEventListener(evt, resume, true));
    addEventListener('pageshow', () => playAudio());
    setTimeout(() => playAudio(), 180);
  }

  // Mark the active navigation item and make internal navigation feel cinematic.
  const page = location.pathname.split('/').pop() || 'index.html';
  $$('header.nav nav a').forEach(link => {
    const href = link.getAttribute('href') || '';
    if (href === page || (page === '' && href === 'index.html')) link.classList.add('active');
  });

  let transition = document.createElement('div');
  transition.id = 'pageTransition';
  transition.innerHTML = '<span></span><b>RED MOON</b>';
  document.body.appendChild(transition);
  requestAnimationFrame(() => transition.classList.add('ready'));

  $$('a[href]').forEach(link => {
    link.addEventListener('click', e => {
      const href = link.getAttribute('href') || '';
      if (!href || href.startsWith('#') || link.target === '_blank' || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const url = new URL(link.href, location.href);
      if (url.origin !== location.origin || !/\.html?$/.test(url.pathname)) return;
      saveTime();
      if (soundOn) localStorage.setItem(STORAGE.sound, 'on');
      e.preventDefault();
      transition.classList.remove('ready');
      transition.classList.add('leaving');
      setTimeout(() => { location.href = url.href; }, 340);
    }, { passive: false });
  });

  paintSound();

  $('#hamb')?.addEventListener('click', () => $('header.nav nav')?.classList.toggle('open'));

  const cursor = $('.cursor'), dot = $('.cursor-dot');
  if (cursor && dot && matchMedia('(pointer:fine)').matches) {
    addEventListener('mousemove', e => {
      cursor.style.left = `${e.clientX}px`;
      cursor.style.top = `${e.clientY}px`;
      dot.style.left = `${e.clientX}px`;
      dot.style.top = `${e.clientY}px`;
    }, { passive: true });
  }

  const targets = $$('.section,.event-card,.drink-card,.owner,.gallery-grid,.menu-item,.cinematic-callout,.menu-v11-card');
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(entries => entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        io.unobserve(entry.target);
      }
    }), { threshold: 0.08 });
    targets.forEach(el => { el.classList.add('cinematic-reveal'); io.observe(el); });
  } else targets.forEach(el => el.classList.add('is-visible'));

  $$('[data-countdown]').forEach(el => {
    const target = new Date(el.dataset.countdown).getTime();
    const tick = () => {
      let d = Math.max(0, target - Date.now());
      const days = Math.floor(d / 86400000); d %= 86400000;
      const hours = Math.floor(d / 3600000); d %= 3600000;
      const mins = Math.floor(d / 60000); d %= 60000;
      const secs = Math.floor(d / 1000);
      el.innerHTML = `<b>${String(days).padStart(2, '0')}</b><span>NAP</span><b>${String(hours).padStart(2, '0')}</b><span>ÓRA</span><b>${String(mins).padStart(2, '0')}</b><span>PERC</span><b>${String(secs).padStart(2, '0')}</b><span>MP</span>`;
    };
    tick(); setInterval(tick, 1000);
  });

  function loaderExists() {
    return !!$('#loader');
  }
})();
