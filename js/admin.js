// ========================
// ADMIN.JS — Panel de administración
// Seguridad: el acceso ya NO depende de una contraseña escrita en el
// código (cualquiera podía leerla con "Ver código fuente"). Ahora se
// usa Supabase Auth: el usuario y la contraseña se verifican en el
// servidor de Supabase, no en el navegador. Debes crear tu usuario
// admin una sola vez desde el panel de Supabase (ver README.md /
// SEGURIDAD.md incluidos en este paquete).
// ========================
import { supabase } from './supabase-client.js';

function escapeHTML(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

const DEFAULT_CATEGORIES = ['Microcontroladores','Sensores','Módulos IoT','Computación','Energía','Periféricos','Kits','Software'];
const DEFAULT_PRODUCTS = [
  {name:'NanoCore X1',cat:'Microcontroladores',desc:'Microcontrolador de 32 bits para aplicaciones IoT industriales.',price:249,priceOld:320,status:'activo',badge:'destacado',icon:'🔧',image:null,specs:[{k:'CPU',v:'Xtensa LX7 240MHz'},{k:'RAM',v:'512KB SRAM'},{k:'Flash',v:'8MB'},{k:'Conectividad',v:'Wi-Fi 6 + BT 5.0'}]},
  {name:'SensorHub Pro',cat:'Sensores',desc:'Hub de sensores multiprotocolo: temperatura, humedad, presión y más.',price:189,priceOld:null,status:'activo',badge:'nuevo',icon:'📡',image:null,specs:[{k:'Sensores',v:'6 en 1'},{k:'Precisión temp.',v:'±0.1°C'},{k:'Interfaz',v:'I2C / SPI / UART'},{k:'Consumo',v:'2.1mA activo'}]},
  {name:'PicoEdge V2',cat:'Computación',desc:'Módulo de computación en el borde para inferencia de IA local.',price:890,priceOld:1100,status:'activo',badge:'oferta',icon:'💻',image:null,specs:[{k:'NPU',v:'1 TOPS'},{k:'CPU',v:'Quad-core A53'},{k:'RAM',v:'4GB LPDDR4'},{k:'OS',v:'Linux / RTOS'}]},
  {name:'PowerCell GT',cat:'Energía',desc:'Módulo de gestión de energía con carga solar integrada.',price:145,priceOld:null,status:'activo',badge:'',icon:'⚡',image:null,specs:[{k:'Entrada solar',v:'5-30V MPPT'},{k:'Salida',v:'3.3V / 5V / 12V'},{k:'Batt.',v:'LiPo / LiFePO4'},{k:'Eficiencia',v:'95%'}]},
  {name:'MeshLink 900',cat:'Módulos IoT',desc:'Módulo de radio LoRa para redes mesh de largo alcance.',price:320,priceOld:null,status:'agotado',badge:'',icon:'📶',image:null,specs:[{k:'Frecuencia',v:'915MHz ISM'},{k:'Alcance',v:'Hasta 15km'},{k:'Cifrado',v:'AES-256'},{k:'Protocolo',v:'LoRaWAN 1.1'}]},
  {name:'DevKit Starter',cat:'Kits',desc:'Kit completo para comenzar con electrónica embebida.',price:499,priceOld:650,status:'activo',badge:'nuevo',icon:'🎒',image:null,specs:[{k:'Incluye',v:'NanoCore X1'},{k:'Sensores',v:'Temperatura, luz, IR'},{k:'Extras',v:'Protoboard + 40 cables'},{k:'Guías',v:'PDF + Video tutoriales'}]},
];

let products = [];
let categories = [...DEFAULT_CATEGORIES];
let orders = [];
let siteSettings = {};
let editingId = null;
let currentImageData = null;

// ========================
// AUTENTICACIÓN (Supabase Auth — verificación en el servidor)
// ========================
async function checkSession() {
  const { data: { session } } = await supabase.auth.getSession();
  if (session) {
    showAdminPanel();
  } else {
    showLoginScreen();
  }
}

async function handleLogin() {
  const email = document.getElementById('admin-email').value.trim();
  const pass = document.getElementById('admin-pass').value;
  const errEl = document.getElementById('admin-error');
  const btn = document.getElementById('admin-login-btn');
  errEl.style.display = 'none';
  if (!email || !pass) { errEl.textContent = '⚠ Ingresa correo y contraseña'; errEl.style.display = 'block'; return; }
  btn.disabled = true; btn.textContent = 'Verificando...';
  const { error } = await supabase.auth.signInWithPassword({ email, password: pass });
  btn.disabled = false; btn.textContent = 'Ingresar';
  if (error) {
    errEl.textContent = '⚠ Credenciales incorrectas';
    errEl.style.display = 'block';
    document.getElementById('admin-pass').value = '';
    return;
  }
  document.getElementById('admin-pass').value = '';
  showAdminPanel();
}

async function handleLogout() {
  await supabase.auth.signOut();
  showLoginScreen();
}

function showLoginScreen() {
  document.getElementById('admin-login').style.display = 'block';
  document.getElementById('admin-panel-content').style.display = 'none';
}

function showAdminPanel() {
  document.getElementById('admin-login').style.display = 'none';
  document.getElementById('admin-panel-content').style.display = 'block';
  loadAdminPanel();
}

// ========================
// CARGA DE DATOS
// ========================
async function refreshProducts() {
  const { data } = await supabase.from('products').select('*').order('name');
  products = data || [];
  renderAdminStats(); renderAdminTable();
}
async function refreshOrders() {
  const { data } = await supabase.from('orders').select('*').order('timestamp', { ascending: false });
  orders = data || [];
  renderOrderList(); renderAdminStats();
}

async function initData() {
  try {
    const { data: settingsRow } = await supabase.from('config').select('value').eq('key', 'settings').maybeSingle();
    if (settingsRow) siteSettings = settingsRow.value;
    else { siteSettings = { whatsapp: '', nombre: '', eslogan: '', subtitulo: '' }; await supabase.from('config').insert({ key: 'settings', value: siteSettings }); }

    const { data: catsRow } = await supabase.from('config').select('value').eq('key', 'categories').maybeSingle();
    if (catsRow && catsRow.value && catsRow.value.list) categories = catsRow.value.list;
    else { categories = [...DEFAULT_CATEGORIES]; await supabase.from('config').insert({ key: 'categories', value: { list: categories } }); }

    const { data: prodRows } = await supabase.from('products').select('*').order('name');
    if (!prodRows || prodRows.length === 0) await supabase.from('products').insert(DEFAULT_PRODUCTS);
    await refreshProducts();
    await refreshOrders();

    supabase.channel('admin-products-changes').on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, refreshProducts).subscribe();
    supabase.channel('admin-orders-changes').on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, refreshOrders).subscribe();
  } catch (e) {
    console.error('Error cargando datos admin:', e);
    showToast('⚠ Error conectando a la base de datos', 'error');
  }
}

