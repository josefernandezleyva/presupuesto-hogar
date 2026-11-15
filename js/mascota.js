// 3.4 · Sencillito, la mascota ahorradora: un golden terrier que pasea sobre la barra de pestañas.
// Viene apagado; cada persona lo activa en Apariencia › Mascota (se guarda solo en ese celular).
// No tapa botones: solo él recibe toques (la capa deja pasar el resto), se esconde con hojas abiertas,
// al escribir y en las pantallas de registro. Crece con monedas: una por cada gasto anotado.

const O = 'class="o"';
// Ojo de anime: blanco, iris con brillo inferior, pupila, dos destellos y párpado marcado. Variantes: dormido (∪) y feliz (∩).
const ojo = (cx, cy, rx, ry, ceja) => `
  <g class="ojo-a"><ellipse ${O} cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="#fff"/>
    <ellipse cx="${cx + rx * .2}" cy="${cy + ry * .12}" rx="${rx * .76}" ry="${ry * .8}" fill="var(--eye)"/>
    <ellipse cx="${cx + rx * .2}" cy="${cy + ry * .5}" rx="${rx * .52}" ry="${ry * .3}" fill="var(--eye-light)"/>
    <ellipse cx="${cx + rx * .28}" cy="${cy + ry * .08}" rx="${rx * .42}" ry="${ry * .5}" fill="var(--line-art)"/>
    <ellipse cx="${cx + rx * .52}" cy="${cy - ry * .3}" rx="${rx * .34}" ry="${ry * .27}" fill="#fff"/>
    <circle cx="${cx - rx * .08}" cy="${cy + ry * .5}" r="${rx * .15}" fill="#fff"/>
    <path d="M${cx - rx * 1.05} ${cy - ry * .45}q${rx * 1.05}-${ry * .8} ${rx * 2.1} 0" fill="none" stroke="var(--line-art)" stroke-width="2.8" stroke-linecap="round"/></g>
  <path class="ojo-c o" d="M${cx - rx} ${cy + 1}q${rx} ${ry * .6} ${rx * 2} 0" fill="none"/>
  <path class="ojo-f o" d="M${cx - rx} ${cy + 2}q${rx}-${ry * .9} ${rx * 2} 0" fill="none" stroke-width="2.6"/>
  ${ceja ? `<path class="o" d="${ceja}" fill="none"/>` : ''}`;
// Pata con almohadilla clara y dos líneas de dedos.
const pata = (cls, x, y, w, h, fill) => `<g class="leg ${cls}"><rect ${O} x="${x}" y="${y}" width="${w}" height="${h}" rx="${w / 2}" fill="${fill}"/>
  <path d="M${x + 2} ${y + h - 3.2}h${w - 4}" stroke="var(--mask)" stroke-width="3.4" stroke-linecap="round"/>
  <path d="M${x + w * .37} ${y + h - 5}v3.4M${x + w * .63} ${y + h - 5}v3.4" stroke="var(--line-art)" stroke-width="1" opacity=".55"/></g>`;
const moneda = (cx, cy, r) => `<circle ${O} cx="${cx}" cy="${cy}" r="${r}" fill="var(--gold)"/><circle cx="${cx}" cy="${cy}" r="${r * .62}" fill="none" stroke="var(--gold-dark)" stroke-width="1"/><path class="brillo" d="M${cx - r * .45} ${cy - r * .2}a${r * .5} ${r * .5} 0 0 1 ${r * .4}-${r * .35}" fill="none" stroke="#fff" stroke-width="1.4" stroke-linecap="round"/>`;
// Collar: borde oscuro y color encima (el color cambia en Ajustes), con tachas.
const collar = (d, ancho) => `<path d="${d}" fill="none" stroke="var(--line-art)" stroke-width="${ancho + 2.6}" stroke-linecap="round"/><path d="${d}" fill="none" stroke="var(--cr)" stroke-width="${ancho}" stroke-linecap="round"/><path d="${d}" fill="none" stroke="var(--cr-light)" stroke-width="1.2" stroke-dasharray="1 5" stroke-linecap="round"/>`;
// Mechón en zigzag: relleno sin borde + borde abierto (para no cerrar con una línea recta).
const mechon = (d, fill) => `<path d="${d}" fill="${fill}"/><path ${O} d="${d}" fill="none"/>`;
const rubor = (x, y) => `<ellipse cx="${x}" cy="${y}" rx="4.2" ry="2.3" fill="#F49AA8" opacity=".55"/><path d="M${x - 3} ${y - 1}l-1 2.2M${x} ${y - 1}l-1 2.2M${x + 3} ${y - 1}l-1 2.2" stroke="#E86F86" stroke-width="1" stroke-linecap="round"/>`;
const gota = (x, y) => `<path class="gota" d="M${x} ${y}c2 3 3 4.5 3 5.8a3 3 0 0 1-6 0c0-1.3 1-2.8 3-5.8z" fill="#7FB7E6" stroke="var(--line-art)" stroke-width="1.2"/>`;

