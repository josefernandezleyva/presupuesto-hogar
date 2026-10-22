// Copia local de la hoja + cola de cambios pendientes + sincronización.
// Cada fila lleva id, version, actualizado_en y eliminado. Gana el último cambio.

import { llamar } from './api.js';
import * as idb from './idb.js';

export const TABLAS = ['Config', 'Personas', 'Participacion', 'Grupos', 'Categorias', 'TiposCambio', 'Gastos',
  'GastosReparto', 'Planes', 'Ingresos', 'Presupuesto', 'Liquidaciones', 'Cierres', 'CierresSaldos'];

const K = 'pp1:';
const vacio = () => Object.fromEntries(TABLAS.map((t) => [t, {}]));

let db = vacio();
let outbox = vacio();
let meta = {};
let rev = 0;
let snap = null;
const oyentes = new Set();
export const estadoSync = { corriendo: false, error: null, ultimo: null };

function leer(k, defecto) {
  try { const v = localStorage.getItem(K + k); return v ? JSON.parse(v) : defecto; } catch { return defecto; }
}
function escribir(k, v) {
  try { localStorage.setItem(K + k, JSON.stringify(v)); return true; } catch { estadoSync.error = 'almacenamiento'; return false; }
}

export function cargar() {
  db = { ...vacio(), ...leer('db', {}) };
  outbox = { ...vacio(), ...leer('outbox', {}) };
  meta = leer('meta', {});
  estadoSync.ultimo = meta.ultimoSync || null;
  rev++;
}

/*
 * Desde la 1.5 la copia de la hoja vive en IndexedDB (mucho más espacio que los ~5 MB de localStorage).
 * La cola de cambios pendientes y los datos de conexión siguen en localStorage: son pequeños y se
 * guardan al instante, así que un cambio nunca se pierde aunque se cierre la app.
 * Si IndexedDB no está disponible, todo sigue como antes, en localStorage.
 */
const COPIA = 'db';
const enIdb = () => meta.copia === 'idb';
/*
 * Marca de sincronización. Con la copia en IndexedDB se guarda como `sinceIdb` y `since` queda en 0:
 * si alguien vuelve a instalar una versión anterior (que lee la copia de localStorage, ya vacía),
 * esa versión baja la hoja completa en vez de quedarse sin datos.
 */
const marca = () => Number(enIdb() ? meta.sinceIdb : meta.since) || 0;
function ponerMarca(v) { if (enIdb()) meta = { ...meta, sinceIdb: v, since: 0 }; else meta = { ...meta, since: v }; }

/** Se llama al arrancar, después de `cargar()`: trae la copia de IndexedDB o la mueve ahí. */
export async function cargarCopia() {
  if (!(await idb.disponible())) return 'local';
  if (enIdb()) {
    const guardada = await idb.leer('copia', COPIA);
    if (guardada && typeof guardada === 'object') { db = { ...vacio(), ...guardada }; rev++; return 'idb'; }
    // El navegador borró la copia: se baja completa de la hoja. La cola pendiente sigue intacta.
    db = vacio();
    TABLAS.forEach((t) => Object.entries(outbox[t]).forEach(([id, r]) => { db[t][id] = r; }));
    meta = { ...meta, since: 0, sinceIdb: 0 };
    escribir('meta', meta);
    rev++;
    avisar();
    return 'recuperar';
  }
  // Primera vez con la 1.5: se mueve la copia de localStorage a IndexedDB y se comprueba antes de borrarla.
  if (!(await idb.guardarSeguro('copia', COPIA, db))) return 'local';
  const prueba = await idb.leer('copia', COPIA);
  const cuenta = (x) => TABLAS.reduce((a, t) => a + Object.keys((x && x[t]) || {}).length, 0);
  if (!prueba || cuenta(prueba) !== cuenta(db)) return 'local';
  meta = { ...meta, copia: 'idb', sinceIdb: Number(meta.since) || 0, since: 0 };
  if (!escribir('meta', meta)) return 'local';
  try { localStorage.removeItem(K + 'db'); } catch { /* nada */ }
  return 'migrada';
}

