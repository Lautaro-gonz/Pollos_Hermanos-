// Unidad de venta de cada producto: por unidad o por kilo.
// La columna `unit` de la tabla products guarda 'unidad' (por defecto) o 'kg'.

import { formatPrice } from './supabase.js';

export const UNITS = {
  unidad: {
    value: 'unidad',
    label: 'Por unidad',
    short: 'u',
    step: 1,          // el carrito suma/resta de a 1
    addStep: 1,       // lo que agrega el botón "Agregar" del menú
    stepLabel: 'uno',
    priceSuffix: 'c/u',
  },
  kg: {
    value: 'kg',
    label: 'Por kilo',
    short: 'kg',
    step: 0.5,        // dentro del carrito se ajusta de a medio kilo
    addStep: 1,       // el botón "Agregar" del menú suma un kilo entero
    stepLabel: 'medio kilo',
    priceSuffix: 'por kg',
  },
};

/** Unidad de venta de un producto o ítem del carrito (por defecto, 'unidad'). */
export const unitOf = (p) => (p?.unit === 'kg' ? UNITS.kg : UNITS.unidad);

export const isKg = (p) => unitOf(p).value === 'kg';

const qtyFormat = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 });

/** Redondea al múltiplo del paso para que no se acumulen decimales raros. */
export function roundQty(qty, unit) {
  const { step } = unitOf({ unit });
  return Math.round(qty / step) * step;
}

/** "1,5 kg" para los productos por kilo · "2" para los que van por unidad. */
export function formatQty(qty, unit) {
  const u = unitOf({ unit });
  return u.value === 'kg' ? `${qtyFormat.format(qty)} kg` : qtyFormat.format(qty);
}

/** "$ 11.000 por kg" · "$ 18.000 c/u" */
export function formatUnitPrice(value, unit) {
  return `${formatPrice(value)} ${unitOf({ unit }).priceSuffix}`;
}

/** Línea de pedido para WhatsApp: "1,5 kg de Milanesas" · "2 x Arrollado". */
export function describeLine(item) {
  const u = unitOf(item);
  return u.value === 'kg'
    ? `${formatQty(item.qty, u.value)} de ${item.name}`
    : `${formatQty(item.qty, u.value)} x ${item.name}`;
}