const ARTE = {
  1: { vb: '0 0 120 100', w: 88, h: 73, svg: `
    <g class="tail"><path ${O} d="M35 61q-12-10-7-24l3 4 2-5q4 9 7 24z" fill="var(--fur)"/><path d="M31.5 42l1.6 4" stroke="var(--fur-light)" stroke-width="2" stroke-linecap="round"/></g>
    ${pata('lb', 36, 71, 11, 17, 'var(--fur-dark)')}${pata('la', 47, 73, 11, 16, 'var(--fur-dark)')}
    <ellipse ${O} cx="56" cy="64" rx="26" ry="17" fill="var(--fur)"/>
    <path d="M31 67q3 13 25 14q20 0 26-12q-7 7-26 7t-25-9z" fill="var(--fur-shade)"/>
    <path d="M39 53q11-6 24-3" fill="none" stroke="var(--fur-light)" stroke-width="3" stroke-linecap="round"/>
    <path d="M45 77l3-4 3 3 3-4 3 3 3-4 3 3 3-4 3 4q-12 6-24 3z" fill="var(--belly)"/>
    ${pata('la', 64, 73, 11, 16, 'var(--fur)')}${pata('lb', 75, 71, 11, 17, 'var(--fur)')}
    <circle ${O} cx="80" cy="44" r="24" fill="var(--fur)"/>
    <path d="M57 49q4 15 21 19q-15-3-20-12z" fill="var(--fur-shade)"/>
    ${mechon('M59 46l-5 2 4 3-4 3 5 1-2 4 5-1', 'var(--fur)')}
    <path d="M70 25q9-5 17-1" fill="none" stroke="var(--fur-light)" stroke-width="3" stroke-linecap="round"/>
    <path ${O} d="M88 45h16q9 1 9 8q0 7-9 8l-3 6-4-5-4 5-3-5q-7-1-7-8z" fill="var(--mask)"/>
    <path d="M91 55q9 3 19-1" fill="none" stroke="var(--belly)" stroke-width="2.4" stroke-linecap="round"/>
    <circle cx="97" cy="51.5" r=".95" fill="var(--fur-dark)"/><circle cx="100.5" cy="52.5" r=".95" fill="var(--fur-dark)"/><circle cx="99" cy="49" r=".95" fill="var(--fur-dark)"/>
    <ellipse ${O} cx="111" cy="48" rx="4.6" ry="3.8" fill="var(--line-art)"/><ellipse cx="109.8" cy="46.6" rx="1.7" ry="1" fill="#fff" opacity=".85"/>
    ${mechon('M75 36l2-6 3 3 3-5 3 4 3-3 2 5 3-1q-9-3-19 3z', 'var(--mask)')}
    <path class="ceja-enojo" d="M76 32l14 5" fill="none" stroke="var(--line-art)" stroke-width="3" stroke-linecap="round"/>
    ${ojo(85, 42, 6.2, 7.6)}
    ${rubor(91, 56)}
    <g class="boca-feliz"><path class="o" d="M97 59q4 3 8-1" fill="none"/><path ${O} d="M99.5 60.6q2.2 6 5 0z" fill="#EF7C8E"/></g>
    <path class="boca-triste o" d="M97 62q4-3 8 1" fill="none"/>
    <path class="boca-ladra o" d="M95 58q5 10 12 0q-6 2.5-12 0z" fill="#7A2430"/>
    <g class="ear"><path ${O} d="M60 30q8-11 16-5q-1 11-8 16q-8-3-8-11z" fill="var(--fur-dark)"/><path d="M64 31q5-6 9-2q-1 6-5 9q-4-2-4-7z" fill="var(--ear-in)"/></g>
    ${collar('M63 58q8 7 18 2', 4.6)}
    ${moneda(72, 68.5, 5.4)}
    ${gota(62, 16)}` },

  2: { vb: '0 0 140 100', w: 108, h: 77, svg: `
    <g class="tail"><path ${O} d="M32 53q-12-15-4-27l3 4 2-5q5 10 7 26z" fill="var(--fur)"/><path d="M29.5 31l2 4" stroke="var(--fur-light)" stroke-width="2" stroke-linecap="round"/></g>
    ${pata('lb', 34, 62, 10, 26, 'var(--fur-dark)')}${pata('la', 46, 64, 10, 25, 'var(--fur-dark)')}
    ${mechon('M36 49l4-8 3 6 4-9 3 8 4-8 3 7 4-7 3 7 4-6 3 6 4-5 2 6', 'var(--fur)')}
    <path ${O} d="M28 58q0-14 36-14q34 0 38 12q2 14-38 16q-36 0-36-14z" fill="var(--fur)"/>
    <path d="M29 61q4 12 35 12q34-1 38-14q-5 9-38 10q-31 0-35-8z" fill="var(--fur-shade)"/>
    <path d="M42 49q18-4 38-1" fill="none" stroke="var(--fur-light)" stroke-width="3" stroke-linecap="round"/>
    <path d="M52 70l3-4 3 3 3-4 3 3 3-4 3 3 3-4 3 3 3-3 2 4q-15 6-30 3z" fill="var(--belly)"/>
    ${pata('la', 82, 64, 10, 25, 'var(--fur)')}${pata('lb', 94, 62, 10, 26, 'var(--fur)')}
    <path ${O} d="M90 42q0-18 18-18q12 0 16 10h10q6 1 6 7t-6 7h-14q-18 8-26 4q-4-3-4-10z" fill="var(--fur)"/>
    <path d="M91 46q6 8 18 7q-10 5-16 1z" fill="var(--fur-shade)"/>
    <path d="M98 27q8-4 16-1" fill="none" stroke="var(--fur-light)" stroke-width="3" stroke-linecap="round"/>
    <path ${O} d="M114 38h22q6 1 5 7q-1 6-8 6l-3 6-4-5-4 5-3-5-3 5-2-6q-4-2-3-7z" fill="var(--mask)"/>
    <path d="M117 47q10 3 21-1" fill="none" stroke="var(--belly)" stroke-width="2.4" stroke-linecap="round"/>
    <circle cx="123" cy="44" r=".9" fill="var(--fur-dark)"/><circle cx="127" cy="45" r=".9" fill="var(--fur-dark)"/><circle cx="125" cy="41.5" r=".9" fill="var(--fur-dark)"/>
    <ellipse ${O} cx="139" cy="40.5" rx="3.8" ry="3.2" fill="var(--line-art)"/><ellipse cx="138" cy="39.3" rx="1.4" ry=".8" fill="#fff" opacity=".85"/>
    ${mechon('M102 32l2-6 3 3 3-6 3 5 3-4 2 5 3-1q-10-2-19 4z', 'var(--mask)')}
    <path class="ceja-enojo" d="M103 28l14 5" fill="none" stroke="var(--line-art)" stroke-width="3" stroke-linecap="round"/>
    ${ojo(111, 37, 4.8, 6, 'M104 30.5q7-4 14 0')}
    ${rubor(116, 46)}
    <g class="boca-feliz"><path class="o" d="M124 52q4 2 8-1" fill="none"/><path ${O} d="M126 53.2q2 5.4 4.6 0z" fill="#EF7C8E"/></g>
    <path class="boca-triste o" d="M124 54q4-3 8 0" fill="none"/>
    <path class="boca-ladra o" d="M121 50q6 10 13 0q-6 2.4-13 0z" fill="#7A2430"/>
    <g class="ear"><path ${O} d="M95 26l5-15q9 3 8 13l-4-3z" fill="var(--fur-dark)"/><path d="M99 22l2-7q4 2 4 7z" fill="var(--ear-in)"/><path d="M104 21l4 3" stroke="var(--line-art)" stroke-width="1.6" stroke-linecap="round"/></g>
    <path ${O} d="M86 46l21 2-10 17z" fill="var(--cr)"/>
    <path d="M90 48l13 1.4" stroke="var(--cr-dark)" stroke-width="2" stroke-linecap="round"/>
    <circle cx="94" cy="52" r="1.5" fill="#fff"/><circle cx="100" cy="53" r="1.5" fill="#fff"/><circle cx="96.5" cy="57.5" r="1.5" fill="#fff"/>
    ${gota(90, 14)}` },

  3: { vb: '0 0 160 120', w: 134, h: 100, svg: `
    <g class="tail"><path ${O} d="M31 70q-11-22-1-34l3 5 2-6q7 11 9 33z" fill="var(--fur)"/><path d="M29 42l2 5" stroke="var(--fur-light)" stroke-width="2.2" stroke-linecap="round"/></g>
    ${pata('lb', 36, 80, 16, 28, 'var(--fur-dark)')}${pata('la', 53, 82, 16, 27, 'var(--fur-dark)')}
    ${mechon('M38 58l4-8 4 6 4-9 4 8 4-8 4 7 4-8 4 7 4-7 4 7 4-6 3 6', 'var(--fur)')}
    <path ${O} d="M26 76q0-24 50-24q48 0 52 20q2 24-52 26q-50 0-50-22z" fill="var(--fur)"/>
    <path d="M27 80q5 18 49 18q48-1 52-22q-6 14-52 15q-44 0-49-11z" fill="var(--fur-shade)"/>
    <path d="M58 99l3-5 4 4 3-5 4 4 3-5 4 4 3-5 4 4 3-4 3 5q-20 7-38 3z" fill="var(--belly)"/>
    <rect ${O} x="50" y="53" width="38" height="22" rx="5" fill="#8C5A2B"/>
    <path d="M53 57h32" stroke="#A97040" stroke-width="2.4" stroke-linecap="round"/>
    <path d="M52 64h34" fill="none" stroke="var(--line-art)" stroke-width="2"/>
    <path d="M54 72h30" stroke="#6E431C" stroke-width="1" stroke-dasharray="2 2"/>
    <rect ${O} x="65" y="61" width="8" height="8" rx="1.5" fill="var(--gold)"/>
    ${moneda(59, 51, 5)}${moneda(71, 49, 5.6)}${moneda(82, 52, 4.6)}
    ${pata('la', 96, 82, 16, 27, 'var(--fur)')}${pata('lb', 113, 80, 16, 28, 'var(--fur)')}
    ${mechon('M101 84l-4-5 5-2-4-5 6-1-3-5 6 1 1-6 4 4', 'var(--mask)')}
    <path ${O} d="M100 82q-6-14 6-22q14 4 16 18q-8 8-22 4z" fill="var(--mask)"/>
    <path ${O} d="M104 56q0-22 22-22q14 0 18 10h8q8 1 8 9t-8 9h-16q-20 10-28 6q-4-4-4-12z" fill="var(--fur)"/>
    <path d="M105 60q6 9 20 8q-12 6-19 1z" fill="var(--fur-shade)"/>
    <path d="M112 38q9-5 18-2" fill="none" stroke="var(--fur-light)" stroke-width="3" stroke-linecap="round"/>
    <path ${O} d="M130 50h22q7 1 6 8q-1 7-9 7l-3 7-4-6-4 6-3-6-4 6-3-6-3 6-2-7q-5-3-3-9z" fill="var(--mask)"/>
    <path d="M133 60q11 3 23-1" fill="none" stroke="var(--belly)" stroke-width="2.6" stroke-linecap="round"/>
    <circle cx="139" cy="56" r="1" fill="var(--fur-dark)"/><circle cx="143" cy="57" r="1" fill="var(--fur-dark)"/><circle cx="141" cy="53.5" r="1" fill="var(--fur-dark)"/>
    <ellipse ${O} cx="156" cy="52.5" rx="4.2" ry="3.6" fill="var(--line-art)"/><ellipse cx="154.7" cy="51.2" rx="1.5" ry=".9" fill="#fff" opacity=".85"/>
    ${mechon('M115 44l2-7 4 3 3-7 4 6 3-5 3 6 4-2q-12-3-23 6z', 'var(--mask)')}
    <path class="ceja-enojo" d="M116 40l17 6" fill="none" stroke="var(--line-art)" stroke-width="3.2" stroke-linecap="round"/>
    ${ojo(126, 49, 5.2, 6.4, 'M118 42q8-5 17-1')}
    <g class="boca-feliz"><path class="o" d="M140 67q5 2 9-1" fill="none"/></g>
    <path class="boca-triste o" d="M140 69q5-3 9 0" fill="none"/>
    <path class="boca-ladra o" d="M137 64q7 11 15 0q-7 2.6-15 0z" fill="#7A2430"/>
    <g class="ear"><path ${O} d="M110 38l5-17q10 3 10 15l-5-3z" fill="var(--fur-dark)"/><path d="M114 33l2-8q5 2 5 8z" fill="var(--ear-in)"/><path d="M120 33l5 3" stroke="var(--line-art)" stroke-width="1.6" stroke-linecap="round"/></g>
    ${collar('M104 62q9 8 22 3', 5.4)}
    <path ${O} d="M111 66l-3 6h12l-3-6z" fill="var(--cr-dark)"/>
    <circle ${O} cx="114" cy="76" r="8.2" fill="var(--gold)"/>
    <circle cx="114" cy="76" r="5.6" fill="none" stroke="var(--gold-dark)" stroke-width="1"/>
    <text x="114" y="78.6" text-anchor="middle" font-family="Inter, system-ui, sans-serif" font-size="7.5" font-weight="800" fill="var(--gold-dark)">S/</text>
    <path class="brillo" d="M109 73a5 5 0 0 1 4-3" fill="none" stroke="#fff" stroke-width="1.4" stroke-linecap="round"/>
    ${gota(106, 24)}` }
};
const NOMBRES = { 1: 'Sencillito', 2: 'Sencillo', 3: 'Don Sencillo' };
const EDAD = { 1: 'cachorro', 2: 'joven', 3: 'adulto' };
const SUB = { 1: 'el cachorro ahorrador', 2: 'el joven explorador', 3: 'el guardián de la alcancía' };
export const svgDe = (e) => `<svg class="criatura" viewBox="${ARTE[e].vb}" aria-hidden="true">${ARTE[e].svg}</svg>`;

