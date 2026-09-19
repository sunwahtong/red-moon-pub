(()=>{
  'use strict';
  const title=document.querySelector('.rm-signature-title');
  if(!title)return;
  const letters=[...title.querySelectorAll('.rm-signature-moon i')];
  letters.forEach(l=>l.dataset.letter=l.textContent.trim());

  const flash=()=>{
    title.classList.remove('rm-flash');
    void title.offsetWidth;
    title.classList.add('rm-flash');
    window.setTimeout(()=>title.classList.remove('rm-flash'),780);
  };
  title.addEventListener('pointerenter',flash,{passive:true});
  title.addEventListener('focusin',flash,{passive:true});

  if(matchMedia('(pointer:fine)').matches){
    let raf=0,x=0,y=0;
    const move=e=>{
      x=e.clientX;y=e.clientY;
      if(!raf)raf=requestAnimationFrame(()=>{
        raf=0;
        const r=title.getBoundingClientRect();
        if(r.bottom<0||r.top>innerHeight)return;
        const px=Math.max(-1,Math.min(1,(x-(r.left+r.width/2))/Math.max(1,r.width)));
        const py=Math.max(-1,Math.min(1,(y-(r.top+r.height/2))/Math.max(1,r.height)));
        title.style.setProperty('--rm-mx',(px*10).toFixed(2)+'px');
        title.style.setProperty('--rm-my',(py*5).toFixed(2)+'px');
        letters.forEach((l,i)=>{
          const dx=px*(i%2?4:7),dy=py*(i%2?2:3);
          l.style.transform=`translate(${dx}px,${dy}px)`;
        });
      });
    };
    addEventListener('pointermove',move,{passive:true});
    addEventListener('pointerleave',()=>letters.forEach((l,i)=>{l.style.transform='';}),{passive:true});
  }
})();
