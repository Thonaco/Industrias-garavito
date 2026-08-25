import { supabase, escapeHtml } from './supabase-client.js';

// ========================
// SEGURIDAD — INICIO DE SESIÓN REAL (Supabase Auth)
// ========================
// Antes, el panel usaba una contraseña fija escrita en el propio código
// (visible para cualquiera que abriera "Ver código fuente"), y esa
// contraseña SOLO ocultaba o mostraba el panel — no protegía la base de
// datos: cualquiera podía abrir la consola del navegador y borrar
// productos directamente. Ahora el login usa Supabase Auth, y los permisos
// reales de escritura los aplica la base de datos con Row Level Security
// (ver /sql/security_setup.sql). Sin haber iniciado sesión con una cuenta
// autorizada, Supabase rechaza cualquier intento de guardar/borrar datos,
// sin importar lo que alguien intente desde la consola.

let products = [];
let categories = [];
let orders = [];
let siteSettings = {};
let editingId = null;
let currentImageData = null;

const DEFAULT_CATEGORIES = ['Microcontroladores','Sensores','Módulos IoT','Computación','Energía','Periféricos','Kits','Software'];
const DEFAULT_PRODUCTS = [
  {name:'NanoCore X1',cat:'Microcontroladores',desc:'Microcontrolador de 32 bits para aplicaciones IoT industriales.',price:249,priceOld:320,status:'activo',badge:'destacado',icon:'🔧',image:null,specs:[{k:'CPU',v:'Xtensa LX7 240MHz'},{k:'RAM',v:'512KB SRAM'},{k:'Flash',v:'8MB'},{k:'Conectividad',v:'Wi-Fi 6 + BT 5.0'}]},
  {name:'SensorHub Pro',cat:'Sensores',desc:'Hub de sensores multiprotocolo: temperatura, humedad, presión y más.',price:189,priceOld:null,status:'activo',badge:'nuevo',icon:'📡',image:null,specs:[{k:'Sensores',v:'6 en 1'},{k:'Precisión temp.',v:'±0.1°C'},{k:'Interfaz',v:'I2C / SPI / UART'},{k:'Consumo',v:'2.1mA activo'}]},
  {name:'PicoEdge V2',cat:'Computación',desc:'Módulo de computación en el borde para inferencia de IA local.',price:890,priceOld:1100,status:'activo',badge:'oferta',icon:'💻',image:null,specs:[{k:'NPU',v:'1 TOPS'},{k:'CPU',v:'Quad-core A53'},{k:'RAM',v:'4GB LPDDR4'},{k:'OS',v:'Linux / RTOS'}]},
  {name:'PowerCell GT',cat:'Energía',desc:'Módulo de gestión de energía con carga solar integrada.',price:145,priceOld:null,status:'activo',badge:'',icon:'⚡',image:null,specs:[{k:'Entrada solar',v:'5-30V MPPT'},{k:'Salida',v:'3.3V / 5V / 12V'},{k:'Batt.',v:'LiPo / LiFePO4'},{k:'Eficiencia',v:'95%'}]},
  {name:'MeshLink 900',cat:'Módulos IoT',desc:'Módulo de radio LoRa para redes mesh de largo alcance.',price:320,priceOld:null,status:'agotado',badge:'',icon:'📶',image:null,specs:[{k:'Frecuencia',v:'915MHz ISM'},{k:'Alcance',v:'Hasta 15km'},{k:'Cifrado',v:'AES-256'},{k:'Protocolo',v:'LoRaWAN 1.1'}]},
  {name:'DevKit Starter',cat:'Kits',desc:'Kit completo para comenzar con electrónica embebida.',price:499,priceOld:650,status:'activo',badge:'nuevo',icon:'🎒',image:null,specs:[{k:'Incluye',v:'NanoCore X1'},{k:'Sensores',v:'Temperatura, luz, IR'},{k:'Extras',v:'Protoboard + 40 cables'},{k:'Guías',v:'PDF + Video tutoriales'}]},
];

const loginCard = document.getElementById('admin-login-card');
const panel = document.getElementById('admin-panel-content');

