// Registrar o editar un gasto: descripción, monto (en soles por defecto), categoría y Guardar.
// Arriba: el mes y quién pagó. Luego fecha, reparto y modalidad; al final, la foto.
// La descripción se guarda en la columna «nota» de Gastos (la misma de siempre; la hoja no cambia).

import * as L from '../logic.js';
import * as ops from '../ops.js';
import * as st from '../store.js';
import { esc, hoy, mesActual, mesDe, parseMonto, r2, num, fmt, fmt0, pct, nombreMes, sumarMeses, fechaCorta, diasEnMes, difMeses, SIMBOLO } from '../util.js';
import { encabezado, segmentado, alerta, avatar, icono } from '../ui.js';
import * as evid from '../evidencia.js';
import { aplicarSquircle } from '../squircle.js';
import { mensajeError } from '../api.js';
import { puntoCat } from './comun.js';

const np = (v) => { const x = parseMonto(v); return isNaN(x) ? 0 : Math.min(100, Math.max(0, x)); };

/** Fecha en el mes `m`: hoy si es el mes actual; si no, el mismo día del mes (o el último). */
function fechaEnMes(m, fechaBase) {
  if (m === mesActual()) return hoy();
  const dia = Number(String(fechaBase || hoy()).slice(8, 10)) || 1;
  return `${m}-${String(Math.min(dia, diasEnMes(m))).padStart(2, '0')}`;
}

/* --------------------------------------------------------------- Estado --- */

function iniciarNuevo(c) {
  const e = c.estado;
  Object.assign(e, {
    monto: '', moneda: 'PEN', tc: '', tcManual: false, falta: null, dupOk: false,
    categoria_id: c.query.cat || '', pagado_por: c.meta.personaId,
    fecha: fechaEnMes(c.mes, hoy()), nota: '', tipo: '',
    rep: 'hogar', modalidad: 'Unico', nroCuotas: 3, mesInicio: '', montoCuota: '', sinFin: '1', durN: '12', dobles: [],
    panel: null
  });
  e.mesInicio = mesDe(e.fecha);
  if (e.moneda === 'USD') e.tc = String(L.tipoCambio(c.S, mesDe(e.fecha)) || '');
  cargarPcts(c, L.participacion(c.S, mesDe(e.fecha)));
}

function iniciarEdicion(c, g) {
  const e = c.estado;
  const S = c.S;
  const plan = g.plan_id ? st.fila('Planes', g.plan_id) : null;
  // Gastos anteriores a la 1.5 pueden no tener descripción: se propone la del plan o el nombre de la categoría.
  const notaGuardada = String(g.nota || '').trim();
  const propuesta = notaGuardada ? '' : (String(plan?.descripcion || '').trim() || L.categoria(S, g.categoria_id)?.nombre || '');
  Object.assign(e, {
    id: g.id, monto: String(g.monto), moneda: g.moneda, tc: g.moneda === 'USD' ? String(g.tipo_cambio || '') : '', tcManual: true,
    categoria_id: g.categoria_id, pagado_por: g.pagado_por, fecha: g.fecha, nota: notaGuardada || propuesta, notaPropuesta: !!propuesta, tipo: g.tipo || '', falta: null,
    modalidad: plan ? plan.modalidad : 'Unico', nroCuotas: 3, mesInicio: g.mes, montoCuota: '',
    sinFin: plan && num(plan.duracion_meses) ? '0' : '1', durN: String(plan && num(plan.duracion_meses) ? plan.duracion_meses : 12),
    dobles: plan ? L.mesesDobles(plan) : [], repite: '1', panel: null
  });
  e.planOrig = plan ? { sinFin: e.sinFin, durN: e.durN, dobles: e.dobles.join(',') } : null;
  const pcts = L.pctsDeGasto(S, g);
  const hogar = L.participacion(S, g.mes);
  const igual = (a, b) => L.personas(S, { todas: true }).every((p) => num(a[p.id]) === num(b[p.id]));
  e.rep = igual(pcts, hogar) ? 'hogar' : 'medida';
  cargarPcts(c, pcts);
}

function moverAMes(c, m) {
  const e = c.estado;
  e.fecha = fechaEnMes(m, e.fecha);
  e.mesInicio = m;
  if (e.moneda === 'USD' && !e.tcManual) e.tc = String(L.tipoCambio(c.S, m) || '');
  if (e.rep === 'hogar') cargarPcts(c, L.participacion(c.S, m));
  c.render();
}

function cargarPcts(c, pcts) {
  L.personas(c.S, { todas: true }).forEach((p) => { c.estado['pct_' + p.id] = String(num(pcts[p.id])); });
}

function pctsActuales(c) {
  const out = {};
  L.personas(c.S).forEach((p) => { out[p.id] = np(c.estado['pct_' + p.id]); });
  return out;
}

function pctsElegidos(c) {
  const e = c.estado;
  if (e.rep === 'hogar') return e.id ? L.participacion(c.S, mesDe(e.fecha)) : null;
  return pctsActuales(c);
}

/** Cambios de plan pedidos al editar un gasto mensual o en cuotas (null si no hay). */
function cambiosDePlan(e) {
  if (!e.planOrig) return null;
  const out = {};
  if (e.dobles.join(',') !== e.planOrig.dobles) out.mesesDobles = e.dobles;
  if (e.modalidad === 'Recurrente') {
    if (e.repite === '0') out.terminar = true;
    else if (e.sinFin !== e.planOrig.sinFin || (e.sinFin === '0' && e.durN !== e.planOrig.durN)) out.duracion = e.sinFin === '1' ? 0 : num(e.durN);
  }
  return Object.keys(out).length ? out : null;
}

/* ------------------------------------------------------------ Cálculos --- */

function tcVigente(c) {
  const e = c.estado;
  if (e.moneda === 'PEN') return 1;
  const v = parseMonto(e.tc);
  return v > 0 ? v : null;
}

function cuotasCalc(e) {
  const total = parseMonto(e.monto);
  const n = Math.max(2, Math.floor(num(e.nroCuotas)));
  if (!(total > 0)) return { n, montos: [], cuota: 0, total: 0, dobles: 0 };
  const q = L.planCuotas(total, n, e.mesInicio || mesDe(e.fecha), e.dobles, parseMonto(e.montoCuota) || 0);
  return { n, montos: q.montos, cuota: q.base, primera: q.montos[0], total: q.total, dobles: q.dobles };
}

