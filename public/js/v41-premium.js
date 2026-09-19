(()=>{
'use strict';
/* V41: universal cinematic atmosphere + safe global click feedback. */
function atmosphere(){
  if(document.querySelector('.rm-atmosphere')) return;
  const wrap=document.createElement('div');wrap.className='rm-atmosphere';wrap.setAttribute('aria-hidden','true');
  for(let i=1;i<=5;i++){const s=document.createElement('span');s.className='rm-smoke s'+i;wrap.appendChild(s)}
  document.body.prepend(wrap);
}
function clickSound(){
  let ready=false,src='assets/sounds/ui_click.wav';
  const prime=()=>{ready=true};
  document.addEventListener('pointerdown',prime,{once:true,passive:true});
  document.addEventListener('click',e=>{
    const el=e.target.closest('button,a,input[type=button],input[type=submit],select,[role="button"]');
    if(!el||el.disabled||el.dataset.noClickSound==='1')return;
    if(el.closest('[data-no-global-click]'))return;
    /* Existing specialist handlers own these interactions to avoid double sounds. */
    if(document.body.classList.contains('dj-page') && el.closest('#djApp,#djLoginView'))return;
    if(document.body.classList.contains('staff-page') && el.closest('#appView,#loginView'))return;
    if(!ready)return;
    try{const a=new Audio(src);a.volume=.20;a.play().catch(()=>{})}catch{}
  },{passive:true});
}
function navClose(){
  const b=document.getElementById('hamb'),n=document.querySelector('header.nav nav');
  if(!b||!n)return;
  b.addEventListener('click',()=>{n.classList.toggle('open');b.setAttribute('aria-expanded',n.classList.contains('open')?'true':'false')});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{atmosphere();clickSound();navClose()});
else{atmosphere();clickSound();navClose()}
})();
