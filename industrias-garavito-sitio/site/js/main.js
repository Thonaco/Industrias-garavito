import { supabase, getWANumber, updateCartBadge } from './supabase-client.js';

// ========================
// TOAST
// ========================
export function showToast(msg, type = 'success') {
  const box = document.getElementById('toast-container');
  if (!box) return;
  const t = document.createElement('div');
  t.className = `toast toast-${type}`;
  t.textContent = msg;
  box.appendChild(t);
  setTimeout(() => t.remove(), 3500);
}
window.showToast = showToast;

// ========================
// MENÚ MÓVIL
// ========================
window.toggleMobileMenu = () => document.getElementById('mobile-menu')?.classList.toggle('open');
window.closeMobileMenu = () => document.getElementById('mobile-menu')?.classList.remove('open');

// ========================
// CURSOR PERSONALIZADO
// ========================
function initCursor() {
  const cur = document.getElementById('cursor');
  const trail = document.getElementById('cursor-trail');
  if (!cur || !trail) return;
  let mx = 0, my = 0, tx = 0, ty = 0;
  if (window.matchMedia('(pointer:fine)').matches) {
    document.addEventListener('mousemove', e => {
      mx = e.clientX; my = e.clientY;
      cur.style.left = (mx - 6) + 'px'; cur.style.top = (my - 6) + 'px';
    });
    function animTrail() {
      tx += (mx - tx) * 0.12; ty += (my - ty) * 0.12;
      trail.style.left = (tx - 16) + 'px'; trail.style.top = (ty - 16) + 'px';
      requestAnimationFrame(animTrail);
    }
    animTrail();
  }
}

// ========================
// SCROLL REVEAL
// ========================
function initReveal() {
  const obs = new IntersectionObserver(entries => entries.forEach(e => {
    if (e.isIntersecting) e.target.classList.add('visible');
  }), { threshold: 0.1 });
  document.querySelectorAll('.reveal').forEach(el => obs.observe(el));
}

// ========================
// CONFIGURACIÓN DEL SITIO (nombre, eslogan, WhatsApp) — solo lectura
// ========================
let cachedSettings = {};
export async function loadSiteSettingsPublic() {
  try {
    const { data: row } = await supabase.from('config').select('value').eq('key', 'settings').maybeSingle();
    const settings = row?.value || {};
    cachedSettings = settings;
    applySiteSettingsToChrome(settings);
    return settings;
  } catch (e) {
    console.error('Error cargando configuración del sitio:', e);
    return {};
  }
}

// ========================
// FORMULARIO DE CONTACTO
// ========================
function submitContact(e) {
  e.preventDefault();
  // Honeypot anti-bot: campo oculto que un humano nunca llena.
  if (document.getElementById('contact-hp')?.value) return;
  const n = document.getElementById('contact-nombre').value.trim();
  const email = document.getElementById('contact-email').value.trim();
  if (!n || !email) { showToast('⚠ Completa nombre y email', 'error'); return; }
  const waNum = getWANumber(cachedSettings);
  if (!waNum) { showToast('⚠ El WhatsApp de la tienda aún no está configurado', 'error'); return; }
  const msg = encodeURIComponent(`📨 *Consulta*\n\nNombre: ${n}\nEmail: ${email}\n\nMe interesa información sobre sus productos.`);
  window.open(`https://wa.me/${waNum}?text=${msg}`, '_blank', 'noopener,noreferrer');
  document.getElementById('contact-nombre').value = '';
  document.getElementById('contact-email').value = '';
  showToast('✓ Abriendo WhatsApp...', 'success');
}
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('contact-form')?.addEventListener('submit', submitContact);
});

function applySiteSettingsToChrome(settings) {
  const logoEl = document.getElementById('site-logo');
  if (logoEl && settings.nombre) {
    logoEl.innerHTML = settings.nombre.toUpperCase().replace('/', ' <span>/</span> ');
  }
  const footerLogo = document.getElementById('footer-logo');
  const footerText = document.getElementById('footer-text');
  if (footerLogo && settings.nombre) footerLogo.textContent = settings.nombre.toUpperCase();
  if (footerText) {
    const nombre = settings.nombre || 'Industrias Garavito';
    footerText.textContent = `© ${new Date().getFullYear()} ${nombre} · Fabricante de Tecnología · Guatemala`;
  }
  const wa = document.getElementById('wa-float');
  if (wa) {
    const num = getWANumber(settings);
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
}

// ========================
// INIT COMÚN
// ========================
export function initShared() {
  initCursor();
  initReveal();
  updateCartBadge();
  loadSiteSettingsPublic();
}

document.addEventListener('DOMContentLoaded', initShared);
