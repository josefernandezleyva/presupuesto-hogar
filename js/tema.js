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

/* ------------------------------------------------------------------------------------------------
   2.3 · Aspecto claro y oscuro como en Ajustes › Pantalla y brillo del iPhone.
   modo: 'light' | 'dark' | 'auto'. En automático, autoTipo dice cuándo cambia:
     'sistema'  → igual que el iPhone (sigue su ajuste de Claro/Oscuro/Automático),
     'sol'      → oscuro del atardecer al amanecer, según dónde estás,
     'horario'  → claro desde claroDesde y oscuro desde oscuroDesde (horas «HH:MM»).
   forzado: {modo, hasta} = el aspecto elegido a mano mientras está en automático, hasta el próximo cambio
   (como «Oscuro hasta el amanecer» en el iPhone).
   ------------------------------------------------------------------------------------------------ */
export const AUTO_TIPOS = [
  { v: 'sistema', l: 'Igual que el iPhone', d: 'Cambia cuando cambia el iPhone (Ajustes › Pantalla y brillo).' },
  { v: 'sol', l: 'Del atardecer al amanecer', d: 'Oscuro al ponerse el sol y claro al salir, según dónde estás.' },
  { v: 'horario', l: 'Horario personalizado', d: 'Tú eliges a qué hora empieza cada uno.' }
];

// Lugares de referencia por zona horaria (sin pedir la ubicación). «Usar mi ubicación» la afina.
const LUGARES = {
  'America/Lima': [-12.046, -77.043, 'Lima'], 'Europe/Madrid': [40.417, -3.704, 'Madrid'], 'Atlantic/Canary': [28.124, -15.43, 'Las Palmas'],
  'America/Bogota': [4.711, -74.072, 'Bogotá'], 'America/Guayaquil': [-2.19, -79.887, 'Guayaquil'], 'America/La_Paz': [-16.5, -68.15, 'La Paz'],
  'America/Santiago': [-33.449, -70.669, 'Santiago'], 'America/Argentina/Buenos_Aires': [-34.604, -58.382, 'Buenos Aires'],
  'America/Sao_Paulo': [-23.551, -46.633, 'São Paulo'], 'America/Mexico_City': [19.433, -99.133, 'Ciudad de México'],
  'America/Caracas': [10.481, -66.904, 'Caracas'], 'America/Montevideo': [-34.901, -56.164, 'Montevideo'], 'America/Asuncion': [-25.264, -57.576, 'Asunción'],
  'America/Panama': [8.983, -79.517, 'Panamá'], 'America/Costa_Rica': [9.928, -84.091, 'San José'], 'America/New_York': [40.713, -74.006, 'Nueva York'],
  'America/Chicago': [41.878, -87.63, 'Chicago'], 'America/Los_Angeles': [34.052, -118.244, 'Los Ángeles'], 'America/Miami': [25.762, -80.192, 'Miami'],
  'Europe/London': [51.507, -0.128, 'Londres'], 'Europe/Paris': [48.857, 2.352, 'París'], 'Europe/Rome': [41.903, 12.496, 'Roma'], 'Europe/Berlin': [52.52, 13.405, 'Berlín']
};

/** Dónde se calcula el sol: la ubicación guardada o la ciudad de la zona horaria del iPhone. */
export function lugarSol(t = leerTema()) {
  if (Number.isFinite(t.lat) && Number.isFinite(t.lon)) return { lat: t.lat, lon: t.lon, nombre: 'tu ubicación', exacto: true };
  let zona = '';
  try { zona = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch { /* sin Intl */ }
  const l = LUGARES[zona];
  if (l) return { lat: l[0], lon: l[1], nombre: l[2], exacto: false };
  // Sin ciudad conocida: la longitud del huso horario, sobre el ecuador (amanece cerca de las 6 y anochece cerca de las 18).
  return { lat: 0, lon: -new Date().getTimezoneOffset() / 4, nombre: 'tu zona horaria', exacto: false };
}

/** Salida y puesta del sol (algoritmo de la NOAA, ± 1 minuto) del día de `fecha`, como objetos Date. */
export function solDelDia(fecha, lat, lon) {
  const rad = Math.PI / 180;
  const d0 = new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate(), 12);
  const dia = Math.round((d0 - new Date(d0.getFullYear(), 0, 0)) / 864e5);
  const g = 2 * Math.PI / 365 * (dia - 1);
  const eqt = 229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g) - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g));
  const decl = 0.006918 - 0.399912 * Math.cos(g) + 0.070257 * Math.sin(g) - 0.006758 * Math.cos(2 * g) + 0.000907 * Math.sin(2 * g) - 0.002697 * Math.cos(3 * g) + 0.00148 * Math.sin(3 * g);
  const cosH = (Math.cos(90.833 * rad) / (Math.cos(lat * rad) * Math.cos(decl))) - Math.tan(lat * rad) * Math.tan(decl);
  if (cosH > 1 || cosH < -1) return null; // noche o día polar
  const h = Math.acos(cosH) / rad;
  const utc = (min) => new Date(Date.UTC(d0.getFullYear(), d0.getMonth(), d0.getDate()) + min * 60000);
  return { sale: utc(720 - 4 * (lon + h) - eqt), pone: utc(720 - 4 * (lon - h) - eqt) };
}

