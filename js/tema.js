// Apariencia por celular: modo, color, diseño (Liquid Glass o clásico), material,
// esquinas (squircle o redondeadas) y formas concéntricas.

const KEY = 'pp-tema';

// Los seis primeros tienen sus tonos ajustados a mano en app.css; los demás (2.1) y el personalizado
// se calculan aquí a partir de su color base, cuidando el contraste en claro y en oscuro.
export const ACENTOS = [
  { v: 'verde', l: 'Verde', c: '#1F7A5C' },
  { v: 'azul', l: 'Azul', c: '#2459A8' },
  { v: 'violeta', l: 'Violeta', c: '#6A45B5' },
  { v: 'terracota', l: 'Terracota', c: '#B4532A' },
  { v: 'rosa', l: 'Rosa', c: '#B03A6E' },
  { v: 'grafito', l: 'Grafito', c: '#3E4A52' },
  { v: 'turquesa', l: 'Turquesa', c: '#0E7C86', calc: true },
  { v: 'celeste', l: 'Celeste', c: '#2B7BB9', calc: true },
  { v: 'indigo', l: 'Índigo', c: '#4B4FC4', calc: true },
  { v: 'lavanda', l: 'Lavanda', c: '#8A63D2', calc: true },
  { v: 'ciruela', l: 'Ciruela', c: '#7B2E6E', calc: true },
  { v: 'frambuesa', l: 'Frambuesa', c: '#C2185B', calc: true },
  { v: 'rojo', l: 'Rojo', c: '#C62828', calc: true },
  { v: 'naranja', l: 'Naranja', c: '#D35400', calc: true },
  { v: 'ambar', l: 'Ámbar', c: '#B7791F', calc: true },
  { v: 'oliva', l: 'Oliva', c: '#6B7A2A', calc: true },
  { v: 'bosque', l: 'Bosque', c: '#2E6B3F', calc: true },
  { v: 'chocolate', l: 'Chocolate', c: '#7A4E2D', calc: true },
  { v: 'pizarra', l: 'Pizarra', c: '#4A5D73', calc: true }
];
export const PERSONAL = 'personal';