let cadena = Promise.resolve(true);
/** Guarda la copia en IndexedDB, en orden. Devuelve si se guardó. */
function guardarCopiaIdb() {
  cadena = cadena.then(() => idb.guardarSeguro('copia', COPIA, db)).catch(() => false);
  return cadena;
}

function persistir() {
  const ok = escribir('outbox', outbox) && (enIdb() || escribir('db', db));
  if (!ok) estadoSync.error = 'almacenamiento';
  if (enIdb()) guardarCopiaIdb().then((v) => { if (!v) estadoSync.error = 'almacenamiento'; });
  return ok;
}

/** Como `persistir`, pero espera a que la copia quede guardada (antes de avanzar la marca de sincronización). */
async function persistirSeguro() {
  if (!escribir('outbox', outbox)) return false;
  if (!enIdb()) return escribir('db', db);
  return guardarCopiaIdb();
}

/** Tamaño aproximado de la copia local y dónde está (para Ajustes). */
export function infoCopia() {
  const filas = TABLAS.reduce((a, t) => a + Object.keys(db[t]).length, 0);
  return { donde: enIdb() ? 'IndexedDB' : 'localStorage', filas, gastos: Object.keys(db.Gastos).length };
}
function avisar() { rev++; oyentes.forEach((f) => { try { f(); } catch (e) { console.error(e); } }); }
export function suscribir(fn) { oyentes.add(fn); return () => oyentes.delete(fn); }

export const getMeta = () => meta;
export function setMeta(patch) { meta = { ...meta, ...patch }; escribir('meta', meta); }

/** Foto de solo lectura con las filas no eliminadas, para la lógica de negocio. */
export function foto() {
  if (snap && snap.rev === rev) return snap.S;
  const S = {};
  TABLAS.forEach((t) => { S[t] = Object.values(db[t]).filter((r) => Number(r.eliminado) !== 1); });
  snap = { rev, S };
  return S;
}

export const fila = (tabla, id) => db[tabla][id];
export const existe = (tabla, id) => !!db[tabla][id];

/**
 * Guarda filas (crea o actualiza). `ts` permite escribir con una fecha antigua
 * (filas generadas automáticamente que nunca deben pisar un cambio real).
 */
/** Hora "del servidor": corrige el reloj del celular con la diferencia medida al sincronizar. */
const ahoraMs = () => Date.now() + (Number(meta.desfase) || 0);

export function guardar(cambios, { ts = null } = {}) {
  const base = ahoraMs();
  const quien = meta.personaId || '';
  cambios.forEach(([tabla, row]) => {
    if (!TABLAS.includes(tabla) || !row.id) throw new Error('fila_invalida');
    const prev = db[tabla][row.id];
    // Un cambio nunca queda "más viejo" que la versión que edita, aunque el reloj esté atrasado.
    const previo = prev && prev.actualizado_en ? Date.parse(prev.actualizado_en) : NaN;
    const ahora = ts || new Date(isNaN(previo) ? base : Math.max(base, previo + 1)).toISOString();
    const r = {
      ...(prev || {}),
      ...row,
      version: Number(prev?.version || 0) + 1,
      creado_en: prev?.creado_en || ahora,
      creado_por: prev?.creado_por || quien,
      actualizado_en: ahora,
      actualizado_por: quien,
      eliminado: row.eliminado ?? prev?.eliminado ?? 0
    };
    db[tabla][row.id] = r;
    outbox[tabla][row.id] = r;
  });
  rev++;
  if (enLote) return;
  persistir();
  avisar();
  programarSync();
}

