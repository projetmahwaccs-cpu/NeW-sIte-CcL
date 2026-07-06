/* ============================================================
   CCL — ccl-core.js
   Cœur partagé des sous-pages (catégories & partenaires).
   Panier et favoris synchronisés avec index.html via
   localStorage ('ccl_cart' / 'ccl_wishlist').
   ============================================================ */

/* ---------- Outils ---------- */
const $ = s => document.querySelector(s);
const money = n => n.toLocaleString('fr-FR') + ' FCFA';
const esc = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
function store(key, val){
  if(val === undefined){ try{ return JSON.parse(localStorage.getItem(key)); }catch(e){ return null; } }
  try{ localStorage.setItem(key, JSON.stringify(val)); }catch(e){}
}
function toast(msg, icon){
  let t = $('#toast');
  if(!t){ t = document.createElement('div'); t.id='toast'; t.setAttribute('role','status'); document.body.appendChild(t); }
  t.innerHTML = '<i class="ti ti-' + (icon||'check') + '"></i> ' + msg;
  t.classList.add('show');
  clearTimeout(window._tt);
  window._tt = setTimeout(()=>t.classList.remove('show'), 2600);
}
function imgErr(el){ el.style.display='none'; el.parentElement.classList.add('noimg'); }
const byId = id => products.find(p => p.id === Number(id));

/* ---------- Vendeurs : visibilité & label ---------- */
function sellerOf(p){ return (typeof SELLERS !== 'undefined' && p.seller) ? SELLERS.find(s => s.id === p.seller) : null; }
function sellerVisible(p){
  if(!p.seller) return true;
  const s = sellerOf(p);
  if(!s || s.active === false) return false;
  if(s.paidUntil){ const d = new Date(s.paidUntil + 'T23:59:59'); if(isFinite(d) && d < new Date()) return false; }
  return true;
}
function visibleProducts(){ return products.filter(sellerVisible); }

function isVid(src){ return /\.mp4($|\?)/i.test(src||''); }
function mediaHTML(p){
  const v = p.video || (isVid(p.image) ? p.image : null);
  if(v){
    const poster = (p.image && !isVid(p.image)) ? ' poster="' + esc(p.image) + '"' : '';
    return '<video src="' + esc(v) + '"' + poster + ' muted loop playsinline autoplay preload="metadata"></video><span class="vtag"><i class="ti ti-player-play-filled"></i> Vidéo</span>';
  }
  if(p.image) return '<img src="' + esc(p.image) + '" alt="' + esc(p.name) + '" loading="lazy" onerror="imgErr(this)">';
  return '';
}

/* ---------- Panier & favoris (synchronisés toutes pages) ---------- */
let cart = store('ccl_cart') || [];
let wish = store('ccl_wishlist') || [];
function saveCart(){ store('ccl_cart', cart); badges(); }
function saveWish(){ store('ccl_wishlist', wish); badges(); }
function cartCount(){ return cart.reduce((s,i)=>s+i.qty,0); }
function badges(){
  const c = String(cartCount()), f = String(wish.length);
  document.querySelectorAll('.bub-cart').forEach(e=>{ e.textContent=c; e.dataset.n=c; });
  document.querySelectorAll('.bub-fav').forEach(e=>{ e.textContent=f; e.dataset.n=f; });
}
function addToCart(id, qty, size, silent){
  const p = byId(id); if(!p) return;
  qty = qty || 1;
  const key = String(id) + '|' + (size||'');
  const line = cart.find(i => String(i.id)+'|'+(i.size||'') === key);
  if(line){ line.qty += qty; } else { cart.push({ id:p.id, name:p.name, price:p.price, image:p.image||'', qty:qty, size:size||null }); }
  saveCart();
  if(!silent) toast('Ajouté au panier — ' + esc(p.name), 'shopping-bag');
}
function toggleWish(id, btn){
  const i = wish.indexOf(id);
  if(i >= 0){ wish.splice(i,1); toast('Retiré des favoris','heart-off'); }
  else { wish.push(id); toast('Ajouté aux favoris','heart'); }
  saveWish();
  if(btn) btn.classList.toggle('on', wish.includes(id));
}
/* Sync inter-onglets */
window.addEventListener('storage', e => {
  if(e.key === 'ccl_cart' || e.key === 'ccl_wishlist'){
    cart = store('ccl_cart') || []; wish = store('ccl_wishlist') || []; badges();
  }
});