async function checkSession() {
  const { data: { session } } = await supabase.auth.getSession();
  if (session) {
    showPanel(session.user.email);
  } else {
    showLogin();
  }
}

async function login(e) {
  e.preventDefault();
  const email = document.getElementById('admin-email').value.trim();
  const pass = document.getElementById('admin-pass').value;
  const errorEl = document.getElementById('admin-error');
  errorEl.style.display = 'none';
  const btn = document.getElementById('login-btn');
  btn.disabled = true; btn.textContent = 'Ingresando...';
  const { error } = await supabase.auth.signInWithPassword({ email, password: pass });
  btn.disabled = false; btn.textContent = 'Ingresar';
  if (error) {
    errorEl.textContent = '⚠ ' + (error.message === 'Invalid login credentials' ? 'Correo o contraseña incorrectos' : error.message);
    errorEl.style.display = 'block';
    return;
  }
  const { data: { session } } = await supabase.auth.getSession();
  showPanel(session.user.email);
}

async function logout() {
  await supabase.auth.signOut();
  showLogin();
}

function showLogin() {
  loginCard.style.display = 'block';
  panel.style.display = 'none';
}

function showPanel(email) {
  loginCard.style.display = 'none';
  panel.style.display = 'block';
  const who = document.getElementById('admin-who');
  if (who) who.textContent = email;
  loadAdminPanel();
}

document.getElementById('admin-login-form')?.addEventListener('submit', login);
window.logoutAdmin = logout;

// ========================
// CARGA DE DATOS
// ========================
async function loadAdminPanel() {
  showLoading(true);
  try {
    const [{ data: settingsRow }, { data: catsRow }, { data: prodRows }, { data: orderRows }] = await Promise.all([
      supabase.from('config').select('value').eq('key', 'settings').maybeSingle(),
      supabase.from('config').select('value').eq('key', 'categories').maybeSingle(),
      supabase.from('products').select('*').order('name'),
      supabase.from('orders').select('*').order('timestamp', { ascending: false }),
    ]);
    siteSettings = settingsRow?.value || { whatsapp: '', nombre: '', eslogan: '', subtitulo: '' };
    categories = catsRow?.value?.list || [];
    products = prodRows || [];
    orders = orderRows || [];

    renderAdminStats();
    renderAdminTable();
    buildEmojiPicker();
    buildSpecsContainer([]);
    populateCategorySelect();
    renderCategoryList();
    renderOrderList();
    document.getElementById('admin-whatsapp').value = siteSettings.whatsapp || '';
    document.getElementById('admin-nombre').value = siteSettings.nombre || '';
    document.getElementById('admin-eslogan').value = siteSettings.eslogan || '';
    document.getElementById('admin-subtitulo').value = siteSettings.subtitulo || '';
  } catch (e) {
    console.error('Error cargando panel:', e);
    toast('⚠ ' + (e.message || 'Error cargando datos'), 'error');
  }
  showLoading(false);
}

function showLoading(v) {
  const el = document.getElementById('admin-loading');
  if (el) el.style.display = v ? 'block' : 'none';
}

function toast(msg, type = 'success') {
  const box = document.getElementById('toast-container');
  if (!box) return;
  const t = document.createElement('div');
  t.className = `toast toast-${type}`;
  t.textContent = msg;
  box.appendChild(t);
  setTimeout(() => t.remove(), 3500);
}

// ========================
// TABS
// ========================
function switchTab(tab) {
  const tabs = ['productos', 'nuevo', 'categorias', 'pedidos', 'sitio'];
  document.querySelectorAll('.admin-tab').forEach((t, i) => t.classList.toggle('active', tabs[i] === tab));
  document.querySelectorAll('.admin-tab-content').forEach(c => c.classList.remove('active'));
  document.getElementById('tab-' + tab).classList.add('active');
  if (tab === 'productos') renderAdminTable();
  if (tab === 'categorias') renderCategoryList();
  if (tab === 'pedidos') renderOrderList();
}
window.switchTab = switchTab;

