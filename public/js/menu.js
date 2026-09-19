(() => {
  const fallback = [
    {name:"Kőbaltás", desc:"SeeCity RP · ITAL", price:1200, image:'assets/menu/drinks/kobaltas.png', icon:'月'},
    {name:"Barracho", desc:"SeeCity RP · Sör", price:1800, image:'assets/menu/drinks/barracho.png', icon:'月'},
    {name:"Sörnyitó", desc:"SeeCity RP · ITAL", price:2400, image:'assets/menu/drinks/sornyito.png', icon:'月'},
    {name:"Syrah vörösbor", desc:"SeeCity RP · ITAL", price:5000, image:'assets/menu/drinks/syrah.png', icon:'月'},
    {name:"Two Roosters rozé", desc:"SeeCity RP · ITAL", price:5600, image:'assets/menu/drinks/two_roosters.png', icon:'月'},
    {name:"Bleuter'D pezsgő", desc:"SeeCity RP · ITAL", price:4800, image:'assets/menu/drinks/bleuterd.png', icon:'月'},
    {name:"The Mount Bourbon Whiskey", desc:"SeeCity RP · ITAL", price:11200, image:'assets/menu/drinks/mount_bourbon.png', icon:'月'},
    {name:"Vinewood Sauvignon Blanc fehérbor", desc:"SeeCity RP · ITAL", price:5800, image:'assets/menu/drinks/vinewood.png', icon:'月'},
    {name:"Cherenkov Premium Vodka", desc:"SeeCity RP · ITAL", price:12600, image:'assets/menu/drinks/chernekov.png', icon:'月'},
    {name:"Cazafortunas Tequila", desc:"SeeCity RP · ITAL", price:12200, image:'assets/menu/drinks/cazafortunas.png', icon:'月'},
    {name:"Sinmisito Tequila", desc:"SeeCity RP · ITAL", price:15800, image:'assets/menu/drinks/sinmisito.png', icon:'月'},
    {name:"Ragga rum", desc:"SeeCity RP · ITAL", price:11200, image:'assets/menu/drinks/ragga.png', icon:'月'},
    {name:"Sprunk (dobozos)", desc:"SeeCity RP · ITAL", price:1780, image:'assets/menu/drinks/sprunk.png', icon:'月'},
    {name:"E-Cola (dobozos)", desc:"SeeCity RP · ITAL", price:1780, image:'assets/menu/drinks/ecola.png', icon:'月'},
    {name:"Rainé ásványvíz", desc:"SeeCity RP · ITAL", price:1600, image:'assets/menu/drinks/raine.png', icon:'水'}
  ];
  const money = n => Number(n||0).toLocaleString('hu-HU')+' Ft';
  const make = (item, i) => {
    const el=document.createElement('article'); el.className='menu-v11-card cinematic-reveal';
    el.innerHTML=`<div class="menu-photo"><img src="${item.image||''}" alt="${item.name}" loading="lazy" onerror="this.parentElement.classList.add('no-image')"><div class="photo-shade"></div><div class="photo-fallback"><span>${item.icon||'月'}</span><small>RED MOON ITAL</small></div><span class="menu-tag">SIGNATURE DRINK</span><span class="menu-num">${String(i+1).padStart(2,'0')}</span></div><div class="menu-copy"><div><h3>${item.name}</h3><p>${item.subtitle||item.desc||'Red Moon Pub · ITAL'}</p></div><strong>${money(item.price)}</strong></div>`;
    return el;
  };
  const grid=document.querySelector('#drinkGrid'); if(!grid)return;
  let last='';
  async function render(){
    let list=fallback;
    try{const r=await fetch('/api/public-products',{cache:'no-store'});if(r.ok){const d=await r.json();if(Array.isArray(d.products)&&d.products.length)list=d.products}}catch{}
    const sig=list.map(x=>`${x.id||x.name}:${x.price}`).join('|'); if(sig===last)return; last=sig;
    grid.innerHTML=''; list.forEach((x,i)=>grid.appendChild(make(x,i)));
  }
  render(); setInterval(render,2000);
})();
