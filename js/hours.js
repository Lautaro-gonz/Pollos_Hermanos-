// Lógica de horarios de atención (sin DOM): validación del carrito y estado "abierto/cerrado".

import { BUSINESS_HOURS } from './config.js';

export const DAY_NAMES = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const DAY_PLURAL = ['los domingos', 'los lunes', 'los martes', 'los miércoles', 'los jueves', 'los viernes', 'los sábados'];

export const toMinutes = (hhmm) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

const minutesOf = (date) => date.getHours() * 60 + date.getMinutes();

/** Franjas del día de la semana de `date` (lista vacía = cerrado). */
export function rangesFor(date) {
  return BUSINESS_HOURS[date.getDay()] ?? [];
}

export const isClosedDay = (date) => rangesFor(date).length === 0;

/** "09:00 a 12:45 y 18:00 a 20:30" */
export function formatRanges(ranges) {
  return ranges.map(([a, b]) => `${a} a ${b}`).join(' y ');
}

/** ¿La fecha/hora cae dentro de alguna franja? (el horario de cierre se acepta) */
export function isWithinHours(date) {
  const min = minutesOf(date);
  return rangesFor(date).some(([a, b]) => min >= toMinutes(a) && min <= toMinutes(b));
}

/** Texto amigable con el horario del día: "Los sábados atendemos de 09:00 a 13:00." */
export function describeDay(date) {
  const ranges = rangesFor(date);
  const day = DAY_PLURAL[date.getDay()];
  const cap = day.charAt(0).toUpperCase() + day.slice(1);
  return ranges.length
    ? `${cap} atendemos de ${formatRanges(ranges)}.`
    : `${cap} estamos cerrados.`;
}

/**
 * Primer día (desde `from`, a medianoche) que todavía tiene algún horario
 * disponible respetando la anticipación mínima.
 */
export function firstBookableDay(from = new Date(), leadMinutes = 0, maxDays = 14) {
  const earliest = new Date(from.getTime() + leadMinutes * 60_000);
  for (let i = 0; i <= maxDays; i += 1) {
    const day = new Date(from.getFullYear(), from.getMonth(), from.getDate() + i);
    const ranges = rangesFor(day);
    const ok = ranges.some(([, close]) => {
      const end = new Date(day);
      end.setMinutes(toMinutes(close));
      return end >= earliest;
    });
    if (ok) return day;
  }
  return null;
}

/**
 * Estado actual del local.
 * @returns {{ open: true, closesAt: string } | { open: false, nextDay: Date, opensAt: string } | { open: false }}
 */
export function storeStatus(now = new Date()) {
  const min = minutesOf(now);
  const current = rangesFor(now).find(([a, b]) => min >= toMinutes(a) && min < toMinutes(b));
  if (current) return { open: true, closesAt: current[1] };

  for (let i = 0; i <= 7; i += 1) {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
    const next = rangesFor(day).find(([a]) => i > 0 || toMinutes(a) > min);
    if (next) return { open: false, nextDay: day, opensAt: next[0], daysAhead: i };
  }
  return { open: false };
}
