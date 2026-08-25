import { supabase, escapeHtml, getCartLocal, saveCartLocal, getWANumber, updateCartBadge } from './supabase-client.js';
import { showToast } from './main.js';

let products = [];
let categories = [];
let siteSettings = {};
let cart = getCartLocal();
let activeFilter = 'Todos';
let currentModalProduct = null;

// ========================
// CARGA DE DATOS (solo lectura)
// ========================
async function loadCatalogData() {
  const [{ data: settingsRow }, { data: catsRow }, { data: prodRows }] = await Promise.all([
    supabase.from('config').select('value').eq('key', 'settings').maybeSingle(),
    supabase.from('config').select('value').eq('key', 'categories').maybeSingle(),
    supabase.from('products').select('*').order('name'),
  ]);
  siteSettings = settingsRow?.value || {};
  categories = catsRow?.value?.list || [];
  products = prodRows || [];
}

function getCategories() {
  return ['Todos', ...new Set([...categories, ...products.map(p => p.cat)])];
}

// ========================
// RENDER — CATÁLOGO COMPLETO (tienda.html)
// ========================
function renderFilterBar() {
  const bar = document.getElementById('filter-bar');
  if (!bar) return;
  bar.innerHTML = getCategories().map(c =>
    `<button class="filter-btn ${c === activeFilter ? 'active' : ''}" data-cat="${escapeHtml(c)}">${escapeHtml(c)}</button>`
  ).join('');
  bar.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => setFilter(btn.dataset.cat));
  });
}

function setFilter(cat) {
  activeFilter = cat;
  renderFilterBar();
  renderProducts();
}

function getProductImageHTML(p, size = 64) {
  return p.image
    ? `<img src="${escapeHtml(p.image)}" alt="${escapeHtml(p.name)}" style="width:100%;height:100%;object-fit:cover;position:absolute;inset:0">`
    : `<span style="position:relative;z-index:1;font-size:${size}px;filter:drop-shadow(0 0 20px rgba(0,255,178,0.3))">${escapeHtml(p.icon || '📦')}</span>`;
}

function renderProducts() {
  const grid = document.getElementById('products-grid');
  if (!grid) return;
  const filtered = activeFilter === 'Todos' ? products : products.filter(p => p.cat === activeFilter);
  if (!filtered.length) {
    grid.innerHTML = '<div style="grid-column:1/-1;padding:80px;text-align:center;color:var(--muted);font-family:JetBrains Mono,monospace;font-size:12px;text-transform:uppercase;letter-spacing:0.15em">// No hay productos</div>';
    return;
  }
  grid.innerHTML = filtered.map(p => {
    const ag = p.status === 'agotado';
    const badge = p.badge
      ? `<span class="product-badge badge-${ag ? 'agotado' : p.badge}">${ag ? 'AGOTADO' : escapeHtml(p.badge.toUpperCase())}</span>`
      : (ag ? '<span class="product-badge badge-agotado">AGOTADO</span>' : '');
    const oldP = p.priceOld ? `<div class="product-price-old">Q${Number(p.priceOld).toLocaleString()}</div>` : '';
    const specs = p.specs?.length
      ? p.specs.slice(0, 3).map(s => `<div class="product-spec-row"><span class="spec-key">${escapeHtml(s.k)}</span><span class="spec-val">${escapeHtml(s.v)}</span></div>`).join('')
      : '';
    const id = escapeHtml(p.id);
    return `<div class="product-card ${ag ? 'agotado' : ''}" style="cursor:pointer"><div class="product-hover-overlay"></div>
      <div class="product-img" data-open="${id}"><div class="product-img-bg"></div>${badge}${getProductImageHTML(p, 64)}</div>
      <div class="product-body"><div class="product-cat">${escapeHtml(p.cat)}</div><div class="product-name" data-open="${id}">${escapeHtml(p.name)}</div><div class="product-desc">${escapeHtml(p.desc || '')}</div>
      ${specs ? `<div class="product-specs">${specs}</div>` : ''}
      <div class="product-footer"><div>${oldP}<div class="product-price">Q${Number(p.price).toLocaleString()}</div></div>
      <button class="add-cart-btn" ${ag ? 'disabled' : ''} data-add="${id}">${ag ? 'Agotado' : '+ Carrito'}</button></div></div></div>`;
  }).join('');

  grid.querySelectorAll('[data-open]').forEach(el => el.addEventListener('click', () => openModal(el.dataset.open)));
  grid.querySelectorAll('[data-add]').forEach(el => el.addEventListener('click', e => { e.stopPropagation(); addToCart(el.dataset.add); }));
}