/** Monto en soles que pesa en el mes (para alerta y reparto). */
function solesDelMes(c) {
  const e = c.estado;
  const nuevoPlan = !e.id || !e.planOrig;
  let base = parseMonto(e.monto) || 0;
  if (nuevoPlan && e.modalidad === 'Cuotas') base = cuotasCalc(e).primera || 0;
  else if (nuevoPlan && e.modalidad === 'Recurrente') base = base * L.factorMes(e.dobles.join(','), mesDe(e.fecha));
  return r2((base || 0) * (tcVigente(c) || 0));
}

/* -------------------------------------------------- Piezas actualizables --- */

function usoHtml(c) {
  const { S, estado: e } = c;
  if (!e.categoria_id) return '';
  const cat = L.categoria(S, e.categoria_id);
  const mes = e.modalidad === 'Cuotas' && !e.planOrig ? (e.mesInicio || mesDe(e.fecha)) : mesDe(e.fecha);
  if (e.moneda === 'USD' && !tcVigente(c)) return '';
  const soles = solesDelMes(c);
  const u = L.usoCategoria(S, mes, e.categoria_id, { extra: soles, excluirId: e.id || null });
  if (!(u.tope > 0)) return '';
  const antes = r2(u.usado - soles);
  if (u.estado === 'excede') return alerta('bad', `Superas el tope de ${cat.nombre}`, `Llevas ${fmt0(antes)} de ${fmt0(u.tope)}. Con este gasto serían ${fmt(u.usado)}, ${fmt(u.usado - u.tope)} de más. Puedes guardar igual.`);
  if (u.estado === 'aviso' && soles > 0) return alerta('warn', `Cerca del tope de ${cat.nombre}`, `Con este gasto: ${fmt(u.usado)} de ${fmt0(u.tope)} (${pct(u.pct)}).`);
  return `<p class="muted xs">${esc(cat.nombre)}: ${esc(fmt0(u.usado))} de ${esc(fmt0(u.tope))} este mes (${esc(pct(u.pct))}).</p>`;
}

function tcHtml(c) {
  const e = c.estado;
  if (e.moneda !== 'USD') return '';
  const mes = mesDe(e.fecha);
  const delMes = L.tipoCambioDelMes(c.S, mes) || L.tipoCambio(c.S, mes);
  const tc = tcVigente(c);
  const monto = parseMonto(e.monto) || 0;
  return `<div class="tc-row">
    <label for="tc" class="muted sm">Tipo de cambio</label>
    <span class="pct-w">S/ <input id="tc" class="inl tc" data-f="tc" inputmode="decimal" placeholder="3.75" value="${esc(e.tc)}"> por US$</span>
  </div>
  <p class="xs ${tc ? 'muted' : 'bad-t'}" id="conv">${tc ? `US$ ${esc(fmt(monto, { moneda: 'PEN' }).replace('S/ ', ''))} = <strong>${esc(fmt(monto * tc))}</strong>${delMes && Math.abs(delMes - tc) > 0.00001 ? ` · el del mes es ${delMes}` : (delMes ? ' · tipo de cambio del mes' : '')}` : 'Escribe el tipo de cambio para convertir a soles.'}</p>`;
}

function etiquetaReparto(c) {
  const { S, estado: e } = c;
  const ps = L.personas(S);
  if (e.rep === 'hogar') return 'Hogar ' + L.barrasReparto(S, L.participacion(S, mesDe(e.fecha)));
  const p = pctsActuales(c);
  const uno = ps.find((x) => num(p[x.id]) === 100);
  if (uno) return 'Todo ' + (uno.alias || uno.nombre.split(' ')[0]);
  return L.barrasReparto(S, p);
}

/** Frase que explica qué reparto se aplica y desde cuándo rige la participación del hogar. */
function infoReparto(c) {
  const { S, estado: e } = c;
  const mes = mesDe(e.fecha);
  if (e.rep !== 'hogar') return `Reparto propio: ${esc(L.textoReparto(S, pctsActuales(c)))}.`;
  const v = L.vigencia(S, mes);
  const desde = v.desde && v.desde <= mes ? `vigente desde ${esc(nombreMes(v.desde).toLowerCase())}` : 'la primera registrada';
  return `Se reparte como el hogar: ${esc(L.textoReparto(S, v.pcts))}, la participación ${desde}.`;
}

/** Descripciones usadas antes que coinciden con lo escrito: completan descripción y categoría. */
function sugerenciasHtml(c) {
  const { S, estado: e } = c;
  if (e.id && !e.notaPropuesta) return '';
  const lista = L.sugerenciasDescripcion(S, e.nota, { max: 4 });
  if (!lista.length) return '';
  return `<div class="sugs" role="group" aria-label="Descripciones usadas antes">${lista.map((x, i) => {
    const cat = L.categoria(S, x.categoria_id);
    return `<button type="button" class="sug" data-a="sugerencia" data-i="${i}">${esc(x.nota)}${cat ? `<span class="muted"> · ${esc(cat.nombre)}</span>` : ''}</button>`;
  }).join('')}</div>`;
}

/** Validación en línea: el primer dato que falta, con el campo que lo marca. */
function faltante(c) {
  const e = c.estado;
  if (!ops.limpiarDescripcion(e.nota)) return { campo: 'nota', msg: 'Escribe una descripción.' };
  if (!(parseMonto(e.monto) > 0)) return { campo: 'monto', msg: 'Escribe el monto.' };
  if (!e.categoria_id) return { campo: 'categoria', msg: 'Elige una categoría.' };
  if (e.moneda === 'USD' && !tcVigente(c)) return { campo: 'tc', msg: 'Escribe el tipo de cambio.' };
  return null;
}

const errorDe = (e, campo) => (e.falta?.campo === campo ? `<p class="campo-err" id="err-${campo}" role="alert">${esc(e.falta.msg)}</p>` : '');
const invalido = (e, campo) => (e.falta?.campo === campo ? ` aria-invalid="true" aria-describedby="err-${campo}"` : '');

function limpiarFalta(c, campo) {
  const e = c.estado;
  if (e.falta?.campo !== campo) return;
  e.falta = null;
  document.getElementById('err-' + campo)?.remove();
  document.querySelectorAll(`[data-err="${campo}"]`).forEach((el) => { el.classList.remove('error'); el.querySelector('[aria-invalid]')?.removeAttribute('aria-invalid'); el.removeAttribute('aria-invalid'); });
}

function presetActivo(c) {
  const { S, estado: e } = c;
  if (e.rep === 'hogar') return 'hogar';
  const p = pctsActuales(c);
  const ps = L.personas(S);
  const uno = ps.find((x) => num(p[x.id]) === 100);
  if (uno) return uno.id;
  if (ps.length === 2 && num(p[ps[0].id]) === 50 && num(p[ps[1].id]) === 50) return 'mitad';
  return null;
}

