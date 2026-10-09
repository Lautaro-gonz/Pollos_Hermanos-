// TEMPORAL — imágenes de relleno de Unsplash mientras se cargan las fotos reales
// desde el panel de admin. Borrar este archivo cuando todos los productos tengan foto.

const unsplash = (id, w = 800) =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&h=${Math.round(w * 0.75)}&q=70`;

const IMAGES = {
  polloAsado: unsplash('1598103442097-8b74394b95c6'),
  polloGrill: unsplash('1532550907401-a500c9a57435'),
  polloFrito: unsplash('1626645738196-c2a7c87a8f58'),
  tiras: unsplash('1562967914-608f82629710'),
  milanesa: unsplash('1585325701956-60dd9c8553bc'),
  sandwich: unsplash('1606755962773-d324e0a13086'),
  burger: unsplash('1568901346375-23c9450c58cd'),
  burgerClasica: unsplash('1571091718767-18b5b1457add'),
  burgerDuo: unsplash('1550547660-d9450f859349'),
  combo: unsplash('1594212699903-ec8a3eca50f5'),
  papas: unsplash('1573080496219-bb080dd4f877'),
};

const KEYWORDS = [
  [/papa|frita/i, IMAGES.papas],
  [/combo|familiar/i, IMAGES.combo],
  [/milanesa/i, IMAGES.milanesa],
  [/hambur|burger/i, IMAGES.burger],
  [/suprema|pechuga/i, IMAGES.polloGrill],
  [/arrollado|fiambre/i, IMAGES.polloGrill],
  [/patita|muslito|muslo|pata\b/i, IMAGES.polloAsado],
  [/\bala|alita/i, IMAGES.polloFrito],
  [/tira|nugget|crisp|crocante|frito/i, IMAGES.tiras],
  [/sandw|sánd/i, IMAGES.sandwich],
  [/medio|grill|plancha/i, IMAGES.polloGrill],
  [/pollo|brasa|asad/i, IMAGES.polloAsado],
];

const ROTATION = Object.values(IMAGES);

/** Imagen de relleno coherente con el nombre/categoría del producto. */
export function placeholderImage(product, index = 0) {
  const text = `${product.name ?? ''} ${product.category ?? ''}`;
  const match = KEYWORDS.find(([re]) => re.test(text));
  return match ? match[1] : ROTATION[index % ROTATION.length];
}

/** Menú de demostración: se muestra solo si Supabase todavía no está configurado. */
export const DEMO_PRODUCTS = [
  { id: 'demo-1',  name: 'Milanesas de pollo',           description: null, category: 'Milanesas',       price: 11000, unit: 'kg',     sale_price: null, badge: null, image_url: IMAGES.milanesa },
  { id: 'demo-2',  name: 'Milanesas de carne de peceto', description: null, category: 'Milanesas',       price: 17500, unit: 'kg',     sale_price: null, badge: null, image_url: IMAGES.milanesa },
  { id: 'demo-3',  name: 'Hamburguesas de pollo',        description: null, category: 'Hamburguesas',    price: 10500, unit: 'kg',     sale_price: null, badge: null, image_url: IMAGES.burger },
  { id: 'demo-4',  name: 'Hamburguesas de carne',        description: null, category: 'Hamburguesas',    price: 15000, unit: 'kg',     sale_price: null, badge: null, image_url: IMAGES.burgerClasica },
  { id: 'demo-5',  name: 'Supremas',                     description: null, category: 'Cortes de pollo', price: 13000, unit: 'kg',     sale_price: null, badge: null, image_url: IMAGES.polloGrill },
  { id: 'demo-6',  name: 'Patitas de pollo',             description: null, category: 'Cortes de pollo', price: 6300,  unit: 'kg',     sale_price: null, badge: null, image_url: IMAGES.polloAsado },
  { id: 'demo-7',  name: 'Muslitos de pollo',            description: null, category: 'Cortes de pollo', price: 6300,  unit: 'kg',     sale_price: null, badge: null, image_url: IMAGES.polloAsado },
  { id: 'demo-8',  name: 'Pata muslo entera',            description: null, category: 'Cortes de pollo', price: 5300,  unit: 'kg',     sale_price: null, badge: null, image_url: IMAGES.polloAsado },
  { id: 'demo-9',  name: 'Alas de pollo',                description: null, category: 'Cortes de pollo', price: 4500,  unit: 'kg',     sale_price: null, badge: null, image_url: IMAGES.polloFrito },
  { id: 'demo-10', name: 'Arrollado de pollo',           description: null, category: 'Arrollados',      price: 18000, unit: 'unidad', sale_price: null, badge: null, image_url: IMAGES.polloGrill },
];
