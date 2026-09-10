export const SALES_TIMEZONE = 'America/Argentina/Buenos_Aires';
const DAY = 86400000;
export function salesRange(from: unknown, to: unknown) {
  function parse(value: unknown) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('Usá fechas válidas con formato AAAA-MM-DD.');
    const date = new Date(value + 'T00:00:00.000Z');
    if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) throw new Error('La fecha no es válida.');
    return date.getTime();
  }
  const first = parse(from), last = parse(to);
  const count = (last - first) / DAY + 1;
  if (count < 1 || count > 93) throw new Error('Elegí un período de entre 1 y 93 días.');
  return { from: String(from), to: String(to), start: new Date(first + 3 * 3600000), end: new Date(last + DAY + 3 * 3600000), days: Array.from({ length: count }, (_, i) => new Date(first + i * DAY).toISOString().slice(0, 10)) };
}