export { NOMBRES, EDAD };

/* ------------------------------------------------------------ Preferencias (solo en este celular) --- */

export const COLORES = {
  rojo: { l: 'Rojo', c: ['#D9483B', '#F7B4A9', '#A52A20'] },
  azul: { l: 'Azul', c: ['#2F6FB5', '#B5D0EE', '#1F4E85'] },
  verde: { l: 'Verde', c: ['#1F7A5C', '#A9DCC6', '#145440'] },
  morado: { l: 'Morado', c: ['#7A4FC2', '#D2C0F0', '#55338F'] }
};
const guardar = (k, v) => { try { localStorage.setItem('sencillo.' + k, JSON.stringify(v)); } catch { /* sin almacenamiento */ } };
const leer = (k, d) => { try { const v = localStorage.getItem('sencillo.' + k); return v == null ? d : JSON.parse(v); } catch { return d; } };
export const UMBRAL = { 2: 5, 3: 15 };
export const etapaPorMonedas = (m) => (m >= UMBRAL[3] ? 3 : m >= UMBRAL[2] ? 2 : 1);

/** Preferencias de la mascota. Viene apagada: cada persona la activa en Apariencia › Mascota. */
export function leerMascota() {
  const monedas = Number(leer('monedas', 0)) || 0;
  return { ver: leer('ver', false) === true, sonido: leer('sonido', true) !== false, color: COLORES[leer('color', 'rojo')] ? leer('color', 'rojo') : 'rojo', monedas, etapa: etapaPorMonedas(monedas) };
}
export function guardarMascota(patch) {
  Object.entries(patch).forEach(([k, v]) => guardar(k, v));
  if (estado.montada) aplicarPrefs();
}