// ========================
// GUARDAR EN SUPABASE
// ========================
async function fbSaveProduct(data, id = null) {
  if (id) { const { error } = await supabase.from('products').update(data).eq('id', id); if (error) throw error; }
  else { const { error } = await supabase.from('products').insert(data); if (error) throw error; }
}
async function fbDeleteProduct(id) { const { error } = await supabase.from('products').delete().eq('id', id); if (error) throw error; }
async function fbDeleteOrder(id) { const { error } = await supabase.from('orders').delete().eq('id', id); if (error) throw error; }
async function fbClearOrders() { const { error } = await supabase.from('orders').delete().not('id', 'is', null); if (error) throw error; }
async function fbSaveSettings(data) { siteSettings = { ...siteSettings, ...data }; const { error } = await supabase.from('config').upsert({ key: 'settings', value: siteSettings }); if (error) throw error; }
async function fbSaveCategories(list) { const { error } = await supabase.from('config').upsert({ key: 'categories', value: { list } }); if (error) throw error; }

// ========================
// PANEL ADMIN — UI
// ========================
function loadAdminPanel() {
  renderAdminStats(); renderAdminTable(); buildEmojiPicker(); buildSpecsContainer([]);
  populateCategorySelect(); renderCategoryList(); renderOrderList();
  document.getElementById('admin-whatsapp').value = siteSettings.whatsapp || '';
  document.getElementById('admin-nombre').value = siteSettings.nombre || '';
  document.getElementById('admin-eslogan').value = siteSettings.eslogan || '';
  document.getElementById('admin-subtitulo').value = siteSettings.subtitulo || '';
}

