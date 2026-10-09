import { supabase, isSupabaseConfigured, formatPrice } from '../supabase.js';
import { STORAGE_BUCKET } from '../config.js';
import { getSession, checkIsAdmin, signOut } from './session.js';
import { UNITS, unitOf } from '../units.js';

const $ = (id) => document.getElementById(id);

const goToLogin = () => window.location.replace('login.html');

/* ---------------------------------------------------------------------------
   Estado
   --------------------------------------------------------------------------- */

/** @type {any[]} */
let products = [];
let statusFilter = 'all';
let query = '';

const list = $('product-list');

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function svg(path, extra = '') {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}>${path}</svg>`;
}

const ICON_EDIT = '<path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4Z"/><path d="m13.5 6.5 4 4"/>';
const ICON_TRASH = '<path d="M5 7h14M10 11v6M14 11v6M6 7l1 12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-12M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>';
const ICON_PHOTO = '<rect x="3" y="5" width="18" height="14" rx="3"/><circle cx="9" cy="10" r="1.8"/><path d="m21 16-5-5-8 8"/>';

/* ---------------------------------------------------------------------------
   Toasts
   --------------------------------------------------------------------------- */

function toast(message, type = 'ok') {
  const t = el('div', `toast${type === 'error' ? ' toast--error' : ''}`, message);
  $('toasts').append(t);
  setTimeout(() => {
    t.classList.add('is-leaving');
    t.addEventListener('animationend', () => t.remove(), { once: true });
  }, type === 'error' ? 5000 : 2800);
}

/* ---------------------------------------------------------------------------
   Datos
   --------------------------------------------------------------------------- */

async function loadProducts() {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) {
    console.error(error);
    list.replaceChildren(el('div', 'admin-empty', 'No pudimos cargar los productos. Recargá la página.'));
    return;
  }
  products = data;
  render();
}

/* ---------------------------------------------------------------------------
   Render de la lista
   --------------------------------------------------------------------------- */

function renderStats() {
  $('stat-total').textContent = products.length;
  $('stat-visible').textContent = products.filter((p) => p.is_available).length;
  $('stat-sale').textContent = products.filter(
    (p) => p.sale_price != null && Number(p.sale_price) < Number(p.price),
  ).length;

  const categories = [...new Set(products.map((p) => p.category).filter(Boolean))].sort();
  $('category-options').replaceChildren(...categories.map((c) => {
    const o = el('option');
    o.value = c;
    return o;
  }));
}

function visibleProducts() {
  const q = query.toLowerCase();
  return products.filter((p) => {
    if (statusFilter === 'visible' && !p.is_available) return false;
    if (statusFilter === 'hidden' && p.is_available) return false;
    if (!q) return true;
    return `${p.name} ${p.category ?? ''} ${p.badge ?? ''}`.toLowerCase().includes(q);
  });
}

function renderRow(p, index) {
  const row = el('article', 'admin-row fade-up');
  row.style.setProperty('--delay', `${Math.min(index, 10) * 40}ms`);
  row.classList.toggle('is-hidden-product', !p.is_available);
  row.dataset.id = p.id;

  // Miniatura
  const thumb = el('div', 'admin-thumb');
  if (p.image_url) {
    const img = el('img');
    img.src = p.image_url;
    img.alt = '';
    img.loading = 'lazy';
    thumb.append(img);
  } else {
    thumb.classList.add('admin-thumb--empty');
    thumb.innerHTML = svg(ICON_PHOTO);
    thumb.title = 'Sin foto';
  }

  // Nombre + categoría
  const info = el('div', 'admin-row-info');
  info.append(el('p', 'admin-row-name', p.name));
  const meta = el('div', 'admin-row-meta');
  meta.append(el('span', '', p.category || 'Sin categoría'));
  if (p.badge) meta.append(el('span', 'badge', p.badge));
  info.append(meta);

  // Precio
  const price = el('div', 'admin-row-price');
  const onSale = p.sale_price != null && Number(p.sale_price) < Number(p.price);
  if (onSale) {
    price.append(
      el('span', 'price price--sale', formatPrice(p.sale_price)),
      el('span', 'price--original', formatPrice(p.price)),
    );
  } else {
    price.append(el('span', 'price', formatPrice(p.price)));
  }
  price.append(el('span', 'price-unit', unitOf(p).priceSuffix));

  // Visible (switch con guardado instantáneo)
  const sw = el('label', 'switch');
  const input = el('input');
  input.type = 'checkbox';
  input.setAttribute('role', 'switch');
  input.checked = p.is_available;
  input.setAttribute('aria-label', `Visible en la tienda: ${p.name}`);
  const label = el('span', 'switch-label', p.is_available ? 'Visible' : 'Oculto');
  input.addEventListener('change', () => toggleAvailability(p, input, label, row));
  sw.append(input, el('span', 'switch-track'), label);

  // Acciones
  const actions = el('div', 'admin-row-actions');
  const editBtn = el('button', 'icon-action');
  editBtn.type = 'button';
  editBtn.innerHTML = svg(ICON_EDIT);
  editBtn.setAttribute('aria-label', `Editar ${p.name}`);
  editBtn.title = 'Editar';
  editBtn.addEventListener('click', () => openEditor(p));

  const delBtn = el('button', 'icon-action icon-action--danger');
  delBtn.type = 'button';
  delBtn.innerHTML = svg(ICON_TRASH);
  delBtn.setAttribute('aria-label', `Eliminar ${p.name}`);
  delBtn.title = 'Eliminar';
  delBtn.addEventListener('click', () => confirmDelete(p, row));

  actions.append(editBtn, delBtn);
  row.append(thumb, info, price, sw, actions);
  return row;
}

function render() {
  renderStats();
  const rows = visibleProducts();

  if (!products.length) {
    const empty = el('div', 'admin-empty');
    empty.append(
      el('p', 'h3', 'Todavía no hay productos'),
      el('p', '', 'Creá el primero con el botón "Nuevo producto".'),
    );
    list.replaceChildren(empty);
    return;
  }
  if (!rows.length) {
    list.replaceChildren(el('div', 'admin-empty', 'Ningún producto coincide con la búsqueda.'));
    return;
  }
  list.replaceChildren(...rows.map(renderRow));
}

/* ---------------------------------------------------------------------------
   Visible / oculto (guardado optimista)
   --------------------------------------------------------------------------- */

async function toggleAvailability(p, input, label, row) {
  const next = input.checked;
  input.disabled = true;
  label.textContent = next ? 'Visible' : 'Oculto';
  row.classList.toggle('is-hidden-product', !next);

  const { error } = await supabase.from('products').update({ is_available: next }).eq('id', p.id);
  input.disabled = false;

  if (error) {
    console.error(error);
    input.checked = !next;
    label.textContent = !next ? 'Visible' : 'Oculto';
    row.classList.toggle('is-hidden-product', next);
    toast('No se pudo actualizar. Probá de nuevo.', 'error');
    return;
  }
  p.is_available = next;
  renderStats();
  toast(next ? `"${p.name}" ya se ve en la tienda` : `"${p.name}" quedó oculto`);
}

/* ---------------------------------------------------------------------------
   Diálogos: helpers de apertura/cierre con animación
   --------------------------------------------------------------------------- */

function openDialog(dialog) {
  dialog.classList.remove('is-closing');
  dialog.showModal();
}

function closeDialog(dialog) {
  if (!dialog.open || dialog.classList.contains('is-closing')) return;
  dialog.classList.add('is-closing');
  setTimeout(() => {
    dialog.classList.remove('is-closing');
    dialog.close();
  }, 250);
}

for (const dialog of document.querySelectorAll('dialog.modal')) {
  dialog.addEventListener('cancel', (e) => {   // tecla Esc → cerrar con animación
    e.preventDefault();
    if (!busy) closeDialog(dialog);
  });
  dialog.addEventListener('click', (e) => {    // clic en el fondo
    if (e.target === dialog && !busy) closeDialog(dialog);
  });
  dialog.querySelectorAll('[data-close]').forEach((b) =>
    b.addEventListener('click', () => !busy && closeDialog(dialog)));
}

let busy = false;

/* ---------------------------------------------------------------------------
   Editor (crear / editar)
   --------------------------------------------------------------------------- */

const editor = $('editor');
const form = $('editor-form');
const submitBtn = $('editor-submit');
const photoInput = $('photo-input');
const photoPreview = $('photo-preview');
const photoEmpty = $('dropzone-empty');
const photoRemove = $('photo-remove');
const photoInfo = $('photo-info');
const dropzone = $('dropzone');

const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_INPUT_BYTES = 20 * 1024 * 1024;  // lo que aceptamos elegir
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;  // límite del bucket
const DEFAULT_PHOTO_INFO = 'La optimizamos automáticamente antes de subirla.';

let editing = null;        // producto que se edita (null = nuevo)
let newPhoto = null;       // Blob optimizado listo para subir
let removePhoto = false;   // el admin pidió quitar la foto actual
let previewUrl = null;

function setFieldError(name, message) {
  const err = form.querySelector(`[data-error-for="${name}"]`);
  if (err) err.textContent = message || '';
  const input = form.elements[name];
  if (input) input.setAttribute('aria-invalid', message ? 'true' : 'false');
}

function showEditorError(message) {
  const box = $('editor-error');
  box.textContent = message || '';
  box.hidden = !message;
}

function setPreview(src) {
  if (previewUrl) URL.revokeObjectURL(previewUrl);
  previewUrl = src?.startsWith('blob:') ? src : null;
  photoPreview.hidden = !src;
  photoEmpty.hidden = !!src;
  photoRemove.hidden = !src;
  if (src) photoPreview.src = src;
  else photoPreview.removeAttribute('src');
}

function openEditor(product = null) {
  editing = product;
  newPhoto = null;
  removePhoto = false;
  form.reset();
  showEditorError('');
  ['name', 'price', 'sale_price', 'photo'].forEach((f) => setFieldError(f, ''));
  photoInfo.textContent = DEFAULT_PHOTO_INFO;

  $('editor-title').textContent = product ? 'Editar producto' : 'Nuevo producto';
  submitBtn.textContent = product ? 'Guardar cambios' : 'Crear producto';

  const f = form.elements;
  if (product) {
    f.name.value = product.name;
    f.price.value = Number(product.price);
    f.sale_price.value = product.sale_price != null ? Number(product.sale_price) : '';
    f.category.value = product.category ?? '';
    f.badge.value = product.badge ?? '';
    f.description.value = product.description ?? '';
    f.sort_order.value = product.sort_order ?? 0;
    f.is_available.checked = product.is_available;
    f.unit.value = unitOf(product).value;
    setPreview(product.image_url || null);
  } else {
    // Nuevo: al final del menú
    f.sort_order.value = products.reduce((max, p) => Math.max(max, p.sort_order ?? 0), 0) + 1;
    f.is_available.checked = true;
    f.unit.value = UNITS.unidad.value;
    setPreview(null);
  }

  syncUnitLabels();
  openDialog(editor);
  setTimeout(() => f.name.focus(), 50);
}

/* ---------- Unidad de venta: unidad o kilo ---------- */

/** Aclara en el formulario a qué se refiere el precio según la unidad elegida. */
function syncUnitLabels() {
  const kg = form.elements.unit.value === 'kg';
  $('unit-hint').textContent = kg
    ? 'El precio que cargues abajo es el del kilo. En la tienda se muestra "por kg" y el cliente elige cuántos kilos lleva.'
    : 'El precio que cargues abajo es el de una unidad.';
  $('price-unit-note').textContent = kg ? 'por kilo' : 'por unidad';
  $('p-price').placeholder = kg ? '11000' : '18000';
}

form.addEventListener('change', (e) => e.target.name === 'unit' && syncUnitLabels());

$('new-product').addEventListener('click', () => openEditor());

/* ---------- Foto: elegir, arrastrar, optimizar ---------- */

async function loadBitmap(file) {
  if ('createImageBitmap' in window) {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch { /* cae al método clásico */ }
  }
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

/** Redimensiona a máx. 1600px y comprime a WEBP (o JPEG si el navegador no soporta WEBP). */
async function optimizeImage(file, maxSide = 1600) {
  const bitmap = await loadBitmap(file);
  const w = bitmap.width;
  const h = bitmap.height;
  const scale = Math.min(1, maxSide / Math.max(w, h));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(h * scale);
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);

  const toBlob = (type, q) => new Promise((r) => canvas.toBlob(r, type, q));
  let blob = await toBlob('image/webp', 0.82);
  if (!blob || blob.type !== 'image/webp') blob = await toBlob('image/jpeg', 0.85);
  return blob;
}

async function handleFile(file) {
  setFieldError('photo', '');
  if (!file) return;
  if (!ACCEPTED.includes(file.type)) {
    setFieldError('photo', 'Formato no soportado. Usá una foto JPG, PNG o WEBP.');
    return;
  }
  if (file.size > MAX_INPUT_BYTES) {
    setFieldError('photo', 'La foto es demasiado pesada (máx. 20 MB).');
    return;
  }

  photoInfo.textContent = 'Optimizando foto…';
  try {
    const blob = await optimizeImage(file);
    if (blob.size > MAX_UPLOAD_BYTES) {
      setFieldError('photo', 'No pudimos achicar la foto lo suficiente. Probá con otra.');
      photoInfo.textContent = DEFAULT_PHOTO_INFO;
      return;
    }
    newPhoto = blob;
    removePhoto = false;
    setPreview(URL.createObjectURL(blob));
    photoInfo.textContent = `Lista para subir · ${(blob.size / 1024).toFixed(0)} KB`;
  } catch (err) {
    console.error(err);
    setFieldError('photo', 'No pudimos leer esa imagen. Probá con otra.');
    photoInfo.textContent = DEFAULT_PHOTO_INFO;
  }
}

photoInput.addEventListener('change', () => {
  handleFile(photoInput.files[0]);
  photoInput.value = ''; // permite volver a elegir el mismo archivo
});

['dragenter', 'dragover'].forEach((ev) => dropzone.addEventListener(ev, (e) => {
  e.preventDefault();
  dropzone.classList.add('is-dragover');
}));
['dragleave', 'drop'].forEach((ev) => dropzone.addEventListener(ev, (e) => {
  e.preventDefault();
  dropzone.classList.remove('is-dragover');
}));
dropzone.addEventListener('drop', (e) => handleFile(e.dataTransfer.files[0]));

photoRemove.addEventListener('click', () => {
  newPhoto = null;
  removePhoto = Boolean(editing?.image_path || editing?.image_url);
  setPreview(null);
  photoInfo.textContent = removePhoto ? 'La foto se quitará al guardar.' : DEFAULT_PHOTO_INFO;
});

/* ---------- Storage ---------- */

async function uploadPhoto(blob) {
  const ext = blob.type === 'image/webp' ? 'webp' : 'jpg';
  const path = `products/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(path, blob, { contentType: blob.type, cacheControl: '31536000', upsert: false });
  if (error) throw error;
  const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path);
  return { path, url: data.publicUrl };
}

