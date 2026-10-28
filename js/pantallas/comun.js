// Fragmentos compartidos entre pantallas.

import * as L from '../logic.js';
import { esc, fmt, nombreMes } from '../util.js';
import { icono } from '../ui.js';
import { mensajeError } from '../api.js';
import { pendientes, foto } from '../store.js';

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

/** Punto con el color del grupo de la categoría. */
export function puntoCat(cat) {
  const color = L.grupoDe(foto(), cat?.grupo)?.color || L.colorGrupoInicial(cat?.grupo);
  return `<span class="dot" style="background:${esc(color)}" aria-hidden="true"></span>`;
}

const pctTxt = (v) => `${Number(v).toLocaleString('es-PE', { maximumFractionDigits: 2 })} %`;

/**
 * Participación propuesta según los sueldos vigentes del mes (ej.: 100 y 50 → 66.67 % y 33.33 %).
 * El administrador la aplica con un toque desde ese mes.
 */
export function tarjetaPropuesta(c, mes) {
  const { S, admin } = c;
  const prop = L.participacionPorIngresos(S, mes);
  if (!prop) return '';
  const actual = L.participacion(S, mes);
  const ps = L.personas(S);
  if (!prop.pcts) {
    if (!prop.faltan.length) return '';
    return `<section class="card stack"><h2 class="h2">Participación según sueldos</h2>
      <p class="sm muted">Para proponerla, falta el sueldo de ${prop.faltan.map((p) => esc(p.nombre)).join(' y ')} en Hogar y ajustes › Ingresos.</p></section>`;
  }
  const igual = L.mismosPcts(prop.pcts, actual);
  return `<section class="card stack prop-part">
    <h2 class="h2">Participación según sueldos</h2>
    <div class="pbar" role="img" aria-label="${ps.map((p) => `${esc(p.nombre)} ${pctTxt(prop.pcts[p.id] || 0)}`).join(', ')}">
      ${ps.filter((p) => prop.pcts[p.id]).map((p) => `<div style="width:${prop.pcts[p.id]}%;background:${esc(p.color)}">${pctTxt(prop.pcts[p.id])}</div>`).join('')}
    </div>
    <p class="xs muted">Cada uno aporta en proporción a lo que gana: ${ps.map((p) => `${esc(p.alias || p.nombre)} ${esc(fmt(L.ingresoVigente(S, p.id, mes)?.soles || 0))}`).join(' · ')}.</p>
    ${igual ? `<p class="sm ok-t">Coincide con la participación de ${esc(nombreMes(mes).toLowerCase())}.</p>`
      : `<p class="sm">La participación vigente es ${ps.map((p) => pctTxt(actual[p.id] || 0)).join(' / ')}.</p>
        ${admin ? `<button type="button" class="btn pri" data-a="usar-propuesta" data-m="${esc(mes)}">Usar desde ${esc(nombreMes(mes).toLowerCase())}</button>` : '<p class="xs muted">El administrador puede aplicarla en Hogar y ajustes › Personas y participación.</p>'}`}
  </section>`;
}

/**
 * Guarda una distribución desde `mes`, pidiendo confirmación con lo que cambia:
 * la distribución que regía y las guardadas desde meses posteriores, que se reemplazan.
 */
export function confirmarDistribucion(c, ops, mes, pcts, { siempre = false, alGuardar = null } = {}) {
  const { S } = c;
  const posteriores = ops.distribucionesPosteriores(mes);
  const guardar = (c2) => {
    ops.guardarParticipacion(mes, pcts);
    if (alGuardar) alGuardar(c2);
    c2.avisar(`Participación ${L.barrasReparto(S, pcts)} desde ${nombreMes(mes).toLowerCase()}`);
  };
  if (!siempre && !posteriores.length) { guardar(c); return; }
  const antes = L.participacion(S, mes);
  c.preguntar({
    titulo: `Participación desde ${nombreMes(mes).toLowerCase()}`,
    html: `<div class="stack-sm sm">
      <div class="split"><span class="muted">Rige ahora</span><span>${esc(L.textoReparto(S, antes))}</span></div>
      <div class="split"><span class="muted">Desde ${esc(nombreMes(mes).toLowerCase())}</span><strong>${esc(L.textoReparto(S, pcts))}</strong></div>
      ${posteriores.length ? `<p class="bad-t">Se reemplaza${posteriores.length > 1 ? 'n' : ''} ${posteriores.length === 1 ? 'el cambio guardado' : `los ${posteriores.length} cambios guardados`} desde un mes posterior:</p>
        <ul class="lista-sm">${posteriores.map((d) => `<li>${esc(nombreMes(d.desde))}: ${esc(L.textoReparto(S, d.pcts))}</li>`).join('')}</ul>` : ''}
      <p class="xs muted">Los gastos ya registrados conservan su reparto. Los nuevos y los mensuales y cuotas programados desde ese mes usan la nueva participación.</p>
    </div>`,
    botones: [{ l: posteriores.length ? 'Reemplazar y guardar' : 'Guardar', estilo: 'pri', fn: guardar }]
  });
}

/** Acción compartida: aplica la participación propuesta desde un mes, con confirmación. */
export function usarPropuesta(c, d, ops) {
  const prop = L.participacionPorIngresos(c.S, d.m);
  if (!prop?.pcts) return;
  confirmarDistribucion(c, ops, d.m, prop.pcts, { siempre: true });
}