// ========================
// STATS + TABLA DE PRODUCTOS
// ========================
function renderAdminStats() {
  const tp = products.length, ac = products.filter(p => p.status === 'activo').length,
        ag = products.filter(p => p.status === 'agotado').length, to = orders.length;
  document.getElementById('admin-stats').innerHTML =
    `<div class="admin-stat-card"><div class="admin-stat-num">${tp}</div><div class="admin-stat-label">Productos</div></div>
     <div class="admin-stat-card"><div class="admin-stat-num" style="color:var(--neon)">${ac}</div><div class="admin-stat-label">Disponibles</div></div>
     <div class="admin-stat-card"><div class="admin-stat-num" style="color:var(--neon2)">${ag}</div><div class="admin-stat-label">Agotados</div></div>
     <div class="admin-stat-card"><div class="admin-stat-num" style="color:var(--neon3)">${to}</div><div class="admin-stat-label">Pedidos</div></div>`;
  const pc = document.getElementById('product-count');
  if (pc) pc.textContent = tp;
}

function renderAdminTable() {
  const s = (document.getElementById('admin-search')?.value || '').toLowerCase();
  const f = products.filter(p => p.name.toLowerCase().includes(s) || p.cat.toLowerCase().includes(s));
  document.getElementById('admin-table-body').innerHTML = f.map(p => {
    const id = escapeHtml(p.id);
    return `<tr>
      <td>${p.image ? `<img src="${escapeHtml(p.image)}" style="width:36px;height:36px;object-fit:cover;border-radius:2px">` : `<span style="font-size:22px">${escapeHtml(p.icon || '📦')}</span>`}</td>
      <td><div class="tbl-name">${escapeHtml(p.name)}</div></td>
      <td><div class="tbl-cat">${escapeHtml(p.cat)}</div></td>
      <td><div class="tbl-price">Q${Number(p.price).toLocaleString()}</div></td>
      <td><span class="status-badge status-${p.status}">${p.status === 'activo' ? 'Activo' : 'Agotado'}</span></td>
      <td><div class="tbl-actions">
        <button class="tbl-btn tbl-btn-edit" data-edit="${id}">Editar</button>
        <button class="tbl-btn tbl-btn-edit" data-toggle="${id}">${p.status === 'activo' ? 'Agotar' : 'Activar'}</button>
        <button class="tbl-btn tbl-btn-del" data-del="${id}">Eliminar</button>
      </div></td></tr>`;
  }).join('');
  document.getElementById('admin-table-body').querySelectorAll('[data-edit]').forEach(el => el.addEventListener('click', () => editProduct(el.dataset.edit)));
  document.getElementById('admin-table-body').querySelectorAll('[data-toggle]').forEach(el => el.addEventListener('click', () => toggleStatus(el.dataset.toggle)));
  document.getElementById('admin-table-body').querySelectorAll('[data-del]').forEach(el => el.addEventListener('click', () => deleteProduct(el.dataset.del)));
  const pc = document.getElementById('product-count');
  if (pc) pc.textContent = products.length;
}
document.getElementById('admin-search')?.addEventListener('input', renderAdminTable);