async function deletePhoto(path) {
  if (!path) return;
  const { error } = await supabase.storage.from(STORAGE_BUCKET).remove([path]);
  if (error) console.warn('No se pudo borrar la foto anterior:', error);
}

/* ---------- Guardar ---------- */

function readForm() {
  const f = form.elements;
  const num = (v) => (v === '' || v == null ? null : Number(v));
  const text = (v) => v.trim() || null;
  return {
    name: f.name.value.trim(),
    price: num(f.price.value),
    sale_price: num(f.sale_price.value),
    category: text(f.category.value),
    badge: text(f.badge.value),
    description: text(f.description.value),
    unit: f.unit.value === 'kg' ? 'kg' : 'unidad',
    sort_order: Number.isFinite(num(f.sort_order.value)) ? Math.trunc(num(f.sort_order.value)) : 0,
    is_available: f.is_available.checked,
  };
}

function validateForm(data) {
  const errors = {};
  if (!data.name) errors.name = 'Poné un nombre.';
  if (data.price == null || Number.isNaN(data.price)) errors.price = 'Poné un precio.';
  else if (data.price < 0) errors.price = 'El precio no puede ser negativo.';
  if (data.sale_price != null) {
    if (Number.isNaN(data.sale_price) || data.sale_price < 0) errors.sale_price = 'Precio de oferta inválido.';
    else if (data.price != null && data.sale_price >= data.price) errors.sale_price = 'Tiene que ser menor al precio normal.';
  }
  ['name', 'price', 'sale_price'].forEach((k) => setFieldError(k, errors[k]));
  return errors;
}

