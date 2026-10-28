// Arranque, navegación y despacho de acciones.

import * as st from './store.js';
import * as L from './logic.js';
import * as ops from './ops.js';
import { mesActual, sumarMeses } from './util.js';
import { hoja, toast } from './ui.js';
import { mensajeError } from './api.js';
import { aplicarTema } from './tema.js';
import { aplicarSquircle } from './squircle.js';

import inicio from './pantallas/inicio.js';
import gastos from './pantallas/gastos.js';
import registro from './pantallas/registro.js';
import cierre from './pantallas/cierre.js';
import analisis from './pantallas/analisis.js';
import mas from './pantallas/mas.js';
import maestros from './pantallas/maestros.js';
import plan from './pantallas/plan.js';
import inicioSesion from './pantallas/conectar.js';
import reporte from './pantallas/reporte.js';
import novedades from './pantallas/novedades.js';
import { procesarCola } from './evidencia.js';
import * as avisos from './avisos.js';

const PANTALLAS = { inicio, gastos, nuevo: registro, gasto: registro, cierre, analisis, reporte, ...mas, ...maestros, ...plan, ...inicioSesion, ...novedades };
// Pestañas de la barra inferior (2.0): entre ellas la transición es un fundido; el resto entra deslizando.
const PESTANAS = new Set(['inicio', 'gastos', 'cierre', 'analisis']);
const SIN_SESION = new Set(['conectar', 'hogar', 'quien']);

const app = {
  ruta: 'inicio', param: '', query: {},
  mes: mesActual(),
  estados: {},
  hoja: null,
  toast: null,
  historial: []
};
const raiz = document.getElementById('app');

function ctx() {
  const S = st.foto();
  const meta = st.getMeta();
  const yo = L.persona(S, meta.personaId);
  return {
    S, meta, yo, admin: L.esAdmin(S, meta.personaId),
    mes: app.mes, ruta: app.ruta, param: app.param, query: app.query,
    estado: app.estados[app.ruta] || (app.estados[app.ruta] = {}),
    sync: st.estadoSync,
    ir, render, avisar, anunciar, preguntar, volver, sincronizar, entrar,
    setMes: (m) => { app.mes = m; },
    setMeta: (patch) => st.setMeta(patch),
    privado: document.documentElement.dataset.privado === '1'
  };
}

export function ir(ruta) {
  const h = '#/' + ruta;
  if (location.hash === h) { entrar(); return; }
  location.hash = h;
}
function volver(defecto = 'inicio') {
  const prev = app.historial[app.historial.length - 2];
  app.volviendo = true;
  if (prev) history.back(); else ir(defecto);
}
function avisar(texto, tipo = '', accion = null) {
  app.toast = { texto, tipo, accion };
  render();
  anunciar(texto);
  clearTimeout(avisar.t);
  avisar.t = setTimeout(() => { app.toast = null; render(); }, accion ? 6000 : tipo === 'bad' ? 4500 : 2200);
}
function preguntar(h) { app.hoja = h; render(); }

/** VoiceOver lee los avisos desde una región fija (no se redibuja con la pantalla). */
function anunciar(texto) {
  let r = document.getElementById('anuncio');
  if (!r) {
    r = document.createElement('div');
    r.id = 'anuncio'; r.className = 'sr'; r.setAttribute('aria-live', 'polite'); r.setAttribute('role', 'status');
    document.body.appendChild(r);
  }
  r.textContent = '';
  setTimeout(() => { r.textContent = texto; }, 50);
}

/**
 * Con una hoja abierta, el resto de la pantalla queda inerte (VoiceOver y el teclado no salen de la hoja).
 * Al abrirla, el foco va a la hoja; al cerrarla, vuelve al botón que la abrió.
 */
