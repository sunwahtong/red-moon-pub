(() => {
  const drinks = [
    {name:"Kőbaltás", desc:"SeeCity RP · ITAL", price:"1 200 Ft", image:'assets/menu/drinks/kobaltas.png', icon:'月'},
    {name:"Barracho", desc:"SeeCity RP · Sör", price:"1 800 Ft", image:'assets/menu/drinks/barracho.png', icon:'月'},
    {name:"Sörnyitó", desc:"SeeCity RP · ITAL", price:"2 400 Ft", image:'assets/menu/drinks/sornyito.png', icon:'月'},
    {name:"Syrah vörösbor", desc:"SeeCity RP · ITAL", price:"5 000 Ft", image:'assets/menu/drinks/syrah.png', icon:'月'},
    {name:"Two Roosters rozé", desc:"SeeCity RP · ITAL", price:"5 600 Ft", image:'assets/menu/drinks/two_roosters.png', icon:'月'},
    {name:"Bleuter'D pezsgő", desc:"SeeCity RP · ITAL", price:"4 800 Ft", image:'assets/menu/drinks/bleuterd.png', icon:'月'},
    {name:"The Mount Bourbon Whiskey", desc:"SeeCity RP · ITAL", price:"11 200 Ft", image:'assets/menu/drinks/mount_bourbon.png', icon:'月'},
    {name:"Vinewood Sauvignon Blanc fehérbor", desc:"SeeCity RP · ITAL", price:"5 800 Ft", image:'assets/menu/drinks/vinewood.png', icon:'月'},
    {name:"Cherenkov Premium Vodka", desc:"SeeCity RP · ITAL", price:"12 600 Ft", image:'assets/menu/drinks/chernekov.png', icon:'月'},
    {name:"Cazafortunas Tequila", desc:"SeeCity RP · ITAL", price:"12 200 Ft", image:'assets/menu/drinks/cazafortunas.png', icon:'月'},
    {name:"Sinmisito Tequila", desc:"SeeCity RP · ITAL", price:"15 800 Ft", image:'assets/menu/drinks/sinmisito.png', icon:'月'},
    {name:"Ragga rum", desc:"SeeCity RP · ITAL", price:"11 200 Ft", image:'assets/menu/drinks/ragga.png', icon:'月'},
    {name:"Sprunk (dobozos)", desc:"SeeCity RP · ITAL", price:"1 780 Ft", image:'assets/menu/drinks/sprunk.png', icon:'月'},
    {name:"E-Cola (dobozos)", desc:"SeeCity RP · ITAL", price:"1 780 Ft", image:'assets/menu/drinks/ecola.png', icon:'月'},
    {name:"Rainé ásványvíz", desc:'SeeCity RP · ITAL', price:'1 600 Ft', image:'assets/menu/drinks/raine.png', icon:'水'}
  ];
  const make = (item, kind, i) => {
    const el = document.createElement('article');
    el.className = 'menu-v11-card cinematic-reveal';
    el.innerHTML = `
      <div class="menu-photo">
        <img src="${item.image}" alt="${item.name}" loading="lazy" onerror="this.parentElement.classList.add('no-image')">
        <div class="photo-shade"></div>
        <div class="photo-fallback"><span>${item.icon}</span><small>RED MOON ${kind.toUpperCase()}</small></div>
        <span class="menu-tag">${kind === 'drink' ? 'SIGNATURE DRINK' : 'HOUSE FOOD'}</span>
        <span class="menu-num">${String(i+1).padStart(2,'0')}</span>
      </div>
      <div class="menu-copy"><div><h3>${item.name}</h3><p>${item.desc}</p></div><strong>${item.price}</strong></div>`;
    return el;
  };
  const drinkGrid = document.querySelector('#drinkGrid');
  drinks.forEach((x,i) => drinkGrid?.appendChild(make(x,'drink',i)));
})();
