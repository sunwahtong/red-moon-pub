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