function enfocarHoja(abierta) {
  [...raiz.children].forEach((n) => { n.inert = !!app.hoja && !n.matches('.sheet, .sheet-bg, .toast'); });
  if (!abierta) return;
  const sh = raiz.querySelector('.sheet');
  if (!sh) return;
  const primero = sh.querySelector('input, select, textarea') || sh.querySelector('#sheet-t');
  if (primero && primero.id === 'sheet-t') primero.tabIndex = -1;
  setTimeout(() => primero?.focus({ preventScroll: true }), 30);
}

function leerHash() {
  const h = location.hash.replace(/^#\/?/, '');
  const [camino, qs] = h.split('?');
  const [ruta, ...resto] = camino.split('/');
  app.ruta = PANTALLAS[ruta] ? ruta : 'inicio';
  app.param = decodeURIComponent(resto.join('/'));
  app.query = Object.fromEntries(new URLSearchParams(qs || ''));
}

function puerta() {
  const meta = st.getMeta();
  if (!meta.url && !meta.demo) return 'conectar';
  const S = st.foto();
  if (!S.Personas.length) return 'hogar';
  if (!L.persona(S, meta.personaId)) return 'quien';
  return null;
}

/** Transición entre pantallas (View Transitions de Safari 18): fundido entre pestañas, deslizar al entrar o volver. */
function conTransicion(fn) {
  const quieto = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  if (!document.startViewTransition || quieto || !render.listo || app.hoja) { fn(); return; }
  try { document.startViewTransition(fn); } catch { fn(); }
}

function entrar() {
  const antes = app.ruta;
  leerHash();
  document.documentElement.dataset.nav = PESTANAS.has(antes) && PESTANAS.has(app.ruta) ? 'tab' : app.volviendo ? 'atras' : 'adelante';
  app.volviendo = false;
  conTransicion(entrarAhora);
}

function entrarAhora() {
  const destino = puerta();
  if (destino && !SIN_SESION.has(app.ruta)) { app.ruta = destino; app.param = ''; }
  if (!destino && SIN_SESION.has(app.ruta) && app.ruta !== 'conectar') { app.ruta = 'inicio'; }
  app.historial.push(app.ruta + '/' + app.param);
  if (app.historial.length > 30) app.historial.shift();
  app.hoja = null;
  app.estados[app.ruta] = {};
  const p = PANTALLAS[app.ruta];
  try { p.iniciar?.(ctx()); } catch (e) { console.error(e); }
  render();
  render.listo = true;
  window.scrollTo(0, 0);
  document.body.classList.remove('desplazado');
}

export function render() {
  const c = ctx();
  const p = PANTALLAS[app.ruta];
  let html;
  try {
    html = p.vista(c);
  } catch (e) {
    console.error(e);
    html = `<main class="pad"><div class="card"><p>Algo salió mal al mostrar esta pantalla.</p><p class="muted">${String(e.message || e).replace(/</g, '&lt;')}</p><a class="btn pri" href="#/inicio">Ir al inicio</a></div></main>`;
  }
  const activo = document.activeElement;
  const foco = activo && activo.dataset && activo.dataset.f ? activo.dataset.f : null;
  // Lo escrito en una hoja abierta se conserva si la pantalla se vuelve a dibujar (por ejemplo, al sincronizar).
  const enHoja = {};
  if (app.hoja && app.hoja === render.hoja) raiz.querySelectorAll('.sheet [name]').forEach((i) => { enHoja[i.name] = i.value; });
  const hojaNueva = !!app.hoja && app.hoja !== render.hoja;
  // Si se redibuja con la misma hoja abierta, el foco vuelve al mismo elemento de la hoja.
  const enfoqueHoja = !hojaNueva && app.hoja && activo?.closest?.('.sheet')
    ? (activo.id ? '#' + CSS.escape(activo.id) : activo.name ? `[name="${CSS.escape(activo.name)}"]` : activo.dataset?.i ? `[data-a="${activo.dataset.a}"][data-i="${activo.dataset.i}"]` : activo.dataset?.a ? `[data-a="${activo.dataset.a}"]` : null)
    : null;
  const hojaCerrada = !app.hoja && !!render.hoja;
  if (hojaNueva && !render.hoja) render.origen = activo?.dataset?.a ? activo.dataset.a + '|' + (activo.dataset.k || activo.dataset.v || activo.dataset.i || '') : null;
  render.hoja = app.hoja;
  raiz.innerHTML = html + hoja(app.hoja) + toast(app.toast);
  Object.entries(enHoja).forEach(([k, v]) => { const i = raiz.querySelector(`.sheet [name="${CSS.escape(k)}"]`); if (i) i.value = v; });
  document.body.classList.toggle('con-hoja', !!app.hoja);
  enfocarHoja(hojaNueva);
  if (enfoqueHoja) { const el = raiz.querySelector('.sheet ' + enfoqueHoja); if (el) { if (el.id === 'sheet-t') el.tabIndex = -1; el.focus({ preventScroll: true }); } }
  if (hojaCerrada && render.origen && !foco) {
    const [a, k] = render.origen.split('|');
    const el = [...raiz.querySelectorAll(`[data-a="${CSS.escape(a)}"]`)].find((x) => (x.dataset.k || x.dataset.v || x.dataset.i || '') === k);
    render.origen = null;
    if (el) el.focus({ preventScroll: true });
  }
  if (foco) {
    const el = raiz.querySelector(`[data-f="${CSS.escape(foco)}"]`);
    if (el && el !== document.activeElement && el.dataset.keep !== undefined) {
      el.focus();
      // El cursor vuelve al final de lo escrito (no al principio).
      try { if (typeof el.value === 'string' && el.setSelectionRange && el.type !== 'number') el.setSelectionRange(el.value.length, el.value.length); } catch { /* algunos tipos no lo permiten */ }
    }
  }
  aplicarSquircle(raiz);
  p.montar?.(raiz, c);
}

/* ------------------------------------------------------------ Acciones --- */

const GLOBALES = {
  atras: (c) => c.volver(),
  ir: (c, d) => c.ir(d.to),
  set: (c, d) => {
    let v = d.v;
    if (d.num !== undefined) v = Number(v);
    c.estado[d.k] = v;
    PANTALLAS[app.ruta].alElegir?.(c, d.k, v);
    render();
  },
  toggle: (c, d) => { c.estado[d.k] = !c.estado[d.k]; render(); },
  mes: (c, d) => { app.mes = sumarMeses(app.mes, Number(d.d)); PANTALLAS[app.ruta].alCambiarMes?.(ctx()); render(); },
  'mes-hoy': () => { app.mes = mesActual(); render(); },
  privado: () => {
    const on = document.documentElement.dataset.privado !== '1';
    document.documentElement.dataset.privado = on ? '1' : '0';
    try { localStorage.setItem('pp-privado', on ? '1' : '0'); } catch { /* sin almacenamiento */ }
    render();
    anunciar(on ? 'Montos ocultos' : 'Montos visibles');
  },
  sync: () => sincronizar(true),
  'cerrar-hoja': () => { app.hoja = null; render(); },
  'toast-accion': () => {
    const a = app.toast?.accion;
    app.toast = null;
    render();
    if (a?.fn) ejecutar(() => a.fn(ctx()));
  },
  'hoja-btn': (c, d, el) => {
    const b = app.hoja?.botones[Number(d.i)];
    const valores = {};
    el.closest('.sheet')?.querySelectorAll('[name]').forEach((i) => { valores[i.name] = i.value; });
    if (b?.mantener) { if (b.fn) ejecutar(() => b.fn(ctx(), valores)); return; }
    app.hoja = null;
    render();
    if (b?.fn) ejecutar(() => b.fn(ctx(), valores));
  }
};

function ejecutar(fn) {
  try {
    const r = fn();
    if (r && r.catch) r.catch(manejarError);
  } catch (e) { manejarError(e); }
}
function manejarError(e) {
  if (e instanceof ops.ErrorApp) avisar(e.message, 'bad');
  else { console.error(e); avisar('Error: ' + (e.message || e), 'bad'); }
}

raiz.addEventListener('click', (ev) => {
  const el = ev.target.closest('[data-a]');
  if (!el || !raiz.contains(el)) return;
  if (el.tagName === 'A') ev.preventDefault();
  const nombre = el.dataset.a;
  const p = PANTALLAS[app.ruta];
  const fn = (p.acciones && p.acciones[nombre]) || GLOBALES[nombre];
  if (fn) ejecutar(() => fn(ctx(), el.dataset, el, ev));
});

function alEscribir(ev) {
  const el = ev.target;
  if (!el.dataset || el.dataset.f === undefined) return;
  const c = ctx();
  c.estado[el.dataset.f] = el.type === 'checkbox' ? el.checked : el.value;
  const p = PANTALLAS[app.ruta];
  p.alEscribir?.(c, el.dataset.f, el, ev);
  if (ev.type === 'change' && el.dataset.r !== undefined) render();
}
raiz.addEventListener('input', alEscribir);
document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape' && app.hoja) { app.hoja = null; render(); } });
raiz.addEventListener('change', alEscribir);
raiz.addEventListener('submit', (ev) => {
  ev.preventDefault();
  const accion = ev.target.dataset.submit;
  const p = PANTALLAS[app.ruta];
  const fn = p.acciones && p.acciones[accion];
  if (fn) ejecutar(() => fn(ctx(), ev.target.dataset, ev.target, ev));
});

/* ------------------------------------------------------- Sincronización --- */

export async function sincronizar(manual = false) {
  try {
    const yo = st.getMeta().personaId;
    const antes = new Set(L.novedades(st.foto(), yo).map((n) => n.gasto.id));
    const habiaSync = !!st.getMeta().ultimoSync;
    await st.sincronizar();
    // 2.0: con la app abierta, un gasto nuevo de la otra persona se anuncia al llegar.
    const llegaron = L.novedades(st.foto(), yo).filter((n) => !antes.has(n.gasto.id) && Date.now() - Date.parse(n.cuando) < 6 * 3600e3);
    if (llegaron.length && habiaSync && !manual) {
      const n = llegaron[0], p = L.persona(st.foto(), n.autor);
      avisar(llegaron.length === 1 ? `${p?.alias || p?.nombre || 'Alguien'} registró ${n.gasto.nota || 'un gasto'}` : `${llegaron.length} gastos nuevos de la otra persona`, '', { l: 'Ver', fn: (c) => c.ir('novedades') });
    }
    procesarCola().catch(() => {});
    const rech = st.estadoSync.rechazados;
    const nuevos = ops.asegurarRecurrentes() + ops.repararGenerados() + ops.asegurarGrupos();
    if (nuevos) await st.sincronizar().catch(() => {});
    if (rech) avisar(`${rech} ${rech === 1 ? 'cambio no se guardó' : 'cambios no se guardaron'} porque su mes ya está cerrado.`, 'bad');
    else if (manual) avisar('Sincronizado');
    if (puerta() && !SIN_SESION.has(app.ruta)) entrar();
    return true;
  } catch (e) {
    if (manual) avisar(mensajeError(e.message), 'bad');
    return false;
  }
}

/* ----------------------------------------------------------- Arranque --- */

aplicarTema();
st.cargar();
let pendienteRender = false;
st.suscribir(() => {
  if (pendienteRender) return;
  pendienteRender = true;
  requestAnimationFrame(() => {
    pendienteRender = false;
    // No redibujar mientras se escribe en un campo: perdería el teclado.
    const a = document.activeElement;
    if (a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA') && raiz.contains(a)) return;
    render();
  });
});
window.addEventListener('hashchange', entrar);
window.addEventListener('popstate', () => { app.volviendo = true; });
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') return;
  window.ppTextoSistema?.();
  avisos.limpiarGlobo();
  sincronizar(false);
});

