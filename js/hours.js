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

/** "09:00 a 12:45 y 18:00 a 20:30" */
export function formatRanges(ranges) {
  return ranges.map(([a, b]) => `${a} a ${b}`).join(' y ');
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

const toHHMM = (min) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

/**
 * Turnos de retiro disponibles para un día, agrupados por franja.
 * Excluye los que no respetan la anticipación mínima respecto de `now`.
 * @returns {{ label: string, times: string[] }[]}
 */
export function slotsFor(day, { now = new Date(), leadMinutes = 0, step = 15 } = {}) {
  const earliest = now.getTime() + leadMinutes * 60_000;
  return rangesFor(day)
    .map(([open, close]) => {
      const times = [];
      for (let m = toMinutes(open); m <= toMinutes(close); m += step) {
        const slot = new Date(day.getFullYear(), day.getMonth(), day.getDate(), Math.floor(m / 60), m % 60);
        if (slot.getTime() >= earliest) times.push(toHHMM(m));
      }
      // Franja que empieza antes de las 14 h = "Mañana", el resto = "Tarde"
      return { label: toMinutes(open) < 14 * 60 ? 'Mañana' : 'Tarde', times };
    })
    .filter((group) => group.times.length > 0);
}

/** Días (a medianoche) desde hoy hasta `maxDays` que tienen al menos un turno libre. */
export function bookableDays({ now = new Date(), leadMinutes = 0, maxDays = 14, step = 15 } = {}) {
  const days = [];
  for (let i = 0; i <= maxDays; i += 1) {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
    if (slotsFor(day, { now, leadMinutes, step }).length) days.push(day);
  }
  return days;
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
