// Fragmentos compartidos entre pantallas.

import * as L from '../logic.js';
import { esc, fmt } from '../util.js';
import { icono } from '../ui.js';
import { mensajeError } from '../api.js';
import { pendientes } from '../store.js';

export function botonSync(c) {
  return `<button class="btn-ic round${c.sync.corriendo ? ' girando' : ''}" data-a="sync" aria-label="Sincronizar ahora">${icono('sync', 22)}</button>`;
}

export function lineaSync(c) {
  const n = pendientes();
  const pend = n ? ` · ${n} ${n === 1 ? 'cambio por subir' : 'cambios por subir'}` : ' · sin cambios pendientes';
  if (c.meta.demo) return `<p class="sync-l">Modo de ejemplo: los datos viven solo en este celular${pend}</p>`;
  if (c.sync.corriendo) return '<p class="sync-l">Sincronizando…</p>';
  if (c.sync.error) return `<p class="sync-l bad-t">${esc(mensajeError(c.sync.error))}</p>`;
  if (!c.sync.ultimo) return `<p class="sync-l">Aún sin sincronizar${pend}</p>`;
  const d = new Date(c.sync.ultimo);
  const hora = d.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
  const esHoy = d.toDateString() === new Date().toDateString();
  return `<p class="sync-l">Sincronizado ${esHoy ? 'hoy' : d.toLocaleDateString('es-PE', { day: 'numeric', month: 'short' })} a las ${esc(hora)}${pend}</p>`;
}

export const nombre = (S, id) => esc(L.persona(S, id)?.nombre || '—');

/** Frase de quién debe a quién (RF-37). */
export function fraseSaldo(S, trans) {
  if (!trans.length) return 'Están al día: nadie debe a nadie';
  if (trans.length === 1) return `${nombre(S, trans[0].de)} le debe ${esc(fmt(trans[0].monto))} a ${nombre(S, trans[0].a)}`;
  return trans.map((t) => `${nombre(S, t.de)} → ${nombre(S, t.a)}: ${esc(fmt(t.monto))}`).join('<br>');
}

export function puntoCat(cat) {
  const colores = { 'Vivienda y servicios': '#2F5D8A', 'Alimentación': '#1F7A5C', 'Transporte': '#B4532A', 'Ocio y suscripciones': '#6B4FA0', 'Personal': '#A23B72', 'Salud y educación': '#2E7D6B', 'Ahorro': '#8A6D1F' };
  return `<span class="dot" style="background:${colores[cat?.grupo] || '#7A7F7C'}" aria-hidden="true"></span>`;
}