/* -------------------------------------------------------- 2.0 · Gestos --- */

// Título grande que se vuelve barra compacta de cristal al desplazarse.
window.addEventListener('scroll', () => { document.body.classList.toggle('desplazado', window.scrollY > 36); }, { passive: true });

// Tirar hacia abajo para sincronizar, en las pestañas (como en las apps de iOS).
(() => {
  let y0 = null, dy = 0;
  const ind = () => document.getElementById('ptr') || Object.assign(document.body.appendChild(document.createElement('div')), { id: 'ptr', innerHTML: '<span class="ptr-c"></span>' });
  window.addEventListener('touchstart', (e) => {
    y0 = window.scrollY <= 0 && PESTANAS.has(app.ruta) && !app.hoja && e.touches.length === 1 ? e.touches[0].clientY : null; dy = 0;
  }, { passive: true });
  window.addEventListener('touchmove', (e) => {
    if (y0 === null) return;
    dy = Math.max(0, e.touches[0].clientY - y0);
    const el = ind();
    el.style.setProperty('--ptr', Math.min(1, dy / 80));
    el.classList.toggle('listo', dy > 80);
    el.classList.toggle('ver', dy > 8);
  }, { passive: true });
  window.addEventListener('touchend', () => {
    if (y0 === null) return;
    const el = ind();
    y0 = null;
    if (dy > 80) {
      el.classList.add('girando');
      sincronizar(true).finally(() => { el.classList.remove('girando', 'ver', 'listo'); });
    } else el.classList.remove('ver', 'listo');
  });
})();