/* ------------------------------------------------------------ La mascota en la app --- */

// Solo pasea por las pestañas principales; se esconde con hojas abiertas, al escribir y fuera de la pantalla.
const RUTAS = ['inicio', 'gastos', 'analisis', 'cierre'];
const estado = { montada: false, ruta: '', datos: () => ({}) };
let capa, pet, arte, burbuja;
let etapa = 1, W = 88, H = 73, ancho = 0, suelo = 0, visible = false, raf = 0;
const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const p = { x: 120, y: 0, vy: 0, dir: 1, estado: 'idle', meta: null, rapido: false, hasta: 0 };
let ultimoToque = performance.now(), tAnterior = performance.now(), tZ = 0, tParpadeo = performance.now() + 2500, alLlegar = null;
const nombre = () => NOMBRES[etapa];

function aplicarPrefs() {
  const pr = leerMascota();
  const [a, l, d] = COLORES[pr.color].c;
  capa.style.setProperty('--cr', a); capa.style.setProperty('--cr-light', l); capa.style.setProperty('--cr-dark', d);
  if (pr.etapa !== etapa) ponerEtapa(pr.etapa);
  revisar();
}

/**
 * Monta la capa una sola vez (fuera de #app, para que los redibujos no la borren).
 * `datos()` devuelve lo que la mascota cuenta del mes: nombre, queda, porDia, proximo, sobregiro, excedida.
 */
