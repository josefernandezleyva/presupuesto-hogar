// Apariencia por celular: modo, color, diseño (Liquid Glass o clásico), material,
// esquinas (squircle o redondeadas) y formas concéntricas.

const KEY = 'pp-tema';

export const ACENTOS = [
  { v: 'verde', l: 'Verde', c: '#1F7A5C' },
  { v: 'azul', l: 'Azul', c: '#2459A8' },
  { v: 'violeta', l: 'Violeta', c: '#6A45B5' },
  { v: 'terracota', l: 'Terracota', c: '#B4532A' },
  { v: 'rosa', l: 'Rosa', c: '#B03A6E' },
  { v: 'grafito', l: 'Grafito', c: '#3E4A52' }
];

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