function setSaving(saving) {
  busy = saving;
  submitBtn.disabled = saving;
  submitBtn.classList.toggle('is-loading', saving);
  if (saving) submitBtn.innerHTML = '<span class="spinner" aria-hidden="true"></span> Guardando…';
  else submitBtn.textContent = editing ? 'Guardar cambios' : 'Crear producto';
}

form.addEventListener('input', (e) => {
  if (e.target.getAttribute('aria-invalid') === 'true') setFieldError(e.target.name, '');
});

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (busy) return;
  showEditorError('');

  const data = readForm();
  const errors = validateForm(data);
  const first = Object.keys(errors)[0];
  if (first) {
    form.elements[first].focus();
    return;
  }

  setSaving(true);
  let uploaded = null;
  const oldPath = editing?.image_path ?? null;

  try {
    if (newPhoto) {
      uploaded = await uploadPhoto(newPhoto);
      data.image_url = uploaded.url;
      data.image_path = uploaded.path;
    } else if (removePhoto) {
      data.image_url = null;
      data.image_path = null;
    }

    const request = editing
      ? supabase.from('products').update(data).eq('id', editing.id).select().single()
      : supabase.from('products').insert(data).select().single();
    const { data: saved, error } = await request;
    if (error) throw error;

    // La foto vieja se borra solo después de guardar bien el producto
    if (editing && (uploaded || removePhoto) && oldPath && oldPath !== saved.image_path) {
      await deletePhoto(oldPath);
    }

    if (editing) products = products.map((p) => (p.id === saved.id ? saved : p));
    else products.push(saved);
    products.sort((a, b) => (a.sort_order - b.sort_order) || a.created_at.localeCompare(b.created_at));

    setSaving(false);
    closeDialog(editor);
    render();
    toast(editing ? 'Cambios guardados' : `"${saved.name}" creado`);
  } catch (err) {
    console.error(err);
    if (uploaded) await deletePhoto(uploaded.path); // no dejar fotos huérfanas
    setSaving(false);
    showEditorError(friendlyDbError(err));
  }
});