function detalleRepartoHtml(c) {
  const { S } = c;
  const soles = solesDelMes(c);
  const p = pctsActuales(c);
  const filas = L.calcularReparto(soles, p);
  const suma = L.sumaPcts(p);
  return L.personas(S).map((x) => {
    const f = filas.find((r) => r.persona_id === x.id);
    return `<div class="split sm"><span>${avatar(x, 22)} ${esc(x.nombre)}</span><span><strong>${num(p[x.id])} %</strong> · ${esc(fmt(f ? f.monto_soles : 0))}</span></div>`;
  }).join('') + (suma === 100 ? '' : `<p class="bad-t xs">Suma ${suma} %; debe ser 100 %.</p>`);
}

const doblesTexto = (e) => (e.dobles.length ? L.textoMesesDobles(e.dobles) : '');

function cuotasHtml(c) {
  const e = c.estado;
  const q = cuotasCalc(e);
  if (!q.montos.length) return '<p class="muted xs">Escribe el monto total arriba.</p>';
  const ini = e.mesInicio || mesDe(e.fecha);
  const doble = q.dobles ? ` (${esc(fmt(r2(q.cuota * 2), { moneda: e.moneda }))} en ${esc(doblesTexto(e))})` : '';
  return `<p class="sm">${q.n} cuotas de <strong>${esc(fmt(q.cuota, { moneda: e.moneda }))}</strong>${doble}, de ${esc(nombreMes(ini, { corto: true }))} a ${esc(nombreMes(sumarMeses(ini, q.n - 1), { corto: true }))}${Math.abs(q.total - parseMonto(e.monto)) > 0.004 ? ` · total ${esc(fmt(q.total, { moneda: e.moneda }))}` : ''}</p>`;
}

function recurrenteHtml(c) {
  const e = c.estado;
  const m = parseMonto(e.monto) || 0;
  const dia = Number(e.fecha.slice(8, 10));
  const doble = e.dobles.length && m > 0 ? ` y ${esc(fmt(r2(m * 2), { moneda: e.moneda }))} en ${esc(doblesTexto(e))}` : '';
  return `<p class="muted xs">Queda programado cada mes, el día ${dia}${m > 0 ? `: ${esc(fmt(m, { moneda: e.moneda }))}${doble}` : ''}. Lo confirmas con un toque.</p>`;
}

/** Selector de los meses en que se paga doble (por ejemplo junio y diciembre). */
function doblesHtml(e, nota = '') {
  return `<div class="lbl">Meses con cuota doble <span class="muted">(opcional)</span></div>
    <div class="meses12" role="group" aria-label="Meses con cuota doble">${L.MESES_CORTOS.map((n, i) => {
      const on = e.dobles.includes(i + 1);
      return `<button type="button" class="${on ? 'on' : ''}" data-a="doble" data-v="${i + 1}" aria-pressed="${on}">${n}</button>`;
    }).join('')}</div>
    <p class="xs muted">${e.dobles.length ? `Paga el doble en ${esc(doblesTexto(e))}.` : 'Por ejemplo, préstamos con cuota doble en julio y diciembre.'}${nota ? ' ' + nota : ''}</p>`;
}

function refrescar(c, { sugs = true } = {}) {
  const set = (id, html) => { const el = document.getElementById(id); if (el) el.innerHTML = html; };
  set('uso', usoHtml(c));
  const conv = document.getElementById('conv');
  if (conv) { const tmp = document.createElement('div'); tmp.innerHTML = tcHtml(c); const n = tmp.querySelector('#conv'); if (n) { conv.className = n.className; conv.innerHTML = n.innerHTML; } }
  set('repDet', detalleRepartoHtml(c));
  set('cuotas', cuotasHtml(c));
  set('recInfo', recurrenteHtml(c));
  const pr = document.getElementById('pillRep'); if (pr) pr.textContent = etiquetaReparto(c);
  set('repInfo', infoReparto(c));
  // Al salir del campo («change») no se redibujan: el toque sobre una sugerencia debe llegar a su botón.
  if (sugs) set('sugBox', sugerenciasHtml(c));
  const act = presetActivo(c);
  document.querySelectorAll('[data-a="preset"]').forEach((b) => { b.classList.toggle('on', b.dataset.v === act); });
  const g = document.getElementById('btnGuardar'); if (g) g.innerHTML = textoGuardar(c);
}

function conEvidencia(c, g) {
  const e = c.estado;
  return !!(e.ev || (!e.evQuitar && (g?.evidencia_id || e.evPend)));
}

function evCardHtml(c, g, bloqueado) {
  const e = c.estado;
  if (!conEvidencia(c, g)) return '';
  const src = e.ev ? evid.urlDe(e.ev) : (e.evPreview || '');
  const info = e.ev ? `${evid.tamanoKB(e.ev)} KB · se sube a Drive al guardar`
    : e.evError ? e.evError
    : e.evPend ? (evid.estadoCola.error ? mensajeError(evid.estadoCola.error) : 'Se sube a Drive al volver la conexión')
    : src ? 'Guardada en Drive' : 'Cargando…';
  return `<section class="card ev-card">
    <button type="button" class="ev-thumb-b" data-a="verEv" aria-label="Ver la foto" ${src ? '' : 'disabled'}>${src ? `<img class="ev-thumb" alt="Evidencia del gasto" src="${src}">` : `<span class="ev-thumb ev-vacio">${icono('foto', 22)}</span>`}</button>
    <span class="row-m"><span class="row-t">${e.ev ? 'Foto lista' : 'Foto del gasto'}</span><span class="row-s${e.evError ? ' bad-t' : ''}">${esc(info)}</span></span>
    ${!bloqueado ? `<label class="link">Cambiar<input type="file" accept="image/*" data-file="ev" class="sr" aria-label="Cambiar la foto"></label>
    <button type="button" class="link bad-t" data-a="quitarEv">Quitar</button>` : ''}
  </section>`;
}

function textoGuardar(c) {
  const e = c.estado;
  const m = parseMonto(e.monto);
  const monto = m > 0 ? ' · ' + esc(fmt(m, { moneda: e.moneda })) : '';
  if (e.id && !e.planOrig && e.modalidad === 'Cuotas') return 'Pasar a cuotas' + monto;
  if (e.id && !e.planOrig && e.modalidad === 'Recurrente') return 'Repetir cada mes' + monto;
  if (e.id) return 'Guardar cambios' + monto;
  if (e.modalidad === 'Cuotas') return 'Programar cuotas' + monto;
  return 'Guardar' + monto;
}