/* --------------------------------------------- 2.1 · Tonos calculados --- */
const hexRgb = (h) => { const m = String(h).replace('#', '').match(/^([0-9a-f]{6})$/i); if (!m) return null; const n = parseInt(m[1], 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
const rgbHex = (c) => '#' + c.map((x) => Math.round(Math.max(0, Math.min(255, x))).toString(16).padStart(2, '0')).join('').toUpperCase();
const mezcla = (a, b, t) => a.map((x, i) => x + (b[i] - x) * t);
function luz(c) { const f = c.map((x) => { x /= 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; }); return 0.2126 * f[0] + 0.7152 * f[1] + 0.0722 * f[2]; }
export function contraste(a, b) { const l1 = luz(a), l2 = luz(b); return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05); }
const BLANCO = [255, 255, 255], NEGRO = [0, 0, 0];
const FONDO_CLARO = hexRgb('#F6F3EC'), FONDO_OSCURO = hexRgb('#121614');
/** Acerca `c` a `hacia` hasta lograr el contraste pedido con `fondo`. */
function ajustar(c, fondo, hacia, minimo) {
  let t = 0, x = c;
  while (contraste(x, fondo) < minimo && t < 1) { t += 0.04; x = mezcla(c, hacia, t); }
  return x;
}

/** Variables de color de un acento, para modo claro y oscuro (textos con contraste AA o mejor). */
export function paleta(hex) {
  const base = hexRgb(hex) || hexRgb('#1F7A5C');
  // Claro: el botón lleva el color base (oscurecido si hace falta para el texto blanco).
  const acc = ajustar(base, BLANCO, NEGRO, 4.5);
  const clara = {
    '--accent': rgbHex(acc), '--accent-ink': '#FFFFFF',
    '--accent-soft': rgbHex(mezcla(base, BLANCO, 0.88)), '--accent-2': rgbHex(mezcla(base, BLANCO, 0.55)),
    '--accent-text': rgbHex(ajustar(acc, FONDO_CLARO, NEGRO, 5.5))
  };
  // Oscuro: el color se aclara para leerse sobre el fondo oscuro; el texto del botón va oscuro.
  const accO = ajustar(mezcla(base, BLANCO, 0.3), FONDO_OSCURO, BLANCO, 6);
  const oscura = {
    '--accent': rgbHex(accO), '--accent-ink': rgbHex(mezcla(base, NEGRO, 0.82)),
    '--accent-soft': rgbHex(mezcla(base, FONDO_OSCURO, 0.78)), '--accent-2': rgbHex(mezcla(base, FONDO_OSCURO, 0.45)),
    '--accent-text': rgbHex(ajustar(mezcla(base, BLANCO, 0.5), FONDO_OSCURO, BLANCO, 7))
  };
  return { clara, oscura };
}

/** Reglas CSS de un acento calculado (las mismas que app.css tiene para los seis primeros). */
export function cssAcento(v, hex) {
  const { clara, oscura } = paleta(hex);
  const decl = (o) => Object.entries(o).map(([k, x]) => `${k}: ${x};`).join(' ');
  const sel = `[data-acento="${v}"]`;
  return `:root${sel} { ${decl(clara)} }
@media (prefers-color-scheme: dark) { :root${sel}:not([data-theme="light"]) { ${decl(oscura)} } }
:root[data-theme="dark"]${sel} { ${decl(oscura)} }`;
}

/** Color base de un acento (o el personalizado). */
export function colorDe(t) {
  if (t.acento === PERSONAL) return /^#[0-9a-f]{6}$/i.test(t.acentoColor || '') ? t.acentoColor : '#1F7A5C';
  return ACENTOS.find((a) => a.v === t.acento)?.c || '#1F7A5C';
}

function ponerCssAcento(t) {
  const calc = t.acento === PERSONAL || ACENTOS.find((a) => a.v === t.acento)?.calc;
  let el = document.getElementById('acento-css');
  const css = calc ? cssAcento(t.acento, colorDe(t)) : '';
  if (css && !el) { el = document.createElement('style'); el.id = 'acento-css'; document.head.appendChild(el); }
  if (el) el.textContent = css;
  // Se guarda para que index.html lo ponga antes de dibujar (sin parpadeo de color al abrir).
  try { if (css) localStorage.setItem('pp-acento-css', css); else localStorage.removeItem('pp-acento-css'); } catch { /* sin almacenamiento */ }
}

export const MODOS = [
  { v: 'auto', l: 'Automático' },
  { v: 'light', l: 'Claro' },
  { v: 'dark', l: 'Oscuro' }
];

export const ESTILOS = [
  { v: 'glass', l: 'Liquid Glass' },
  { v: 'clasico', l: 'Clásico' }
];

export const MATERIALES = [
  { v: 'ultrafino', l: 'Ultrafino' },
  { v: 'fino', l: 'Fino' },
  { v: 'normal', l: 'Normal' },
  { v: 'grueso', l: 'Grueso' }
];

export const ESQUINAS = [
  { v: 'squircle', l: 'Squircle' },
  { v: 'redondeadas', l: 'Redondeadas' }
];

export const ICONOS = [
  { v: 'verde', l: 'Verde' }, { v: 'azul', l: 'Azul' }, { v: 'violeta', l: 'Violeta' },
  { v: 'terracota', l: 'Terracota' }, { v: 'rosa', l: 'Rosa' }, { v: 'grafito', l: 'Grafito' },
  { v: 'crema', l: 'Crema' }, { v: 'oscuro', l: 'Oscuro' }, { v: 'original', l: 'Original' }
];
const KEY_ICONO = 'pp-icono';

export function leerIcono() {
  try { const v = localStorage.getItem(KEY_ICONO); if (ICONOS.some((i) => i.v === v)) return v; } catch { /* sin almacenamiento */ }
  return 'verde';
}

/** Guarda el ícono elegido y lo pone en la página (Safari lo usa al agregar la app a la pantalla de inicio). */
export function guardarIcono(v) {
  if (!ICONOS.some((i) => i.v === v)) return;
  try { localStorage.setItem(KEY_ICONO, v); } catch { /* sin almacenamiento */ }
  const base = v === 'verde' ? './icons/' : `./icons/${v}/`;
  document.querySelector('link[rel="apple-touch-icon"]')?.setAttribute('href', base + 'apple-touch-icon.png');
  document.querySelector('link[rel="icon"]')?.setAttribute('href', base + 'icon-192.png');
  document.querySelector('link[rel="manifest"]')?.setAttribute('href', v === 'verde' ? './manifest.webmanifest' : `./manifest-${v}.webmanifest`);
}

export const DEFECTO = { modo: 'auto', acento: 'verde', estilo: 'glass', material: 'normal', esquinas: 'squircle', concentrico: true };

export function leerTema() {
  try {
    const t = JSON.parse(localStorage.getItem(KEY));
    if (t && typeof t === 'object') return { ...DEFECTO, ...t };
  } catch { /* sin almacenamiento */ }
  return { ...DEFECTO };
}

export function aplicarTema(t = leerTema()) {
  const r = document.documentElement;
  if (t.modo === 'auto') {
    // Solo se quita el modo que puso la app; si el entorno fijó uno, se respeta.
    if (r.dataset.ppModo) { delete r.dataset.theme; delete r.dataset.ppModo; }
  } else {
    r.dataset.theme = t.modo;
    r.dataset.ppModo = '1';
  }
  if (t.acento && t.acento !== 'verde') r.dataset.acento = t.acento;
  else delete r.dataset.acento;
  ponerCssAcento(t);
  r.dataset.estilo = t.estilo;
  r.dataset.material = t.material;
  r.dataset.esquinas = t.esquinas;
  r.dataset.concentrico = t.concentrico ? '1' : '0';
  const bg = getComputedStyle(r).getPropertyValue('--bg').trim();
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => { if (bg) m.setAttribute('content', bg); });
}

export function guardarTema(parcial) {
  const t = { ...leerTema(), ...parcial };
  try { localStorage.setItem(KEY, JSON.stringify(t)); } catch { /* sin almacenamiento */ }
  aplicarTema(t);
  return t;
}