export function montarMascota({ datos }) {
  if (estado.montada || typeof document === 'undefined') return;
  estado.montada = true; estado.datos = datos;
  capa = document.createElement('div');
  capa.className = 'masc-capa';
  capa.innerHTML = '<button type="button" class="masc" hidden><div class="giro"><div class="cuerpo"></div></div></button><div class="masc-burbuja" aria-live="polite"></div>';
  document.body.appendChild(capa);
  pet = capa.querySelector('.masc'); arte = capa.querySelector('.cuerpo'); burbuja = capa.querySelector('.masc-burbuja');
  etapa = leerMascota().etapa;
  ponerEtapa(etapa);
  aplicarPrefs();
  eventos();
  addEventListener('resize', () => { if (visible) medir(); });
  document.addEventListener('focusin', revisar);
  document.addEventListener('focusout', () => setTimeout(revisar, 50));
  document.addEventListener('visibilitychange', revisar);
  setInterval(revisar, 700);
}

/** Después de cada pantalla: decide si se ve. */
export function rutaMascota(ruta) { estado.ruta = ruta; if (estado.montada) revisar(); }

function puedeVerse() {
  if (!leerMascota().ver || document.hidden || !RUTAS.includes(estado.ruta)) return false;
  if (document.querySelector('.sheet') || !document.querySelector('.tabbar')) return false;
  const a = document.activeElement;
  return !(a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA' || a.tagName === 'SELECT' || a.isContentEditable));
}

function revisar() {
  const v = puedeVerse();
  if (v === visible) { if (v) medir(); return; }
  visible = v;
  pet.hidden = !v;
  if (!v) { burbuja.classList.remove('ver'); cancelAnimationFrame(raf); raf = 0; return; }
  medir();
  if (!p.y || p.y > suelo) p.y = suelo;
  p.x = Math.min(Math.max(p.x, W / 2), ancho - W / 2);
  pet.style.transform = `translate(${p.x - W / 2}px, ${p.y - H}px)`;
  if (!estado.saludo) { estado.saludo = true; setTimeout(() => visible && decir(`¡Hola! Soy ${nombre()}. Tócame.`, 3200), 500); }
  tAnterior = performance.now();
  raf = requestAnimationFrame(paso);
}

function medir() {
  ancho = document.documentElement.clientWidth;
  const tb = document.querySelector('.tabbar .tabgroup') || document.querySelector('.tabbar');
  const nuevo = tb ? tb.getBoundingClientRect().top + 6 : innerHeight - 90;
  if (Math.abs(nuevo - suelo) > 1 && p.estado !== 'drag') { if (p.y >= suelo - 1) p.y = nuevo; suelo = nuevo; }
  if (!suelo) suelo = nuevo;
  p.x = Math.min(Math.max(p.x, W / 2), ancho - W / 2);
}

function ponerEtapa(e) {
  etapa = e; W = ARTE[e].w * 0.74; H = ARTE[e].h * 0.74;
  pet.style.width = W + 'px'; pet.style.height = H + 'px';
  arte.innerHTML = svgDe(e);
  ponerAnimo();
}
function clase(...cs) { pet.classList.remove('walk', 'run', 'sleep'); cs.forEach((c) => c && pet.classList.add(c)); }
function caminarA(x, rapido = false) {
  p.meta = Math.min(Math.max(x, W / 2 + 4), ancho - W / 2 - 4);
  p.rapido = rapido; p.estado = 'walk';
  p.dir = p.meta >= p.x ? 1 : -1;
  pet.classList.toggle('izq', p.dir < 0);
  clase(rapido ? 'run' : 'walk');
}
function quedarse(ms) { p.estado = 'idle'; p.meta = null; p.hasta = performance.now() + ms; clase(); }
function dormir() { if (p.estado === 'drag') return; p.estado = 'sleep'; p.meta = null; clase('sleep'); ponerAnimo(); decir('Me echo un ratito…', 1800); }
function despertar(msg) { if (p.estado !== 'sleep') return; quedarse(900); ponerAnimo(); decir(msg || '¡Ya desperté!'); }

function paso(t) {
  if (!visible) { raf = 0; return; }
  const dt = Math.min(0.05, (t - tAnterior) / 1000); tAnterior = t;
  if (p.estado !== 'drag') {
    if (p.y < suelo || p.vy !== 0) {
      p.vy += 1800 * dt; p.y += p.vy * dt;
      if (p.y >= suelo) { p.y = suelo; if (p.vy > 380) { p.vy = -p.vy * 0.32; animar('aterriza'); } else p.vy = 0; }
    }
    if (p.estado === 'walk' && p.meta != null && p.vy === 0) {
      const v = (p.rapido ? 170 : 52 - (etapa - 1) * 7) * (reduce ? 0.7 : 1);
      const d = p.meta - p.x;
      if (Math.abs(d) <= v * dt) { p.x = p.meta; llego(); } else p.x += Math.sign(d) * v * dt;
    } else if (p.estado === 'idle' && t > p.hasta && p.vy === 0) {
      if (t - ultimoToque > 30000) dormir();
      else { const r = Math.random(); if (r < 0.55) caminarA(W / 2 + Math.random() * (ancho - W)); else if (r < 0.78) haceAlgoSolo(); else quedarse(2000 + Math.random() * 3000); }
    } else if (p.estado === 'sleep' && t - tZ > 1500) {
      tZ = t; particula('z', 'z', p.x + 16 * p.dir, p.y - H + 6, 16 * p.dir, -44);
    }
    if (p.estado !== 'sleep' && t > tParpadeo) { pet.classList.add('parpadeo'); setTimeout(() => pet.classList.remove('parpadeo'), 140); tParpadeo = t + 2200 + Math.random() * 3000; }
  }
  pet.style.transform = `translate(${p.x - W / 2}px, ${p.y - H}px)`;
  if (burbuja.classList.contains('ver')) colocarBurbuja();
  raf = requestAnimationFrame(paso);
}
function llego() { clase(); const fn = alLlegar; alLlegar = null; if (fn) fn(); else quedarse(1500 + Math.random() * 3000); }
function animar(c) { pet.classList.remove(c); void pet.offsetWidth; pet.classList.add(c); setTimeout(() => pet.classList.remove(c), 700); }
function saltar(fuerza = 480) { if (p.estado === 'drag') return; p.vy = -fuerza * (reduce ? 0.5 : 1) * (etapa === 3 ? 0.7 : 1); p.y -= 1; pet.classList.add('feliz'); setTimeout(() => pet.classList.remove('feliz'), 950); }

let tBurbuja = 0;
function decir(texto, ms = 3200) {
  burbuja.textContent = texto; burbuja.classList.add('ver'); colocarBurbuja();
  clearTimeout(tBurbuja); tBurbuja = setTimeout(() => burbuja.classList.remove('ver'), ms);
}
function colocarBurbuja() {
  const bw = burbuja.offsetWidth, bh = burbuja.offsetHeight;
  const x = Math.min(Math.max(p.x - bw / 2, 10), ancho - bw - 10);
  const y = Math.max(60, p.y - H - bh - 10);
  burbuja.style.transform = `translate(${x}px, ${y}px)`;
  burbuja.style.setProperty('--cola', Math.min(Math.max(p.x - x, 16), bw - 16) + 'px');
}

function particula(tipo, contenido, x, y, dx = 0, dy = -60) {
  const el = document.createElement('div');
  el.className = 'masc-part ' + tipo;
  if (tipo === 'corazon') el.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 11c0 5.6-7 10-7 10z" fill="#E5677F"/></svg>';
  else el.textContent = contenido;
  el.style.setProperty('--x0', x + 'px'); el.style.setProperty('--y0', y + 'px');
  el.style.setProperty('--x1', x + dx + 'px'); el.style.setProperty('--y1', y + dy + 'px');
  capa.appendChild(el);
  setTimeout(() => el.remove(), 2100);
}
const corazones = (n = 3) => { for (let i = 0; i < n; i++) setTimeout(() => particula('corazon', '', p.x - 9 + (Math.random() * 30 - 15), p.y - H, Math.random() * 30 - 15, -55 - Math.random() * 25), i * 110); };
const chispas = (n = 4) => { for (let i = 0; i < n; i++) setTimeout(() => particula('chispa', '', p.x - 5 + (Math.random() * 40 - 20), p.y - H * .7, Math.random() * 30 - 15, -40 - Math.random() * 25), i * 90); };
function monedaHacia(desdeX, desdeY) {
  const el = document.createElement('div');
  el.className = 'masc-part moneda cae'; el.textContent = 'S/';
  el.style.setProperty('--x0', desdeX - 11 + 'px'); el.style.setProperty('--y0', desdeY + 'px');
  el.style.setProperty('--x1', p.x - 11 + 'px'); el.style.setProperty('--y1', p.y - H * .8 + 'px');
  capa.appendChild(el);
  setTimeout(() => { el.remove(); animar('aterriza'); chispas(3); }, 720);
}

function sumarMoneda() {
  const pr = leerMascota();
  const antes = etapaPorMonedas(pr.monedas);
  guardar('monedas', pr.monedas + 1);
  const ahora = etapaPorMonedas(pr.monedas + 1);
  if (ahora > antes) setTimeout(() => evolucionar(ahora), 900);
}
function evolucionar(e) {
  const de = nombre();
  quedarse(2200);
  pet.classList.remove('evoluciona'); void pet.offsetWidth; pet.classList.add('evoluciona');
  for (let i = 0; i < 10; i++) setTimeout(() => particula('chispa', '', p.x - 5 + (Math.random() * 60 - 30), p.y - H / 2 + (Math.random() * 30 - 15), Math.random() * 50 - 25, -40 - Math.random() * 40), i * 90);
  setTimeout(() => ponerEtapa(e), 650);
  setTimeout(() => { pet.classList.remove('evoluciona'); saltar(420); decir(`¡${de} creció! Ahora es ${NOMBRES[e]}, ${EDAD[e]}.`, 3800); }, 1450);
}

/** Lo que cuenta: frases con los datos reales del mes. */
function mensajes() {
  const d = estado.datos() || {};
  const h = new Date().getHours();
  const l = [`${h < 12 ? '¡Buenos días' : h < 19 ? '¡Buenas tardes' : '¡Buenas noches'}${d.nombre ? ', ' + d.nombre : ''}!`];
  if (d.sobregiro) l.push(`Ojo: este mes se pasan de los ingresos por ${d.sobregiro}.`);
  if (d.excedida) l.push(`${d.excedida.cat} pasó su tope: ${d.excedida.usado} de ${d.excedida.tope}.`);
  if (d.queda) l.push(`Les quedan ${d.queda} para ${d.mes}.`);
  if (d.porDia) l.push(`Pueden gastar ${d.porDia} por día.`);
  if (d.proximo) l.push(d.proximo);
  if (d.sinMonto) l.push(d.sinMonto === 1 ? 'Hay un gasto esperando su monto. Cuando llegue el recibo, lo anotamos.' : `Hay ${d.sinMonto} gastos esperando su monto.`);
  if (d.proyeccion) l.push(d.proyeccion);
  const m = leerMascota().monedas;
  l.push(`Tengo ${m} ${m === 1 ? 'moneda enterrada' : 'monedas enterradas'}. Cada gasto que anotas me da una.`);
  l.push('Guau. Vi una oferta de arroz en el mercado.');
  return l;
}
let iMsg = 0;
function ponerAnimo() {
  if (!pet) return;
  const d = estado.montada ? (estado.datos() || {}) : {};
  const preocupado = !!(d.sobregiro || d.excedida) && p.estado !== 'sleep';
  pet.classList.toggle('preocupado', preocupado);
  pet.setAttribute('aria-label', `${nombre()}, la mascota${p.estado === 'sleep' ? ' (dormido)' : preocupado ? ' (preocupado)' : ''}. Tócalo para que te cuente algo del mes`);
}

let audio = null;
function ladrido(veces = 2) {
  if (!leerMascota().sonido) return;
  try {
    audio = audio || new (window.AudioContext || window.webkitAudioContext)();
    if (audio.state === 'suspended') audio.resume();
    const base = etapa === 1 ? 880 : etapa === 2 ? 620 : 430;
    for (let i = 0; i < veces; i++) {
      const t0 = audio.currentTime + i * 0.2;
      const o = audio.createOscillator(), f = audio.createBiquadFilter(), g = audio.createGain();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(base * 1.25, t0);
      o.frequency.exponentialRampToValueAtTime(base * 0.55, t0 + 0.13);
      f.type = 'bandpass'; f.frequency.value = base * 1.6; f.Q.value = 1.4;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.3, t0 + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.16);
      o.connect(f); f.connect(g); g.connect(audio.destination);
      o.start(t0); o.stop(t0 + 0.18);
    }
  } catch { /* sin audio */ }
}
function guau(texto = '¡GUAU!') {
  pet.classList.remove('ladra'); void pet.offsetWidth; pet.classList.add('ladra');
  setTimeout(() => pet.classList.remove('ladra'), 820);
  const x = Math.min(Math.max(p.x + p.dir * W * .5 - 30, 4), ancho - 74);
  particula('guau', texto, x, p.y - H * .62, p.dir * 16, -12);
}