/** Lista de categorías con quiebre por grupo, en una hoja que sube desde abajo. */
function hojaCategorias(c) {
  const { S, estado: e } = c;
  const mes = mesDe(e.fecha);
  const filas = L.categoriasPorGrupo(S).map(({ grupo, cats }) => `<div class="cat-g"><span class="dot" style="background:${esc(grupo.color || '#7A7F7C')}" aria-hidden="true"></span>${esc(grupo.nombre)}</div>
    <div class="cat-l">${cats.map((x) => {
      const u = L.usoCategoria(S, mes, x.id, { excluirId: e.id || null });
      const on = x.id === e.categoria_id;
      return `<button type="button" class="cat-op${on ? ' on' : ''}" data-a="elegirCat" data-v="${esc(x.id)}" aria-pressed="${on}">
        <span class="row-m"><span class="row-t">${esc(x.nombre)}</span>${u.tope > 0 ? `<span class="row-s">${esc(fmt0(u.usado))} de ${esc(fmt0(u.tope))} este mes</span>` : ''}</span>
        ${on ? icono('check', 20) : ''}</button>`;
    }).join('')}</div>`).join('');
  return `<div class="cat-hoja">${filas || '<p class="muted sm">Aún no hay categorías.</p>'}</div>
    ${c.admin ? '<button type="button" class="btn ghost wide" data-a="nueva-cat">+ Nueva categoría</button>' : ''}`;
}

/* --------------------------------------------------------------- Vista --- */

