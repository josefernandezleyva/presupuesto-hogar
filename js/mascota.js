// 3.4.3 · Moti, el pug ahorrador: un personaje original que pasea sobre la barra de pestañas.
// Viene apagado; cada persona lo activa en Apariencia › Mascota (se guarda solo en ese celular).
// No tapa botones: solo él recibe toques (la capa deja pasar el resto), se esconde con hojas abiertas,
// al escribir y en las pantallas de registro. Crece con monedas: una por cada gasto anotado.
// Cambia de postura según lo que hace: sentado, camina alternando patitas, saluda, celebra (al saltar
// o cuando lo arrastras), duerme echado y muestra su moneda. Su cara parpadea, sonríe, ladra o se preocupa.

import { MOTI, MOTI_VB } from './moti-arte.js';

const VB = MOTI_VB.split(' ').map(Number);
const NOMBRES = { 1: 'Moti', 2: 'Moti', 3: 'Don Moti' };
const EDAD = { 1: 'cachorro', 2: 'joven', 3: 'adulto' };
/** Moti en su edad `e` (1 cachorro, 2 joven con medalla, 3 adulto con su atado). `solo` limita a una postura (vista previa). */
export const svgDe = (e, solo) => `<svg class="criatura moti e${e}" viewBox="${MOTI_VB}" aria-hidden="true">${solo ? MOTI[solo] : Object.values(MOTI).join('')}</svg>`;

export { NOMBRES, EDAD };

/* ------------------------------------------------------------ Preferencias (solo en este celular) --- */

export const COLORES = {
  turquesa: { l: 'Turquesa', c: ['#3FB0A6', '#BFE7E2', '#2A8077'] },
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
  return { ver: leer('ver', false) === true, sonido: leer('sonido', true) !== false, color: COLORES[leer('color', 'turquesa')] ? leer('color', 'turquesa') : 'turquesa', monedas, etapa: etapaPorMonedas(monedas) };
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
let etapa = 1, W = 65, H = 70, ancho = 0, suelo = 0, visible = false, raf = 0;
const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const p = { x: 120, y: 0, vy: 0, dir: 1, estado: 'idle', meta: null, rapido: false, hasta: 0 };
let ultimoToque = performance.now(), tAnterior = performance.now(), tZ = 0, tParpadeo = performance.now() + 2500, alLlegar = null;
let tHuella = 0, tPolvo = 0, pie = 0, oculta = 0, poseVista = '', saludaHasta = 0, ahorraHasta = 0;
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
  capa.innerHTML = '<button type="button" class="masc moti" hidden><div class="giro"><div class="cuerpo"></div></div></button><div class="masc-burbuja" aria-live="polite"></div>';
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
export function rutaMascota(ruta) {
  const antes = estado.ruta;
  estado.ruta = ruta;
  if (!estado.montada) return;
  revisar();
  // Te sigue: al cambiar de pestaña, galopa hasta quedar sobre la pestaña tocada.
  if (visible && antes && antes !== ruta && RUTAS.includes(antes) && p.estado !== 'drag') {
    const tab = document.querySelector('.tabbar .tab.on');
    if (!tab) return;
    const r = tab.getBoundingClientRect();
    ultimoToque = performance.now();
    if (p.estado === 'sleep') despertar('¡Voy contigo!');
    alLlegar = () => { quedarse(1800); brincar(); saludaHasta = performance.now() + 2400; };
    caminarA(r.left + r.width / 2, true);
  }
}

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
  if (!v) { burbuja.classList.remove('ver'); cancelAnimationFrame(raf); raf = 0; oculta = performance.now(); alLlegar = null; return; }
  medir();
  if (!p.y || p.y > suelo) p.y = suelo;
  const destino = Math.min(Math.max(p.x, W / 2 + 8), ancho - W / 2 - 8);
  // Entra caminando desde el borde (más cerca de donde estaba), en vez de aparecer de golpe.
  if (!reduce && performance.now() - oculta > 400) {
    const izquierda = destino < ancho / 2;
    p.x = izquierda ? -W / 2 - 4 : ancho + W / 2 + 4;
    p.estado = 'walk'; p.meta = destino; p.rapido = false;
    p.dir = izquierda ? 1 : -1; pet.classList.toggle('izq', p.dir < 0); clase('walk');
  } else p.x = destino;
  pet.style.transform = `translate(${p.x - W / 2}px, ${p.y - H}px)`;
  if (!estado.saludo) { estado.saludo = true; setTimeout(() => { if (!visible) return; saludaHasta = performance.now() + 2600; decir(`¡Hola! Soy ${nombre()}. Tócame.`, 3200); }, 1600); }
  tAnterior = performance.now();
  raf = requestAnimationFrame(paso);
}

function medir() {
  ancho = document.documentElement.clientWidth;
  const tb = document.querySelector('.tabbar .tabgroup') || document.querySelector('.tabbar');
  const nuevo = tb ? tb.getBoundingClientRect().top + 6 : innerHeight - 90;
  if (Math.abs(nuevo - suelo) > 1 && p.estado !== 'drag') { if (p.y >= suelo - 1) p.y = nuevo; suelo = nuevo; }
  if (!suelo) suelo = nuevo;
  if (p.estado !== 'walk') p.x = Math.min(Math.max(p.x, W / 2), ancho - W / 2);
}