function renderAdminStats() {
  const tp = products.length, ac = products.filter(p => p.status === 'activo').length, ag = products.filter(p => p.status === 'agotado').length, to = orders.length;
  const el = document.getElementById('admin-stats');
  if (!el) return;
  el.innerHTML = `<div class="admin-stat-card"><div class="admin-stat-num">${tp}</div><div class="admin-stat-label">Productos</div></div><div class="admin-stat-card"><div class="admin-stat-num" style="color:var(--neon)">${ac}</div><div class="admin-stat-label">Disponibles</div></div><div class="admin-stat-card"><div class="admin-stat-num" style="color:var(--neon2)">${ag}</div><div class="admin-stat-label">Agotados</div></div><div class="admin-stat-card"><div class="admin-stat-num" style="color:var(--neon3)">${to}</div><div class="admin-stat-label">Pedidos</div></div>`;
  const pc = document.getElementById('product-count'); if (pc) pc.textContent = tp;
}

function renderAdminTable() {
  const s = (document.getElementById('admin-search')?.value || '').toLowerCase();
  const f = products.filter(p => p.name.toLowerCase().includes(s) || p.cat.toLowerCase().includes(s));
  document.getElementById('admin-table-body').innerHTML = f.map(p => `<tr><td>${p.image ? `<img src="${escapeHTML(p.image)}" style="width:36px;height:36px;object-fit:cover;border-radius:2px">` : `<span style="font-size:22px">${p.icon || '📦'}</span>`}</td><td><div class="tbl-name">${escapeHTML(p.name)}</div></td><td><div class="tbl-cat">${escapeHTML(p.cat)}</div></td><td><div class="tbl-price">Q${Number(p.price).toLocaleString()}</div></td><td><span class="status-badge status-${p.status}">${p.status === 'activo' ? 'Activo' : 'Agotado'}</span></td><td><div class="tbl-actions"><button class="tbl-btn tbl-btn-edit" onclick="editProduct('${p.id}')">Editar</button><button class="tbl-btn tbl-btn-edit" onclick="toggleStatus('${p.id}')">${p.status === 'activo' ? 'Agotar' : 'Activar'}</button><button class="tbl-btn tbl-btn-del" onclick="deleteProduct('${p.id}')">Eliminar</button></div></td></tr>`).join('');
  const pc = document.getElementById('product-count'); if (pc) pc.textContent = products.length;
}

function switchTab(tab) {
  const tabs = ['productos', 'nuevo', 'categorias', 'pedidos', 'sitio'];
  document.querySelectorAll('.admin-tab').forEach((t, i) => t.classList.toggle('active', tabs[i] === tab));
  document.querySelectorAll('.admin-tab-content').forEach(c => c.classList.remove('active'));
  document.getElementById('tab-' + tab).classList.add('active');
  if (tab === 'productos') renderAdminTable();
  if (tab === 'categorias') renderCategoryList();
  if (tab === 'pedidos') renderOrderList();
}

