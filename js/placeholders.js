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
  [/tira|nugget|crisp|crocante|frito/i, IMAGES.tiras],
  [/sandw|sánd/i, IMAGES.sandwich],
  [/hambur|burger/i, IMAGES.burger],
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
  { id: 'demo-1', name: 'Pollo entero a las brasas', description: 'Dorado lento, con limón y chimichurri de la casa.', category: 'Pollos', price: 18000, sale_price: null, badge: 'Más pedido', image_url: IMAGES.polloAsado },
  { id: 'demo-2', name: 'Balde de pollo crocante', description: '8 presas rebozadas con nuestra mezcla secreta de especias.', category: 'Pollos', price: 21000, sale_price: 18500, badge: null, image_url: IMAGES.polloFrito },
  { id: 'demo-3', name: 'Tiras de pollo', description: '10 tiras crocantes con salsa de ajo suave.', category: 'Pollos', price: 9500, sale_price: null, badge: null, image_url: IMAGES.tiras },
  { id: 'demo-4', name: 'Sándwich de pollo crispy', description: 'Pan brioche, pollo crocante, pickles y salsa picante.', category: 'Sándwiches', price: 8500, sale_price: null, badge: 'Nuevo', image_url: IMAGES.sandwich },
  { id: 'demo-5', name: 'Hamburguesa doble cheddar', description: 'Doble medallón, cheddar fundido, lechuga y tomate.', category: 'Hamburguesas', price: 9800, sale_price: null, badge: null, image_url: IMAGES.burger },
  { id: 'demo-6', name: 'Combo hamburguesa + papas', description: 'Hamburguesa completa con papas fritas medianas.', category: 'Combos', price: 12500, sale_price: 11000, badge: null, image_url: IMAGES.combo },
  { id: 'demo-7', name: 'Milanesa de pollo', description: 'Con limón grillado. Ideal para acompañar con ensalada.', category: 'Pollos', price: 8900, sale_price: null, badge: null, image_url: IMAGES.milanesa },
  { id: 'demo-8', name: 'Papas fritas grandes', description: 'Cortadas a mano, con sal y perejil.', category: 'Guarniciones', price: 6000, sale_price: null, badge: null, image_url: IMAGES.papas },
];
