// ========================
// SITE.JS — Lógica compartida del sitio público
// Se carga en: index.html, catalogo.html, nosotros.html, contacto.html
// Cada función revisa si sus elementos existen antes de usarlos, así
// este mismo archivo funciona igual en cualquier página sin errores.
// ========================
import { supabase } from './supabase-client.js';

// ------------------------
// Utilidades de seguridad
// ------------------------
// Escapa HTML antes de insertar texto dinámico en el DOM (evita XSS
// almacenado si algún día un dato de producto contuviera código).
function escapeHTML(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ========================
// ESTADO GLOBAL (por página — no persiste entre páginas, solo el carrito)
// ========================
const DEFAULT_CATEGORIES = ['Microcontroladores','Sensores','Módulos IoT','Computación','Energía','Periféricos','Kits','Software'];

let products = [];
let cart = JSON.parse(localStorage.getItem('ig_cart') || '[]');
let categories = [...DEFAULT_CATEGORIES];
let siteSettings = {};
let currentModalProduct = null;
let activeFilter = 'Todos';

// ========================
// CARGA INICIAL DESDE SUPABASE (solo lectura en páginas públicas)
// ========================
async function refreshProducts() {
  const { data } = await supabase.from('products').select('*').order('name');
  products = data || [];
  renderFilterBar();
  renderProducts();
  renderHomeTeaser();
  updateCartUI();
}

async function initPublicData() {
  showLoadingScreen(true);
  try {
    const { data: settingsRow } = await supabase.from('config').select('value').eq('key', 'settings').maybeSingle();
    siteSettings = settingsRow ? settingsRow.value : { whatsapp: '', nombre: '', eslogan: '', subtitulo: '' };

    const { data: catsRow } = await supabase.from('config').select('value').eq('key', 'categories').maybeSingle();
    if (catsRow && catsRow.value && catsRow.value.list) categories = catsRow.value.list;

    const { data: prodRows } = await supabase.from('products').select('*').order('name');
    products = prodRows || [];

    supabase
      .channel('products-changes-public')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, refreshProducts)
      .subscribe();

    applySettingsToPage();
    updateWAFloat();
    renderFilterBar();
    renderProducts();
    renderHomeTeaser();
    updateCartUI();
  } catch (e) {
    console.error('Error cargando datos:', e);
    showToast('⚠ Error conectando a la base de datos.', 'error');
  }
  showLoadingScreen(false);
}

function showLoadingScreen(show) {
  const el = document.getElementById('loading-screen');
  if (el) el.style.display = show ? 'flex' : 'none';
}

// ========================
// AJUSTES DEL SITIO (nombre, eslogan, WhatsApp)
// ========================
function applySettingsToPage() {
  if (siteSettings.nombre) {
    const logo = document.getElementById('site-logo');
    if (logo) logo.innerHTML = escapeHTML(siteSettings.nombre.toUpperCase()).replace('/', ' <span>/</span> ');
    const flogo = document.getElementById('footer-logo');
    if (flogo) flogo.textContent = siteSettings.nombre.toUpperCase();
    const ftext = document.getElementById('footer-text');
    if (ftext) ftext.textContent = `© ${new Date().getFullYear()} ${siteSettings.nombre} · Fabricante de Tecnología · Guatemala`;
  }
  if (siteSettings.eslogan) {
    const lines = document.querySelectorAll('.hero-title .line1,.hero-title .line2,.hero-title .line3');
    if (lines.length) {
      const words = siteSettings.eslogan.toUpperCase().split(' ');
      if (lines[0]) lines[0].textContent = words.slice(0, Math.ceil(words.length/3)).join(' ');
      if (lines[1]) lines[1].textContent = words.slice(Math.ceil(words.length/3), Math.ceil(2*words.length/3)).join(' ');
      if (lines[2]) lines[2].textContent = words.slice(Math.ceil(2*words.length/3)).join(' ');
    }
  }
  if (siteSettings.subtitulo) {
    const sub = document.querySelector('.hero-sub');
    if (sub) sub.textContent = siteSettings.subtitulo;
  }
}