function friendlyDbError(err) {
  const msg = (err?.message || '').toLowerCase();
  if (msg.includes('sale_below_price')) return 'El precio de oferta tiene que ser menor al precio normal.';
  if (err?.code === '42703' && msg.includes('unit')) return 'Falta activar la venta por kilo: corré supabase/catalogo.sql en el SQL Editor de Supabase.';
  if (msg.includes('row-level security') || err?.code === '42501') return 'Tu usuario no tiene permisos para hacer esto.';
  if (msg.includes('jwt') || msg.includes('session')) return 'Tu sesión venció. Volvé a ingresar.';
  if (msg.includes('payload too large') || msg.includes('maximum allowed size')) return 'La foto es demasiado pesada.';
  if (msg.includes('failed to fetch') || msg.includes('network')) return 'Sin conexión. Revisá internet y probá de nuevo.';
  return 'No se pudo guardar. Probá de nuevo.';
}

/* ---------------------------------------------------------------------------
   Eliminar
   --------------------------------------------------------------------------- */

const confirmDialog = $('confirm');
const confirmOk = $('confirm-ok');
let pendingDelete = null;

function confirmDelete(product, row) {
  pendingDelete = { product, row };
  $('confirm-text').textContent = `"${product.name}" se borrará del menú junto con su foto. Esta acción no se puede deshacer.`;
  openDialog(confirmDialog);
  setTimeout(() => confirmDialog.querySelector('[data-close]').focus(), 50);
}