let toques = [], ladridos = [], abajo = null, ofendido = 0;
function eventos() {
  pet.addEventListener('pointerdown', (ev) => {
    ev.preventDefault(); try { pet.setPointerCapture(ev.pointerId); } catch { /* puntero simulado */ }
    abajo = { id: ev.pointerId, x: ev.clientX, y: ev.clientY, t: performance.now(), arrastra: false, caricia: false, prev: [], moneda: false };
    abajo.timer = setTimeout(empezarCaricia, 450);
  });
  pet.addEventListener('pointermove', (ev) => {
    if (!abajo || ev.pointerId !== abajo.id) return;
    const dx = ev.clientX - abajo.x, dy = ev.clientY - abajo.y;
    if (!abajo.arrastra && Math.hypot(dx, dy) > 9) {
      terminarCaricia(abajo); abajo.caricia = false;
      abajo.arrastra = true; p.estado = 'drag'; p.vy = 0; p.meta = null; clase(); pet.classList.add('drag');
      decir(etapa === 3 ? '¡Oye, que peso 16 kilos!' : '¡Uy! ¿A dónde vamos?', 1600);
    }
    if (abajo.arrastra) {
      p.x = Math.min(Math.max(ev.clientX, W / 2), ancho - W / 2);
      p.y = Math.min(Math.max(ev.clientY + H / 2, H + 60), suelo);
      if (Math.abs(dx) > 4) { p.dir = dx >= 0 ? 1 : -1; pet.classList.toggle('izq', p.dir < 0); }
      abajo.prev.push([performance.now(), p.y]); if (abajo.prev.length > 5) abajo.prev.shift();
    }
  });
  pet.addEventListener('pointerup', soltar);
  pet.addEventListener('pointercancel', soltar);
  pet.addEventListener('contextmenu', (ev) => ev.preventDefault());
  pet.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); tocar(); } });
}
function empezarCaricia() {
  if (!abajo || abajo.arrastra) return;
  abajo.caricia = true; ultimoToque = performance.now();
  if (p.estado === 'sleep') { quedarse(600); ponerAnimo(); }
  p.estado = 'idle'; p.meta = null; p.hasta = Infinity; clase();
  pet.classList.add('caricia');
  decir(etapa === 1 ? 'Mmm… ¡más, más!' : 'Mmm… justo ahí.', 2600);
  abajo.corazones = setInterval(() => corazones(1), 380);
  abajo.premio = setTimeout(() => {
    if (!abajo || !abajo.caricia || abajo.moneda) return;
    // Una moneda por caricia, como mucho 3 al día: crece sobre todo anotando gastos.
    const hoy = new Date().toISOString().slice(0, 10);
    const c = leer('caricias', {});
    if ((c[hoy] || 0) >= 3) return;
    guardar('caricias', { [hoy]: (c[hoy] || 0) + 1 });
    abajo.moneda = true;
    chispas(3); monedaHacia(p.x, p.y - H - 60);
    decir('Por tanto cariño, enterré una moneda.', 2600);
    setTimeout(sumarMoneda, 500);
  }, 1600);
}
function terminarCaricia(fue) {
  clearTimeout(fue.timer); clearInterval(fue.corazones); clearTimeout(fue.premio);
  if (fue.caricia) { pet.classList.remove('caricia'); quedarse(900); }
}
function soltar(ev) {
  if (!abajo || (ev && ev.pointerId !== abajo.id)) return;
  const fue = abajo; abajo = null; ultimoToque = performance.now();
  terminarCaricia(fue);
  if (fue.arrastra) {
    pet.classList.remove('drag');
    const [a, b] = [fue.prev[0], fue.prev[fue.prev.length - 1]];
    p.vy = a && b && b[0] > a[0] ? Math.max(-500, Math.min(400, (b[1] - a[1]) / ((b[0] - a[0]) / 1000))) : 0;
    quedarse(900);
    if (p.y < suelo - 20) setTimeout(() => decir('¡Aterricé!', 1500), 380);
    return;
  }
  if (fue.caricia) { decir('Gracias. Guau.', 1400); return; }
  tocar();
}
function tocar() {
  const t = performance.now();
  ultimoToque = t;
  if (t < ofendido) { guau('grr…'); decir('Grrr… dame un ratito.', 1500); return; }
  if (p.estado === 'sleep') { despertar(); saltar(360); ladrido(1); guau('¿guau?'); return; }
  toques = toques.filter((x) => t - x < 1600); toques.push(t);
  if (toques.length >= 4) {
    toques = [];
    ladridos = ladridos.filter((x) => t - x < 7000); ladridos.push(t);
    quedarse(1300); ladrido(2); guau();
    if (ladridos.length >= 2) {
      ladridos = []; ofendido = t + 3500;
      decir('¡Ya, ya! Me voy para allá.', 2400);
      setTimeout(() => { alLlegar = () => { quedarse(2500); p.dir = p.x > ancho / 2 ? -1 : 1; pet.classList.toggle('izq', p.dir < 0); decir('Hmpf.', 1400); }; caminarA(p.x > ancho / 2 ? W : ancho - W, true); }, 700);
    } else {
      decir(['¡Guau! ¡No me piques tanto!', '¡Guau guau! ¡Que me haces cosquillas!', '¡GUAU! Uno a la vez, por favor.'][Math.floor(Math.random() * 3)], 2400);
    }
    return;
  }
  quedarse(1600);
  if (toques.length > 1) { animar('aterriza'); decir(['¿Eh?', '¡Oye!', '¿Qué pasa?'][toques.length - 2] || '¡Oye!', 900); return; }
  saltar(); corazones(2); chispas(1);
  const ms = mensajes();
  decir(ms[iMsg++ % ms.length], 3600);
}
function haceAlgoSolo() {
  if (Math.random() < 0.5) {
    quedarse(1700); pet.classList.add('olfatea');
    setTimeout(() => pet.classList.remove('olfatea'), 1600);
    if (Math.random() < 0.3) setTimeout(() => visible && decir(['Snif, snif… huele a oferta.', 'Por aquí pasó un sol.', 'Snif… ¿pan con chicharrón?'][Math.floor(Math.random() * 3)], 1800), 500);
  } else {
    quedarse(1800); pet.classList.add('cava');
    const tierra = setInterval(() => { for (let i = 0; i < 2; i++) particula('tierra', '', p.x - p.dir * W * .3, p.y - 6, -p.dir * (20 + Math.random() * 30), -18 - Math.random() * 22); }, 120);
    setTimeout(() => { clearInterval(tierra); pet.classList.remove('cava'); if (Math.random() < 0.4 && visible) decir('Aquí guardo mis ahorros. Shhh.', 1800); }, 1500);
  }
}

/** Al anotar un gasto nuevo en este celular: corre al botón +, recibe una moneda y lo celebra. */
export function premiarMascota(texto) {
  if (!estado.montada || !leerMascota().ver) return;
  const hacer = () => {
    if (!visible) return;
    ultimoToque = performance.now();
    if (p.estado === 'sleep') despertar('¿Un gasto? ¡Voy!');
    const mas = document.querySelector('.tab-add');
    const xMas = mas ? mas.getBoundingClientRect().left + mas.offsetWidth / 2 : ancho / 2;
    alLlegar = () => {
      p.dir = 1; pet.classList.remove('izq'); quedarse(1800);
      monedaHacia(xMas, suelo - 110);
      setTimeout(() => { saltar(520); corazones(3); ladrido(1); guau('¡guau!'); decir(texto || '¡Anotado!', 3600); sumarMoneda(); }, 650);
    };
    caminarA(xMas - W * 0.62 - 10, true);
  };
  setTimeout(hacer, 700);
}