// ========================
// RENDER — TEASER (index.html, solo destacados)
// ========================
function renderTeaser(limit = 3) {
  const grid = document.getElementById('teaser-grid');
  if (!grid) return;
  const featured = products.filter(p => p.status !== 'agotado').slice(0, limit);
  grid.innerHTML = featured.map(p => {
    const id = escapeHtml(p.id);
    return `<div class="product-card" style="cursor:pointer">
      <div class="product-img"><div class="product-img-bg"></div>${getProductImageHTML(p, 56)}</div>
      <div class="product-body"><div class="product-cat">${escapeHtml(p.cat)}</div><div class="product-name">${escapeHtml(p.name)}</div>
      <div class="product-footer"><div class="product-price">Q${Number(p.price).toLocaleString()}</div>
      <a class="add-cart-btn" href="tienda.html" style="text-decoration:none;display:inline-block;text-align:center">Ver en tienda</a></div></div></div>`;
  }).join('');
}

// ========================
// MODAL DE PRODUCTO
// ========================
function openModal(id) {
  const p = products.find(x => String(x.id) === String(id));
  if (!p) return;
  currentModalProduct = p;
  const mi = document.getElementById('modal-img');
  const micon = document.getElementById('modal-icon');
  mi.querySelector('img.mpimg')?.remove();
  if (p.image) {
    const img = document.createElement('img');
    img.src = p.image; img.className = 'mpimg';
    img.style.cssText = 'width:100%;height:100%;object-fit:cover;position:absolute;inset:0';
    mi.appendChild(img);
    micon.textContent = '';
  } else {
    micon.textContent = p.icon || '📦';
  }
  document.getElementById('modal-cat').textContent = p.cat;
  document.getElementById('modal-name').textContent = p.name;
  document.getElementById('modal-desc').textContent = p.desc || 'Sin descripción.';
  document.getElementById('modal-price').textContent = `Q${Number(p.price).toLocaleString()}`;
  const oldEl = document.getElementById('modal-old-price');
  if (p.priceOld) { oldEl.textContent = `Q${Number(p.priceOld).toLocaleString()}`; oldEl.style.display = 'block'; }
  else { oldEl.style.display = 'none'; }
  document.getElementById('modal-specs').innerHTML = p.specs?.length
    ? p.specs.map(s => `<div class="modal-spec-row"><span style="color:var(--muted);font-family:'JetBrains Mono',monospace;font-size:11px">${escapeHtml(s.k)}</span><span style="font-family:'JetBrains Mono',monospace;font-size:12px">${escapeHtml(s.v)}</span></div>`).join('')
    : '';
  const btn = document.getElementById('modal-cart-btn');
  btn.disabled = p.status === 'agotado';
  btn.textContent = p.status === 'agotado' ? 'Agotado' : 'Agregar al carrito';
  document.getElementById('product-modal').classList.add('open');
}
function closeModal() { document.getElementById('product-modal')?.classList.remove('open'); }
function addFromModal() { if (currentModalProduct) addToCart(currentModalProduct.id); closeModal(); }

