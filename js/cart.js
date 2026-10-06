// Carrito lateral + formulario de reserva + envío del pedido por WhatsApp.

import { formatPrice } from './supabase.js';
import { WHATSAPP_NUMBER } from './config.js';
import {
  DAY_NAMES, rangesFor, isClosedDay, isWithinHours, describeDay, firstBookableDay,
} from './hours.js';

const STORAGE_KEY = 'lph-cart-v1';
const MIN_LEAD_MINUTES = 30;   // anticipación mínima para retirar
const MAX_DAYS_AHEAD = 14;     // hasta cuántos días adelante se puede reservar

/* ---------------------------------------------------------------------------
   Estado
   --------------------------------------------------------------------------- */

/** @type {{ id: string, name: string, price: number, image: string, qty: number }[]} */
let items = load();

function load() {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return Array.isArray(data) ? data.filter((i) => i && i.id && i.qty > 0) : [];
  } catch {
    return [];
  }
}

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    /* modo privado / storage bloqueado: el carrito funciona igual en memoria */
  }
}

const totalQty = () => items.reduce((sum, i) => sum + i.qty, 0);
const totalPrice = () => items.reduce((sum, i) => sum + i.qty * i.price, 0);

/** Precio efectivo de un producto (con descuento si corresponde). */
export function effectivePrice(product) {
  const sale = product.sale_price != null && Number(product.sale_price) < Number(product.price);
  return Number(sale ? product.sale_price : product.price);
}

export function addToCart(product, image) {
  const existing = items.find((i) => i.id === product.id);
  if (existing) {
    existing.qty += 1;
  } else {
    items.push({
      id: product.id,
      name: product.name,
      price: effectivePrice(product),
      image: image || product.image_url || '',
      qty: 1,
    });
  }
  commit();
  bumpBadge();
}

function setQty(id, qty) {
  if (qty <= 0) items = items.filter((i) => i.id !== id);
  else {
    const item = items.find((i) => i.id === id);
    if (item) item.qty = Math.min(qty, 99);
  }
  commit();
}

function clearCart() {
  items = [];
  commit();
}

/**
 * Actualiza nombre/precio con los datos vigentes del catálogo y quita
 * productos que ya no existen o no están disponibles.
 */
export function syncCartWithProducts(products) {
  const byId = new Map(products.map((p) => [p.id, p]));
  const before = JSON.stringify(items);
  items = items
    .filter((i) => byId.has(i.id))
    .map((i) => {
      const p = byId.get(i.id);
      return { ...i, name: p.name, price: effectivePrice(p), image: i.image || p.image_url || '' };
    });
  if (JSON.stringify(items) !== before) commit();
}

function commit() {
  save();
  render();
}

/* ---------------------------------------------------------------------------
   DOM
   --------------------------------------------------------------------------- */

const $ = (id) => document.getElementById(id);

const drawer = $('cart-drawer');
const overlay = $('cart-overlay');
const toggleBtn = $('cart-toggle');
const badge = $('cart-count');
const list = $('cart-items');
const emptyState = $('cart-empty');
const footer = $('cart-footer');
const subtotalEl = $('cart-subtotal');
const formTotalEl = $('checkout-total');
const form = $('checkout-form');
const successLink = $('checkout-wa-link');

const views = {
  cart: $('cart-view'),
  checkout: $('checkout-view'),
  success: $('success-view'),
};

let lastFocus = null;

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function iconButton(label, path, onClick, className = 'qty-btn') {
  const btn = el('button', className);
  btn.type = 'button';
  btn.setAttribute('aria-label', label);
  btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">${path}</svg>`;
  btn.addEventListener('click', onClick);
  return btn;
}

const ICON_MINUS = '<path d="M6 12h12"/>';
const ICON_PLUS = '<path d="M12 6v12M6 12h12"/>';
const ICON_TRASH = '<path d="M5 7h14M10 11v6M14 11v6M6 7l1 12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-12M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>';

function renderItem(item) {
  const li = el('li', 'cart-item');

  const thumb = el('div', 'cart-item-thumb');
  if (item.image) {
    const img = el('img');
    img.src = item.image;
    img.alt = '';
    img.loading = 'lazy';
    thumb.append(img);
  }

  const info = el('div', 'cart-item-info');
  info.append(
    el('p', 'cart-item-name', item.name),
    el('p', 'cart-item-unit', `${formatPrice(item.price)} c/u`),
  );

  const stepper = el('div', 'qty-stepper');
  stepper.append(
    iconButton(`Quitar uno de ${item.name}`, ICON_MINUS, () => setQty(item.id, item.qty - 1)),
    el('span', 'qty-value', String(item.qty)),
    iconButton(`Agregar uno de ${item.name}`, ICON_PLUS, () => setQty(item.id, item.qty + 1)),
  );
  info.append(stepper);

  const side = el('div', 'cart-item-side');
  side.append(
    iconButton(`Eliminar ${item.name}`, ICON_TRASH, () => setQty(item.id, 0), 'cart-item-remove'),
    el('p', 'cart-item-total', formatPrice(item.price * item.qty)),
  );

  li.append(thumb, info, side);
  return li;
}