function getWANumber() {
  return (siteSettings && siteSettings.whatsapp) ? siteSettings.whatsapp.replace(/\D/g, '') : '';
}

function updateWAFloat() {
  const wa = document.getElementById('wa-float');
  if (!wa) return;
  const num = getWANumber();
  if (num) {
    wa.href = `https://wa.me/${num}`;
    wa.style.opacity = '1';
    wa.style.pointerEvents = 'auto';
  } else {
    wa.href = 'javascript:void(0)';
    wa.style.opacity = '0.3';
    wa.style.pointerEvents = 'none';
    wa.title = 'Configura tu WhatsApp en el panel admin';
  }
}

// ========================
// CATÁLOGO
// ========================
function getCategories() {
  return ['Todos', ...new Set([...categories, ...products.map(p => p.cat)])];
}

function renderFilterBar() {
  const bar = document.getElementById('filter-bar');
  if (!bar) return;
  bar.innerHTML = getCategories().map(c =>
    `<button class="filter-btn ${c === activeFilter ? 'active' : ''}" onclick="setFilter('${escapeHTML(c).replace(/'/g,"\\'")}')">${escapeHTML(c)}</button>`
  ).join('');
}

function setFilter(cat) {
  activeFilter = cat;
  renderFilterBar();
  renderProducts();
}

function getProductImageHTML(p, size = 64) {
  return p.image
    ? `<img src="${escapeHTML(p.image)}" alt="${escapeHTML(p.name)}" style="width:100%;height:100%;object-fit:cover;position:absolute;inset:0">`
    : `<span style="position:relative;z-index:1;font-size:${size}px;filter:drop-shadow(0 0 20px rgba(0,255,178,0.3))">${p.icon || '📦'}</span>`;
}