// ========================
// CARRITO
// ========================
function addToCart(id) {
  const p = products.find(x => String(x.id) === String(id));
  if (!p || p.status === 'agotado') return;
  const ex = cart.find(x => x.id === id);
  if (ex) ex.qty++; else cart.push({ id, qty: 1 });
  saveCartLocal(cart);
  updateCartBadge();
  showToast(`✓ ${p.name} agregado`, 'success');
}
function removeFromCart(id) {
  cart = cart.filter(x => x.id !== id);
  saveCartLocal(cart);
  updateCartBadge();
  renderCartItems();
}
function changeQty(id, delta) {
  const item = cart.find(x => x.id === id);
  if (!item) return;
  item.qty += delta;
  if (item.qty <= 0) { removeFromCart(id); return; }
  saveCartLocal(cart);
  updateCartBadge();
  renderCartItems();
}
function cartTotal() {
  return cart.reduce((a, i) => {
    const p = products.find(x => String(x.id) === String(i.id));
    return a + (p ? p.price * i.qty : 0);
  }, 0);
}
function renderCartItems() {
  const con = document.getElementById('cart-items-container');
  if (!con) return;
  document.getElementById('cart-total').textContent = `Q${cartTotal().toLocaleString('es', { minimumFractionDigits: 2 })}`;
  if (!cart.length) {
    con.innerHTML = '<div class="cart-empty"><div class="empty-icon">🛒</div><p>Tu carrito está vacío</p></div>';
    return;
  }
  con.innerHTML = cart.map(item => {
    const p = products.find(x => String(x.id) === String(item.id));
    if (!p) return '';
    const ic = p.image ? `<img src="${escapeHtml(p.image)}" style="width:100%;height:100%;object-fit:cover">` : escapeHtml(p.icon || '📦');
    const id = escapeHtml(p.id);
    return `<div class="cart-item"><div class="cart-item-icon">${ic}</div><div class="cart-item-info">
      <div class="cart-item-name">${escapeHtml(p.name)}</div>
      <div class="cart-item-price">Q${(p.price * item.qty).toLocaleString('es', { minimumFractionDigits: 2 })}</div>
      <div class="cart-item-controls">
        <button class="qty-btn" data-qty-down="${id}">−</button>
        <span class="qty-display">${item.qty}</span>
        <button class="qty-btn" data-qty-up="${id}">+</button>
        <button class="remove-item" data-remove="${id}">🗑</button>
      </div></div></div>`;
  }).join('');
  con.querySelectorAll('[data-qty-down]').forEach(el => el.addEventListener('click', () => changeQty(el.dataset.qtyDown, -1)));
  con.querySelectorAll('[data-qty-up]').forEach(el => el.addEventListener('click', () => changeQty(el.dataset.qtyUp, 1)));
  con.querySelectorAll('[data-remove]').forEach(el => el.addEventListener('click', () => removeFromCart(el.dataset.remove)));
}
function openCart() {
  renderCartItems();
  document.getElementById('cart-sidebar')?.classList.add('open');
  document.getElementById('cart-overlay')?.classList.add('open');
}
function closeCart() {
  document.getElementById('cart-sidebar')?.classList.remove('open');
  document.getElementById('cart-overlay')?.classList.remove('open');
}
function openCheckoutForm() {
  if (!cart.length) { showToast('⚠ Carrito vacío', 'error'); return; }
  closeCart();
  document.getElementById('checkout-overlay').style.display = 'flex';
}
function closeCheckoutForm() { document.getElementById('checkout-overlay').style.display = 'none'; }

function buildWhatsAppOrderMsg(code, buyerName, buyerPhone, buyerAddress, buyerNotes, cartSnap, prodsSnap) {
  const items = cartSnap.map(item => {
    const p = prodsSnap.find(x => String(x.id) === String(item.id));
    return p ? `• ${p.name} x${item.qty} — Q${(p.price * item.qty).toLocaleString('es', { minimumFractionDigits: 2 })}` : '';
  }).filter(Boolean).join('\n');
  const total = cartSnap.reduce((a, i) => {
    const p = prodsSnap.find(x => String(x.id) === String(i.id));
    return a + (p ? p.price * i.qty : 0);
  }, 0);
  let msg = `🛒 *NUEVO PEDIDO ${code}*\n━━━━━━━━━━━━━━\n`;
  msg += `👤 *Cliente:* ${buyerName}\n`;
  if (buyerPhone) msg += `📞 *Tel:* ${buyerPhone}\n`;
  if (buyerAddress) msg += `📍 *Dirección:* ${buyerAddress}\n`;
  msg += `━━━━━━━━━━━━━━\n*Productos:*\n${items}\n━━━━━━━━━━━━━━\n`;
  msg += `💰 *TOTAL: Q${total.toLocaleString('es', { minimumFractionDigits: 2 })}*\n`;
  if (buyerNotes) msg += `\n📝 *Notas:* ${buyerNotes}\n`;
  msg += `\n_Pedido desde la tienda online_`;
  return encodeURIComponent(msg);
}