const pantalla = {
  iniciar(c) {
    if (c.ruta === 'gasto') {
      const g = st.fila('Gastos', c.param);
      if (g && Number(g.eliminado) !== 1) { iniciarEdicion(c, g); return; }
    }
    iniciarNuevo(c);
  },

  vista(c) {
    const { S, estado: e } = c;
    const edit = !!e.id;
    const g = edit ? st.fila('Gastos', e.id) : null;
    if (c.ruta === 'gasto' && !g) return `${encabezado({ titulo: 'Gasto' })}<main class="pad">${alerta('warn', 'No encontré este gasto', 'Puede que se haya eliminado en otro celular.')}</main>`;
    const plan = g?.plan_id ? L.idx(S).plan.get(g.plan_id) : null;
    const mes = mesDe(e.fecha);
    const cerrado = L.mesCerrado(S, mes);
    const anulado = g?.estado === L.ESTADO.ANUL;
    const bloqueado = anulado || (g && L.mesCerrado(S, g.mes));
    const ps = L.personas(S);
    const pagador = L.persona(S, e.pagado_por);
    const catSel = L.categoria(S, e.categoria_id);
    const tipoEf = e.tipo || catSel?.tipo || 'Variable';
    const modoLabel = e.modalidad === 'Cuotas' ? (plan ? `Cuota ${g.nro_cuota} de ${plan.nro_cuotas}` : `${e.nroCuotas} cuotas`)
      : e.modalidad === 'Recurrente' ? (e.repite === '0' ? 'Termina este mes' : 'Cada mes') : 'Pago único';
    const dis = bloqueado ? 'disabled' : '';
    const pill = (k, contenido) => `<button type="button" class="pill${e.panel === k ? ' on' : ''}" data-a="panel" data-k="${k}" aria-expanded="${e.panel === k}" ${dis}>${contenido}</button>`;
    const tieneEv = conEvidencia(c, g);
    const nombreCorto = pagador?.alias || pagador?.nombre?.split(' ')[0] || '';
    const quien = `<button type="button" class="hdr-quien${e.panel === 'pago' ? ' on' : ''}" data-a="${ps.length === 2 ? 'pagador' : 'panel'}" data-k="pago" ${dis} aria-label="Pagó ${esc(pagador?.nombre || '')}. Toca para cambiar">
      ${avatar(pagador, 28)}<span class="hdr-quien-t"><span class="hdr-quien-l">Pagó</span><span>${esc(nombreCorto)}</span></span>${ps.length > 1 && !bloqueado ? icono('cambiar', 14) : ''}</button>`;

    return `${encabezado({ titulo: edit ? 'Editar gasto' : 'Nuevo gasto', derecha: quien, clase: 'izq' })}
    <main class="pad form has-footer">
      <div class="mes-reg" role="group" aria-label="Mes del gasto">
        <button type="button" class="btn-ic" data-a="mesReg" data-d="-1" aria-label="Mes anterior" ${dis}>${icono('atras', 22)}</button>
        <div class="mes-reg-t"><span class="lbl">Mes del gasto</span><strong>${esc(nombreMes(mes))}</strong>${cerrado ? ' <span class="badge">Cerrado</span>' : ''}</div>
        <button type="button" class="btn-ic" data-a="mesReg" data-d="1" aria-label="Mes siguiente" ${dis}>${icono('adelante', 22)}</button>
      </div>
      ${!edit && mes !== mesActual() ? `<button type="button" class="link center-self" data-a="mesHoy">Volver a ${esc(nombreMes(mesActual(), { anio: false }).toLowerCase())}</button>` : ''}
      ${cerrado && !bloqueado ? alerta('warn', `${nombreMes(mes)} está cerrado`, edit ? 'No se puede cambiar. El administrador puede reabrirlo en Cierre de mes.' : 'Cambia la fecha a un mes abierto o pide al administrador que lo reabra.') : ''}
      ${bloqueado ? alerta('warn', anulado ? 'Este gasto está anulado' : `${nombreMes(g.mes)} está cerrado`, anulado ? 'No cuenta en los totales.' : 'Solo se puede ver.') : ''}
      ${plan ? `<p class="muted sm">${plan.modalidad === 'Cuotas' ? `Cuota ${g.nro_cuota} de ${plan.nro_cuotas}` : 'Gasto mensual'} · ${esc(plan.descripcion)} · ${esc(g.estado)}</p>` : ''}

      ${e.panel === 'pago' && ps.length > 2 ? `<section class="card panel">
        <div class="lbl">¿Quién pagó?</div>
        <div class="chips">${ps.map((p) => `<button type="button" class="chip${p.id === e.pagado_por ? ' on' : ''}" data-a="set" data-k="pagado_por" data-v="${esc(p.id)}">${avatar(p, 24)} ${esc(p.nombre)}</button>`).join('')}</div>
      </section>` : ''}

      <div class="campo-desc${e.falta?.campo === 'nota' ? ' error' : ''}" data-err="nota">
        <label class="lbl" for="nota">Descripción</label>
        <input id="nota" class="input desc-i" data-f="nota" data-keep maxlength="${ops.MAX_DESCRIPCION}" autocomplete="off" autocapitalize="sentences" enterkeyhint="next" placeholder="¿En qué gastaste? Ej.: Supermercado" value="${esc(e.nota)}" aria-required="true"${invalido(e, 'nota')} ${dis}>
        ${errorDe(e, 'nota')}
        ${e.notaPropuesta && !bloqueado ? '<p class="xs muted">Este gasto no tenía descripción: se propone el nombre de la categoría. Puedes cambiarla.</p>' : ''}
      </div>
      <div id="sugBox">${bloqueado ? '' : sugerenciasHtml(c)}</div>

      <section class="amount${e.falta?.campo === 'monto' ? ' error' : ''}" data-err="monto">
        <span class="monto-s" aria-hidden="true">${SIMBOLO[e.moneda]}</span>
        <label class="sr" for="monto">${e.modalidad === 'Cuotas' && !plan ? 'Monto total' : 'Monto'}</label>
        <input id="monto" class="monto-i" data-f="monto" data-keep inputmode="decimal" autocomplete="off" enterkeyhint="done" placeholder="0.00" value="${esc(e.monto)}"${invalido(e, 'monto')} ${dis}>
        <div class="cur-seg" role="group" aria-label="Moneda">
          <button type="button" class="${e.moneda === 'PEN' ? 'on' : ''}" data-a="moneda" data-v="PEN" aria-pressed="${e.moneda === 'PEN'}" ${dis}>S/</button>
          <button type="button" class="${e.moneda === 'USD' ? 'on' : ''}" data-a="moneda" data-v="USD" aria-pressed="${e.moneda === 'USD'}" ${dis}>US$</button>
        </div>
      </section>
      ${errorDe(e, 'monto')}
      <div id="tcbox">${tcHtml(c)}</div>
      ${errorDe(e, 'tc')}

      <button type="button" class="campo-cat${catSel ? '' : ' vacio'}${e.falta?.campo === 'categoria' ? ' error' : ''}" data-a="listaCat" data-err="categoria" ${dis} aria-haspopup="dialog"${invalido(e, 'categoria')}>
        <span class="row-m"><span class="lbl">Categoría</span>
          <span class="campo-v">${catSel ? `${puntoCat(catSel)} ${esc(catSel.nombre)} <span class="muted">· ${esc(catSel.grupo || 'Otros')}</span>` : 'Elige una categoría'}</span></span>
        ${icono('adelante', 18)}</button>
      ${errorDe(e, 'categoria')}
      <div id="uso">${usoHtml(c)}</div>

      <div class="pills" role="group" aria-label="Fecha, reparto y modalidad">
        <label class="pill pill-date${bloqueado ? ' off' : ''}">${icono('calendario', 16)}<span>${esc(fechaCorta(e.fecha))}</span>
          <input type="date" data-f="fecha" data-r value="${esc(e.fecha)}" aria-label="Fecha" ${dis}></label>
        ${pill('reparto', `${icono('reparto', 16)}<span id="pillRep">${esc(etiquetaReparto(c))}</span>`)}
        ${pill('modo', `${icono('repetir', 16)}<span>${esc(modoLabel)}</span>${e.dobles.length ? ' <span class="badge soft">×2</span>' : ''}`)}
      </div>
      <p class="rep-info xs" id="repInfo">${infoReparto(c)}</p>

      ${e.panel === 'reparto' ? `<section class="card panel">
        <div class="lbl">¿Cómo se reparte este gasto?</div>
        <div class="chips">
          <button type="button" class="chip${presetActivo(c) === 'hogar' ? ' on' : ''}" data-a="preset" data-v="hogar">Hogar ${L.barrasReparto(S, L.participacion(S, mes))}</button>
          ${ps.map((p) => `<button type="button" class="chip${presetActivo(c) === p.id ? ' on' : ''}" data-a="preset" data-v="${esc(p.id)}">Todo ${esc(p.alias || p.nombre.split(' ')[0])}</button>`).join('')}
          ${ps.length === 2 ? `<button type="button" class="chip${presetActivo(c) === 'mitad' ? ' on' : ''}" data-a="preset" data-v="mitad">50/50</button>` : ''}
        </div>
        ${ps.length === 2
          ? `<label class="sr" for="slider">Porcentaje de ${esc(ps[0].nombre)}</label>
             <input id="slider" type="range" class="slider" min="0" max="100" step="1" data-f="slider" value="${Math.round(np(e['pct_' + ps[0].id]))}">
             <div class="pct-pair">${ps.map((p) => `<label class="pct-box"><span class="sm">${avatar(p, 22)} ${esc(p.alias || p.nombre.split(' ')[0])}</span>
               <span class="pct-w"><input class="inl pct" data-f="pct_${esc(p.id)}" inputmode="decimal" enterkeyhint="done" value="${esc(e['pct_' + p.id])}" aria-label="Porcentaje de ${esc(p.nombre)}"> %</span></label>`).join('')}</div>
             <p class="xs muted">Mueve la barra o escribe el porcentaje de una persona, por ejemplo 66: la otra se completa sola.</p>`
          : ps.map((p) => `<label class="frow"><span>${avatar(p, 22)} ${esc(p.nombre)}</span><span class="pct-w"><input class="inl pct" data-f="pct_${esc(p.id)}" inputmode="decimal" value="${esc(e['pct_' + p.id])}"> %</span></label>`).join('')}
        <div id="repDet" class="stack-sm">${detalleRepartoHtml(c)}</div>
      </section>` : ''}

      ${e.panel === 'modo' ? `<section class="card panel stack">${panelModo(c, g, plan, tipoEf)}</section>` : ''}

      <div class="pills pills-fin" role="group" aria-label="Foto">
        <label class="pill pill-file${tieneEv ? ' on' : ''}${bloqueado ? ' off' : ''}">${icono('foto', 16)}<span>${tieneEv ? 'Foto' : 'Agregar foto'}</span>
          <input type="file" accept="image/*" data-file="ev" aria-label="Agregar foto o captura del gasto" ${dis}></label>
      </div>

      <div id="evBox">${evCardHtml(c, g, bloqueado)}</div>

      ${edit && !bloqueado && !cerrado ? `<div class="links">
        ${g?.estado === L.ESTADO.PROG ? '<button type="button" class="link" data-a="confirmar">Confirmar con este monto</button>' : ''}
        <button type="button" class="link bad-t" data-a="anular">Anular gasto</button>
      </div>` : ''}
    </main>
    ${!bloqueado && !cerrado ? `<div class="footer"><button type="button" id="btnGuardar" class="btn pri" data-a="guardar">${textoGuardar(c)}</button></div>` : ''}`;
  },

  montar(raiz, c) {
    const e = c.estado;
    // En un gasto nuevo el cursor empieza en la descripción, el dato principal.
    if (!e.id && !e.montado) {
      e.montado = true;
      const d = raiz.querySelector('#nota');
      if (d) setTimeout(() => d.focus(), 60);
    }
    // «Siguiente» en el teclado: de la descripción al monto, con el teclado numérico.
    const nota = raiz.querySelector('#nota');
    if (nota && !nota.dataset.enter) {
      nota.dataset.enter = '1';
      nota.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') { ev.preventDefault(); raiz.querySelector('#monto')?.focus(); } });
    }
    const alElegirFoto = (inp) => inp.addEventListener('change', async () => {
      const file = inp.files && inp.files[0];
      if (!file) return;
      try {
        e.ev = await evid.comprimir(file);
        Object.assign(e, { evQuitar: false, evError: '' });
        c.render();
      } catch (err) { c.avisar(err.message, 'bad'); }
    });
    // Foto o captura: se comprime en el celular y se sube al guardar.
    raiz.querySelectorAll('input[data-file="ev"]').forEach(alElegirFoto);
    // Foto ya guardada: se trae de la cola, del celular o de Drive, sin redibujar la pantalla.
    const g = e.id ? st.fila('Gastos', e.id) : null;
    if (g && !e.evRevisada) {
      e.evRevisada = true;
      const pintar = () => {
        const box = document.getElementById('evBox');
        if (!box) return;
        box.innerHTML = evCardHtml(c, st.fila('Gastos', e.id), L.mesCerrado(c.S, g.mes) || g.estado === L.ESTADO.ANUL);
        aplicarSquircle(box);
        box.querySelectorAll('input[data-file="ev"]').forEach(alElegirFoto);
      };
      evid.pendiente(g.id).then((p) => {
        if (!g.evidencia_id && !p) return;
        e.evPend = p;
        pintar();
        return evid.obtener(g).then((ev) => { if (ev) { e.evPreview = evid.urlDe(ev); pintar(); } });
      }).catch(() => { e.evError = 'No se pudo traer la foto. Revisa la conexión.'; pintar(); });
    }
  },

  alEscribir(c, f, el, ev) {
    const e = c.estado;
    const ps = L.personas(c.S);
    const ponerValor = (id, v) => { const i = document.querySelector(`[data-f="pct_${id}"]`); if (i && i !== document.activeElement) i.value = v; };
    if (f === 'slider') {
      const [a, b] = ps;
      e['pct_' + a.id] = String(el.value);
      e['pct_' + b.id] = String(100 - Number(el.value));
      ponerValor(a.id, e['pct_' + a.id]); ponerValor(b.id, e['pct_' + b.id]);
      e.rep = 'medida';
    }
    if (f.startsWith('pct_')) {
      e.rep = 'medida';
      // Con dos personas, al escribir el porcentaje de una se completa el de la otra.
      if (ps.length === 2 && String(el.value).trim() !== '') {
        const yo = f.slice(4);
        const otra = ps.find((p) => p.id !== yo);
        const v = np(el.value);
        if (otra) { e['pct_' + otra.id] = String(r2(100 - v)); ponerValor(otra.id, e['pct_' + otra.id]); }
        const sl = document.getElementById('slider');
        if (sl) sl.value = String(Math.round(yo === ps[0].id ? v : 100 - v));
      }
    }
    if (f === 'tc') e.tcManual = true;
    if (f === 'nota') e.notaPropuesta = false;
    limpiarFalta(c, f === 'nota' || f === 'monto' || f === 'tc' ? f : '');
    if (f === 'fecha') {
      if (e.modalidad !== 'Cuotas' || e.planOrig) e.mesInicio = mesDe(e.fecha);
      if (e.moneda === 'USD' && !e.tcManual) e.tc = String(L.tipoCambio(c.S, mesDe(e.fecha)) || '');
      if (e.rep === 'hogar') cargarPcts(c, L.participacion(c.S, mesDe(e.fecha)));
    }
    refrescar(c, { sugs: ev?.type !== 'change' });
  },

  alElegir(c, k) {
    if (k === 'tipo') c.estado.tipoManual = true;
  },

  acciones: {
    listaCat(c) {
      c.preguntar({ titulo: 'Categoría', html: hojaCategorias(c), botones: [], cancelar: 'Cerrar' });
    },
    sugerencia(c, d) {
      const e = c.estado;
      const x = L.sugerenciasDescripcion(c.S, e.nota, { max: 4 })[Number(d.i)];
      if (!x) return;
      e.nota = x.nota;
      e.notaPropuesta = false;
      if (x.categoria_id) { e.categoria_id = x.categoria_id; if (!e.tipoManual) e.tipo = ''; }
      if (e.falta?.campo === 'nota' || e.falta?.campo === 'categoria') e.falta = null;
      c.render();
      setTimeout(() => document.getElementById('monto')?.focus(), 30);
    },
    elegirCat(c, d) {
      const e = c.estado;
      e.categoria_id = d.v;
      if (e.falta?.campo === 'categoria') e.falta = null;
      if (!e.tipoManual) e.tipo = '';
      c.preguntar(null);
    },
    mesReg(c, d) { moverAMes(c, sumarMeses(mesDe(c.estado.fecha), Number(d.d))); },
    mesHoy(c) { moverAMes(c, mesActual()); },
    doble(c, d) {
      const e = c.estado;
      const m = Number(d.v);
      e.dobles = e.dobles.includes(m) ? e.dobles.filter((x) => x !== m) : [...e.dobles, m].sort((a, b) => a - b);
      c.render();
    },
    verEv(c) {
      const e = c.estado;
      const src = e.ev ? evid.urlDe(e.ev) : e.evPreview;
      if (!src) return;
      const g = e.id ? st.fila('Gastos', e.id) : null;
      c.preguntar({ titulo: 'Foto del gasto', html: `<img class="ev-full" src="${src}" alt="Evidencia del gasto">${g?.evidencia_url && !e.ev ? `<a class="btn sec wide" href="${esc(g.evidencia_url)}" target="_blank" rel="noopener">Abrir en Google Drive</a>` : ''}`, botones: [], cancelar: 'Cerrar' });
    },
    quitarEv(c) {
      Object.assign(c.estado, { ev: null, evQuitar: true, evPreview: '', evPend: false });
      c.render();
    },
    moneda(c, d) {
      const e = c.estado;
      e.moneda = d.v || (e.moneda === 'PEN' ? 'USD' : 'PEN');
      if (e.moneda === 'USD' && !e.tc) e.tc = String(L.tipoCambio(c.S, mesDe(e.fecha)) || '');
      c.render();
    },
    pagador(c) {
      const ps = L.personas(c.S);
      const i = ps.findIndex((p) => p.id === c.estado.pagado_por);
      c.estado.pagado_por = ps[(i + 1) % ps.length].id;
      c.render();
    },
    panel(c, d) {
      c.estado.panel = c.estado.panel === d.k ? null : d.k;
      c.render();
    },
    preset(c, d) {
      const e = c.estado;
      const ps = L.personas(c.S);
      if (d.v === 'hogar') { e.rep = 'hogar'; cargarPcts(c, L.participacion(c.S, mesDe(e.fecha))); }
      else if (d.v === 'mitad') { e.rep = 'medida'; cargarPcts(c, Object.fromEntries(ps.map((p) => [p.id, 50]))); }
      else { e.rep = 'medida'; cargarPcts(c, Object.fromEntries(ps.map((p) => [p.id, p.id === d.v ? 100 : 0]))); }
      c.render();
    },
    cuotas(c, d) {
      c.estado.nroCuotas = Math.min(72, Math.max(2, num(c.estado.nroCuotas) + Number(d.d)));
      c.estado.montoCuota = '';
      c.render();
    },
    'nueva-cat'(c) {
      const grupos = L.grupos(c.S);
      c.preguntar({
        titulo: 'Nueva categoría',
        html: `<label class="lbl" for="nc">Nombre</label><input id="nc" name="nombre" class="input" maxlength="40" autocomplete="off">
          <label class="lbl" for="ng">Grupo</label><select id="ng" name="grupo" class="select">${grupos.map((g) => `<option${g.nombre === 'Otros' ? ' selected' : ''}>${esc(g.nombre)}</option>`).join('')}</select>
          <label class="lbl" for="nt">Tipo</label><select id="nt" name="tipo" class="select"><option>Variable</option><option>Fijo</option></select>`,
        botones: [{ l: 'Crear categoría', estilo: 'pri', fn: (c2, v) => {
          const id = ops.guardarCategoria({ nombre: v.nombre, grupo: v.grupo, tipo: v.tipo, naturaleza: 'Deseo' });
          c2.estado.categoria_id = id;
          c2.render();
          c2.avisar('Categoría creada');
        } }]
      });
    },
    guardar(c) {
      const e = c.estado;
      const monto = parseMonto(e.monto);
      // Validación en línea: se marca el campo que falta, con su mensaje, y se lleva el cursor ahí.
      const falta = faltante(c);
      if (falta) {
        // El mensaje queda junto al campo; VoiceOver lo lee igual.
        e.falta = falta;
        c.render();
        c.anunciar(falta.msg);
        const foco = { nota: 'nota', monto: 'monto', tc: 'tc' }[falta.campo];
        if (foco) document.getElementById(foco)?.focus();
        else document.querySelector('[data-err="categoria"]')?.focus();
        return;
      }
      e.falta = null;
      const pcts = pctsElegidos(c);
      if (pcts && L.sumaPcts(pcts) !== 100) { e.panel = 'reparto'; c.render(); throw new ops.ErrorApp('El reparto debe sumar 100 %.'); }
      if (e.dobles.length && !c.meta.demo && (num(c.meta.schemaServidor) || 3) < 4 && (!e.planOrig || e.dobles.join(',') !== e.planOrig.dobles)) {
        throw new ops.ErrorApp('Las cuotas dobles necesitan el Code.gs de la versión 1.4 o posterior en la hoja. Pide al dueño de la hoja que lo actualice.');
      }
      const f = {
        monto, moneda: e.moneda, tipoCambio: e.moneda === 'USD' ? tcVigente(c) : 1,
        categoria_id: e.categoria_id, pagado_por: e.pagado_por, fecha: e.fecha, nota: ops.limpiarDescripcion(e.nota), tipo: e.tipo || '',
        pcts, repHogar: e.rep === 'hogar', modalidad: e.modalidad,
        nroCuotas: e.nroCuotas, mesInicio: e.mesInicio, montoCuota: parseMonto(e.montoCuota) || 0,
        duracion: e.sinFin === '1' ? 0 : num(e.durN), mesesDobles: e.dobles
      };
      const g = e.id ? st.fila('Gastos', e.id) : null;
      const cat = L.categoria(c.S, e.categoria_id);
      // Aviso de gasto repetido: mismo día, categoría, monto y moneda.
      const iguales = e.id ? [] : ops.gastosIguales(f);
      if (iguales.length && !e.dupOk) {
        const otro = iguales[0];
        const quien = L.persona(c.S, otro.registrado_por || otro.pagado_por);
        c.preguntar({
          titulo: 'Ya hay uno igual',
          html: `<p class="sm">Ya está registrado <strong>«${esc(otro.nota || cat?.nombre || 'Gasto')}»</strong>, ${esc(cat?.nombre || '')}, ${esc(fmt(num(otro.monto), { moneda: otro.moneda || 'PEN' }))}.</p>
            <p class="xs muted">${esc(fechaCorta(otro.fecha))}${quien ? ` · lo registró ${esc(quien.alias || quien.nombre)}` : ''}</p>
            <p class="xs muted">Si es otro gasto, guárdalo igual.</p>`,
          botones: [{ l: 'Guardar igual', estilo: 'pri', fn: (c2) => { c2.estado.dupOk = true; pantalla.acciones.guardar(c2); } }]
        });
        return;
      }
      const nombreFoto = `${e.fecha} ${cat?.nombre || 'gasto'} ${fmt(monto, { moneda: e.moneda })}.jpg`;
      const terminar = (texto, deshacerId = null) => {
        c.setMes(mesDe(e.fecha));
        c.volver('inicio');
        c.avisar(texto, '', deshacerId ? { l: 'Deshacer', fn: (c2) => { ops.deshacer(deshacerId); c2.avisar('Registro deshecho'); } } : null);
      };

      // Un pago único que ahora se repite cada mes o se paga en cuotas.
      if (g && !g.plan_id && e.modalidad !== 'Unico') {
        const planId = ops.convertirEnPlan(g.id, f);
        const gid = L.idGastoDePlan(planId, 0);
        if (e.ev) evid.encolar(gid, e.ev, nombreFoto);
        else if (e.evQuitar) evid.quitar(gid);
        else evid.mover(g.id, gid);
        terminar(e.modalidad === 'Cuotas' ? `Se pasó a ${Math.floor(num(e.nroCuotas))} cuotas` : 'Ahora se repite cada mes');
        return;
      }

      const cambiosPlan = cambiosDePlan(e);
      const hacer = (alcance) => {
        const id = ops.guardarGasto(f, { id: e.id || null, alcance });
        if (g?.plan_id && cambiosPlan) ops.actualizarPlan(g.plan_id, cambiosPlan, g.mes, { excluir: Math.abs(monto - num(g.monto)) > 0.004 ? g.id : null });
        // La foto se une al gasto (en cuotas o cada mes, a la primera cuota).
        const gid = !e.id && (e.modalidad === 'Cuotas' || e.modalidad === 'Recurrente') ? L.idGastoDePlan(id, 0) : (e.id || id);
        if (e.ev) evid.encolar(gid, e.ev, nombreFoto);
        else if (e.evQuitar && e.id) evid.quitar(e.id);
        const n = Math.floor(num(e.nroCuotas));
        const texto = e.id ? (cambiosPlan?.terminar ? 'Listo: deja de repetirse después de este mes' : 'Cambios guardados')
          : e.modalidad === 'Cuotas' ? `Se programaron ${n} cuotas` : e.modalidad === 'Recurrente' ? 'Gasto mensual programado' : 'Gasto guardado';
        terminar(texto, e.id ? null : id);
      };
      const cambioDelGasto = g && (Math.abs(monto - num(g.monto)) > 0.004 || g.categoria_id !== e.categoria_id || g.pagado_por !== e.pagado_por
        || g.moneda !== e.moneda || (g.nota || '') !== f.nota || e.rep !== 'hogar');
      if (g?.plan_id && g.estado === L.ESTADO.PROG && cambioDelGasto) {
        c.preguntar({ titulo: '¿A qué gastos aplica el cambio?', texto: 'Este gasto es parte de un plan de cuotas o mensual.', botones: [
          { l: 'Solo a este', estilo: 'sec', fn: () => hacer('este') },
          { l: 'A este y los siguientes', estilo: 'pri', fn: () => hacer('siguientes') }
        ] });
        return;
      }
      hacer('este');
    },
    confirmar(c) {
      ops.confirmarGasto(c.estado.id, parseMonto(c.estado.monto), c.estado.moneda === 'USD' ? tcVigente(c) : null);
      c.volver('gastos');
      c.avisar('Gasto confirmado');
    },
    anular(c) {
      const g = st.fila('Gastos', c.estado.id);
      const fin = (alcance) => { ops.anularGasto(g.id, alcance); c.volver('gastos'); c.avisar('Gasto anulado'); };
      if (g.plan_id) {
        c.preguntar({ titulo: 'Anular gasto', texto: 'Es parte de un plan. ¿Anulas solo este o también los programados que siguen?', botones: [
          { l: 'Solo este', estilo: 'sec', fn: () => fin('este') },
          { l: 'Este y los siguientes', estilo: 'danger', fn: () => fin('siguientes') }
        ] });
      } else {
        c.preguntar({ titulo: 'Anular gasto', texto: 'Deja de contar en los totales, pero queda en la hoja como anulado.', botones: [{ l: 'Anular', estilo: 'danger', fn: () => fin('este') }] });
      }
    }
  }
};

