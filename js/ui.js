// Piezas de interfaz reutilizables. Devuelven HTML como texto; todo dato se escapa con esc().

import { esc, fmt, fmt0, nombreMes, iniciales } from './util.js';

export const ICON = {
  atras: '<path d="M15 6l-6 6 6 6"/>',
  adelante: '<path d="M9 6l6 6-6 6"/>',
  cerrar: '<path d="M6 6l12 12M18 6L6 18"/>',
  sync: '<path d="M20 11a8 8 0 0 0-14.5-4M4 5v4h4M4 13a8 8 0 0 0 14.5 4M20 19v-4h-4"/>',
  inicio: '<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  lista: '<path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01"/>',
  mas: '<path d="M12 5v14M5 12h14"/>',
  grafico: '<path d="M4 20V11M10 20V5M16 20v-6M20 20H2"/>',
  puntos: '<circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/>',
  check: '<path d="M5 12l5 5 9-10"/>',
  alerta: '<path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18h.01"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16h.01"/>',
  compartir: '<path d="M12 3v12M7 8l5-5 5 5M5 13v7h14v-7"/>',
  calendario: '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M8 3v4M16 3v4M4 10h16"/>',
  reparto: '<circle cx="12" cy="12" r="8"/><path d="M12 4v8l5.5 5.5"/>',
  nota: '<path d="M5 4h10l4 4v12H5z"/><path d="M9 12h6M9 16h4"/>',
  repetir: '<path d="M4 12a8 8 0 0 1 13.7-5.7L20 8M20 4v4h-4M20 12a8 8 0 0 1-13.7 5.7L4 16M4 20v-4h4"/>',
  paleta: '<path d="M12 3a9 9 0 1 0 0 18c1.1 0 2-.9 2-2 0-.5-.2-1-.5-1.3-.3-.4-.5-.8-.5-1.3 0-1.1.9-2 2-2h2.4A4.6 4.6 0 0 0 21 9.9C21 6.1 17 3 12 3z"/><circle cx="7.5" cy="11" r="1"/><circle cx="10" cy="7" r="1"/><circle cx="15" cy="7" r="1"/>',
  foto: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
  cambiar: '<path d="M7 7h11l-3-3M17 17H6l3 3"/>',
  grupo: '<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>',
  subir: '<path d="M12 19V5M6 11l6-6 6 6"/>',
  bajar: '<path d="M12 5v14M6 13l6 6 6-6"/>',
  reporte: '<path d="M6 3h9l4 4v14H6z"/><path d="M9 12h7M9 16h7M9 8h3"/>',
  copiar: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>'
};

export function icono(nombre, size = 22, extra = '') {
  return `<svg class="ic" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true" ${extra}>${ICON[nombre]}</svg>`;
}

export function encabezado({ titulo, atras = true, derecha = '', clase = '' }) {
  return `<header class="top${clase ? ' ' + clase : ''}">
    ${atras ? `<button class="btn-ic" data-a="atras" aria-label="Volver">${icono('atras', 24)}</button>` : '<span class="btn-ic"></span>'}
    <h1 class="top-t">${esc(titulo)}</h1>
    ${derecha || '<span class="btn-ic"></span>'}
  </header>`;
}

export function barraMes(mes, { derecha = '', cerrado = false } = {}) {
  return `<div class="mesbar">
    <button class="btn-ic" data-a="mes" data-d="-1" aria-label="Mes anterior">${icono('atras', 24)}</button>
    <h1 class="mes-t">${esc(nombreMes(mes))}${cerrado ? ' <span class="badge">Cerrado</span>' : ''}</h1>
    <button class="btn-ic" data-a="mes" data-d="1" aria-label="Mes siguiente">${icono('adelante', 24)}</button>
    <span class="spacer"></span>${derecha}
  </div>`;
}

export function tabbar(activa) {
  const t = (ruta, ic, label) => `<a href="#/${ruta}" class="tab${activa === ruta ? ' on' : ''}"${activa === ruta ? ' aria-current="page"' : ''}>${icono(ic, 24)}<span>${label}</span></a>`;
  return `<nav class="tabbar" aria-label="Secciones">
    <div class="tabgroup">${t('inicio', 'inicio', 'Inicio')}${t('gastos', 'lista', 'Gastos')}${t('analisis', 'grafico', 'Análisis')}${t('mas', 'puntos', 'Más')}</div>
    <a href="#/nuevo" class="tab-add" aria-label="Registrar gasto">${icono('mas', 28)}</a>
  </nav>`;
}