async function checkout() {
  const name = document.getElementById('buyer-name').value.trim();
  const phone = document.getElementById('buyer-phone').value.trim();
  const addr = document.getElementById('buyer-address').value.trim();
  const notes = document.getElementById('buyer-notes').value.trim();
  // Honeypot anti-bot: si este campo oculto viene lleno, es un bot — se ignora en silencio.
  if (document.getElementById('buyer-hp')?.value) return;
  if (!name) { showToast('⚠ Ingresa tu nombre', 'error'); return; }

  const code = '#GRV-' + Math.floor(100000 + Math.random() * 900000);
  const cs = [...cart], ps = [...products];
  const items = cs.map(i => {
    const p = ps.find(x => String(x.id) === String(i.id));
    return p ? { name: p.name, qty: i.qty, price: p.price } : null;
  }).filter(Boolean);
  const total = cartTotal();

  try {
    const { error } = await supabase.from('orders').insert({
      code, date: new Date().toLocaleString('es'), buyer: name, phone, address: addr, notes, items, total, timestamp: Date.now(),
    });
    if (error) throw error;
  } catch (e) {
    console.error('Error guardando pedido:', e);
    showToast('⚠ ' + (e.message || 'Error guardando pedido'), 'error');
  }

  const waMsg = buildWhatsAppOrderMsg(code, name, phone, addr, notes, cs, ps);
  const waNum = getWANumber(siteSettings);
  document.getElementById('order-code').textContent = code;
  document.getElementById('order-wa-link').href = waNum ? `https://wa.me/${waNum}?text=${waMsg}` : `https://wa.me/?text=${waMsg}`;
  cart = []; saveCartLocal(cart); updateCartBadge(); renderCartItems(); closeCheckoutForm();
  document.getElementById('order-overlay').classList.add('open');
  ['buyer-name', 'buyer-phone', 'buyer-address', 'buyer-notes'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
}
function closeOrder() { document.getElementById('order-overlay')?.classList.remove('open'); }

// ========================
// EXPONER AL SCOPE GLOBAL (para atributos onclick restantes en el HTML)
// ========================
window.openCart = openCart;
window.closeCart = closeCart;
window.openCheckoutForm = openCheckoutForm;
window.closeCheckoutForm = closeCheckoutForm;
window.checkout = checkout;
window.closeModal = closeModal;
window.addFromModal = addFromModal;
window.closeOrder = closeOrder;

// ========================
// COUNTERS (solo en index.html)
// ========================
function animCount(el, target) {
  if (!el) return;
  let s = 0; const i = target / 60;
  const t = setInterval(() => { s = Math.min(s + i, target); el.textContent = Math.floor(s).toLocaleString(); if (s >= target) clearInterval(t); }, 2000 / 60);
}

// ========================
// CUBO 3D (solo si existe el canvas en la página)
// ========================
function initHeroCube() {
  const canvas = document.getElementById('heroCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d'); canvas.width = 380; canvas.height = 380;
  const cx = 190, cy = 190, size = 90; let angle = 0;
  const verts = [[-1,-1,-1],[1,-1,-1],[1,1,-1],[-1,1,-1],[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]].map(v => v.map(c => c * size));
  const edges = [[0,1],[1,2],[2,3],[3,0],[4,5],[5,6],[6,7],[7,4],[0,4],[1,5],[2,6],[3,7]];
  function project([x, y, z]) { const f = 400, d = f / (f - z * 0.5); return [cx + x * d, cy + y * d]; }
  function rotX(v, a) { const [x, y, z] = v; return [x, y * Math.cos(a) - z * Math.sin(a), y * Math.sin(a) + z * Math.cos(a)]; }
  function rotY(v, a) { const [x, y, z] = v; return [x * Math.cos(a) + z * Math.sin(a), y, -x * Math.sin(a) + z * Math.cos(a)]; }
  function drawCube() {
    ctx.clearRect(0, 0, 380, 380);
    const rotated = verts.map(v => rotY(rotX(v, angle * 0.4), angle));
    ctx.shadowBlur = 20; ctx.shadowColor = '#00FFB2';
    edges.forEach(([i, j]) => {
      const [x1, y1] = project(rotated[i]); const [x2, y2] = project(rotated[j]);
      const g = ctx.createLinearGradient(x1, y1, x2, y2);
      g.addColorStop(0, 'rgba(0,255,178,0.8)'); g.addColorStop(1, 'rgba(61,142,255,0.4)');
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.strokeStyle = g; ctx.lineWidth = 1.5; ctx.stroke();
    });
    ctx.shadowBlur = 0; angle += 0.008; requestAnimationFrame(drawCube);
  }
  drawCube();
}

// ========================
// INICIALIZACIÓN
// ========================
async function initStorePage() {
  const loading = document.getElementById('loading-screen');
  if (loading) loading.style.display = 'flex';
  try {
    await loadCatalogData();
    renderFilterBar();
    renderProducts();
    renderTeaser();
    renderCartItems();

    // Tiempo real: refrescar catálogo si el admin hace cambios
    supabase.channel('products-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, async () => {
        await loadCatalogData(); renderFilterBar(); renderProducts(); renderTeaser();
      }).subscribe();
  } catch (e) {
    console.error('Error cargando catálogo:', e);
    showToast('⚠ Error conectando con la base de datos', 'error');
  }
  if (loading) loading.style.display = 'none';

  animCount(document.getElementById('cnt1'), 3840);
  animCount(document.getElementById('cnt2'), 520);
  animCount(document.getElementById('cnt3'), 14);
  initHeroCube();
}

document.addEventListener('DOMContentLoaded', initStorePage);