function render() {
  const qty = totalQty();
  badge.textContent = String(qty);
  badge.dataset.count = String(qty);
  toggleBtn.setAttribute('aria-label', qty ? `Abrir pedido (${qty} productos)` : 'Abrir pedido');

  list.replaceChildren(...items.map(renderItem));
  const empty = items.length === 0;
  emptyState.hidden = !empty;
  list.hidden = empty;
  footer.hidden = empty;

  const total = formatPrice(totalPrice());
  subtotalEl.textContent = total;
  formTotalEl.textContent = total;

  // Si se vació el carrito estando en el formulario, volver al listado
  if (empty && currentView === 'checkout') showView('cart');
}

function bumpBadge() {
  toggleBtn.classList.remove('is-bumping');
  void toggleBtn.offsetWidth; // reinicia la animación
  toggleBtn.classList.add('is-bumping');
}

/* ---------------------------------------------------------------------------
   Apertura / cierre del panel
   --------------------------------------------------------------------------- */

let currentView = 'cart';

function showView(name) {
  currentView = name;
  for (const [key, view] of Object.entries(views)) {
    const active = key === name;
    view.hidden = !active;
    view.classList.toggle('is-active', active);
  }
  const focusTarget = views[name].querySelector('[data-autofocus]') || views[name].querySelector('button, input');
  focusTarget?.focus({ preventScroll: true });
}

function openCart() {
  if (drawer.classList.contains('is-open')) return;
  lastFocus = document.activeElement;
  clearTimeout(hideTimer);
  drawer.hidden = false;
  overlay.hidden = false;
  void drawer.offsetWidth; // fuerza el layout para que la transición de entrada se ejecute
  drawer.classList.add('is-open');
  overlay.classList.add('is-open');
  document.documentElement.classList.add('cart-locked');
  toggleBtn.setAttribute('aria-expanded', 'true');
  showView(currentView === 'success' ? 'cart' : currentView);
}

let hideTimer;

function closeCart() {
  if (!drawer.classList.contains('is-open')) return;
  drawer.classList.remove('is-open');
  overlay.classList.remove('is-open');
  document.documentElement.classList.remove('cart-locked');
  toggleBtn.setAttribute('aria-expanded', 'false');
  // Ocultar al terminar la animación de salida (duración en cart.css)
  hideTimer = setTimeout(() => {
    drawer.hidden = true;
    overlay.hidden = true;
    if (currentView === 'success') showView('cart');
  }, 580);
  lastFocus?.focus?.({ preventScroll: true });
}

toggleBtn.addEventListener('click', openCart);
overlay.addEventListener('click', closeCart);
drawer.querySelectorAll('[data-cart-close]').forEach((b) => b.addEventListener('click', closeCart));
$('cart-checkout').addEventListener('click', () => showView('checkout'));
$('checkout-back').addEventListener('click', () => showView('cart'));

document.addEventListener('keydown', (e) => {
  if (!drawer.classList.contains('is-open')) return;
  if (e.key === 'Escape') closeCart();
  if (e.key === 'Tab') trapFocus(e);
});

function trapFocus(e) {
  const focusables = [...drawer.querySelectorAll(
    'button:not([disabled]), a[href], input:not([disabled]), select, textarea',
  )].filter((n) => n.offsetParent !== null);
  if (!focusables.length) return;
  const first = focusables[0];
  const last = focusables[focusables.length - 1];
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
}

/* ---------------------------------------------------------------------------
   Formulario de reserva
   --------------------------------------------------------------------------- */

const pad = (n) => String(n).padStart(2, '0');
const toDateValue = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const timeHint = $('time-hint');

function setDateLimits() {
  const today = new Date();
  const max = new Date();
  max.setDate(max.getDate() + MAX_DAYS_AHEAD);
  form.elements.date.min = toDateValue(today);
  form.elements.date.max = toDateValue(max);
  if (!form.elements.date.value) {
    // Por defecto: el primer día que todavía tenga horario disponible (nunca domingo)
    const first = firstBookableDay(today, MIN_LEAD_MINUTES, MAX_DAYS_AHEAD);
    form.elements.date.value = toDateValue(first || today);
  }
  updateTimeHint();
}

function pickupDate(dateValue, timeValue = '00:00') {
  const [y, m, d] = dateValue.split('-').map(Number);
  const [hh, mm] = timeValue.split(':').map(Number);
  return new Date(y, m - 1, d, hh, mm);
}

/** Muestra el horario del día elegido y ajusta min/max del selector de hora. */
function updateTimeHint() {
  const value = form.elements.date.value;
  if (!value) {
    timeHint.textContent = '';
    return;
  }
  const day = pickupDate(value);
  const ranges = rangesFor(day);
  timeHint.textContent = describeDay(day);
  form.elements.time.min = ranges[0]?.[0] ?? '';
  form.elements.time.max = ranges.at(-1)?.[1] ?? '';
}

