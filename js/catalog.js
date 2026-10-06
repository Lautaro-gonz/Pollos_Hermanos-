import { supabase, isSupabaseConfigured, formatPrice } from './supabase.js';
import { observeReveal } from './motion.js';
import { placeholderImage, DEMO_PRODUCTS } from './placeholders.js';
import { addToCart, syncCartWithProducts } from './cart.js';
import { storeStatus, DAY_NAMES } from './hours.js';

const grid = document.getElementById('product-grid');
const filters = document.getElementById('category-filters');
const countLabel = document.getElementById('catalog-count');

let products = [];
let activeCategory = 'Todo';
let demoMode = false;

document.getElementById('year').textContent = new Date().getFullYear();

// Cartel del hero: "Abierto ahora" / "Cerrado · abrimos ..." según los horarios reales
const statusTag = document.getElementById('store-status');

function updateStoreStatus() {
  const s = storeStatus();
  statusTag.classList.toggle('is-closed', !s.open);
  if (s.open) {
    statusTag.textContent = `Abierto ahora · hasta las ${s.closesAt}`;
  } else if (s.nextDay) {
    const when = s.daysAhead === 0 ? 'hoy'
      : s.daysAhead === 1 ? 'mañana'
      : `el ${DAY_NAMES[s.nextDay.getDay()]}`;
    statusTag.textContent = `Cerrado ahora · abrimos ${when} a las ${s.opensAt}`;
  }
}

updateStoreStatus();
setInterval(updateStoreStatus, 60_000);

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text; // textContent: nunca inyectar HTML de la DB
  return node;
}

const ICON_PLUS = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M12 6v12M6 12h12"/></svg>';
const ICON_CHECK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>';

// Feedback breve en el botón: "✓ Agregado" y vuelve a su estado normal
function confirmAdded(btn) {
  clearTimeout(btn._resetTimer);
  btn.classList.add('is-added');
  btn.innerHTML = `${ICON_CHECK}<span>Agregado</span>`;
  btn._resetTimer = setTimeout(() => {
    btn.classList.remove('is-added');
    btn.innerHTML = `${ICON_PLUS}<span>Agregar</span>`;
  }, 1400);
}

function renderStatus(message) {
  grid.replaceChildren(el('p', 'catalog-status', message));
  countLabel.textContent = '';
}

function renderCard(product, index) {
  const card = el('article', 'product-card');
  card.dataset.id = product.id;

  const media = el('div', 'product-card-image');
  const img = el('img');
  img.src = product.image_url || placeholderImage(product, index);
  img.alt = product.name;
  img.loading = 'lazy';
  img.decoding = 'async';
  img.dataset.loading = '';
  const showImg = () => img.removeAttribute('data-loading');
  img.addEventListener('load', showImg, { once: true });
  img.addEventListener('error', showImg, { once: true });
  media.append(img);
  if (product.badge) media.append(el('span', 'badge', product.badge));

  const body = el('div', 'product-card-body');
  if (product.category) body.append(el('span', 'product-category', product.category));
  body.append(el('h3', 'product-name', product.name));
  if (product.description) body.append(el('p', 'product-desc', product.description));

  const priceRow = el('p', 'price-row');
  const onSale = product.sale_price != null && Number(product.sale_price) < Number(product.price);
  if (onSale) {
    const off = Math.round((1 - product.sale_price / product.price) * 100);
    priceRow.append(
      el('span', 'price price--sale', formatPrice(product.sale_price)),
      el('span', 'price--original', formatPrice(product.price)),
      el('span', 'price-off', `-${off}%`),
    );
  } else {
    priceRow.append(el('span', 'price', formatPrice(product.price)));
  }

  const addBtn = el('button', 'btn btn-primary btn-sm btn-add');
  addBtn.type = 'button';
  addBtn.setAttribute('aria-label', `Agregar ${product.name} al carrito`);
  addBtn.innerHTML = `${ICON_PLUS}<span>Agregar</span>`;
  addBtn.addEventListener('click', () => {
    addToCart(product, img.currentSrc || img.src);
    confirmAdded(addBtn);
  });

  const footer = el('div', 'product-footer');
  footer.append(priceRow, addBtn);
  body.append(footer);

  card.append(media, body);
  return card;
}

function renderGrid() {
  const visible = activeCategory === 'Todo'
    ? products
    : products.filter((p) => p.category === activeCategory);

  if (!visible.length) {
    renderStatus('No hay productos disponibles por ahora.');
    return;
  }

  const cards = visible.map(renderCard);
  grid.replaceChildren(...cards);
  observeReveal(cards, { stagger: 80 });
  if (!demoMode) countLabel.textContent = `${visible.length} ${visible.length === 1 ? 'producto' : 'productos'}`;
}

function renderFilters() {
  const categories = [...new Set(products.map((p) => p.category).filter(Boolean))];
  if (categories.length < 2) {
    filters.hidden = true;
    return;
  }

  filters.hidden = false;
  const chips = ['Todo', ...categories].map((name) => {
    const chip = el('button', 'chip', name);
    chip.type = 'button';
    chip.setAttribute('aria-pressed', String(name === activeCategory));
    chip.addEventListener('click', () => {
      if (name === activeCategory) return;
      activeCategory = name;
      filters.querySelectorAll('.chip').forEach((c) =>
        c.setAttribute('aria-pressed', String(c.textContent === name)));
      renderGrid();
    });
    return chip;
  });
  filters.replaceChildren(...chips);
  observeReveal(chips, { stagger: 50 });
}

async function loadProducts() {
  if (!isSupabaseConfigured) {
    // TEMPORAL: menú de demostración hasta completar js/config.js
    console.info('[catálogo] Supabase sin configurar: mostrando productos de demostración.');
    demoMode = true;
    products = DEMO_PRODUCTS;
    syncCartWithProducts(products);
    renderFilters();
    renderGrid();
    countLabel.replaceChildren(el('span', 'demo-notice', 'Vista previa · productos de ejemplo'));
    return;
  }

  const { data, error } = await supabase
    .from('products')
    .select('id, name, description, category, price, sale_price, image_url, badge')
    .eq('is_available', true)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error cargando productos:', error);
    renderStatus('No pudimos cargar el menú. Probá de nuevo en unos minutos.');
    return;
  }

  products = data;
  syncCartWithProducts(products);
  renderFilters();
  renderGrid();
}

loadProducts();