function productCardHTML(p) {
  const ag = p.status === 'agotado';
  const badge = p.badge
    ? `<span class="product-badge badge-${ag ? 'agotado' : p.badge}">${ag ? 'AGOTADO' : escapeHTML(p.badge.toUpperCase())}</span>`
    : (ag ? '<span class="product-badge badge-agotado">AGOTADO</span>' : '');
  const oldP = p.priceOld ? `<div class="product-price-old">Q${Number(p.priceOld).toLocaleString()}</div>` : '';
  const specs = p.specs?.length
    ? p.specs.slice(0, 3).map(s => `<div class="product-spec-row"><span class="spec-key">${escapeHTML(s.k)}</span><span class="spec-val">${escapeHTML(s.v)}</span></div>`).join('')
    : '';
  const sid = "'" + String(p.id).replace(/'/g, "\\'") + "'";
  return `<div class="product-card ${ag ? 'agotado' : ''}" style="cursor:pointer"><div class="product-hover-overlay"></div>
    <div class="product-img" onclick="openModal(${sid})"><div class="product-img-bg"></div>${badge}${getProductImageHTML(p, 64)}</div>
    <div class="product-body"><div class="product-cat">${escapeHTML(p.cat)}</div><div class="product-name" onclick="openModal(${sid})">${escapeHTML(p.name)}</div><div class="product-desc">${escapeHTML(p.desc || '')}</div>
    ${specs ? `<div class="product-specs">${specs}</div>` : ''}
    <div class="product-footer"><div>${oldP}<div class="product-price">Q${Number(p.price).toLocaleString()}</div></div>
    <button class="add-cart-btn" ${ag ? 'disabled' : ''} onclick="event.stopPropagation();addToCart(${sid})">${ag ? 'Agotado' : '+ Carrito'}</button></div></div></div>`;
}

function renderProducts() {
  const grid = document.getElementById('products-grid');
  if (!grid) return;
  const filtered = activeFilter === 'Todos' ? products : products.filter(p => p.cat === activeFilter);
  if (!filtered.length) {
    grid.innerHTML = '<div style="grid-column:1/-1;padding:80px;text-align:center;color:var(--muted);font-family:JetBrains Mono,monospace;font-size:12px;text-transform:uppercase;letter-spacing:0.15em">// No hay productos</div>';
    return;
  }
  grid.innerHTML = filtered.map(productCardHTML).join('');
}

// Muestra un pequeño adelanto de productos en la página de inicio
function renderHomeTeaser() {
  const grid = document.getElementById('home-products-grid');
  if (!grid) return;
  const teaser = [...products].sort((a, b) => (b.badge ? 1 : 0) - (a.badge ? 1 : 0)).slice(0, 3);
  if (!teaser.length) {
    grid.innerHTML = '<div style="grid-column:1/-1;padding:40px;text-align:center;color:var(--muted);font-family:JetBrains Mono,monospace;font-size:12px">// Catálogo próximamente</div>';
    return;
  }
  grid.innerHTML = teaser.map(productCardHTML).join('');
}

// ========================
// MODAL DE PRODUCTO
// ========================
function openModal(id) {
  const p = products.find(x => x.id === id);
  if (!p) return;
  currentModalProduct = p;
  const mi = document.getElementById('modal-img');
  const micon = document.getElementById('modal-icon');
  mi.querySelector('img.mpimg')?.remove();
  if (p.image) {
    const img = document.createElement('img');
    img.src = p.image; img.className = 'mpimg';
    img.style.cssText = 'width:100%;height:100%;object-fit:cover;position:absolute;inset:0';
    mi.appendChild(img); micon.textContent = '';
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
    ? p.specs.map(s => `<div class="modal-spec-row"><span style="color:var(--muted);font-family:'JetBrains Mono',monospace;font-size:11px">${escapeHTML(s.k)}</span><span style="font-family:'JetBrains Mono',monospace;font-size:12px">${escapeHTML(s.v)}</span></div>`).join('')
    : '';
  const btn = document.getElementById('modal-cart-btn');
  btn.disabled = p.status === 'agotado';
  btn.textContent = p.status === 'agotado' ? 'Agotado' : 'Agregar al carrito';
  document.getElementById('product-modal').classList.add('open');
}
function closeModal() { document.getElementById('product-modal').classList.remove('open'); }
function addFromModal() { if (currentModalProduct) addToCart(currentModalProduct.id); closeModal(); }

// ========================
// CARRITO
// ========================
function saveCartLocal() { localStorage.setItem('ig_cart', JSON.stringify(cart)); }

function addToCart(id) {
  const p = products.find(x => x.id === id);
  if (!p || p.status === 'agotado') return;
  const ex = cart.find(x => x.id === id);
  if (ex) ex.qty++; else cart.push({ id, qty: 1 });
  saveCartLocal(); updateCartUI();
  showToast(`✓ ${p.name} agregado`, 'success');
}
function removeFromCart(id) { cart = cart.filter(x => x.id !== id); saveCartLocal(); updateCartUI(); renderCartItems(); }
function changeQty(id, delta) {
  const item = cart.find(x => x.id === id);
  if (!item) return;
  item.qty += delta;
  if (item.qty <= 0) { removeFromCart(id); return; }
  saveCartLocal(); updateCartUI(); renderCartItems();
}
function updateCartUI() {
  const c = document.getElementById('cart-count');
  if (!c) return;
  const tot = cart.reduce((a, i) => a + i.qty, 0);
  c.textContent = tot; c.style.display = tot > 0 ? 'flex' : 'none';
  const tv = cart.reduce((a, i) => { const p = products.find(x => x.id === i.id); return a + (p ? p.price * i.qty : 0); }, 0);
  const tEl = document.getElementById('cart-total');
  if (tEl) tEl.textContent = `Q${tv.toLocaleString('es', { minimumFractionDigits: 2 })}`;
}
function renderCartItems() {
  const con = document.getElementById('cart-items-container');
  if (!con) return;
  if (!cart.length) { con.innerHTML = '<div class="cart-empty"><div class="empty-icon">🛒</div><p>Tu carrito está vacío</p></div>'; return; }
  con.innerHTML = cart.map(item => {
    const p = products.find(x => x.id === item.id);
    if (!p) return '';
    const ic = p.image ? `<img src="${escapeHTML(p.image)}" style="width:100%;height:100%;object-fit:cover">` : (p.icon || '📦');
    return `<div class="cart-item"><div class="cart-item-icon">${ic}</div><div class="cart-item-info"><div class="cart-item-name">${escapeHTML(p.name)}</div><div class="cart-item-price">Q${(p.price * item.qty).toLocaleString('es', { minimumFractionDigits: 2 })}</div><div class="cart-item-controls"><button class="qty-btn" onclick="changeQty('${p.id}',-1)">−</button><span class="qty-display">${item.qty}</span><button class="qty-btn" onclick="changeQty('${p.id}',1)">+</button><button class="remove-item" onclick="removeFromCart('${p.id}')">🗑</button></div></div></div>`;
  }).join('');
}
function openCart() { renderCartItems(); updateCartUI(); document.getElementById('cart-sidebar').classList.add('open'); document.getElementById('cart-overlay').classList.add('open'); }
function closeCart() { document.getElementById('cart-sidebar').classList.remove('open'); document.getElementById('cart-overlay').classList.remove('open'); }
function openCheckoutForm() { if (!cart.length) { showToast('⚠ Carrito vacío', 'error'); return; } closeCart(); document.getElementById('checkout-overlay').style.display = 'flex'; }
function closeCheckoutForm() { document.getElementById('checkout-overlay').style.display = 'none'; }

function buildWhatsAppOrderMsg(code, buyerName, buyerPhone, buyerAddress, buyerNotes, cartSnap, prodsSnap) {
  const items = cartSnap.map(item => {
    const p = prodsSnap.find(x => x.id === item.id);
    return p ? `• ${p.name} x${item.qty} — Q${(p.price * item.qty).toLocaleString('es', { minimumFractionDigits: 2 })}` : '';
  }).filter(Boolean).join('\n');
  const total = cartSnap.reduce((a, i) => { const p = prodsSnap.find(x => x.id === i.id); return a + (p ? p.price * i.qty : 0); }, 0);
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
  if (!name) { showToast('⚠ Ingresa tu nombre', 'error'); return; }
  const code = '#GRV-' + Math.floor(100000 + Math.random() * 900000);
  const cs = [...cart], ps = [...products];
  const items = cs.map(i => { const p = ps.find(x => x.id === i.id); return p ? { name: p.name, qty: i.qty, price: p.price } : null; }).filter(Boolean);
  const total = cs.reduce((a, i) => { const p = ps.find(x => x.id === i.id); return a + (p ? p.price * i.qty : 0); }, 0);
  try {
    const { error } = await supabase.from('orders').insert({
      code, date: new Date().toLocaleString('es'), buyer: name, phone, address: addr, notes, items, total, timestamp: Date.now()
    });
    if (error) throw error;
  } catch (e) {
    console.error('Error guardando pedido:', e);
    showToast('⚠ ' + (e.message || 'Error guardando pedido'), 'error');
  }
  const waMsg = buildWhatsAppOrderMsg(code, name, phone, addr, notes, cs, ps);
  const waNum = getWANumber();
  document.getElementById('order-code').textContent = code;
  document.getElementById('order-wa-link').href = waNum ? `https://wa.me/${waNum}?text=${waMsg}` : `https://wa.me/?text=${waMsg}`;
  cart = []; saveCartLocal(); updateCartUI(); renderCartItems(); closeCheckoutForm();
  document.getElementById('order-overlay').classList.add('open');
  ['buyer-name', 'buyer-phone', 'buyer-address', 'buyer-notes'].forEach(id => document.getElementById(id).value = '');
}
function closeOrder() { document.getElementById('order-overlay').classList.remove('open'); }

// ========================
// CONTACTO
// ========================
function submitContact() {
  const n = document.getElementById('contact-nombre').value.trim();
  const e = document.getElementById('contact-email').value.trim();
  if (!n || !e) { showToast('⚠ Completa nombre y email', 'error'); return; }
  const waNum = getWANumber();
  if (!waNum) { showToast('⚠ El WhatsApp de la tienda no está configurado', 'error'); return; }
  const msg = encodeURIComponent(`📨 *Consulta*\n\nNombre: ${n}\nEmail: ${e}\n\nMe interesa información sobre sus productos.`);
  window.open(`https://wa.me/${waNum}?text=${msg}`, '_blank', 'noopener,noreferrer');
  document.getElementById('contact-nombre').value = '';
  document.getElementById('contact-email').value = '';
  showToast('✓ Abriendo WhatsApp...', 'success');
}

// ========================
// UI: CURSOR, MENÚ MÓVIL, TOASTS, REVEAL, CONTADORES, CUBO 3D
// ========================
function toggleMobileMenu() { document.getElementById('mobile-menu')?.classList.toggle('open'); }
function closeMobileMenu() { document.getElementById('mobile-menu')?.classList.remove('open'); }

function showToast(msg, type = 'success') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const t = document.createElement('div');
  t.className = `toast toast-${type}`;
  t.textContent = msg;
  container.appendChild(t);
  setTimeout(() => t.remove(), 3500);
}

function initCursor() {
  const cur = document.getElementById('cursor');
  const trail = document.getElementById('cursor-trail');
  if (!cur || !trail) return;
  let mx = 0, my = 0, tx = 0, ty = 0;
  if (window.matchMedia('(pointer:fine)').matches) {
    document.addEventListener('mousemove', e => { mx = e.clientX; my = e.clientY; cur.style.left = (mx - 6) + 'px'; cur.style.top = (my - 6) + 'px'; });
    function animTrail() { tx += (mx - tx) * 0.12; ty += (my - ty) * 0.12; trail.style.left = (tx - 16) + 'px'; trail.style.top = (ty - 16) + 'px'; requestAnimationFrame(animTrail); }
    animTrail();
  }
}

function initReveal() {
  const obs = new IntersectionObserver(entries => entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('visible'); }), { threshold: 0.1 });
  document.querySelectorAll('.reveal').forEach(el => obs.observe(el));
}

