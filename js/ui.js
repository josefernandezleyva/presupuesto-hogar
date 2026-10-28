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
  basura: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6"/>',
  campana: '<path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 20a2 2 0 0 0 4 0"/>',
  ojo: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>',
  ojoNo: '<path d="M4 4l16 16M9.9 5.8A9.6 9.6 0 0 1 12 5.5C18 5.5 21.5 12 21.5 12a17 17 0 0 1-3 3.8M6.2 7.2A16.6 16.6 0 0 0 2.5 12S6 18.5 12 18.5a9 9 0 0 0 4-.9"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/>',
  cuentas: '<path d="M7 7h12l-3-3M17 17H5l3 3"/><circle cx="12" cy="12" r="0.6"/>',
  buscar: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>',
  filtro: '<path d="M4 6h16M7 12h10M10 18h4"/>',
  engranaje: '<circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/>',
  reloj: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
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

/** Barra de pestañas (2.0): Inicio, Gastos, Cuentas y Análisis; el + registra. Ajustes, desde el avatar de Inicio. */
export function tabbar(activa) {
  const t = (ruta, ic, label) => `<a href="#/${ruta}" class="tab${activa === ruta ? ' on' : ''}"${activa === ruta ? ' aria-current="page"' : ''}>${icono(ic, 24)}<span>${label}</span></a>`;
  return `<nav class="tabbar" aria-label="Secciones">
    <div class="tabgroup">${t('inicio', 'inicio', 'Inicio')}${t('gastos', 'lista', 'Gastos')}${t('cierre', 'cuentas', 'Cuentas')}${t('analisis', 'grafico', 'Análisis')}</div>
    <a href="#/nuevo" class="tab-add" aria-label="Registrar gasto">${icono('mas', 28)}</a>
  </nav>`;
}

/**
 * Título grande de una pestaña, como en iOS: el nombre arriba y, al bajar, una barra compacta de cristal.
 * `mes` agrega el selector de mes bajo el título.
 */
export function tituloGrande({ titulo, sub = '', derecha = '', mes = null, cerrado = false }) {
  return `<header class="lt">
    <div class="lt-bar"><span class="lt-mini" aria-hidden="true">${esc(titulo)}${mes ? ' · ' + esc(nombreMes(mes, { corto: true })) : ''}</span><span class="lt-acc">${derecha}</span></div>
    <div class="lt-head">${sub ? `<div class="lt-sub">${sub}</div>` : ''}<h1 class="lt-t">${esc(titulo)}</h1></div>
    ${mes ? `<div class="lt-mes" role="group" aria-label="Mes">
      <button class="btn-ic" data-a="mes" data-d="-1" aria-label="Mes anterior">${icono('atras', 22)}</button>
      <span class="lt-mes-t">${esc(nombreMes(mes))}${cerrado ? ' <span class="badge">Cerrado</span>' : ''}</span>
      <button class="btn-ic" data-a="mes" data-d="1" aria-label="Mes siguiente">${icono('adelante', 22)}</button>
    </div>` : ''}
  </header>`;
}

/** Anillo de progreso (SVG): gastado, comprometido y el resto, sobre 100 %. */
export function anillo(pctGastado, pctComprometido = 0, { size = 112, estado = 'ok', texto = '' } = {}) {
  const r = 46, c = 2 * Math.PI * r;
  const g = Math.max(0, Math.min(100, pctGastado || 0)), k = Math.max(0, Math.min(100 - g, pctComprometido || 0));
  return `<svg class="anillo ${estado}" width="${size}" height="${size}" viewBox="0 0 112 112" role="img" aria-label="${Math.round(pctGastado || 0)} % del presupuesto usado">
    <circle cx="56" cy="56" r="${r}" class="an-fondo"/>
    ${k > 0 ? `<circle cx="56" cy="56" r="${r}" class="an-comp" stroke-dasharray="${(g + k) / 100 * c} ${c}" transform="rotate(-90 56 56)"/>` : ''}
    <circle cx="56" cy="56" r="${r}" class="an-gas" stroke-dasharray="${g / 100 * c} ${c}" transform="rotate(-90 56 56)"/>
    <text x="56" y="54" class="an-n">${Math.round(pctGastado || 0)}%</text><text x="56" y="72" class="an-l">${esc(texto)}</text>
  </svg>`;
}

/** Hace cuánto: «hace 5 min», «hoy 10:30», «ayer», «12 oct». */
export function haceCuanto(iso, ahora = new Date()) {
  const d = new Date(iso);
  if (isNaN(d)) return '';
  const min = Math.round((ahora - d) / 60000);
  if (min < 1) return 'ahora';
  if (min < 60) return `hace ${min} min`;
  const hoyD = ahora.toDateString() === d.toDateString();
  if (hoyD) return 'hoy ' + d.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
  const ayer = new Date(ahora); ayer.setDate(ayer.getDate() - 1);
  if (ayer.toDateString() === d.toDateString()) return 'ayer';
  return d.toLocaleDateString('es-PE', { day: 'numeric', month: 'short' });
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
  return `<div class="toast ${t.tipo || ''}"><span>${esc(t.texto)}</span>${t.accion ? `<button type="button" class="toast-b" data-a="toast-accion">${esc(t.accion.l)}</button>` : ''}</div>`;
}