/* ---------- Cartes produit (fiche = index.html#/produit/ID) ---------- */
function badgeHTML(p){
  if(p.old){ const pct = Math.round((1 - p.price/p.old) * 100); return '<span class="ptag sale">-' + pct + '%</span>'; }
  if(p.badge === 'Nouveau') return '<span class="ptag new">Nouveau</span>';
  if(p.badge) return '<span class="ptag">' + esc(p.badge) + '</span>';
  return '';
}
function cardHTML(p){
  const inWish = wish.includes(p.id) ? ' on' : '';
  const media = mediaHTML(p);
  const price = p.old
    ? '<span class="sale">' + money(p.price) + '</span><s>' + money(p.old) + '</s>'
    : money(p.price);
  return '<article class="pcard rv" onclick="location.href=\'index.html#/produit/' + p.id + '\'">' +
    '<div class="pimg' + (media?'':' noimg') + '">' + badgeHTML(p) +
      '<button class="pfav' + inWish + '" onclick="event.stopPropagation(); toggleWish(' + p.id + ', this)" aria-label="Favoris"><i class="ti ti-heart"></i></button>' +
      media +
    '</div>' +
    '<div class="pinfo">' +
      '<span class="pcat">' + esc(CAT_LABEL[p.cat] || 'Boutique') + '</span>' +
      (sellerOf(p) ? '<span class="soldby"><i class="ti ti-building-store"></i> ' + esc(sellerOf(p).shop) + '</span>' : '') +
      '<h3 class="pname">' + esc(p.name) + '</h3>' +
      '<div class="pprice">' + price + '</div>' +
      '<button class="padd" onclick="event.stopPropagation(); addToCart(' + p.id + ')"><i class="ti ti-plus"></i> Ajouter au panier</button>' +
    '</div>' +
  '</article>';
}

/* ---------- Grille de la page (catégorie définie par window.PAGE_CAT) ---------- */
const pageState = { min:'', max:'', sort:'reco', limit:24 };
function pageList(){
  let list = visibleProducts().filter(p => Array.isArray(window.PAGE_CAT) ? window.PAGE_CAT.includes(p.cat) : p.cat === window.PAGE_CAT);
  const min = Number(pageState.min), max = Number(pageState.max);
  if(pageState.min !== '' && !isNaN(min)) list = list.filter(p => p.price >= min);
  if(pageState.max !== '' && !isNaN(max)) list = list.filter(p => p.price <= max);
  switch(pageState.sort){
    case 'price-asc': list.sort((a,b)=>a.price-b.price); break;
    case 'price-desc': list.sort((a,b)=>b.price-a.price); break;
    case 'name': list.sort((a,b)=>a.name.localeCompare(b.name,'fr')); break;
    case 'promo': list.sort((a,b)=>(b.old?1:0)-(a.old?1:0)); break;
  }
  return list;
}
function applyPageFilter(kind, val){
  if(kind==='sort') pageState.sort = val;
  if(kind==='price'){ pageState.min = ($('#fmin')||{}).value || ''; pageState.max = ($('#fmax')||{}).value || ''; pageState.limit = 24; }
  renderPage();
}
function renderPage(){
  const box = $('#page-results'); if(!box) return;
  const list = pageList();
  const count = $('#page-count'); if(count) count.textContent = list.length + ' produit' + (list.length>1?'s':'');
  const heroN = $('#hero-count'); if(heroN) heroN.textContent = list.length + ' produit' + (list.length>1?'s':'') + ' · Livraison J+1 à Dakar';
  if(list.length === 0){
    box.innerHTML = '<div class="empty"><i class="ti ti-mood-empty"></i>Aucun produit dans cette gamme de prix.</div>';
    return;
  }
  const shown = list.slice(0, pageState.limit);
  box.innerHTML = '<div class="pgrid">' + shown.map(cardHTML).join('') + '</div>' +
    (list.length > pageState.limit
      ? '<div class="loadmore"><button class="btn btn-line" onclick="pageState.limit += 24; renderPage();">Afficher plus (' + (list.length - pageState.limit) + ' restants)</button></div>'
      : '');
  observeReveals();
}

/* ---------- Révélation au scroll + header ---------- */
let io = null;
function observeReveals(){
  if(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if(!('IntersectionObserver' in window)) return;
  if(!io){
    io = new IntersectionObserver(entries => {
      entries.forEach(e => { if(e.isIntersecting){ e.target.classList.add('in'); io.unobserve(e.target); } });
    }, { rootMargin:'0px 0px -30px 0px', threshold:.05 });
  }
  document.querySelectorAll('.rv:not(.in)').forEach(el => io.observe(el));
}
let _tick = false;
window.addEventListener('scroll', () => {
  if(_tick) return; _tick = true;
  requestAnimationFrame(() => { document.body.classList.toggle('scrolled', (window.scrollY||0) > 10); _tick = false; });
}, { passive:true });

/* ---------- Démarrage ---------- */
document.addEventListener('DOMContentLoaded', () => {
  const y = document.getElementById('year'); if(y) y.textContent = new Date().getFullYear();
  const an = document.querySelector('.announce');
  if(an && typeof SHOP !== 'undefined' && SHOP.ANNOUNCE) an.innerHTML = '<i class="ti ti-truck-delivery"></i> ' + esc(SHOP.ANNOUNCE);
  badges();
  if(window.PAGE_CAT) renderPage();
  observeReveals();
});