confirmOk.addEventListener('click', async () => {
  if (!pendingDelete || busy) return;
  const { product, row } = pendingDelete;
  busy = true;
  confirmOk.disabled = true;
  confirmOk.innerHTML = '<span class="spinner" aria-hidden="true"></span> Eliminando…';

  const { error } = await supabase.from('products').delete().eq('id', product.id);

  busy = false;
  confirmOk.disabled = false;
  confirmOk.textContent = 'Eliminar';

  if (error) {
    console.error(error);
    toast(friendlyDbError(error), 'error');
    return;
  }

  await deletePhoto(product.image_path);
  pendingDelete = null;
  closeDialog(confirmDialog);

  row.classList.add('is-removing');
  setTimeout(() => {
    products = products.filter((p) => p.id !== product.id);
    render();
  }, 300);
  toast(`"${product.name}" eliminado`);
});

/* ---------------------------------------------------------------------------
   Búsqueda, filtros, sesión
   --------------------------------------------------------------------------- */

let searchTimer;
$('search').addEventListener('input', (e) => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    query = e.target.value.trim();
    render();
  }, 150);
});

$('status-filter').addEventListener('click', (e) => {
  const chip = e.target.closest('[data-filter]');
  if (!chip) return;
  statusFilter = chip.dataset.filter;
  $('status-filter').querySelectorAll('.chip').forEach((c) =>
    c.setAttribute('aria-pressed', String(c === chip)));
  render();
});

$('logout').addEventListener('click', async () => {
  await signOut();
  goToLogin();
});

/* ---------------------------------------------------------------------------
   Guardia de acceso: sin sesión de admin → login.html
   (al final del módulo, cuando todo lo de arriba ya está inicializado)
   --------------------------------------------------------------------------- */

async function guard() {
  if (!isSupabaseConfigured) return goToLogin();

  const session = await getSession();
  if (!session) return goToLogin();

  if (!(await checkIsAdmin())) {
    await signOut();
    return goToLogin();
  }

  $('admin-user').textContent = session.user.email;
  document.body.classList.remove('is-checking');
  loadProducts();

  supabase.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_OUT') goToLogin();
  });
}

guard();
