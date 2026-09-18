(()=>{
const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
// cinematic cursor
let c=$('.cursor'),d=$('.cursor-dot'); if(c&&d){addEventListener('pointermove',e=>{c.style.left=e.clientX+'px';c.style.top=e.clientY+'px';d.style.left=e.clientX+'px';d.style.top=e.clientY+'px'})}
// countdowns
function tick(){const now=Date.now(); $$('[data-v17-countdown]').forEach(el=>{const t=Date.parse(el.dataset.v17Countdown), diff=Math.max(0,t-now); const vals=[Math.floor(diff/864e5),Math.floor(diff/36e5)%24,Math.floor(diff/6e4)%60,Math.floor(diff/1e3)%60]; ['d','h','m','s'].forEach((k,i)=>{const x=el.querySelector('[data-c='+k+']');if(x)x.textContent=String(vals[i]).padStart(2,'0')})})} tick(); setInterval(tick,1000);
// subtle mouse depth
const hero=$('.rm17-hero'); if(hero){hero.addEventListener('pointermove',e=>{const r=hero.getBoundingClientRect(),x=(e.clientX-r.left)/r.width-.5,y=(e.clientY-r.top)/r.height-.5; const moon=$('.rm17-moon'); if(moon) moon.style.transform=`translate(${x*18}px,${y*12}px)`; const media=$('.rm17-hero-media'); if(media) media.style.transform=`scale(1.06) translate(${x*-7}px,${y*-4}px)`}); hero.addEventListener('pointerleave',()=>{const moon=$('.rm17-moon'),media=$('.rm17-hero-media');if(moon)moon.style.transform='';if(media)media.style.transform=''})}
// reveal observer
const io='IntersectionObserver' in window?new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting)e.target.classList.add('v17-in')}),{threshold:.12}):null; $$('.v17-reveal').forEach(x=>io?.observe(x));
})();
/* V18.7 ticker controller: first pass enters from the right; then an exact-width,
   gapless two-copy loop runs forever. Letters fade individually at both viewport edges. */
(function(){
  const strip=document.querySelector('.rm17-strip');
  const track=document.querySelector('.rm17-strip-track');
  if(!strip || !track) return;

  const reduce=window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const copies=[...track.querySelectorAll('.rm18-copy')];
  if(copies.length<2) return;

  const allLetters=[...track.querySelectorAll('.rm-letter')];
  const firstLetters=[...copies[0].querySelectorAll('.rm-letter')];
  const edge=85;

  const setFade=()=>{
    const vw=document.documentElement.clientWidth;
    for(const el of allLetters){
      const r=el.getBoundingClientRect();
      let opacity=1;
      if(r.right <= 0 || r.left >= vw) opacity=0;
      else {
        const enter=Math.max(0,Math.min(1,r.right/edge));
        const leave=Math.max(0,Math.min(1,(vw-r.left)/edge));
        opacity=Math.min(enter,leave);
      }
      el.style.opacity=String(opacity);
    }
  };

  const measure=()=>Math.ceil(copies[0].getBoundingClientRect().width);
  let raf=0, intro=null, loop=null;

  const startLoop=()=>{
    if(loop) loop.cancel();
    const distance=measure();
    if(!distance) return;
    track.classList.remove('rm-ticker-intro');
    track.style.transform='translate3d(0,0,0)';
    const duration=Math.max(16000, distance*42);
    loop=track.animate(
      [{transform:'translate3d(0,0,0)'},{transform:`translate3d(${-distance}px,0,0)`}],
      {duration,easing:'linear',iterations:Infinity}
    );
  };

  const start=()=>{
    if(reduce){ setFade(); return; }
    const distance=measure();
    if(!distance) return;

    /* One complete first pass: the whole copy travels from the right edge
       through the viewport until it has cleared the left edge. */
    track.classList.add('rm-ticker-intro');
    const introDistance=window.innerWidth + distance;
    const introDuration=Math.max(6000, introDistance*26);

    intro=track.animate(
      [{transform:`translate3d(${window.innerWidth}px,0,0)`},
       {transform:`translate3d(${-distance}px,0,0)`}],
      {duration:introDuration,easing:'linear',fill:'forwards'}
    );

    intro.finished.then(()=>{
      startLoop();
    }).catch(()=>{});
  };

  const frame=()=>{
    setFade();
    raf=requestAnimationFrame(frame);
  };

  requestAnimationFrame(()=>{ start(); frame(); });

  let resizeTimer=0;
  addEventListener('resize',()=>{
    clearTimeout(resizeTimer);
    resizeTimer=setTimeout(()=>{
      if(intro) intro.cancel();
      if(loop) loop.cancel();
      start();
    },180);
  },{passive:true});
})();