// ========================
// FORMULARIO DE PRODUCTO
// ========================
const EMOJIS = ['🔧','📡','💻','⚡','📶','🎒','🌡️','🌐','🔬','🔩','⚙️','🖥️','📱','🔋','🛠️','🧲','🎯','🔑','💡','🔌'];
function buildEmojiPicker() {
  const el = document.getElementById('emoji-picker');
  el.innerHTML = EMOJIS.map(e => `<div class="emoji-opt" data-emoji="${e}">${e}</div>`).join('');
  el.querySelectorAll('[data-emoji]').forEach(o => o.addEventListener('click', () => selectEmoji(o.dataset.emoji)));
}
function selectEmoji(e) {
  document.getElementById('p-icon').value = e;
  document.querySelectorAll('.emoji-opt').forEach(el => el.classList.toggle('selected', el.textContent === e));
}
function buildSpecsContainer(specs) {
  const c = document.getElementById('specs-container');
  c.innerHTML = '';
  (specs || []).forEach(s => addSpecRow(s.k, s.v));
}
function addSpecRow(k = '', v = '') {
  const c = document.getElementById('specs-container');
  if (c.children.length >= 4) { toast('Máximo 4 especificaciones', 'error'); return; }
  const row = document.createElement('div');
  row.style.cssText = 'display:grid;grid-template-columns:1fr 1fr auto;gap:8px;margin-bottom:8px;align-items:center';
  const keyInput = document.createElement('input');
  keyInput.className = 'admin-input spec-key-input'; keyInput.type = 'text'; keyInput.placeholder = 'Clave'; keyInput.value = k; keyInput.style.padding = '8px 12px';
  const valInput = document.createElement('input');
  valInput.className = 'admin-input spec-val-input'; valInput.type = 'text'; valInput.placeholder = 'Valor'; valInput.value = v; valInput.style.padding = '8px 12px';
  const delBtn = document.createElement('button');
  delBtn.className = 'tbl-btn tbl-btn-del'; delBtn.textContent = '✕'; delBtn.style.padding = '8px 10px';
  delBtn.addEventListener('click', () => row.remove());
  row.append(keyInput, valInput, delBtn);
  c.appendChild(row);
}
document.getElementById('add-spec-btn')?.addEventListener('click', () => addSpecRow());
function getSpecs() {
  const keys = [...document.querySelectorAll('.spec-key-input')];
  const vals = [...document.querySelectorAll('.spec-val-input')];
  return keys.map((k, i) => ({ k: k.value.trim(), v: vals[i].value.trim() })).filter(s => s.k && s.v);
}
function populateCategorySelect() {
  const sel = document.getElementById('p-cat');
  const cv = sel.value;
  sel.innerHTML = '<option value="">Seleccionar categoría</option>';
  categories.forEach(c => {
    const o = document.createElement('option'); o.value = c; o.textContent = c;
    if (c === cv) o.selected = true;
    sel.appendChild(o);
  });
}

// Validación básica de imagen (tipo + tamaño) antes de convertir a base64
function handleImageUpload(event) {
  const file = event.target.files[0];
  if (!file) return;
  const allowed = ['image/jpeg', 'image/png', 'image/webp'];
  if (!allowed.includes(file.type)) { toast('⚠ Formato no permitido. Usa JPG, PNG o WEBP.', 'error'); event.target.value = ''; return; }
  if (file.size > 2 * 1024 * 1024) { toast('⚠ Imagen muy grande. Máx 2MB.', 'error'); event.target.value = ''; return; }
  const r = new FileReader();
  r.onload = e => {
    currentImageData = e.target.result;
    document.getElementById('img-upload-preview').src = currentImageData;
    document.getElementById('img-upload-preview').style.display = 'block';
    document.getElementById('img-upload-label').textContent = '✓ Imagen cargada';
    document.getElementById('img-clear-btn').style.display = 'inline-block';
  };
  r.readAsDataURL(file);
}
function clearImage() {
  currentImageData = null;
  document.getElementById('img-upload-preview').style.display = 'none';
  document.getElementById('img-upload-preview').src = '';
  document.getElementById('img-upload-label').textContent = '📁 Click para subir imagen (JPG, PNG, WEBP)';
  document.getElementById('img-clear-btn').style.display = 'none';
  document.getElementById('p-image-file').value = '';
}
window.handleImageUpload = handleImageUpload;
document.getElementById('img-clear-btn')?.addEventListener('click', clearImage);