export function avatar(p, size = 32) {
  if (!p) return '';
  return `<span class="av" style="width:${size}px;height:${size}px;background:${esc(p.color || '#5E5A54')};font-size:${Math.round(size * 0.38)}px" aria-hidden="true">${esc(iniciales(p.alias || p.nombre))}</span>`;
}

/** Botones de opción única. `k` es el campo del estado de la pantalla. */
export function chips(k, opciones, sel, { clase = '', label = '' } = {}) {
  return `<div class="chips ${clase}" role="group"${label ? ` aria-label="${esc(label)}"` : ''}>${opciones.map((o) =>
    `<button type="button" class="chip${String(o.v) === String(sel) ? ' on' : ''}" data-a="set" data-k="${esc(k)}" data-v="${esc(o.v)}" aria-pressed="${String(o.v) === String(sel)}">${o.html || esc(o.l)}</button>`).join('')}${''}</div>`;
}

export function segmentado(k, opciones, sel, label = '') {
  return `<div class="seg" role="group"${label ? ` aria-label="${esc(label)}"` : ''}>${opciones.map((o) =>
    `<button type="button" class="${String(o.v) === String(sel) ? 'on' : ''}" data-a="set" data-k="${esc(k)}" data-v="${esc(o.v)}" aria-pressed="${String(o.v) === String(sel)}">${esc(o.l)}</button>`).join('')}</div>`;
}

const CLASE_ESTADO = { ok: 'ok', aviso: 'warn', excede: 'bad', sin_tope: 'ok' };
export function barra(pct, estado = 'ok', extra = '') {
  const w = Math.max(0, Math.min(100, pct || 0));
  return `<div class="track" role="img" aria-label="${Math.round(pct || 0)} %">
    <div class="fill ${CLASE_ESTADO[estado] || 'ok'}" style="width:${w}%"></div>${extra}</div>`;
}

export function alerta(tipo, titulo, texto = '', { id = '' } = {}) {
  return `<div class="alert ${tipo}"${id ? ` id="${id}"` : ''} role="${tipo === 'bad' ? 'alert' : 'status'}">
    ${icono(tipo === 'bad' || tipo === 'warn' ? 'alerta' : 'info', 22)}
    <div><div class="alert-t">${esc(titulo)}</div>${texto ? `<div class="alert-x">${esc(texto)}</div>` : ''}</div>
  </div>`;
}

export const dinero = (n, o) => esc(fmt(n, o));
export const dinero0 = (n, o) => esc(fmt0(n, o));

export function vacio(texto, boton = '') {
  return `<div class="empty"><p>${esc(texto)}</p>${boton}</div>`;
}

export function fila({ izq = '', titulo, sub = '', der = '', a = '', datos = {}, href = '' }) {
  const attrs = Object.entries(datos).map(([k, v]) => ` data-${k}="${esc(v)}"`).join('');
  const inner = `${izq}<span class="row-m"><span class="row-t">${titulo}</span>${sub ? `<span class="row-s">${sub}</span>` : ''}</span>${der}`;
  if (href) return `<a class="row" href="${esc(href)}">${inner}</a>`;
  if (a) return `<button type="button" class="row" data-a="${esc(a)}"${attrs}>${inner}</button>`;
  return `<div class="row">${inner}</div>`;
}

export function hoja(h) {
  if (!h) return '';
  return `<div class="sheet-bg" data-a="cerrar-hoja"></div>
  <div class="sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-t">
    <h2 id="sheet-t" class="sheet-t">${esc(h.titulo)}</h2>
    ${h.texto ? `<p class="sheet-x">${esc(h.texto)}</p>` : ''}
    ${h.html || ''}
    <div class="sheet-b">${h.botones.map((b, i) => `<button type="button" class="btn ${b.estilo || 'sec'}" data-a="hoja-btn" data-i="${i}">${esc(b.l)}</button>`).join('')}
    <button type="button" class="btn ghost" data-a="cerrar-hoja">${esc(h.cancelar || 'Cancelar')}</button></div>
  </div>`;
}

export function toast(t) {
  if (!t) return '';
  return `<div class="toast ${t.tipo || ''}" role="status"><span>${esc(t.texto)}</span>${t.accion ? `<button type="button" class="toast-b" data-a="toast-accion">${esc(t.accion.l)}</button>` : ''}</div>`;
}
