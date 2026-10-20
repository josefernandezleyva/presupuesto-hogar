// Utilidades sin dependencias: fechas por mes, dinero, texto.

export function uuid() {
  if (globalThis.crypto && crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export const r2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
export const num = (v) => (v === '' || v === null || v === undefined || isNaN(Number(v)) ? 0 : Number(v));

const pad = (n) => String(n).padStart(2, '0');

export function hoy(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
export const mesActual = (d = new Date()) => hoy(d).slice(0, 7);
export const mesDe = (fecha) => String(fecha || '').slice(0, 7);

export function sumarMeses(mes, k) {
  const [y, m] = mes.split('-').map(Number);
  const t = y * 12 + (m - 1) + k;
  return `${Math.floor(t / 12)}-${pad((t % 12) + 1)}`;
}
export function difMeses(a, b) { // meses desde a hasta b
  const [ya, ma] = a.split('-').map(Number);
  const [yb, mb] = b.split('-').map(Number);
  return (yb * 12 + mb) - (ya * 12 + ma);
}
export function rangoMeses(desde, hasta) {
  const out = [];
  for (let m = desde; m <= hasta; m = sumarMeses(m, 1)) out.push(m);
  return out;
}
export function diasEnMes(mes) {
  const [y, m] = mes.split('-').map(Number);
  return new Date(y, m, 0).getDate();
}

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
export function nombreMes(mes, { corto = false, anio = true } = {}) {
  const [y, m] = mes.split('-').map(Number);
  let n = MESES[m - 1];
  if (corto) n = n.slice(0, 3);
  n = n[0].toUpperCase() + n.slice(1);
  return anio ? `${n}${corto ? ' ' + String(y).slice(2) : ' ' + y}` : n;
}
export function fechaCorta(fecha) {
  const [y, m, d] = fecha.split('-').map(Number);
  const f = `${d} ${MESES[m - 1].slice(0, 3)}`;
  if (fecha === hoy()) return `Hoy, ${f}`;
  const ayer = new Date(); ayer.setDate(ayer.getDate() - 1);
  if (fecha === hoy(ayer)) return `Ayer, ${f}`;
  return y === new Date().getFullYear() ? f : `${f} ${y}`;
}

export const SIMBOLO = { PEN: 'S/', USD: 'US$' };

export function fmt(n, { dec = 2, moneda = 'PEN', signo = false } = {}) {
  const v = Number(n) || 0;
  const abs = Math.abs(v).toFixed(dec);
  const [ent, frac] = abs.split('.');
  const grupos = ent.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const s = `${SIMBOLO[moneda] || ''} ${grupos}${frac ? '.' + frac : ''}`;
  if (v < 0 && Math.abs(v) >= 0.005) return `− ${s}`;
  if (signo && v > 0.005) return `+ ${s}`;
  return s;
}
export const fmt0 = (n, o = {}) => fmt(n, { ...o, dec: 0 });
export const pct = (n) => `${Math.round(Number(n) || 0)} %`;

/** Acepta "1,234.50", "1234.5", "85,50" (coma decimal) y "S/ 20". */
export function parseMonto(str) {
  let s = String(str ?? '').replace(/[^\d.,-]/g, '').trim();
  if (!s) return NaN;
  if (s.includes(',') && !s.includes('.') && /,\d{1,2}$/.test(s)) s = s.replace(',', '.');
  s = s.replace(/,/g, '');
  const v = Number(s);
  return isNaN(v) ? NaN : r2(v);
}

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export const norm = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

export function iniciales(nombre) {
  const p = String(nombre || '?').trim().split(/\s+/);
  return ((p[0] || '?')[0] + (p[1] ? p[1][0] : '')).toUpperCase();
}
