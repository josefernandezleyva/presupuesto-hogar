// Evidencia de un gasto: una foto o captura, comprimida en el celular y guardada en Drive.
// Si no hay conexión, queda en una cola del celular y se sube en la próxima sincronización.

import * as idb from './idb.js';
import * as st from './store.js';
import { llamar } from './api.js';

/** Reduce la imagen a 1600 px y JPEG: una foto de 4 MB queda en unos 250 KB. */
export async function comprimir(file, max = 1600, calidad = 0.72) {
  if (!file || !/^image\//.test(file.type || 'image/')) throw new Error('Elige una imagen.');
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((ok, ko) => {
      const i = new Image();
      i.onload = () => ok(i);
      i.onerror = () => ko(new Error('No se pudo leer la imagen. Prueba con otra foto o una captura.'));
      i.src = url;
    });
    const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.max(1, Math.round(img.naturalWidth * k)), h = Math.max(1, Math.round(img.naturalHeight * k));
    const cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    const ctx = cv.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    const dataUrl = cv.toDataURL('image/jpeg', calidad);
    return { mime: 'image/jpeg', data: dataUrl.split(',')[1], w, h };
  } finally {
    URL.revokeObjectURL(url);
  }
}

export const urlDe = (ev) => (ev ? `data:${ev.mime};base64,${ev.data}` : '');
export const tamanoKB = (ev) => Math.round((ev?.data?.length || 0) * 0.75 / 1024);

export async function encolar(gastoId, ev, nombre) {
  await idb.guardar('pendientes', gastoId, { ...ev, nombre, reemplaza: st.fila('Gastos', gastoId)?.evidencia_id || '' });
  procesarCola();
}

/** Pasa una foto en espera de un gasto a otro (cuando un pago único se vuelve un plan). */
export async function mover(de, a) {
  const p = await idb.leer('pendientes', de);
  if (!p) return;
  await idb.guardar('pendientes', a, p);
  await idb.borrar('pendientes', de);
  procesarCola();
}

export async function quitar(gastoId) {
  await idb.borrar('pendientes', gastoId);
  const g = st.fila('Gastos', gastoId);
  if (g && (g.evidencia_id || g.evidencia_url)) st.guardarUno('Gastos', { id: gastoId, evidencia_id: '', evidencia_url: '' });
}

export const pendiente = async (gastoId) => !!(await idb.leer('pendientes', gastoId));
export const pendientes = async () => (await idb.claves('pendientes')).length;

/** Último problema al subir fotos (vacío si todo va bien). */
export const estadoCola = { error: '' };
const ERRORES_RED = new Set(['sin_conexion', 'tiempo_agotado', 'ocupado']);

let enCurso = null;
/** Sube las fotos en cola. Se llama al guardar y después de cada sincronización. */
export function procesarCola() {
  if (enCurso) return enCurso;
  enCurso = (async () => {
    const meta = st.getMeta();
    if (!meta.url && !meta.demo) return 0;
    let subidas = 0;
    for (const gid of await idb.claves('pendientes')) {
      const p = await idb.leer('pendientes', gid);
      const g = st.fila('Gastos', gid);
      if (!p) continue;
      if (!g || Number(g.eliminado) === 1) { await idb.borrar('pendientes', gid); continue; }
      try {
        const r = await llamar(meta, { action: 'subirEvidencia', gastoId: gid, mime: p.mime, nombre: p.nombre, data: p.data, reemplaza: p.reemplaza });
        if (!r || !r.ok) throw new Error(r?.error || 'respuesta_invalida');
        await idb.guardar('cache', r.id, { mime: p.mime, data: p.data });
        st.guardarUno('Gastos', { id: gid, evidencia_id: r.id, evidencia_url: r.url || '' });
        await idb.borrar('pendientes', gid);
        estadoCola.error = '';
        subidas++;
      } catch (e) {
        // Sin conexión u otro problema: se reintenta en la próxima sincronización.
        estadoCola.error = ERRORES_RED.has(e.message) ? '' : e.message;
        break;
      }
    }
    return subidas;
  })().finally(() => { enCurso = null; });
  return enCurso;
}

/** Devuelve la imagen de un gasto: la de la cola, la guardada en el celular o la de Drive. */
export async function obtener(gasto) {
  if (!gasto) return null;
  const p = await idb.leer('pendientes', gasto.id);
  if (p) return p;
  if (!gasto.evidencia_id) return null;
  const c = await idb.leer('cache', gasto.evidencia_id);
  if (c) return c;
  const r = await llamar(st.getMeta(), { action: 'evidencia', id: gasto.evidencia_id });
  if (!r || !r.ok) throw new Error(r?.error || 'respuesta_invalida');
  const ev = { mime: r.mime, data: r.data };
  await idb.guardar('cache', gasto.evidencia_id, ev);
  return ev;
}
