(() => {
  const drinks = [
    {name:'Blood Moon', desc:'Gin · cherry · yuzu · citrus', price:'$18', image:'assets/menu/drinks/blood-moon.jpg', icon:'月'},
    {name:'Tokyo Afterdark', desc:'Whisky · plum · ginger · smoke', price:'$21', image:'assets/menu/drinks/tokyo-afterdark.jpg', icon:'赤'},
    {name:'Red Sake', desc:'Premium sake · lychee · rose', price:'$16', image:'assets/menu/drinks/red-sake.jpg', icon:'酒'},
    {name:'Neon Yuzu', desc:'Vodka · yuzu · tonic · citrus', price:'$17', image:'assets/menu/drinks/neon-yuzu.jpg', icon:'光'}
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
