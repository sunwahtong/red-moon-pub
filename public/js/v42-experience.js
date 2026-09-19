(()=>{'use strict';
function addAtmosphere(){
 const a=document.querySelector('.rm-atmosphere'); if(!a)return;
 if(!a.querySelector('.rm42-orb')){const o=document.createElement('span');o.className='rm42-orb';a.appendChild(o)}
}
function pointerGlow(){
 if(matchMedia('(pointer:fine)').matches===false)return;
 const g=document.createElement('div');g.className='rm42-pointer';document.body.appendChild(g);
 let x=innerWidth*.5,y=innerHeight*.3,tx=x,ty=y;
 addEventListener('pointermove',e=>{tx=e.clientX;ty=e.clientY},{passive:true});
 const tick=()=>{x+=(tx-x)*.08;y+=(ty-y)*.08;g.style.transform=`translate3d(${x}px,${y}px,0)`;requestAnimationFrame(tick)};tick();
}
function activeNav(){const path=location.pathname.split('/').pop()||'index.html';document.querySelectorAll('header.nav nav a').forEach(a=>{const href=(a.getAttribute('href')||'').split('?')[0];if(href===path)a.classList.add('rm42-active')})}
function ready(){addAtmosphere();activeNav();document.body.classList.add('rm42-ready');pointerGlow()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ready);else ready();
})();