const EMOJIS = ['🔧','📡','💻','⚡','📶','🎒','🌡️','🌐','🔬','🔩','⚙️','🖥️','📱','🔋','🛠️','🧲','🎯','🔑','💡','🔌'];
function buildEmojiPicker() { document.getElementById('emoji-picker').innerHTML = EMOJIS.map(e => `<div class="emoji-opt" onclick="selectEmoji('${e}')">${e}</div>`).join(''); }
function selectEmoji(e) { document.getElementById('p-icon').value = e; document.querySelectorAll('.emoji-opt').forEach(el => el.classList.toggle('selected', el.textContent === e)); }
function buildSpecsContainer(specs) { const c = document.getElementById('specs-container'); c.innerHTML = ''; (specs || []).forEach(s => addSpecRow(s.k, s.v)); }
function addSpecRow(k = '', v = '') {
  const c = document.getElementById('specs-container');
  if (c.children.length >= 4) { showToast('Máximo 4 especificaciones', 'error'); return; }
  const row = document.createElement('div');
  row.style.cssText = 'display:grid;grid-template-columns:1fr 1fr auto;gap:8px;margin-bottom:8px;align-items:center';
  row.innerHTML = `<input class="admin-input spec-key-input" type="text" placeholder="Clave" value="${escapeHTML(k)}" style="padding:8px 12px"><input class="admin-input spec-val-input" type="text" placeholder="Valor" value="${escapeHTML(v)}" style="padding:8px 12px"><button class="tbl-btn tbl-btn-del" onclick="this.parentElement.remove()" style="padding:8px 10px">✕</button>`;
  c.appendChild(row);
}
function getSpecs() { return [...document.querySelectorAll('.spec-key-input')].map((k, i) => ({ k: k.value.trim(), v: document.querySelectorAll('.spec-val-input')[i].value.trim() })).filter(s => s.k && s.v); }
function populateCategorySelect() {
  const sel = document.getElementById('p-cat'); const cv = sel.value;
  sel.innerHTML = '<option value="">Seleccionar categoría</option>';
  categories.forEach(c => { const o = document.createElement('option'); o.value = c; o.textContent = c; if (c === cv) o.selected = true; sel.appendChild(o); });
}

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
  if (!name || !cat || !price) { showToast('⚠ Nombre, categoría y precio son obligatorios', 'error'); return; }
  const btn = document.getElementById('save-product-btn'); btn.textContent = 'Guardando...'; btn.disabled = true;
  try {
    if (editingId !== null) {
      const ex = products.find(p => p.id === editingId);
      const img = currentImageData !== null ? currentImageData : (ex ? ex.image : null);
      await fbSaveProduct({ name, cat, price, priceOld, status, badge, icon, desc, specs, image: img }, editingId);
      showToast(`✓ "${name}" actualizado`, 'success'); cancelEdit();
    } else {
      await fbSaveProduct({ name, cat, price, priceOld, status, badge, icon, desc, specs, image: currentImageData || null });
      showToast(`✓ "${name}" agregado`, 'success'); clearProductForm();
    }
    const m = document.getElementById('save-msg'); m.style.opacity = '1'; setTimeout(() => m.style.opacity = '0', 2500);
  } catch (e) {
    console.error('Error guardando producto:', e);
    showToast('⚠ ' + (e.message || 'Error guardando en Supabase'), 'error');
  }
  btn.textContent = editingId ? 'Actualizar Producto' : 'Guardar Producto'; btn.disabled = false;
}

