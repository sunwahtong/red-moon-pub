(()=>{
  'use strict';
  const selector=[
    '.hero h1','.page-hero h1','.rm17-page-hero h1','.menu-premium-hero h1','.location-intro h1',
    '.location-heading h1','.club-hero h1','.dj-top h1','.staff-head h1','.rm17-section h2',
    '.section h2','.menu-intro h2','.panel-head h2','.featured-bar h2','.event-banner h2',
    '.event-card h2','.story-copy h2','.rm17-story-copy h2','.dj-live-card h2',
    '.rm17-journal-card h3','.rm17-vip-card h3'
  ].join(',');
  const heads=[...document.querySelectorAll(selector)].filter(el=>!el.closest('.rm-signature-title'));
  heads.forEach(el=>{
    el.classList.add('rm52-heading');
    const on=()=>el.classList.add('rm52-active');
    const off=()=>el.classList.remove('rm52-active');
    el.addEventListener('pointerenter',on,{passive:true});
    el.addEventListener('pointerleave',off,{passive:true});
    el.addEventListener('focusin',on,{passive:true});
    el.addEventListener('focusout',off,{passive:true});
  });
})();