let enLote = false;
/** Agrupa muchas escrituras: guarda y avisa una sola vez al final. */
export function lote(fn) {
  enLote = true;
  try { return fn(); } finally {
    enLote = false;
    persistir();
    avisar();
    programarSync();
  }
}
export const guardarUno = (tabla, row, o) => guardar([[tabla, row]], o);
export const eliminar = (tabla, id) => guardar([[tabla, { id, eliminado: 1 }]]);

export function pendientes() {
  return TABLAS.reduce((a, t) => a + Object.keys(outbox[t]).length, 0);
}

let timer = null;
function programarSync() {
  clearTimeout(timer);
  timer = setTimeout(() => { sincronizar().catch(() => {}); }, 1200);
}

let enCurso = null;
export function sincronizar() {
  if (!meta.url && !meta.demo) return Promise.resolve(false);
  if (enCurso) return enCurso.then(() => sincronizar());
  enCurso = (async () => {
    estadoSync.corriendo = true; avisar();
    const enviados = {};
    TABLAS.forEach((t) => { enviados[t] = Object.values(outbox[t]); });
    try {
      const t0 = Date.now();
      const res = await llamar(meta, { action: 'sync', since: marca(), changes: enviados });
      if (!res || !res.ok) throw new Error(res?.error || 'respuesta_invalida');
      if (res.serverTime) meta.desfase = res.serverTime - Math.round((t0 + Date.now()) / 2);
      let rechazados = 0;
      // Versión del Code.gs de la hoja (las anteriores a la 4 no la informan al sincronizar).
      meta.schemaServidor = Number(res.schema) || 3;
      meta.codigoServidor = res.codigo ? String(res.codigo) : '';
      TABLAS.forEach((t) => {
        // Una pestaña que la hoja todavía no tiene (Code.gs anterior): sus cambios esperan en la cola.
        if (res.accepted && !(t in res.accepted)) return;
        (enviados[t] || []).forEach((r) => {
          const actual = outbox[t][r.id];
          // Sale de la cola si no cambió mientras viajaba: o se aceptó, o el servidor
          // tenía una versión más nueva, que llega en res.changes.
          if (actual && actual.actualizado_en === r.actualizado_en && actual.version === r.version) delete outbox[t][r.id];
        });
        ((res.changes && res.changes[t]) || []).forEach((r) => {
          const local = outbox[t][r.id];
          if (local && String(local.actualizado_en) > String(r.actualizado_en)) return; // cambio local más nuevo, sigue en cola
          db[t][r.id] = r;
        });
        // El servidor rechazó filas de un mes cerrado. Si no tiene versión propia, la fila se descarta.
        const delServidor = new Set(((res.changes && res.changes[t]) || []).map((r) => r.id));
        ((res.rechazados && res.rechazados[t]) || []).forEach((id) => {
          rechazados++;
          if (!outbox[t][id] && !delServidor.has(id)) delete db[t][id];
        });
      });
      // Primero se guarda la copia; solo si se guardó se avanza la marca de sincronización.
      if (!(await persistirSeguro())) throw new Error('almacenamiento');
      ponerMarca(res.maxTs || marca());
      meta.ultimoSync = new Date().toISOString();
      if (!escribir('meta', meta)) throw new Error('almacenamiento');
      estadoSync.error = null;
      estadoSync.rechazados = rechazados;
      estadoSync.ultimo = meta.ultimoSync;
      return true;
    } catch (e) {
      estadoSync.error = String(e.message || e);
      throw e;
    } finally {
      estadoSync.corriendo = false;
      enCurso = null;
      avisar();
    }
  })();
  return enCurso;
}

export function reiniciar() {
  db = vacio(); outbox = vacio(); meta = {};
  try { Object.keys(localStorage).filter((k) => k.startsWith(K)).forEach((k) => localStorage.removeItem(k)); } catch { /* sin almacenamiento */ }
  // Sin meta.copia, una copia vieja en IndexedDB se ignora al arrancar; igual se borra.
  idb.borrar('copia', COPIA).catch(() => {});
  avisar();
}
