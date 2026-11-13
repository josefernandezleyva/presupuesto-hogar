// Fragmentos compartidos entre pantallas.

import { iconoDe, svg } from '../iconos.js';
import * as L from '../logic.js';
import { esc, fmt, nombreMes, num, fechaCorta } from '../util.js';
import { icono } from '../ui.js';
import { mensajeError } from '../api.js';
import { pendientes, foto } from '../store.js';
import * as ops from '../ops.js';

/* ------------------------------------------------------------------ 3.2 --- */

/** 3.2 · Gasto mensual guardado sin monto (S/ 0): un recordatorio cuyo monto se completa cuando llega el recibo. */
export const sinMonto = (g) => !!g && g.estado !== L.ESTADO.ANUL && !(num(g.monto) > 0);

/** Monto para mostrar: «Por definir» cuando aún no se sabe. */
export const montoTxt = (g, opt = {}) => (sinMonto(g) ? 'Por definir' : fmt(num(g.monto), { moneda: g.moneda, ...opt }));

const nombreGasto = (g) => g.nota || L.categoria(foto(), g.categoria_id)?.nombre || 'Gasto';

/**
 * 3.2 · Marcar como pagado desde cualquier lugar (Inicio, Gastos, detalle). Si el gasto aún no tiene monto,
 * primero se pide cuánto fue. El aviso trae «Deshacer».
 */
export function marcarPagado(c, id) {
  const g = foto().Gastos.find((x) => x.id === id);
  if (!g) return;
  const listo = (c2) => c2.avisar('Marcado como pagado', '', { l: 'Deshacer', fn: (c3) => { ops.desconfirmarGasto(id); c3.avisar('Vuelve a estar por pagar'); } });
  if (!sinMonto(g)) { ops.confirmarGasto(id); listo(c); return; }
  c.preguntar({
    titulo: '¿Cuánto fue?',
    html: `<p class="sm">«${esc(nombreGasto(g))}» no tiene monto todavía. Escríbelo para marcarlo como pagado.</p>
      <label class="frow"><span class="muted">Monto (${g.moneda === 'USD' ? 'US$' : 'S/'})</span><input class="inl" name="monto" inputmode="decimal" autocomplete="off" placeholder="0.00" aria-label="Monto del recibo"></label>`,
    botones: [{ l: 'Marcar como pagado', estilo: 'pri', mantener: true, fn: (c2, v) => {
      const m = num(String(v.monto || '').replace(/,/g, ''));
      if (!(m > 0)) throw new ops.ErrorApp('Escribe cuánto fue.');
      ops.confirmarGasto(id, m);
      c2.preguntar(null);
      listo(c2);
    } }]
  });
}

/**
 * 3.2 · Anular siempre pide confirmación, venga de donde venga (deslizar en Gastos, detalle o edición).
 * Muestra qué se anula y recuerda que se puede restaurar en «Gastos anulados». El aviso trae «Deshacer».
 */
export function pedirAnular(c, id, { despues = null } = {}) {
  const S = foto();
  const g = S.Gastos.find((x) => x.id === id);
  if (!g) return;
  const plan = g.plan_id ? L.idx(S).plan.get(g.plan_id) : null;
  const siguen = plan ? (L.idx(S).gastosPorPlan.get(g.plan_id) || []).filter((x) => x.estado === L.ESTADO.PROG && num(x.nro_cuota) > num(g.nro_cuota) && !L.mesCerrado(S, x.mes)).length : 0;
  const hacer = (c2, alcance) => {
    const r = ops.anularGasto(g.id, alcance);
    despues?.(c2);
    c2.avisar(r.gastos.length > 1 ? `${r.gastos.length} gastos anulados` : `«${nombreGasto(g)}» anulado`, '', { l: 'Deshacer', fn: (c3) => { ops.deshacerAnulacion(r); c3.avisar('Anulación deshecha'); } });
  };
  c.preguntar({
    titulo: '¿Anular este gasto?',
    html: `<div class="anu-q"><span class="b">${esc(nombreGasto(g))}</span><span class="num b">${esc(montoTxt(g))}</span>
        <span class="xs muted">${esc(fechaCorta(g.fecha))}${plan ? ` · ${plan.modalidad === 'Cuotas' ? `cuota ${esc(g.nro_cuota)} de ${esc(plan.nro_cuotas)}` : 'gasto mensual'}` : ''}</span></div>
      <p class="sm">Deja de contar en los totales y en las cuentas entre ustedes, pero no se borra: queda en la hoja como anulado.</p>
      <p class="xs muted">Si te equivocas, lo restauras en Hogar y ajustes › Gastos anulados.</p>`,
    botones: siguen
      ? [{ l: 'Anular solo este', estilo: 'danger', fn: (c2) => hacer(c2, 'este') },
        { l: `Anular este y ${siguen === 1 ? 'el siguiente' : `los ${siguen} siguientes`}`, estilo: 'sec', fn: (c2) => hacer(c2, 'siguientes') }]
      : [{ l: 'Sí, anular', estilo: 'danger', fn: (c2) => hacer(c2, 'este') }],
    cancelar: 'No anular'
  });
}

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
/** 3.0 · Ícono pequeño de la categoría (en línea con el texto), del color de su grupo. */
export function puntoCat(cat) {
  const color = L.grupoDe(foto(), cat?.grupo)?.color || L.colorGrupoInicial(cat?.grupo);
  const ic = cat?.nombre ? iconoDe(cat.nombre, cat.grupo) : iconoDe(cat?.grupo || '', '');
  return `<span class="cat-ic" style="--c:${esc(color)}">${svg(ic, 16)}</span>`;
}