function editProduct(id) {
  const p = products.find(x => x.id === id); if (!p) return;
  editingId = id; switchTab('nuevo');
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
  document.getElementById('edit-id-display').textContent = id;
  document.getElementById('save-product-btn').textContent = 'Actualizar Producto';
  document.getElementById('cancel-edit-btn').style.display = 'inline-flex';
  selectEmoji(p.icon || '');
  currentImageData = null;
  if (p.image) {
    document.getElementById('img-upload-preview').src = p.image;
    document.getElementById('img-upload-preview').style.display = 'block';
    document.getElementById('img-upload-label').textContent = '✓ Imagen actual (sube una nueva para cambiar)';
    document.getElementById('img-clear-btn').style.display = 'inline-block';
  } else { clearImage(); }
}
function cancelEdit() { editingId = null; clearProductForm(); document.getElementById('edit-mode-banner').style.display = 'none'; document.getElementById('save-product-btn').textContent = 'Guardar Producto'; document.getElementById('cancel-edit-btn').style.display = 'none'; }
function clearProductForm() {
  ['p-name', 'p-price', 'p-price-old', 'p-icon', 'p-desc'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  document.getElementById('p-cat').value = ''; document.getElementById('p-status').value = 'activo'; document.getElementById('p-badge').value = '';
  buildSpecsContainer([]); document.querySelectorAll('.emoji-opt').forEach(e => e.classList.remove('selected')); clearImage();
}
async function deleteProduct(id) {
  const p = products.find(x => x.id === id); if (!p || !confirm(`¿Eliminar "${p.name}"?`)) return;
  try { await fbDeleteProduct(id); showToast(`🗑 "${p.name}" eliminado`, 'success'); }
  catch (e) { console.error(e); showToast('⚠ ' + (e.message || 'Error eliminando'), 'error'); }
}
async function toggleStatus(id) {
  const p = products.find(x => x.id === id); if (!p) return;
  const ns = p.status === 'activo' ? 'agotado' : 'activo';
  try { const d = { ...p }; delete d.id; await fbSaveProduct({ ...d, status: ns }, id); showToast(`✓ "${p.name}" → ${ns === 'activo' ? 'Activo' : 'Agotado'}`, 'success'); }
  catch (e) { console.error(e); showToast('⚠ ' + (e.message || 'Error actualizando'), 'error'); }
}

// CATEGORÍAS
function renderCategoryList() {
  const list = document.getElementById('cat-list');
  if (!categories.length) { list.innerHTML = '<div style="color:var(--muted);font-size:12px;font-family:JetBrains Mono,monospace;padding:12px">// Sin categorías</div>'; return; }
  list.innerHTML = categories.map((c, i) => `<div class="cat-item"><span class="cat-item-name">${escapeHTML(c)}</span><span style="font-size:10px;color:var(--muted);font-family:JetBrains Mono,monospace;margin-right:8px">${products.filter(p => p.cat === c).length} prod.</span><button class="cat-item-del" onclick="deleteCategory(${i})">✕</button></div>`).join('');
}
async function addCategory() {
  const inp = document.getElementById('new-cat-input'); const name = inp.value.trim();
  if (!name) { showToast('⚠ Ingresa un nombre', 'error'); return; }
  if (categories.includes(name)) { showToast('⚠ Ya existe', 'error'); return; }
  categories.push(name); inp.value = '';
  try { await fbSaveCategories(categories); renderCategoryList(); populateCategorySelect(); showToast(`✓ "${name}" agregada`, 'success'); }
  catch (e) { console.error(e); showToast('⚠ ' + (e.message || 'Error guardando'), 'error'); categories.pop(); }
}
async function deleteCategory(i) {
  const cat = categories[i];
  if (products.some(p => p.cat === cat) && !confirm(`"${cat}" tiene productos. ¿Eliminar?`)) return;
  categories.splice(i, 1);
  try { await fbSaveCategories(categories); renderCategoryList(); populateCategorySelect(); showToast(`🗑 "${cat}" eliminada`, 'success'); }
  catch (e) { console.error(e); showToast('⚠ ' + (e.message || 'Error eliminando'), 'error'); categories.splice(i, 0, cat); }
}

// PEDIDOS
function renderOrderList() {
  const list = document.getElementById('order-list'); const no = document.getElementById('no-orders');
  const oc = document.getElementById('order-count'); if (oc) oc.textContent = orders.length;
  if (!orders.length) { list.innerHTML = ''; no.style.display = 'block'; return; }
  no.style.display = 'none';
  const waNum = (siteSettings.whatsapp || '').replace(/\D/g, '');
  list.innerHTML = orders.map(o => {
    const items = o.items.map(it => `${it.name} x${it.qty}`).join(', ');
    const wm = encodeURIComponent(`*Pedido ${o.code}*\nCliente: ${o.buyer}\nEstado: EN PROCESO ✅`);
    const wl = waNum ? `https://wa.me/${waNum}?text=${wm}` : `javascript:alert('Configura WhatsApp en Config')`;
    return `<div class="order-item"><div class="order-item-header"><span class="order-item-code">${escapeHTML(o.code)}</span><span class="order-item-date">${escapeHTML(o.date)}</span></div><div class="order-item-name">👤 ${escapeHTML(o.buyer)}${o.phone ? ' · ' + escapeHTML(o.phone) : ''}</div>${o.address ? `<div style="font-size:11px;color:var(--muted);margin-top:3px">📍 ${escapeHTML(o.address)}</div>` : ''}<div class="order-item-products" style="margin-top:6px">${escapeHTML(items)}</div><div class="order-item-total">Q${Number(o.total).toLocaleString('es', { minimumFractionDigits: 2 })}</div>${o.notes ? `<div style="font-size:11px;color:var(--muted);margin-top:4px">📝 ${escapeHTML(o.notes)}</div>` : ''}<div class="order-item-actions"><a href="${wl}" target="_blank" rel="noopener noreferrer" class="tbl-btn tbl-btn-edit" style="text-decoration:none">💬 WhatsApp</a><button class="tbl-btn tbl-btn-del" onclick="deleteOrder('${o.id}')">Eliminar</button></div></div>`;
  }).join('');
}
async function deleteOrder(fid) { try { await fbDeleteOrder(fid); showToast('Pedido eliminado', 'success'); } catch (e) { console.error(e); showToast('⚠ ' + (e.message || 'Error'), 'error'); } }
async function clearOrders() { try { await fbClearOrders(); showToast('Historial limpiado', 'success'); } catch (e) { console.error(e); showToast('⚠ ' + (e.message || 'Error'), 'error'); } }

// AJUSTES DEL SITIO
async function applySiteSettings() {
  const nombre = document.getElementById('admin-nombre').value.trim();
  const eslogan = document.getElementById('admin-eslogan').value.trim();
  const subtitulo = document.getElementById('admin-subtitulo').value.trim();
  const wa = document.getElementById('admin-whatsapp').value.trim().replace(/\D/g, '');
  siteSettings = { ...siteSettings, nombre, eslogan, subtitulo, whatsapp: wa };
  try {
    await fbSaveSettings(siteSettings);
    const m = document.getElementById('site-save-msg'); m.style.opacity = '1'; setTimeout(() => m.style.opacity = '0', 2500);
    showToast('✓ Configuración guardada en la nube', 'success');
  } catch (e) { console.error(e); showToast('⚠ ' + (e.message || 'Error guardando configuración'), 'error'); }
}
function updateWhatsApp() { /* Solo se guarda al presionar "Aplicar configuración" */ }

async function resetAll() {
  if (!confirm('¿Reiniciar todos los datos?')) return;
  try {
    const { data: rows } = await supabase.from('products').select('id');
    if (rows && rows.length) await supabase.from('products').delete().in('id', rows.map(r => r.id));
    await supabase.from('products').insert(DEFAULT_PRODUCTS);
    categories = [...DEFAULT_CATEGORIES];
    await fbSaveCategories(categories);
    renderCategoryList(); populateCategorySelect();
    showToast('Datos reiniciados', 'success');
  } catch (e) { console.error(e); showToast('⚠ ' + (e.message || 'Error reiniciando'), 'error'); }
}

// IMAGEN
function handleImageUpload(event) {
  const file = event.target.files[0]; if (!file) return;
  if (file.size > 2 * 1024 * 1024) { showToast('⚠ Imagen muy grande. Máx 2MB.', 'error'); return; }
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

function showToast(msg, type = 'success') {
  const container = document.getElementById('toast-container');
  const t = document.createElement('div'); t.className = `toast toast-${type}`; t.textContent = msg;
  container.appendChild(t); setTimeout(() => t.remove(), 3500);
}

// ========================
// EXPONER AL SCOPE GLOBAL
// ========================
window.handleLogin = handleLogin;
window.handleLogout = handleLogout;
window.switchTab = switchTab;
window.saveProduct = saveProduct;
window.editProduct = editProduct;
window.cancelEdit = cancelEdit;
window.clearProductForm = clearProductForm;
window.deleteProduct = deleteProduct;
window.toggleStatus = toggleStatus;
window.addSpecRow = addSpecRow;
window.selectEmoji = selectEmoji;
window.handleImageUpload = handleImageUpload;
window.clearImage = clearImage;
window.addCategory = addCategory;
window.deleteCategory = deleteCategory;
window.deleteOrder = deleteOrder;
window.clearOrders = clearOrders;
window.applySiteSettings = applySiteSettings;
window.resetAll = resetAll;
window.updateWhatsApp = updateWhatsApp;

// ========================
// INIT
// ========================
supabase.auth.onAuthStateChange((_event, session) => {
  if (!session) showLoginScreen();
});
initData();
checkSession();