async function saveProduct() {
  const name = document.getElementById('p-name').value.trim();
  const cat = document.getElementById('p-cat').value;
  const price = parseFloat(document.getElementById('p-price').value);
  const priceOld = parseFloat(document.getElementById('p-price-old').value) || null;
  const status = document.getElementById('p-status').value;
  const badge = document.getElementById('p-badge').value;
  const icon = document.getElementById('p-icon').value || '📦';
  const desc = document.getElementById('p-desc').value.trim();
  const specs = getSpecs();
  if (!name || !cat || !price) { toast('⚠ Nombre, categoría y precio son obligatorios', 'error'); return; }

  const btn = document.getElementById('save-product-btn');
  btn.textContent = 'Guardando...'; btn.disabled = true;
  try {
    if (editingId !== null) {
      const ex = products.find(p => p.id === editingId);
      const img = currentImageData !== null ? currentImageData : (ex ? ex.image : null);
      const { error } = await supabase.from('products').update({ name, cat, price, priceOld, status, badge, icon, desc, specs, image: img }).eq('id', editingId);
      if (error) throw error;
      toast(`✓ "${name}" actualizado`, 'success');
      cancelEdit();
    } else {
      const { error } = await supabase.from('products').insert({ name, cat, price, priceOld, status, badge, icon, desc, specs, image: currentImageData || null });
      if (error) throw error;
      toast(`✓ "${name}" agregado`, 'success');
      clearProductForm();
    }
    await loadAdminPanel();
  } catch (e) {
    console.error('Error guardando producto:', e);
    toast('⚠ ' + (e.message || 'Error guardando en Supabase'), 'error');
  }
  btn.textContent = editingId ? 'Actualizar Producto' : 'Guardar Producto';
  btn.disabled = false;
}
window.saveProduct = saveProduct;