/** Errores de fecha/hora según los horarios reales del local. */
function scheduleErrors(dateValue, timeValue) {
  const errors = {};
  if (!dateValue) {
    errors.date = 'Elegí el día de retiro.';
    return errors;
  }

  const day = pickupDate(dateValue);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const max = new Date(today);
  max.setDate(max.getDate() + MAX_DAYS_AHEAD);

  if (day < today) errors.date = 'Esa fecha ya pasó. Elegí hoy o un día próximo.';
  else if (day > max) errors.date = `Podés reservar hasta ${MAX_DAYS_AHEAD} días adelante.`;
  else if (isClosedDay(day)) errors.date = `Los ${DAY_NAMES[day.getDay()]}s estamos cerrados. Elegí otro día y te esperamos.`;

  if (errors.date) return errors;

  if (!timeValue) {
    errors.time = 'Elegí la hora de retiro.';
    return errors;
  }

  const when = pickupDate(dateValue, timeValue);
  if (!isWithinHours(when)) {
    // El horario del día ya se muestra justo arriba (#time-hint), no repetirlo
    errors.time = 'A esa hora estamos cerrados. Elegí un horario dentro de la franja indicada.';
  } else if (when < new Date(Date.now() + MIN_LEAD_MINUTES * 60_000)) {
    errors.time = `Necesitamos al menos ${MIN_LEAD_MINUTES} minutos para preparar tu pedido. Elegí un horario un poco más tarde.`;
  }
  return errors;
}

function setError(field, message) {
  const input = form.elements[field];
  const error = form.querySelector(`[data-error-for="${field}"]`);
  input.setAttribute('aria-invalid', message ? 'true' : 'false');
  if (error) error.textContent = message || '';
}

function validate() {
  const data = {
    name: form.elements.name.value.trim(),
    phone: form.elements.phone.value.trim(),
    date: form.elements.date.value,
    time: form.elements.time.value,
  };
  const errors = {};

  if (data.name.length < 2) errors.name = 'Ingresá tu nombre.';

  const digits = data.phone.replace(/\D/g, '');
  if (digits.length < 8 || digits.length > 13) errors.phone = 'Ingresá un teléfono válido (ej: 376 4123456).';

  Object.assign(errors, scheduleErrors(data.date, data.time));

  for (const field of ['name', 'phone', 'date', 'time']) setError(field, errors[field]);
  return { data, errors };
}

function buildMessage({ name, phone, date, time }) {
  const when = pickupDate(date, time);
  const day = when.toLocaleDateString('es-AR', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });

  const lines = [
    '*NUEVO PEDIDO — Los Pollos Hermanos*',
    '',
    '*Detalle del pedido:*',
    ...items.map((i) => `• ${i.qty} x ${i.name} — ${formatPrice(i.price * i.qty)}`),
    '',
    `*TOTAL: ${formatPrice(totalPrice())}*`,
    '',
    '*Datos del cliente:*',
    `Nombre: ${name}`,
    `Teléfono: ${phone}`,
    `Retiro: ${day.charAt(0).toUpperCase()}${day.slice(1)} a las ${time} hs`,
    '',
    'Pago al retirar en el local. ¡Gracias!',
  ];
  return lines.join('\n');
}

function whatsappUrl(message) {
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
}

form.addEventListener('submit', (e) => {
  e.preventDefault();
  if (!items.length) return;

  const { data, errors } = validate();
  const firstError = Object.keys(errors)[0];
  if (firstError) {
    form.elements[firstError].focus();
    return;
  }

  const url = whatsappUrl(buildMessage(data));
  successLink.href = url;

  // Abrir WhatsApp en otra pestaña; si el navegador lo bloquea, navegar en la misma
  // (sin 'noopener' en features: con él window.open siempre devuelve null)
  const win = window.open(url, '_blank');
  if (win) win.opener = null;
  else window.location.href = url;

  clearCart();
  form.reset();
  setDateLimits();
  showView('success');
});

// Limpia el error de un campo apenas el usuario lo corrige
form.addEventListener('input', (e) => {
  if (e.target.name && e.target.getAttribute('aria-invalid') === 'true') setError(e.target.name, '');
});

// Fecha/hora: se validan apenas se eligen, sin esperar al envío
form.addEventListener('change', (e) => {
  if (e.target.name !== 'date' && e.target.name !== 'time') return;
  if (e.target.name === 'date') updateTimeHint();
  const { date, time } = form.elements;
  const errors = scheduleErrors(date.value, time.value);
  setError('date', errors.date);
  // Solo marcar la hora si ya se eligió una (no regañar antes de tiempo)
  setError('time', time.value ? errors.time : '');
});

setDateLimits();
render();
