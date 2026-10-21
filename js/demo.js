// Servidor de ejemplo: imita al Apps Script guardando en el propio celular.
// Sirve para probar la app sin conectar una hoja de Google.

import * as idb from './idb.js';

const KEY = 'pp1:demo-servidor';

function leer() {
  try { return JSON.parse(localStorage.getItem(KEY)) || { tablas: {}, ts: 0 }; } catch { return { tablas: {}, ts: 0 }; }
}

export async function manejarDemo(req) {
  await new Promise((r) => setTimeout(r, 150));
  if (req.action === 'subirEvidencia') {
    const id = 'demo-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    await idb.guardar('demo', id, { mime: req.mime, data: req.data });
    return { ok: true, id, url: '' };
  }
  if (req.action === 'evidencia') {
    const ev = await idb.leer('demo', req.id);
    return ev ? { ok: true, ...ev } : { ok: false, error: 'evidencia_no_existe' };
  }
  const srv = leer();
  if (req.action === 'ping') return { ok: true, schema: 4, serverTime: Date.now() };
  if (req.action !== 'sync') return { ok: false, error: 'accion_desconocida' };
  const since = Number(req.since) || 0;
  let ts = Math.max(Date.now(), srv.ts + 1);
  const accepted = {};
  const forced = {};
  Object.entries(req.changes || {}).forEach(([t, rows]) => {
    const tabla = srv.tablas[t] || (srv.tablas[t] = {});
    accepted[t] = [];
    forced[t] = new Set();
    rows.forEach((row) => {
      const ex = tabla[row.id];
      if (ex && String(ex.actualizado_en || '') > String(row.actualizado_en || '')) { forced[t].add(row.id); return; }
      tabla[row.id] = { ...(ex || {}), ...row, server_ts: ts++ };
      accepted[t].push(row.id);
    });
  });
  srv.ts = Math.max(srv.ts, ts - 1);
  try { localStorage.setItem(KEY, JSON.stringify(srv)); } catch { return { ok: false, error: 'almacenamiento' }; }
  const changes = {};
  Object.entries(srv.tablas).forEach(([t, tabla]) => {
    changes[t] = Object.values(tabla).filter((r) => r.server_ts > since || forced[t]?.has(r.id));
  });
  return { ok: true, schema: 4, changes, accepted, maxTs: srv.ts, serverTime: Date.now() };
}

export function borrarDemo() {
  try { localStorage.removeItem(KEY); } catch { /* nada */ }
}