function editProduct(id) {
  const p = products.find(x => String(x.id) === String(id));
  if (!p) return;
  editingId = p.id;
  switchTab('nuevo');
  document.getElementById('p-name').value = p.name;
  document.getElementById('p-cat').value = p.cat;
  document.getElementById('p-price').value = p.price;
  document.getElementById('p-price-old').value = p.priceOld || '';
  document.getElementById('p-status').value = p.status;
  document.getElementById('p-badge').value = p.badge || '';
  document.getElementById('p-icon').value = p.icon || '';
  document.getElementById('p-desc').value = p.desc || '';
  buildSpecsContainer(p.specs || []);
  document.getElementById('edit-mode-banner').style.display = 'block';
  document.getElementById('edit-id-display').textContent = p.id;
  document.getElementById('save-product-btn').textContent = 'Actualizar Producto';
  document.getElementById('cancel-edit-btn').style.display = 'inline-flex';
  selectEmoji(p.icon || '');
  currentImageData = null;
  if (p.image) {
    document.getElementById('img-upload-preview').src = p.image;
    document.getElementById('img-upload-preview').style.display = 'block';
    document.getElementById('img-upload-label').textContent = '✓ Imagen actual (sube una nueva para cambiar)';
    document.getElementById('img-clear-btn').style.display = 'inline-block';
  } else {
    clearImage();
  }
}
function cancelEdit() {
  editingId = null;
  clearProductForm();
  document.getElementById('edit-mode-banner').style.display = 'none';
  document.getElementById('save-product-btn').textContent = 'Guardar Producto';
  document.getElementById('cancel-edit-btn').style.display = 'none';
}
window.cancelEdit = cancelEdit;
function clearProductForm() {
  ['p-name', 'p-price', 'p-price-old', 'p-icon', 'p-desc'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  document.getElementById('p-cat').value = '';
  document.getElementById('p-status').value = 'activo';
  document.getElementById('p-badge').value = '';
  buildSpecsContainer([]);
  document.querySelectorAll('.emoji-opt').forEach(e => e.classList.remove('selected'));
  clearImage();
}
window.clearProductForm = clearProductForm;

async function deleteProduct(id) {
  const p = products.find(x => String(x.id) === String(id));
  if (!p || !confirm(`¿Eliminar "${p.name}"?`)) return;
  try {
    const { error } = await supabase.from('products').delete().eq('id', id);
    if (error) throw error;
    toast(`🗑 "${p.name}" eliminado`, 'success');
    await loadAdminPanel();
  } catch (e) {
    console.error('Error eliminando producto:', e);
    toast('⚠ ' + (e.message || 'Error eliminando'), 'error');
  }
}
async function toggleStatus(id) {
  const p = products.find(x => String(x.id) === String(id));
  if (!p) return;
  const ns = p.status === 'activo' ? 'agotado' : 'activo';
  try {
    const { error } = await supabase.from('products').update({ status: ns }).eq('id', id);
    if (error) throw error;
    toast(`✓ "${p.name}" → ${ns === 'activo' ? 'Activo' : 'Agotado'}`, 'success');
    await loadAdminPanel();
  } catch (e) {
    console.error('Error actualizando producto:', e);
    toast('⚠ ' + (e.message || 'Error actualizando'), 'error');
  }
}

// ========================
// CATEGORÍAS
// ========================
function renderCategoryList() {
  const list = document.getElementById('cat-list');
  if (!categories.length) { list.innerHTML = '<div style="color:var(--muted);font-size:12px;font-family:JetBrains Mono,monospace;padding:12px">// Sin categorías</div>'; return; }
  list.innerHTML = categories.map((c, i) =>
    `<div class="cat-item"><span class="cat-item-name">${escapeHtml(c)}</span>
     <span style="font-size:10px;color:var(--muted);font-family:JetBrains Mono,monospace;margin-right:8px">${products.filter(p => p.cat === c).length} prod.</span>
     <button class="cat-item-del" data-catdel="${i}">✕</button></div>`
  ).join('');
  list.querySelectorAll('[data-catdel]').forEach(el => el.addEventListener('click', () => deleteCategory(Number(el.dataset.catdel))));
}
async function addCategory() {
  const inp = document.getElementById('new-cat-input');
  const name = inp.value.trim();
  if (!name) { toast('⚠ Ingresa un nombre', 'error'); return; }
  if (categories.includes(name)) { toast('⚠ Ya existe', 'error'); return; }
  const next = [...categories, name];
  try {
    const { error } = await supabase.from('config').upsert({ key: 'categories', value: { list: next } });
    if (error) throw error;
    categories = next;
    inp.value = '';
    renderCategoryList(); populateCategorySelect();
    toast(`✓ "${name}" agregada`, 'success');
  } catch (e) {
    console.error('Error guardando categoría:', e);
    toast('⚠ ' + (e.message || 'Error guardando'), 'error');
  }
}
window.addCategory = addCategory;
async function deleteCategory(i) {
  const cat = categories[i];
  if (products.some(p => p.cat === cat) && !confirm(`"${cat}" tiene productos. ¿Eliminar?`)) return;
  const next = categories.filter((_, idx) => idx !== i);
  try {
    const { error } = await supabase.from('config').upsert({ key: 'categories', value: { list: next } });
    if (error) throw error;
    categories = next;
    renderCategoryList(); populateCategorySelect();
    toast(`🗑 "${cat}" eliminada`, 'success');
  } catch (e) {
    console.error('Error eliminando categoría:', e);
    toast('⚠ ' + (e.message || 'Error eliminando'), 'error');
  }
}

// ========================
// PEDIDOS
// ========================
function renderOrderList() {
  const list = document.getElementById('order-list');
  const no = document.getElementById('no-orders');
  const countEl = document.getElementById('order-count');
  if (countEl) countEl.textContent = orders.length;
  if (!orders.length) { list.innerHTML = ''; no.style.display = 'block'; return; }
  no.style.display = 'none';
  const waNum = (siteSettings.whatsapp || '').replace(/\D/g, '');
  list.innerHTML = orders.map(o => {
    const items = o.items.map(it => `${it.name} x${it.qty}`).join(', ');
    const wm = encodeURIComponent(`*Pedido ${o.code}*\nCliente: ${o.buyer}\nEstado: EN PROCESO ✅`);
    const wl = waNum ? `https://wa.me/${waNum}?text=${wm}` : '#';
    return `<div class="order-item">
      <div class="order-item-header"><span class="order-item-code">${escapeHtml(o.code)}</span><span class="order-item-date">${escapeHtml(o.date)}</span></div>
      <div class="order-item-name">👤 ${escapeHtml(o.buyer)}${o.phone ? ' · ' + escapeHtml(o.phone) : ''}</div>
      ${o.address ? `<div style="font-size:11px;color:var(--muted);margin-top:3px">📍 ${escapeHtml(o.address)}</div>` : ''}
      <div class="order-item-products" style="margin-top:6px">${escapeHtml(items)}</div>
      <div class="order-item-total">Q${Number(o.total).toLocaleString('es', { minimumFractionDigits: 2 })}</div>
      ${o.notes ? `<div style="font-size:11px;color:var(--muted);margin-top:4px">📝 ${escapeHtml(o.notes)}</div>` : ''}
      <div class="order-item-actions">
        <a href="${wl}" target="_blank" rel="noopener noreferrer" class="tbl-btn tbl-btn-edit" style="text-decoration:none">💬 WhatsApp</a>
        <button class="tbl-btn tbl-btn-del" data-orderdel="${escapeHtml(o.id)}">Eliminar</button>
      </div></div>`;
  }).join('');
  list.querySelectorAll('[data-orderdel]').forEach(el => el.addEventListener('click', () => deleteOrder(el.dataset.orderdel)));
}
async function deleteOrder(fid) {
  try {
    const { error } = await supabase.from('orders').delete().eq('id', fid);
    if (error) throw error;
    toast('Pedido eliminado', 'success');
    await loadAdminPanel();
  } catch (e) {
    console.error('Error eliminando pedido:', e);
    toast('⚠ ' + (e.message || 'Error'), 'error');
  }
}
async function clearOrders() {
  if (!confirm('¿Limpiar historial de pedidos?')) return;
  try {
    const { error } = await supabase.from('orders').delete().not('id', 'is', null);
    if (error) throw error;
    toast('Historial limpiado', 'success');
    await loadAdminPanel();
  } catch (e) {
    console.error('Error limpiando pedidos:', e);
    toast('⚠ ' + (e.message || 'Error'), 'error');
  }
}
window.clearOrders = clearOrders;

// ========================
// CONFIGURACIÓN DEL SITIO
// ========================
async function applySiteSettings() {
  const nombre = document.getElementById('admin-nombre').value.trim();
  const eslogan = document.getElementById('admin-eslogan').value.trim();
  const subtitulo = document.getElementById('admin-subtitulo').value.trim();
  const wa = document.getElementById('admin-whatsapp').value.trim().replace(/\D/g, '');
  const next = { ...siteSettings, nombre, eslogan, subtitulo, whatsapp: wa };
  try {
    const { error } = await supabase.from('config').upsert({ key: 'settings', value: next });
    if (error) throw error;
    siteSettings = next;
    const m = document.getElementById('site-save-msg');
    m.style.opacity = '1'; setTimeout(() => m.style.opacity = '0', 2500);
    toast('✓ Configuración guardada en la nube', 'success');
  } catch (e) {
    console.error('Error guardando configuración:', e);
    toast('⚠ ' + (e.message || 'Error guardando configuración'), 'error');
  }
}
window.applySiteSettings = applySiteSettings;

// ========================
// REINICIAR DATOS (sembrar catálogo de ejemplo)
// ========================
async function resetAll() {
  if (!confirm('¿Reiniciar todos los datos? Esto borra los productos actuales y siembra el catálogo de ejemplo.')) return;
  try {
    const { data: rows } = await supabase.from('products').select('id');
    if (rows && rows.length) {
      const { error: delErr } = await supabase.from('products').delete().in('id', rows.map(r => r.id));
      if (delErr) throw delErr;
    }
    const { error: insErr } = await supabase.from('products').insert(DEFAULT_PRODUCTS);
    if (insErr) throw insErr;
    const { error: catErr } = await supabase.from('config').upsert({ key: 'categories', value: { list: DEFAULT_CATEGORIES } });
    if (catErr) throw catErr;
    categories = [...DEFAULT_CATEGORIES];
    toast('Datos reiniciados', 'success');
    await loadAdminPanel();
  } catch (e) {
    console.error('Error reiniciando datos:', e);
    toast('⚠ ' + (e.message || 'Error reiniciando'), 'error');
  }
}
window.resetAll = resetAll;

// ========================
// EXPONER FUNCIONES RESTANTES USADAS EN EL HTML
// ========================
window.deleteProduct = deleteProduct;
window.toggleStatus = toggleStatus;
window.editProduct = editProduct;

checkSession();