const aMin = (hhmm, def) => { const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm || '')); return m ? (+m[1] % 24) * 60 + (+m[2] % 60) : def; };
const minDe = (d) => d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60;
export const horaCorta = (d) => `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;

/** Minutos del día en que empieza el claro y el oscuro, según el tipo de automático (o null si sigue al iPhone). */
export function horarioDe(t, ahora = new Date()) {
  if (t.autoTipo === 'horario') return { claro: aMin(t.claroDesde, 420), oscuro: aMin(t.oscuroDesde, 1320) };
  if (t.autoTipo === 'sol') {
    const l = lugarSol(t);
    const s = solDelDia(ahora, l.lat, l.lon);
    if (!s) return { claro: 420, oscuro: 1140 };
    return { claro: minDe(s.sale), oscuro: minDe(s.pone) };
  }
  return null;
}

/** Aspecto que toca a esa hora según el horario: 'light' o 'dark'. */
export function aspectoEn(h, min) {
  return h.claro <= h.oscuro ? (min >= h.claro && min < h.oscuro ? 'light' : 'dark') : (min >= h.oscuro && min < h.claro ? 'dark' : 'light');
}

/** El próximo cambio automático: { modo, cuando: Date }, o null si sigue al iPhone. */
export function proximoCambio(t = leerTema(), ahora = new Date()) {
  if (t.modo !== 'auto' || !horarioDe(t, ahora)) return null;
  const actual = aspectoEn(horarioDe(t, ahora), minDe(ahora));
  // Se busca minuto a minuto (hasta dos días): sencillo y exacto con cualquier horario y en cualquier fecha.
  for (let i = 1; i <= 2 * 1440; i++) {
    const d = new Date(Math.floor(ahora.getTime() / 60000) * 60000 + i * 60000);
    const m = aspectoEn(horarioDe(t, d), minDe(d));
    if (m !== actual) return { modo: m, cuando: d };
  }
  return null;
}

/** Aspecto que se ve ahora: 'light', 'dark' o null (el del iPhone). */
export function modoEfectivo(t = leerTema(), ahora = new Date()) {
  if (t.modo === 'light' || t.modo === 'dark') return t.modo;
  if (t.forzado && t.forzado.hasta > ahora.getTime()) return t.forzado.modo;
  const h = horarioDe(t, ahora);
  return h ? aspectoEn(h, minDe(ahora)) : null;
}

/** Texto como el del iPhone bajo «Automático»: «Oscuro hasta el amanecer», «Claro hasta las 22:00»… */
export function textoAutomatico(t = leerTema(), ahora = new Date()) {
  if (t.modo !== 'auto') return '';
  if (t.autoTipo === 'sistema' || !t.autoTipo) return 'Igual que el iPhone';
  const modo = modoEfectivo(t, ahora);
  const nombre = modo === 'dark' ? 'Oscuro' : 'Claro';
  // Cuándo cambia de verdad lo que se ve (contando lo elegido a mano).
  let p = null;
  for (let i = 1; i <= 2 * 1440 && !p; i++) {
    const d = new Date(Math.floor(ahora.getTime() / 60000) * 60000 + i * 60000);
    if (modoEfectivo(t, d) !== modo) p = { cuando: d };
  }
  if (!p) return nombre;
  if (t.autoTipo === 'sol') return `${nombre} hasta ${modo === 'dark' ? 'el amanecer' : 'el atardecer'}`;
  return `${nombre} hasta las ${horaCorta(p.cuando)}`;
}

function guardarHorarioRapido(t) {
  // index.html lo usa al abrir para poner el aspecto antes de dibujar (sin destello claro de noche).
  try {
    const h = t.modo === 'auto' ? horarioDe(t) : null;
    if (h) localStorage.setItem('pp-horario', JSON.stringify({ claro: Math.round(h.claro), oscuro: Math.round(h.oscuro), forzado: t.forzado || null }));
    else localStorage.removeItem('pp-horario');
  } catch { /* sin almacenamiento */ }
}

let reloj = null;
/** Programa el próximo cambio automático (y se reprograma solo). */
export function programarCambio() {
  clearTimeout(reloj);
  const t = leerTema();
  const forz = t.modo === 'auto' && t.forzado && t.forzado.hasta > Date.now() ? t.forzado.hasta : Infinity;
  const p = proximoCambio(t);
  const cuando = Math.min(forz, p ? p.cuando.getTime() : Infinity);
  if (!Number.isFinite(cuando)) return;
  // Los navegadores retrasan los temporizadores largos; se revisa al menos cada 10 minutos.
  reloj = setTimeout(() => { revisarAspecto(); programarCambio(); }, Math.min(Math.max(cuando - Date.now() + 500, 1000), 600000));
}

/** Pone el aspecto que toca ahora; con transición suave si cambió. */
export function revisarAspecto() {
  const t = leerTema();
  if (t.forzado && t.forzado.hasta <= Date.now()) { delete t.forzado; try { localStorage.setItem(KEY, JSON.stringify(t)); } catch { /* nada */ } }
  const antes = document.documentElement.dataset.theme || '';
  const efectivo = modoEfectivo(t) || '';
  if (antes === efectivo || (!document.documentElement.dataset.ppModo && !efectivo)) return guardarHorarioRapido(t);
  const cambiar = () => aplicarTema(t);
  if (document.visibilityState === 'visible' && document.startViewTransition && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    document.documentElement.classList.add('vt-aspecto');
    document.startViewTransition(cambiar).finished.finally(() => document.documentElement.classList.remove('vt-aspecto'));
  } else cambiar();
}

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

export const DEFECTO = { modo: 'auto', autoTipo: 'sistema', claroDesde: '07:00', oscuroDesde: '22:00', acento: 'verde', estilo: 'glass', material: 'normal', esquinas: 'squircle', concentrico: true };

export function leerTema() {
  try {
    const t = JSON.parse(localStorage.getItem(KEY));
    if (t && typeof t === 'object') return { ...DEFECTO, ...t };
  } catch { /* sin almacenamiento */ }
  return { ...DEFECTO };
}

export function aplicarTema(t = leerTema()) {
  const r = document.documentElement;
  const efectivo = modoEfectivo(t);
  if (!efectivo) {
    // Igual que el iPhone: solo se quita el modo que puso la app; si el entorno fijó uno, se respeta.
    if (r.dataset.ppModo) { delete r.dataset.theme; delete r.dataset.ppModo; }
  } else {
    r.dataset.theme = efectivo;
    r.dataset.ppModo = '1';
  }
  guardarHorarioRapido(t);
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
  Object.keys(t).forEach((k) => { if (t[k] === undefined) delete t[k]; });
  try { localStorage.setItem(KEY, JSON.stringify(t)); } catch { /* sin almacenamiento */ }
  aplicarTema(t);
  programarCambio();
  return t;
}

/**
 * Tocar Claro u Oscuro. Con Automático activado y un horario, queda así hasta el próximo cambio
 * (como en el iPhone); siguiendo al iPhone, o sin automático, queda fijo.
 */
export function elegirAspecto(modo) {
  const t = leerTema();
  if (t.modo === 'auto' && t.autoTipo !== 'sistema') {
    const h = horarioDe(t);
    const toca = h ? aspectoEn(h, minDe(new Date())) : null;
    if (toca === modo) return guardarTema({ forzado: undefined });
    const p = proximoCambio(t);
    return guardarTema({ forzado: { modo, hasta: p ? p.cuando.getTime() : Date.now() + 12 * 3600e3 } });
  }
  return guardarTema({ modo, forzado: undefined });
}

/** Activar o desactivar Automático. Al desactivarlo queda fijo el aspecto que se ve ahora. */
export function ponerAutomatico(on) {
  if (on) return guardarTema({ modo: 'auto', forzado: undefined });
  const t = leerTema();
  const visto = modoEfectivo(t) || (matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  return guardarTema({ modo: visto, forzado: undefined });
}
