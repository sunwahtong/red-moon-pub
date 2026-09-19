(()=>{'use strict';
const mk=(c='')=>{const e=document.createElement('div');e.className=c;return e};
const smoke=mk('rm-smoke-layer');const smoke2=mk('rm-smoke-layer two');document.body.append(smoke,smoke2);
const pill=mk('rm-status-pill');pill.innerHTML='<i></i><span>RED MOON IS OPEN</span>';document.body.append(pill);
let live=false;
function setStatus(s){live=!!s?.live;pill.classList.toggle('show',true);pill.classList.toggle('live',live);pill.querySelector('span').textContent=live?(s?.dj?.name?`● ${s.dj.name} IS LIVE`:'● RED MOON IS LIVE'):'RED MOON IS OPEN'}
async function sync(){try{const r=await fetch('/api/club/state',{cache:'no-store'});if(r.ok){const d=await r.json();setStatus(d.state)}}catch{}}
sync();setInterval(sync,8000);
try{const es=new EventSource('/api/club/events');es.onmessage=e=>{try{const d=JSON.parse(e.data);if(d.state)setStatus(d.state)}catch{}}}catch{}
// Gentle pointer light for premium panels, disabled on touch.
if(matchMedia('(pointer:fine)').matches){document.addEventListener('pointermove',e=>{document.documentElement.style.setProperty('--rm-mx',`${e.clientX}px`);document.documentElement.style.setProperty('--rm-my',`${e.clientY}px`)},{passive:true})}
})();