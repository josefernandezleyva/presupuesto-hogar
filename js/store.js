// Copia local de la hoja + cola de cambios pendientes + sincronización.
// Cada fila lleva id, version, actualizado_en y eliminado. Gana el último cambio.

import { llamar } from './api.js';

export const TABLAS = ['Config', 'Personas', 'Participacion', 'Categorias', 'TiposCambio', 'Gastos',
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

function persistir() {
  const ok = escribir('outbox', outbox) && escribir('db', db);
  if (!ok) estadoSync.error = 'almacenamiento';
  return ok;
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
      const res = await llamar(meta, { action: 'sync', since: meta.since || 0, changes: enviados });
      if (!res || !res.ok) throw new Error(res?.error || 'respuesta_invalida');
      if (res.serverTime) meta.desfase = res.serverTime - Math.round((t0 + Date.now()) / 2);
      let rechazados = 0;
      TABLAS.forEach((t) => {
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
      if (!persistir()) throw new Error('almacenamiento');
      meta.since = res.maxTs || meta.since || 0;
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
  avisar();
}