function initCounters() {
  const c1 = document.getElementById('cnt1'), c2 = document.getElementById('cnt2'), c3 = document.getElementById('cnt3');
  if (!c1 && !c2 && !c3) return;
  function animCount(el, target) {
    if (!el) return;
    let s = 0; const i = target / 60;
    const t = setInterval(() => { s = Math.min(s + i, target); el.textContent = Math.floor(s).toLocaleString(); if (s >= target) clearInterval(t); }, 2000 / 60);
  }
  setTimeout(() => { animCount(c1, 3840); animCount(c2, 520); animCount(c3, 14); }, 800);
}

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

function highlightActiveNav() {
  const path = location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-links a[data-page], .mobile-menu a[data-page]').forEach(a => {
    a.classList.toggle('active', a.dataset.page === path);
  });
}

// ========================
// EXPONER FUNCIONES AL SCOPE GLOBAL (necesario por ser type="module")
// ========================
window.setFilter = setFilter;
window.openModal = openModal;
window.closeModal = closeModal;
window.addFromModal = addFromModal;
window.addToCart = addToCart;
window.removeFromCart = removeFromCart;
window.changeQty = changeQty;
window.openCart = openCart;
window.closeCart = closeCart;
window.openCheckoutForm = openCheckoutForm;
window.closeCheckoutForm = closeCheckoutForm;
window.checkout = checkout;
window.closeOrder = closeOrder;
window.submitContact = submitContact;
window.toggleMobileMenu = toggleMobileMenu;
window.closeMobileMenu = closeMobileMenu;

// ========================
// INIT
// ========================
document.getElementById('cart-overlay')?.addEventListener('click', closeCart);
document.getElementById('product-modal')?.addEventListener('click', function (e) { if (e.target === this) closeModal(); });
initCursor();
initReveal();
initCounters();
initHeroCube();
highlightActiveNav();
updateCartUI();
initPublicData();