export default pantalla;

/** Contenido del panel de modalidad: al registrar, o al editar un gasto suelto, mensual o en cuotas. */
function panelModo(c, g, plan, tipoEf) {
  const e = c.estado;
  const tipo = `<div class="frow"><span class="muted">Tipo</span>${segmentado('tipo', [{ v: 'Fijo', l: 'Fijo' }, { v: 'Variable', l: 'Variable' }], tipoEf, 'Tipo de gasto')}</div>`;
  if (plan && plan.modalidad === 'Recurrente') {
    const n = difMeses(plan.mes_inicio, g.mes) + 1;
    return `<p class="sm">Gasto mensual desde ${esc(nombreMes(plan.mes_inicio).toLowerCase())}. Este es el mes ${n}.</p>
      ${segmentado('repite', [{ v: '1', l: 'Sigue cada mes' }, { v: '0', l: 'Termina este mes' }], e.repite, 'Repetición')}
      ${e.repite === '0' ? '<p class="xs muted">Se anulan los meses programados que siguen. Este gasto se mantiene.</p>' : `
        ${segmentado('sinFin', [{ v: '1', l: 'Sin fin' }, { v: '0', l: 'Por meses' }], e.sinFin, 'Duración')}
        ${e.sinFin === '0' ? `<label class="frow"><span class="muted">Meses en total, desde el inicio</span><input class="inl" data-f="durN" inputmode="numeric" value="${esc(e.durN)}"></label>` : ''}
        ${doblesHtml(e, 'Se aplica desde este mes.')}`}
      <p class="xs muted">Para cambiar el monto de los meses que siguen, cámbialo arriba y elige «A este y los siguientes» al guardar.</p>
      ${tipo}`;
  }
  if (plan && plan.modalidad === 'Cuotas') {
    return `<p class="sm">Cuota ${esc(g.nro_cuota)} de ${esc(plan.nro_cuotas)} · total ${esc(fmt(plan.monto_total, { moneda: plan.moneda }))}.</p>
      ${doblesHtml(e, 'Lo que falta pagar se reparte de nuevo desde este mes.')}
      ${tipo}`;
  }
  return `${segmentado('modalidad', [{ v: 'Unico', l: 'Pago único' }, { v: 'Cuotas', l: 'En cuotas' }, { v: 'Recurrente', l: 'Cada mes' }], e.modalidad, 'Modalidad')}
    ${g && e.modalidad !== 'Unico' ? `<p class="xs muted">Este gasto pasa a ser ${e.modalidad === 'Cuotas' ? 'la primera cuota' : 'el primer mes'} del plan, con su foto.</p>` : ''}
    ${e.modalidad === 'Cuotas' ? `
      <div class="frow"><span class="muted">Cuotas</span>
        <span class="stepper"><button type="button" class="btn-ic" data-a="cuotas" data-d="-1" aria-label="Menos cuotas">−</button><strong>${e.nroCuotas}</strong><button type="button" class="btn-ic" data-a="cuotas" data-d="1" aria-label="Más cuotas">+</button></span></div>
      <label class="frow"><span class="muted">Primera cuota</span><input type="month" class="inl" data-f="mesInicio" data-r value="${esc(e.mesInicio)}"></label>
      <label class="frow"><span class="muted">Cuota con intereses</span><input class="inl" data-f="montoCuota" inputmode="decimal" placeholder="Opcional" value="${esc(e.montoCuota)}"></label>
      ${doblesHtml(e)}
      <div id="cuotas">${cuotasHtml(c)}</div>` : ''}
    ${e.modalidad === 'Recurrente' ? `
      ${segmentado('sinFin', [{ v: '1', l: 'Sin fin' }, { v: '0', l: 'Por meses' }], e.sinFin, 'Duración')}
      ${e.sinFin === '0' ? `<label class="frow"><span class="muted">Meses</span><input class="inl" data-f="durN" inputmode="numeric" value="${esc(e.durN)}"></label>` : ''}
      ${doblesHtml(e)}
      <div id="recInfo">${recurrenteHtml(c)}</div>` : ''}
    ${tipo}`;
}
