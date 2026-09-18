(() => {
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];
  const initialIsIndex = /(^|\/)index\.html?$/.test(location.pathname) || /\/$/.test(location.pathname);
  const STORAGE = { volume:'redmoon-volume', sound:'redmoon-sound', time:'redmoon-audio-time' };

  // One Audio object lives for the whole SPA session. Internal page changes never recreate it.
  const audio = new Audio('assets/red-moon.mp3');
  audio.loop = true;
  audio.preload = 'auto';
  audio.autoplay = false;
  let volume = Number.parseInt(localStorage.getItem(STORAGE.volume) || '45', 10);
  if (!Number.isFinite(volume)) volume = 45;
  volume = Math.max(0, Math.min(100, volume));
  audio.volume = volume / 100;

  // Tiny tactile UI click used by the public navigation and primary controls.

  // LIVE DJ — one public WebRTC listener per browser tab. When live is active,
  // the house ambience is muted and the DJ's live audio takes over.
  let liveState={active:false,djName:'',title:'',startedAt:null};
  let liveWS=null, livePC=null, liveAudio=null, liveViewerId=null;
  function livePanel(){return $('#liveDJPanel')}
  function paintLive(state){
    liveState={...liveState,...state};
    const p=livePanel();
    if(p){
      p.classList.toggle('is-live',!!liveState.active);
      p.querySelector('[data-live-badge]')?.replaceChildren(document.createTextNode(liveState.active?'LIVE NOW':'OFF AIR'));
      p.querySelector('[data-live-dj]')?.replaceChildren(document.createTextNode(liveState.djName||'Red Moon DJ'));
      p.querySelector('[data-live-title]')?.replaceChildren(document.createTextNode(liveState.title||'Red Moon Live'));
    }
    if(liveState.active){
      audio.pause();
      audio.currentTime=audio.currentTime||0;
      connectLiveViewer();
    }else{
      disconnectLiveViewer();
      if(soundOn && volume>0) playAudio();
    }
    paintSound();
  }
  function connectLiveViewer(){
    if(!liveState.active)return;
    if(liveWS&&liveWS.readyState<=1)return;
    const proto=location.protocol==='https:'?'wss':'ws';
    liveWS=new WebSocket(`${proto}://${location.host}/ws?mode=viewer`);
    liveWS.onmessage=async ev=>{
      let m;try{m=JSON.parse(ev.data)}catch{return}
      if(m.type==='live_state'){paintLive(m);return}
      if(m.type==='offer'){
        try{
          liveViewerId=m.viewerId;
          livePC=new RTCPeerConnection({iceServers:[{urls:'stun:stun.l.google.com:19302'},{urls:'stun:stun1.l.google.com:19302'}]});
          livePC.onicecandidate=e=>{if(e.candidate&&liveWS?.readyState===1)liveWS.send(JSON.stringify({type:'ice',targetId:null,candidate:e.candidate}))};
          // The DJ needs the viewer's id as the target. The server infers it from the connection.
          livePC.ontrack=e=>{
            if(!liveAudio){liveAudio=new Audio();liveAudio.autoplay=true;liveAudio.playsInline=true;document.body.appendChild(liveAudio)}
            liveAudio.srcObject=e.streams[0];liveAudio.volume=volume/100;
            const pr=liveAudio.play();if(pr?.catch)pr.catch(()=>{});
          };
          await livePC.setRemoteDescription(m.offer);
          const answer=await livePC.createAnswer();await livePC.setLocalDescription(answer);
          liveWS.send(JSON.stringify({type:'answer',answer:livePC.localDescription}));
        }catch{disconnectLiveViewer()}
      }
      if(m.type==='ice'&&livePC&&m.candidate)try{await livePC.addIceCandidate(m.candidate)}catch{}
    };
    liveWS.onclose=()=>{liveWS=null;livePC?.close();livePC=null;liveViewerId=null};
  }
  function disconnectLiveViewer(){
    try{livePC?.close()}catch{};livePC=null;liveViewerId=null;
    try{liveWS?.close()}catch{};liveWS=null;
    if(liveAudio){try{liveAudio.pause()}catch{};liveAudio.srcObject=null;liveAudio.remove();liveAudio=null}
  }
  // Server status gives freshly loaded pages the current live state immediately.
  fetch('/api/live',{credentials:'same-origin',cache:'no-store'}).then(r=>r.json()).then(paintLive).catch(()=>{});

  const uiClick = new Audio('assets/sounds/ui_click.wav');
  uiClick.preload = 'auto';
  uiClick.volume = 0.32;
  const playUiClick = () => {
    try { uiClick.currentTime = 0; const p = uiClick.play(); if (p?.catch) p.catch(()=>{}); } catch {}
  };

  let soundOn = localStorage.getItem(STORAGE.sound) === 'on';
  let restoredTime = false;
  const savedTime = Number.parseFloat(localStorage.getItem(STORAGE.time) || '0');
  const hasSavedTime = Number.isFinite(savedTime) && savedTime > 0;
  const restoreTime = () => {
    if (restoredTime || !hasSavedTime || !Number.isFinite(audio.duration) || audio.duration <= 0) return;
    try { audio.currentTime = Math.min(savedTime, Math.max(0, audio.duration - 0.25)); } catch {}
    restoredTime = true;
  };
  audio.addEventListener('loadedmetadata', restoreTime);
  const saveTime = () => {
    if (Number.isFinite(audio.currentTime) && audio.currentTime >= 0) localStorage.setItem(STORAGE.time, String(audio.currentTime));
  };
  let lastSavedAt = 0;
  audio.addEventListener('timeupdate', () => {
    const now = performance.now();
    if (now - lastSavedAt > 650) { saveTime(); lastSavedAt = now; }
  });
  addEventListener('pagehide', saveTime, { capture:true });
  addEventListener('beforeunload', saveTime, { capture:true });

  let soundWrap = $('.sound-wrap');
  if (!soundWrap) {
    const nav = $('.nav');
    const wrap = document.createElement('div');
    wrap.className = 'sound-wrap';
    wrap.innerHTML = '<button class="sound" id="soundBtn" type="button" aria-label="Zene ki- és bekapcsolása" aria-expanded="false" aria-pressed="false"><span id="soundIcon">)))</span><span>AMBIENCE</span></button><div class="volume-panel" id="volumePanel" aria-label="Hangerő"><div class="volume-head"><span>VOLUME</span><strong id="volumeValue">45%</strong></div><input id="volumeSlider" type="range" min="0" max="100" value="45" aria-label="Zene hangereje"></div>';
    nav?.appendChild(wrap);
    soundWrap = wrap;
  }
  const btn = $('#soundBtn'), icon = $('#soundIcon'), slider = $('#volumeSlider'), value = $('#volumeValue'), panel = $('#volumePanel');
  function paintSound() {
    if(liveState.active && livePanel()){ const b=livePanel().querySelector('[data-live-badge]'); if(b)b.textContent='LIVE NOW'; }
    btn?.setAttribute('aria-pressed', String(soundOn && !audio.paused));
    btn?.setAttribute('aria-expanded', String(panel?.classList.contains('open') || false));
    if (icon) icon.textContent = liveState.active ? (soundOn ? ')))' : '—') : (soundOn && !audio.paused ? ')))' : '—');
    const label=btn?.querySelector('span:last-child'); if(label) label.textContent=liveState.active?'LIVE DJ':'AMBIENCE';
    if (slider) slider.value = String(volume);
    if (value) value.textContent = `${volume}%`;
  }
  async function playAudio() {
    if (liveState.active) return false;
    if (!soundOn || volume <= 0) return false;
    restoreTime();
    audio.volume = volume / 100;
    try { await audio.play(); paintSound(); return true; } catch { paintSound(); return false; }
  }
  async function startFromGesture() {
    soundOn = true;
    if(liveState.active){connectLiveViewer();return true;}
    localStorage.setItem(STORAGE.sound, 'on');
    restoreTime();
    audio.volume = volume / 100;
    try { await audio.play(); paintSound(); return true; } catch { paintSound(); return false; }
  }
  function stopAudio() { saveTime(); audio.pause(); soundOn = false; localStorage.setItem(STORAGE.sound, 'off'); paintSound(); }
  btn?.addEventListener('click', async () => { panel?.classList.toggle('open'); if(liveState.active){ soundOn=!soundOn; localStorage.setItem(STORAGE.sound,soundOn?'on':'off'); if(soundOn){connectLiveViewer();if(liveAudio)await liveAudio.play().catch(()=>{})}else if(liveAudio)liveAudio.pause(); paintSound(); return; } if (soundOn && !audio.paused) stopAudio(); else await startFromGesture(); paintSound(); });
  slider?.addEventListener('input', async () => { volume = Number(slider.value); localStorage.setItem(STORAGE.volume, String(volume)); audio.volume = volume / 100; if (volume === 0) { if (!audio.paused) stopAudio(); return; } if (soundOn && audio.paused) await playAudio(); paintSound(); });
  panel?.addEventListener('click', e => e.stopPropagation());
  document.addEventListener('click', e => { if (!soundWrap?.contains(e.target)) panel?.classList.remove('open'); });

  // If the visitor already started the music earlier, try to resume it automatically
  // on the next public page. Browsers may still block audible autoplay after a hard reload;
  // in that case the saved position remains intact and the next user interaction resumes it.
  const resumeSavedMusic = async () => {
    if (soundOn && volume > 0 && !initialIsIndex) await playAudio();
  };
  if (initialIsIndex && $('#loader')) {
    const loader = $('#loader'), enter = $('#enterRedMoon');
    document.documentElement.classList.add('rm-index-lock');
    const showReady = () => { loader?.classList.add('ready'); enter?.removeAttribute('disabled'); };
    if (document.readyState === 'complete') showReady(); else addEventListener('load', showReady, {once:true});
    enter?.addEventListener('click', async () => { enter.disabled = true; await startFromGesture(); loader?.classList.add('gone'); document.documentElement.classList.remove('rm-index-lock'); setTimeout(() => loader?.remove(), 1250); }, {once:true});
  } else $('#loader')?.remove();

  function markNav() {
    const page = location.pathname.split('/').pop() || 'index.html';
    $$('header.nav nav a').forEach(a => {
      const href = (a.getAttribute('href') || '').split('#')[0];
      a.classList.toggle('active', href === page || (page === 'index.html' && href === '/'));
    });
  }
  function ensureStyles(doc) {
    doc.querySelectorAll('link[rel="stylesheet"]').forEach(link => {
      const href = new URL(link.getAttribute('href'), location.href).href;
      if (![...document.querySelectorAll('link[rel="stylesheet"]')].some(x => new URL(x.href, location.href).href === href)) {
        const n = document.createElement('link'); n.rel = 'stylesheet'; n.href = href; document.head.appendChild(n);
      }
    });
  }
  function initReveals(root = document) {
    const targets = $$('.section,.event-card,.drink-card,.owner,.gallery-grid,.menu-item,.cinematic-callout,.menu-v11-card,.rm17-section,.rm17-owner,.rm17-journal-card', root);
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver(entries => entries.forEach(entry => { if (entry.isIntersecting) { entry.target.classList.add('cinematic-reveal','is-visible'); io.unobserve(entry.target); } }), {threshold:.08});
      targets.forEach(el => { el.classList.add('cinematic-reveal'); io.observe(el); });
    } else targets.forEach(el => el.classList.add('is-visible'));
  }
  function initCountdowns(root = document) {
    $$('[data-countdown],[data-v17-countdown]', root).forEach(el => {
      if (el.dataset.countdownBound) return;
      el.dataset.countdownBound = '1';
      const raw = el.dataset.countdown || el.dataset.v17Countdown;
      const tick = () => {
        let d = Math.max(0, new Date(raw).getTime() - Date.now());
        const days = Math.floor(d/86400000); d%=86400000;
        const hours = Math.floor(d/3600000); d%=3600000;
        const mins = Math.floor(d/60000); d%=60000;
        const secs = Math.floor(d/1000);
        if (el.hasAttribute('data-v17-countdown')) {
          [['d',days],['h',hours],['m',mins],['s',secs]].forEach(([k,v]) => { const x=el.querySelector(`[data-c=${k}]`); if(x)x.textContent=String(v).padStart(2,'0'); });
        } else el.innerHTML=`<b>${String(days).padStart(2,'0')}</b><span>NAP</span><b>${String(hours).padStart(2,'0')}</b><span>ÓRA</span><b>${String(mins).padStart(2,'0')}</b><span>PERC</span><b>${String(secs).padStart(2,'0')}</b><span>MP</span>`;
      };
      tick(); setInterval(tick,1000);
    });
  }
  const transition = document.createElement('div');
  transition.id = 'pageTransition';
  transition.innerHTML = '<span></span><b>RED MOON</b>';
  document.body.appendChild(transition);
  requestAnimationFrame(() => transition.classList.add('ready'));

  async function spaNavigate(url, push = true) {
    try {
      saveTime();
      transition.classList.remove('ready'); transition.classList.add('leaving');
      const res = await fetch(url.href, {credentials:'same-origin', headers:{'X-Red-Moon-Navigation':'spa'}});
      if (!res.ok) throw new Error('navigation');
      const html = await res.text();
      const doc = new DOMParser().parseFromString(html,'text/html');
      const nextMain = doc.querySelector('main');
      if (!nextMain) throw new Error('main');
      ensureStyles(doc);
      document.body.className = doc.body.className;
      document.title = doc.title;
      $('main')?.replaceWith(nextMain);
      const nextFooter = doc.querySelector('footer'), currentFooter = $('footer');
      if (nextFooter && currentFooter) currentFooter.replaceWith(nextFooter);
      $('#loader')?.remove(); document.documentElement.classList.remove('rm-index-lock');
      if (push) history.pushState({rm:true},'',url.href);
      markNav(); initReveals(); initCountdowns(); window.RedMoonPageInit?.();
      if (url.hash) setTimeout(() => document.querySelector(url.hash)?.scrollIntoView({behavior:'smooth',block:'start'}),30);
      else scrollTo({top:0,behavior:'smooth'});
      setTimeout(() => { transition.classList.remove('leaving'); transition.classList.add('ready'); paintSound(); }, 80);
    } catch { location.href = url.href; }
  }
  document.addEventListener('click', e => {
    const menuItem = e.target.closest?.('.nav nav a, .hamb, .loader-enter, .rm17-btn, .btn-red');
    if(menuItem) playUiClick();
  });

  document.addEventListener('click', e => {
    const link = e.target.closest?.('a[href]'); if (!link) return;
    const href = link.getAttribute('href') || '';
    if (!href || href.startsWith('#') || link.target === '_blank' || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const url = new URL(link.href, location.href);
    if (url.origin !== location.origin || !/\.html?$/.test(url.pathname)) return;
    // Staff keeps a full page lifecycle for its authenticated app. Public navigation stays in-SPA.
    if (url.pathname.endsWith('/staff.html') || url.pathname.endsWith('/staff')) return;
    e.preventDefault(); spaNavigate(url,true);
  });
  addEventListener('popstate', () => spaNavigate(new URL(location.href),false));
  $('#hamb')?.addEventListener('click', () => $('header.nav nav')?.classList.toggle('open'));
  markNav(); initReveals(); initCountdowns(); paintSound();
  // Attempt autoplay only after the page UI is ready, so navigation can continue
  // from the exact saved timestamp whenever the browser allows audible playback.
  resumeSavedMusic();
})();
