// Gráficos en SVG hechos a mano (sin librerías). Los colores vienen del CSS.

import { esc, fmt0 } from './util.js';

const W = 340;

function compacto(n) {
  const a = Math.abs(n);
  if (a >= 1e6) return (n / 1e6).toFixed(1) + ' M';
  if (a >= 1e4) return Math.round(n / 1e3) + ' mil';
  return Math.round(n).toLocaleString('en-US');
}

/**
 * Barras verticales. items: [{ label, valor, ref?, clase?, apilado?: [{valor, clase}] }]
 * `ref` dibuja una marca horizontal (p. ej. el presupuesto de ese mes).
 */
export function barras(items, { alto = 150, etiquetas = 'auto', aria = '' } = {}) {
  const top = 22, bottom = 22, h = alto - top - bottom;
  const max = Math.max(1, ...items.map((i) => Math.max(i.apilado ? i.apilado.reduce((a, s) => a + s.valor, 0) : i.valor, i.ref || 0)));
  const n = items.length;
  const slot = W / n;
  const bw = Math.min(34, slot * 0.62);
  const y = (v) => top + h - (v / max) * h;
  const mostrar = (i) => etiquetas === 'todas' || (etiquetas === 'auto' && (i === n - 1 || items[i].destacar || n <= 6));
  let s = `<svg viewBox="0 0 ${W} ${alto}" width="100%" role="img" aria-label="${esc(aria)}" class="chart">`;
  s += `<line x1="0" x2="${W}" y1="${top + h}" y2="${top + h}" class="c-axis"/>`;
  items.forEach((it, i) => {
    const x = i * slot + (slot - bw) / 2;
    if (it.apilado) {
      let acc = 0;
      it.apilado.forEach((seg) => {
        const y0 = y(acc + seg.valor), hh = (seg.valor / max) * h;
        if (hh > 0) s += `<rect x="${x.toFixed(1)}" y="${y0.toFixed(1)}" width="${bw.toFixed(1)}" height="${hh.toFixed(1)}" class="c-bar ${seg.clase || ''}"/>`;
        acc += seg.valor;
      });
    } else if (it.valor > 0) {
      s += `<rect x="${x.toFixed(1)}" y="${y(it.valor).toFixed(1)}" width="${bw.toFixed(1)}" height="${((it.valor / max) * h).toFixed(1)}" rx="3" class="c-bar ${it.clase || ''}"/>`;
    }
    if (it.ref > 0) s += `<line x1="${(x - 4).toFixed(1)}" x2="${(x + bw + 4).toFixed(1)}" y1="${y(it.ref).toFixed(1)}" y2="${y(it.ref).toFixed(1)}" class="c-ref"/>`;
    const total = it.apilado ? it.apilado.reduce((a, b) => a + b.valor, 0) : it.valor;
    if (mostrar(i) && total > 0) s += `<text x="${(x + bw / 2).toFixed(1)}" y="${(Math.min(y(total), it.ref ? y(it.ref) : 1e9) - 5).toFixed(1)}" text-anchor="middle" class="c-val${it.destacar ? ' c-hi' : ''}">${esc(compacto(total))}</text>`;
    s += `<text x="${(x + bw / 2).toFixed(1)}" y="${alto - 6}" text-anchor="middle" class="c-lbl">${esc(it.label)}</text>`;
  });
  return s + '</svg>';
}

/** Línea con puntos, con línea de cero si hay negativos. items: [{label, valor|null}] */
export function linea(items, { alto = 140, aria = '', sufijo = '' } = {}) {
  const top = 20, bottom = 22, h = alto - top - bottom, pad = 14;
  const vals = items.map((i) => i.valor).filter((v) => v !== null && v !== undefined);
  if (!vals.length) return '<p class="muted sm">Sin datos suficientes.</p>';
  const max = Math.max(...vals, 0), min = Math.min(...vals, 0);
  const rango = max - min || 1;
  const x = (i) => pad + (i * (W - 2 * pad)) / Math.max(1, items.length - 1);
  const y = (v) => top + h - ((v - min) / rango) * h;
  let s = `<svg viewBox="0 0 ${W} ${alto}" width="100%" role="img" aria-label="${esc(aria)}" class="chart">`;
  s += `<line x1="0" x2="${W}" y1="${y(0).toFixed(1)}" y2="${y(0).toFixed(1)}" class="c-axis"/>`;
  const pts = items.map((it, i) => (it.valor === null ? null : [x(i), y(it.valor)]));
  let d = '';
  pts.forEach((p, i) => { if (p) d += `${d && pts[i - 1] ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`; });
  s += `<path d="${d}" class="c-line"/>`;
  pts.forEach((p, i) => {
    if (!p) return;
    const neg = items[i].valor < 0;
    s += `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="3.5" class="c-pt${neg ? ' bad' : ''}"/>`;
    if (i === items.length - 1 || items.length <= 6) s += `<text x="${p[0].toFixed(1)}" y="${(p[1] - 8).toFixed(1)}" text-anchor="middle" class="c-val">${esc(Math.round(items[i].valor) + sufijo)}</text>`;
  });
  items.forEach((it, i) => { if (items.length <= 6 || i % 2 === (items.length - 1) % 2) s += `<text x="${x(i).toFixed(1)}" y="${alto - 6}" text-anchor="middle" class="c-lbl">${esc(it.label)}</text>`; });
  return s + '</svg>';
}

/** Barra horizontal con marca de meta/tope, en HTML. */
export function barraMeta(valorPct, metaPct, clase = 'ok') {
  const escala = Math.max(100, valorPct, metaPct) * 1.05;
  return `<div class="track"><div class="fill ${clase}" style="width:${Math.min(100, (valorPct / escala) * 100)}%"></div>
    <span class="mark" style="left:${(metaPct / escala) * 100}%" aria-hidden="true"></span></div>`;
}

export { fmt0 };
