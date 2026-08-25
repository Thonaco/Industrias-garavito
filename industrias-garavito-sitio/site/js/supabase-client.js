// ========================
// SUPABASE CONFIG (compartido por todas las páginas)
// ========================
// NOTA DE SEGURIDAD: esta clave es la "anon/publishable key" de Supabase.
// Está diseñada para ser pública (viaja en el navegador de cualquier visitante),
// así que no es un secreto que se pueda "esconder" moviéndola a otro archivo.
// La seguridad real se logra con Row Level Security (RLS) en la base de datos:
// ver /sql/security_setup.sql y el archivo README-SEGURIDAD.md incluidos.
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

export const SUPABASE_URL = "https://juvngeftlkqghlwmnmro.supabase.co";
export const SUPABASE_KEY = "sb_publishable_wJQMZheTqWUkK9LtCTNqPQ_xppWGUAk";

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ========================
// UTILIDADES DE SEGURIDAD
// ========================
// Escapa HTML antes de insertarlo con innerHTML, para evitar que un nombre,
// descripción o especificación de producto pueda inyectar <script> u otro
// código (XSS). Úsese en TODO texto dinámico que venga de la base de datos
// o de formularios antes de insertarlo en el DOM.
export function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

// ========================
// CARRITO — helpers compartidos (localStorage, por sesión de navegador)
// ========================
export function getCartLocal() {
  try { return JSON.parse(localStorage.getItem('ig_cart') || '[]'); }
  catch { return []; }
}
export function saveCartLocal(cart) {
  localStorage.setItem('ig_cart', JSON.stringify(cart));
}
export function getCartCount() {
  return getCartLocal().reduce((a, i) => a + i.qty, 0);
}

// Refleja el contador del carrito en cualquier página que tenga #cart-count
export function updateCartBadge() {
  const el = document.getElementById('cart-count');
  if (!el) return;
  const total = getCartCount();
  el.textContent = total;
  el.style.display = total > 0 ? 'flex' : 'none';
}

// ========================
// WHATSAPP
// ========================
export function getWANumber(siteSettings) {
  return (siteSettings && siteSettings.whatsapp) ? siteSettings.whatsapp.replace(/\D/g, '') : '';
}