function ponerEtapa(e) {
  etapa = e; H = [0, 70, 76, 82][e]; W = H * VB[2] / VB[3];
  pet.style.width = W + 'px'; pet.style.height = H + 'px';
  arte.innerHTML = svgDe(e);
  poseVista = ''; ponerPose(performance.now());
  ponerAnimo();
}
/** Qué postura de Moti se ve según lo que está haciendo. */
function poseActual(t) {
  const c = pet.classList;
  if (p.estado === 'drag' || c.contains('aire') || c.contains('feliz') || c.contains('evoluciona')) return 'celebra';
  if (p.estado === 'sleep') return 'duerme';
  if (p.estado === 'walk' && p.meta != null) return Math.floor(t / (p.rapido ? 130 : 240)) % 2 ? 'camina2' : 'camina';
  if (c.contains('cava') || t < ahorraHasta) return 'ahorra';
  if (c.contains('reverencia') || t < saludaHasta) return 'saluda';
  return 'sentado';
}
function ponerPose(t) { const k = poseActual(t); if (k !== poseVista) { poseVista = k; pet.dataset.pose = k; } }
function clase(...cs) { pet.classList.remove('walk', 'run', 'sleep'); cs.forEach((c) => c && pet.classList.add(c)); }
function mirar(dir) {
  if (dir === p.dir) return;
  p.dir = dir;
  pet.classList.toggle('izq', dir < 0);
  animar('volteo'); // se da la vuelta con un saltito (no cambia de lado de golpe)
}
function caminarA(x, rapido = false) {
  p.meta = Math.min(Math.max(x, W / 2 + 4), ancho - W / 2 - 4);
  if (Math.abs(p.meta - p.x) < 3) { p.meta = null; llego(); return; }
  p.rapido = rapido; p.estado = 'walk';
  mirar(p.meta >= p.x ? 1 : -1);
  clase(rapido ? 'run' : 'walk');
}
function quedarse(ms) { p.estado = 'idle'; p.meta = null; p.hasta = performance.now() + ms; clase(); }
function dormir() { if (p.estado === 'drag') return; p.estado = 'sleep'; p.meta = null; clase('sleep'); ponerAnimo(); decir('Me echo una siestita…', 1800); }
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
      const enPantalla = p.x > 0 && p.x < ancho;
      if (enPantalla && t - tHuella > (p.rapido ? 170 : 420)) { tHuella = t; huella(); }
      if (enPantalla && p.rapido && t - tPolvo > 110) { tPolvo = t; particula('polvo', '', p.x - p.dir * W * .42, p.y - 7, -p.dir * (16 + Math.random() * 18), -10 - Math.random() * 12); }
    } else if (p.estado === 'idle' && t > p.hasta && p.vy === 0) {
      if (t - ultimoToque > 30000) dormir();
      else { const r = Math.random(); if (r < 0.55) caminarA(W / 2 + Math.random() * (ancho - W)); else if (r < 0.78) haceAlgoSolo(); else quedarse(2000 + Math.random() * 3000); }
    } else if (p.estado === 'sleep' && t - tZ > 1500) {
      tZ = t; particula('z', 'z', p.x + 16 * p.dir, p.y - H + 6, 16 * p.dir, -44);
    }
    if (p.estado !== 'sleep' && t > tParpadeo) { pet.classList.add('parpadeo'); setTimeout(() => pet.classList.remove('parpadeo'), 140); tParpadeo = t + 2200 + Math.random() * 3000; }
  }
  pet.classList.toggle('aire', p.y < suelo - 3 && p.estado !== 'drag');
  ponerPose(t);
  pet.style.transform = `translate(${p.x - W / 2}px, ${p.y - H}px)`;
  if (burbuja.classList.contains('ver')) colocarBurbuja();
  raf = requestAnimationFrame(paso);
}
/** Huella de pezuña que se borra sola, alternando pata delantera y trasera. */
function huella() {
  pie = 1 - pie;
  const x = p.x + p.dir * (pie ? W * .22 : -W * .2) - 4;
  const el = document.createElement('div');
  el.className = 'masc-huella';
  el.style.transform = `translate(${x}px, ${p.y - 3}px)`;
  capa.appendChild(el);
  setTimeout(() => el.remove(), 1600);
}
/** Brinco de alegría con las patas estiradas. */
function brincar() { saltar(430); setTimeout(() => particula('polvo', '', p.x - 6, p.y - 6, -14, -8), 80); }
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
  setTimeout(() => { el.remove(); ahorraHasta = performance.now() + 2200; animar('aterriza'); chispas(3); }, 720);
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
  setTimeout(() => { pet.classList.remove('evoluciona'); saltar(420); decir(NOMBRES[e] === de ? `¡${de} creció! Ya es ${EDAD[e]} y estrena medalla.` : `¡${de} creció! Ahora es ${NOMBRES[e]}, ${EDAD[e]}, con su atado de ahorros.`, 3800); }, 1450);
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
  if (d.ritmo) l.push(d.ritmo);
  if (d.proyeccion) l.push(d.proyeccion);
  const m = leerMascota().monedas;
  l.push(`Tengo ${m} ${m === 1 ? 'moneda enterrada' : 'monedas enterradas'}. Cada gasto que anotas me da una.`);
  l.push('¡Guau! Vi una oferta de arroz en el mercado.');
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
/** Ladrido corto y agudo, más grave a medida que crece. */
function ladrido(veces = 2) {
  if (!leerMascota().sonido) return;
  try {
    audio = audio || new (window.AudioContext || window.webkitAudioContext)();
    if (audio.state === 'suspended') audio.resume();
    const base = etapa === 1 ? 900 : etapa === 2 ? 680 : 520;
    for (let i = 0; i < veces; i++) {
      const t0 = audio.currentTime + i * 0.19;
      const o = audio.createOscillator(), f = audio.createBiquadFilter(), g = audio.createGain();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(base * 1.3, t0);
      o.frequency.exponentialRampToValueAtTime(base * 0.55, t0 + 0.12);
      f.type = 'bandpass'; f.frequency.value = base * 1.6; f.Q.value = 1.5;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.28, t0 + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.15);
      o.connect(f); f.connect(g); g.connect(audio.destination);
      o.start(t0); o.stop(t0 + 0.17);
    }
  } catch { /* sin audio */ }
}
const notas = (n = 2) => { for (let i = 0; i < n; i++) setTimeout(() => particula('nota', i % 2 ? '♫' : '♪', p.x + p.dir * W * .3, p.y - H * .95, p.dir * (10 + Math.random() * 14), -40 - Math.random() * 16), i * 260); };
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
      decir(etapa === 3 ? '¡Oye, con cuidado, que llevo mis ahorros!' : '¡Uy! ¿A dónde vamos?', 1600);
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
  if (fue.caricia) { decir('Gracias. ¡Guau!', 1400); return; }
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
    quedarse(1300); ladrido(2); guau('¡GUAU!');
    if (ladridos.length >= 2) {
      ladridos = []; ofendido = t + 3500;
      decir('¡Ya, ya! Me voy para allá.', 2400);
      setTimeout(() => { alLlegar = () => { quedarse(2500); p.dir = p.x > ancho / 2 ? -1 : 1; pet.classList.toggle('izq', p.dir < 0); decir('Hmpf.', 1400); }; caminarA(p.x > ancho / 2 ? W : ancho - W, true); }, 700);
    } else {
      decir(['¡Guau! ¡No me piques tanto!', '¡Guau, guau! ¡Que me haces cosquillas!', '¡GUAU! Uno a la vez, por favor.'][Math.floor(Math.random() * 3)], 2400);
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
  const r = Math.random();
  if (r < 0.24) { // olfatea el piso, avanzando de a poquito
    quedarse(2000); pet.classList.add('olfatea');
    const snif = setInterval(() => particula('olor', '', p.x + p.dir * W * .5, p.y - 8, p.dir * 8, -14), 300);
    setTimeout(() => { clearInterval(snif); pet.classList.remove('olfatea'); if (Math.random() < 0.3 && visible) decir(['Snif, snif… huele a oferta.', 'Por aquí pasó un sol.', 'Snif… ¿pan con chicharrón?'][Math.floor(Math.random() * 3)], 1800); }, 1800);
  } else if (r < 0.44) { // cava y entierra sus ahorros
    quedarse(1900); pet.classList.add('cava');
    const tierra = setInterval(() => { for (let i = 0; i < 2; i++) particula('tierra', '', p.x - p.dir * W * .3, p.y - 6, -p.dir * (20 + Math.random() * 30), -18 - Math.random() * 22); }, 120);
    setTimeout(() => { clearInterval(tierra); pet.classList.remove('cava'); if (Math.random() < 0.4 && visible) decir('Aquí guardo mis ahorros. Shhh.', 1800); }, 1600);
  } else if (r < 0.62) { // reverencia de juego: patas delanteras abajo y cola feliz
    quedarse(1500); pet.classList.add('reverencia'); ladrido(1);
    setTimeout(() => pet.classList.remove('reverencia'), 1300);
  } else if (r < 0.78) { // zoomies: corre de lado a lado a toda velocidad
    const x0 = p.x, ida = Math.min(Math.max(x0 + (x0 < ancho / 2 ? 1 : -1) * ancho * .45, W), ancho - W);
    alLlegar = () => { alLlegar = () => { brincar(); quedarse(1600); if (visible) decir('¡Wiii! Energía de pug.', 1600); }; caminarA(x0, true); };
    caminarA(ida, true);
  } else { // se sienta un rato moviendo la cola
    quedarse(3000); pet.classList.add('sentado');
    setTimeout(() => pet.classList.remove('sentado'), 2800);
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
      setTimeout(() => { brincar(); corazones(3); ladrido(1); guau('¡guau!'); decir(texto || '¡Anotado!', 3600); sumarMoneda(); }, 650);
    };
    caminarA(xMas - W * 0.62 - 10, true);
  };
  setTimeout(hacer, 700);
}