/** 3.0 · Placa redondeada con el ícono de la categoría, para el inicio de las filas. */
export function placaCat(cat, size = 36) {
  const color = L.grupoDe(foto(), cat?.grupo)?.color || L.colorGrupoInicial(cat?.grupo);
  return `<span class="placa" style="--c:${esc(color)};width:${size}px;height:${size}px" aria-hidden="true">${svg(iconoDe(cat?.nombre || '', cat?.grupo || ''), Math.round(size * 0.88))}</span>`;
}

/** 3.0 · Placa con un ícono del set (estados, ingresos…), con color propio. */
export function placa(nombre, color = 'var(--accent)', size = 36) {
  return `<span class="placa" style="--c:${color};width:${size}px;height:${size}px" aria-hidden="true">${svg(nombre, Math.round(size * 0.84))}</span>`;
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
    const n = ops.guardarParticipacion(mes, pcts);
    if (alGuardar) alGuardar(c2);
    // 3.3: se dice cuántos mensuales y cuotas por pagar tomaron la nueva participación.
    c2.avisar(`Participación ${L.barrasReparto(S, pcts)} desde ${nombreMes(mes).toLowerCase()}${n ? ` · ${n} ${n === 1 ? 'gasto programado actualizado' : 'gastos programados actualizados'}` : ''}`);
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

/**
 * 3.2 · Restaurar un gasto anulado (desde su detalle o desde «Gastos anulados»): se elige si vuelve como pagado
 * o por pagar. Si era de un plan cancelado, se puede reactivar el plan con los anulados que le siguen.
 */
export function pedirRestaurar(c, id, { despues = null } = {}) {
  const S = foto();
  const g = S.Gastos.find((x) => x.id === id);
  if (!g || g.estado !== L.ESTADO.ANUL) return;
  const plan = g.plan_id ? L.idx(S).plan.get(g.plan_id) : null;
  const cerrado = L.mesCerrado(S, g.mes);
  const sig = plan && plan.estado === 'Cancelado'
    ? (L.idx(S).gastosPorPlan.get(g.plan_id) || []).filter((x) => x.estado === L.ESTADO.ANUL && num(x.nro_cuota) > num(g.nro_cuota) && !L.mesCerrado(S, x.mes)).length : 0;
  const hacer = (c2, como, conPlan = false) => {
    const n = ops.restaurarAnulado(g.id, como, { conPlan });
    despues?.(c2);
    c2.avisar(n > 1 ? `${n} gastos restaurados${conPlan ? ' y plan reactivado' : ''}` : `«${nombreGasto(g)}» restaurado como ${como === L.ESTADO.CONF ? 'pagado' : 'por pagar'}`, '', { l: 'Deshacer', fn: (c3) => {
      const S3 = foto();
      const ids = [g.id, ...(conPlan ? (L.idx(S3).gastosPorPlan.get(g.plan_id) || []).filter((x) => num(x.nro_cuota) > num(g.nro_cuota) && x.estado === L.ESTADO.PROG && !L.mesCerrado(S3, x.mes)).map((x) => x.id) : [])];
      ops.deshacerAnulacion({ gastos: [], plan: conPlan && plan ? [plan.id, 'Cancelado'] : null });
      ids.forEach((x) => { try { ops.anularGasto(x, 'este'); } catch (e) { /* mes cerrado: se queda */ } });
      c3.avisar('Restauración deshecha');
    } });
  };
  const cab = `<div class="anu-q"><span class="b">${esc(nombreGasto(g))}</span><span class="num b">${esc(fmt(num(g.monto), { moneda: g.moneda }))}</span>
    <span class="xs muted">${esc(fechaCorta(g.fecha))} ${esc(String(g.fecha).slice(0, 4))}${plan ? ` · ${plan.modalidad === 'Cuotas' ? `cuota ${esc(g.nro_cuota)} de ${esc(plan.nro_cuotas)}` : 'gasto mensual'}` : ''}</span></div>`;
  if (cerrado) {
    c.preguntar({ titulo: 'No se puede restaurar', html: `${cab}<p class="sm">${esc(nombreMes(g.mes))} está cerrado. El administrador puede reabrirlo en Cuentas y luego restaurar el gasto.</p>`, botones: [], cancelar: 'Entendido' });
    return;
  }
  const conMonto = num(g.monto) > 0;
  c.preguntar({
    titulo: 'Restaurar gasto',
    html: `${cab}<p class="sm">Vuelve a contar en los totales${conMonto ? ' y en las cuentas entre ustedes cuando esté pagado' : ''}. ¿Cómo queda?</p>
      ${sig ? `<p class="xs muted">Su plan está cancelado y tiene ${sig === 1 ? 'otro gasto anulado después' : `${sig} gastos anulados después`}. Puedes reactivar el plan con ellos.</p>` : ''}`,
    botones: [
      ...(conMonto ? [{ l: 'Restaurar como pagado', estilo: 'pri', fn: (c2) => hacer(c2, L.ESTADO.CONF) }] : []),
      { l: 'Restaurar como por pagar', estilo: conMonto ? 'sec' : 'pri', fn: (c2) => hacer(c2, L.ESTADO.PROG) },
      ...(sig ? [{ l: `Restaurar con los ${sig + 1} y reactivar el plan`, estilo: 'sec', fn: (c2) => hacer(c2, L.ESTADO.PROG, true) }] : [])
    ]
  });
}
