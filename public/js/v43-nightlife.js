(()=>{'use strict';
const mk=(c='')=>{const e=document.createElement('div');e.className=c;return e};
const smoke=mk('rm-smoke-layer');const smoke2=mk('rm-smoke-layer two');document.body.append(smoke,smoke2);
const pill=mk('rm-status-pill');pill.innerHTML='<i aria-hidden="true"></i><div class="rm-status-copy"><b>RED MOON / STATUS</b><span>Zárva</span></div><em>LIVE</em>';pill.setAttribute('aria-label','Red Moon Állapot');document.body.append(pill);
let live=false;
function setOpen(open){pill.classList.add('show');pill.classList.toggle('open',!!open);pill.classList.toggle('closed',!open);pill.querySelector('.rm-status-copy span').textContent=open?'Nyitva':'Zárva';pill.querySelector('em').textContent=open?'OPEN':'CLOSED'}
async function sync(){try{const r=await fetch('/api/public/status',{cache:'no-store'});if(r.ok){const d=await r.json();setOpen(!!d.open)}}catch{}}
sync();setInterval(sync,5000);
try{const es=new EventSource('/api/events');es.onmessage=()=>sync()}catch{}
try{const es=new EventSource('/api/club/events');es.onmessage=e=>{try{const d=JSON.parse(e.data);if(d.state)setStatus(d.state)}catch{}}}catch{}
// Gentle pointer light for premium panels, disabled on touch.
if(matchMedia('(pointer:fine)').matches){document.addEventListener('pointermove',e=>{document.documentElement.style.setProperty('--rm-mx',`${e.clientX}px`);document.documentElement.style.setProperty('--rm-my',`${e.clientY}px`)},{passive:true})}
})();