// Mensajes del service worker: llegó un aviso (se sincroniza) o se tocó uno (se abre su pantalla).
navigator.serviceWorker?.addEventListener('message', (e) => {
  if (e.data?.tipo === 'aviso') sincronizar(false);
  if (e.data?.tipo === 'abrir' && e.data.url) { location.hash = e.data.url.replace(/^#/, ''); avisos.limpiarGlobo(); }
});

try { document.documentElement.dataset.privado = localStorage.getItem('pp-privado') === '1' ? '1' : '0'; } catch { /* nada */ }
window.addEventListener('online', () => sincronizar(false));
// La copia de la hoja se lee de IndexedDB (o se mueve ahí la primera vez) antes de mostrar la app.
st.cargarCopia().catch(() => 'local').then(async (r) => {
  // Si el navegador borró la copia, se baja de la hoja antes de entrar (para no pedir crear un hogar nuevo).
  if (r === 'recuperar') { try { await st.sincronizar(); } catch { /* se reintenta luego */ } }
}).finally(() => {
  // 2.0: las novedades empiezan a contarse desde la primera vez que se abre esta versión.
  if (!st.getMeta().novedadesVistas) st.setMeta({ novedadesVistas: new Date().toISOString() });
  entrar();
  sincronizar(false).then(() => avisos.revisar().catch(() => {}));
  avisos.limpiarGlobo();
  mostrarNovedadesVersion();
});

/** Una sola vez: qué cambió en la 2.0 y dónde quedó cada cosa. */
function mostrarNovedadesVersion() {
  const meta = st.getMeta();
  if (meta.visto20) return;
  st.setMeta({ visto20: true });
  if (puerta() || (!meta.ultimoSync && !meta.demo)) return; // instalación nueva: no hay nada que comparar
  preguntar({
    titulo: 'Novedades de la versión 2.0',
    html: `<ul class="nuevo20">
      <li><b>Cuentas</b> es una pestaña: saldo entre ustedes, pagos y cierre del mes.</li>
      <li><b>Avisos</b>: activa en Ajustes que te avise cada gasto que registre la otra persona.</li>
      <li><b>Novedades</b>: la campana de Inicio muestra lo que registró la otra persona.</li>
      <li><b>Hogar y ajustes</b>: toca tu foto, arriba a la derecha de Inicio.</li>
      <li><b>Buscar</b> gastos en todos los meses, desde Gastos.</li>
      <li>Tira hacia abajo para sincronizar, y toca el ojo para ocultar los montos.</li>
    </ul>`,
    botones: [{ l: 'Entendido', estilo: 'pri' }],
    cancelar: 'Cerrar'
  });
}

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}

export { app };
