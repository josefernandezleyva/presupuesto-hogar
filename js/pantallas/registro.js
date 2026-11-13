// Registrar o editar un gasto (3.1, como el prototipo): monto primero, descripción, categoría en chips
// y una tarjeta de filas: fecha, mes, quién pagó, reparto, cómo se paga, si ya se pagó y el comprobante.
// La descripción se guarda en la columna «nota» de Gastos (la misma de siempre; la hoja no cambia).

import * as L from '../logic.js';
import * as ops from '../ops.js';
import * as st from '../store.js';
import { esc, hoy, mesActual, mesDe, parseMonto, r2, num, fmt, fmt0, pct, nombreMes, sumarMeses, fechaCorta, diasEnMes, difMeses, SIMBOLO } from '../util.js';
import { encabezado, segmentado, alerta, avatar, icono } from '../ui.js';
import * as evid from '../evidencia.js';
import { aplicarSquircle } from '../squircle.js';
import { mensajeError } from '../api.js';
import { puntoCat, pedirAnular } from './comun.js';

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
    // 2.1: un gasto nuevo siempre empieza con la fecha de hoy (aunque se esté mirando otro mes); se cambia en «Fecha».
    fecha: /^\d{4}-\d{2}-\d{2}$/.test(c.query.fecha || '') ? c.query.fecha : hoy(), nota: '', tipo: '',
    rep: 'hogar', modalidad: 'Unico', nroCuotas: 3, mesInicio: '', montoCuota: '', sinFin: '1', durN: '12', dobles: [],
    diaModo: 'fecha', diaN: '', panel: null
  });
  e.mesInicio = mesDe(e.fecha);
  e.pagado = e.fecha > hoy() ? '0' : '1';
  e.pagadoManual = false;
  // 2.0 · «Registrar otro igual»: copia descripción, monto, moneda, categoría y quién pagó (la fecha es hoy).
  const base = c.query.copia ? st.fila('Gastos', c.query.copia) : null;
  if (base) Object.assign(e, { nota: base.nota || '', monto: String(base.monto || ''), moneda: base.moneda || 'PEN', categoria_id: base.categoria_id, pagado_por: base.pagado_por || e.pagado_por, dupOk: false });
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
    dobles: plan ? L.mesesDobles(plan) : [], repite: '1', panel: null,
    // 3.3: día de cada mes (31 = fin de mes) y último mes del gasto mensual.
    diaModo: plan && num(plan.dia) >= 31 ? 'fin' : 'otro', diaN: String(plan ? (num(plan.dia) || Number(g.fecha.slice(8, 10))) : ''),
    planIni: plan?.mes_inicio || '', hasta: plan && num(plan.duracion_meses) ? sumarMeses(plan.mes_inicio, num(plan.duracion_meses) - 1) : sumarMeses(g.mes, 5)
  });
  e.planOrig = plan ? { sinFin: e.sinFin, durN: e.durN, hasta: e.hasta, dobles: e.dobles.join(','), dia: num(plan.dia) || Number(g.fecha.slice(8, 10)) } : null;
  e.pagado = g.estado === L.ESTADO.CONF ? '1' : '0';
  e.pagadoOrig = e.pagado;
  e.pagadoManual = true;
  const pcts = L.pctsDeGasto(S, g);
  const hogar = L.participacion(S, g.mes);
  const igual = (a, b) => L.personas(S, { todas: true }).every((p) => num(a[p.id]) === num(b[p.id]));
  e.rep = igual(pcts, hogar) ? 'hogar' : 'medida';
  cargarPcts(c, pcts);
  // 3.3: para saber si cambió el reparto al guardar.
  e.repOrig = e.rep;
  e.pctsOrig = { ...pcts };
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
    // 3.3: al editar, la duración se elige con el último mes («Hasta»).
    else if (e.sinFin !== e.planOrig.sinFin || (e.sinFin === '0' && e.hasta !== e.planOrig.hasta)) out.duracion = e.sinFin === '1' ? 0 : difMeses(e.planIni, e.hasta) + 1;
    if (diaEfectivo(e) !== e.planOrig.dia) out.dia = diaEfectivo(e);
  }
  return Object.keys(out).length ? out : null;
}

/** 3.3 · Día de cada mes elegido para un gasto mensual (31 = fin de mes). */
function diaEfectivo(e) {
  if (e.diaModo === 'fin') return 31;
  if (e.diaModo === 'otro') return Math.min(31, Math.max(1, Math.floor(num(e.diaN)) || Number(e.fecha.slice(8, 10))));
  return Number(e.fecha.slice(8, 10));
}

/** 3.3 · Las próximas fechas de un mensual, para ver cómo cae el día (30 nov, 31 dic, 28 feb…). */
function proximasFechas(e, desde, n = 4) {
  const d = diaEfectivo(e);
  return Array.from({ length: n }, (_, i) => fechaCorta(L.fechaEnMes(sumarMeses(desde, i), d))).join(' · ');
}

/** 3.3 · Selector del día de cada mes: el de la fecha, otro día o fin de mes. */
function diaHtml(e, edit) {
  const dFecha = Number(e.fecha.slice(8, 10));
  const ops3 = edit ? [{ v: 'otro', l: 'Un día fijo' }, { v: 'fin', l: 'Fin de mes' }] : [{ v: 'fecha', l: `El ${dFecha}` }, { v: 'otro', l: 'Otro día' }, { v: 'fin', l: 'Fin de mes' }];
  return `<div class="lbl">Día de cada mes</div>${segmentado('diaModo', ops3, e.diaModo, 'Día de cada mes')}
    ${e.diaModo === 'otro' ? `<label class="frow"><span class="muted">Día (1 a 31)</span><input class="inl" data-f="diaN" inputmode="numeric" enterkeyhint="done" value="${esc(e.diaN || dFecha)}" aria-label="Día de cada mes"></label>` : ''}
    <p class="xs muted" id="diaInfo">${diaInfo(e)}</p>`;
}

function diaInfo(e) {
  const d = diaEfectivo(e);
  const desde = e.planIni && e.id ? mesDe(e.fecha) : mesDe(e.fecha);
  return `${d >= 31 ? 'El último día de cada mes' : d >= 29 ? `El ${d} (en meses más cortos, su último día)` : `El ${d} de cada mes`}. Próximas fechas: ${esc(proximasFechas(e, desde))}.`;
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

/** 3.2 · Monto 0 permitido solo en gastos mensuales que siguen por pagar (nuevos o una mensualidad por pagar). */
function permiteSinMonto(c) {
  const e = c.estado;
  if (e.modalidad !== 'Recurrente') return false;
  const g = e.id ? st.fila('Gastos', e.id) : null;
  return !g || g.estado !== L.ESTADO.CONF || e.pagado === '0';
}

/** Validación en línea: el primer dato que falta, con el campo que lo marca. */
function faltante(c) {
  const e = c.estado;
  if (!ops.limpiarDescripcion(e.nota)) return { campo: 'nota', msg: 'Escribe una descripción.' };
  // 3.2: un gasto mensual puede quedar sin monto (S/ 0) como recordatorio; se completa cuando llega el recibo.
  if (!(parseMonto(e.monto) > 0) && !permiteSinMonto(c)) return { campo: 'monto', msg: e.modalidad === 'Recurrente' ? 'Escribe el monto. Si aún no lo sabes, déjalo en 0: queda por pagar.' : 'Escribe el monto.' };
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

/** 2.4 · Cuánto le toca a cada uno de este gasto, siempre a la vista y al día mientras se escribe el monto. */
function repResumenHtml(c) {
  const { S, estado: e, meta } = c;
  const ps = L.personas(S);
  if (ps.length < 2) return '';
  const soles = solesDelMes(c);
  const p = pctsActuales(c);
  if (L.sumaPcts(p) !== 100) return `<p class="bad-t xs">El reparto suma ${L.sumaPcts(p)} %; debe ser 100 %.</p>`;
  const filas = L.calcularReparto(soles, p);
  const monto = (id) => filas.find((r) => r.persona_id === id)?.monto_soles || 0;
  const conMonto = soles > 0;
  const nuevoPlan = !e.id || !e.planOrig;
  const cuando = e.modalidad === 'Cuotas' ? (nuevoPlan ? ' · primera cuota' : ' · esta cuota') : e.modalidad === 'Recurrente' ? ' · cada mes' : '';
  const corto = (x) => esc(x.alias || x.nombre.split(' ')[0]) + (x.id === meta.personaId ? ' <span class="muted">(tú)</span>' : '');
  const conParte = ps.filter((x) => num(p[x.id]) > 0);
  const barra = `<div class="rr-bar" aria-hidden="true">${conParte.map((x) => `<span style="flex:${num(p[x.id])};background:${esc(x.color || '#888')}"></span>`).join('')}</div>`;
  const celdas = ps.map((x) => `<div class="rr-p${num(p[x.id]) > 0 ? '' : ' cero'}">
      <span class="rr-n">${avatar(x, 20)} ${corto(x)}</span>
      <span class="rr-m num">${conMonto ? esc(fmt(monto(x.id))) : 'S/ —'}</span>
      <span class="rr-pct">${Number(num(p[x.id]).toFixed(2))} %</span>
    </div>`).join('');
  // Quién pagó y qué parte de la otra persona pasa a las cuentas del mes.
  const pagador = L.persona(S, e.pagado_por);
  const ajenas = conMonto && pagador ? filas.filter((r) => r.persona_id !== pagador.id && r.monto_soles > 0) : [];
  let pie = '';
  if (!conMonto) pie = 'Escribe el monto para ver cuánto le toca a cada uno.';
  else if (ajenas.length) {
    const quienes = ajenas.map((r) => { const x = L.persona(S, r.persona_id); return `${esc(x?.alias || x?.nombre.split(' ')[0] || '')} (${esc(fmt(r.monto_soles))})`; }).join(' y ');
    pie = e.pagado === '1'
      ? `Pagó ${esc(pagador.alias || pagador.nombre.split(' ')[0])}: lo que le toca a ${quienes} se suma a las cuentas entre ustedes.`
      : `Al marcarlo como pagado, lo que le toca a ${quienes} se sumará a las cuentas entre ustedes.`;
  } else pie = `Lo pagó quien lo asume: no cambia las cuentas entre ustedes.`;
  const vig = L.vigencia(S, mesDe(e.fecha));
  const origen = e.rep === 'hogar'
    ? `Como el hogar · participación ${vig.desde && vig.desde <= mesDe(e.fecha) ? `vigente desde ${esc(nombreMes(vig.desde).toLowerCase())}` : 'la primera registrada'}`
    : 'Reparto propio de este gasto';
  return `<button type="button" class="reparto-res rr31" data-a="panel" data-k="reparto" aria-label="Le toca a cada uno. Toca para cambiar el reparto" ${c.estado.bloqueado ? 'disabled' : ''}>
    <span class="rr-h"><span class="lbl">Le toca a cada uno${cuando}</span><span class="rr-cambiar">Cambiar ${icono('adelante', 14)}</span></span>
    ${barra}
    <span class="rr-cols${ps.length > 2 ? ' muchas' : ''}">${celdas}</span>
    <span class="rr-pie xs">${pie}</span>
    <span class="rr-vig xs">${origen}</span>
  </button>`;
}

/** 3.0 · Las 4 categorías más usadas en los últimos 90 días (atajos con su ícono). */
function frecuentes(S) {
  const desde = new Date(Date.now() - 90 * 864e5).toISOString().slice(0, 10);
  const cuenta = new Map();
  S.Gastos.forEach((g) => { if (g.estado !== L.ESTADO.ANUL && g.fecha >= desde && g.categoria_id) cuenta.set(g.categoria_id, (cuenta.get(g.categoria_id) || 0) + 1); });
  const activas = new Set(L.categorias(S).map((x) => x.id));
  const top = [...cuenta.entries()].filter(([id]) => activas.has(id)).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([id]) => L.categoria(S, id));
  return top.length >= 2 ? top : [];
}

/** 3.1 · Categoría como en el prototipo: la elegida y las frecuentes como chips, y «Todas…» abre la lista completa. */
function catFilaHtml(c, catSel, dis) {
  const { S, estado: e } = c;
  const top = e.bloqueado ? [] : frecuentes(S);
  const lista = catSel && !top.some((x) => x.id === catSel.id) ? [catSel, ...top] : top;
  const chips = lista.map((x) => {
    const on = e.categoria_id === x.id;
    return `<button type="button" class="chip${on ? ' on' : ''}" data-a="catFrecuente" data-v="${esc(x.id)}" aria-pressed="${on}" ${dis}>${puntoCat(x)} ${esc(x.nombre)}</button>`;
  }).join('');
  const todas = e.bloqueado ? '' : `<button type="button" class="chip campo-cat${lista.length ? '' : ' vacio'}" data-a="listaCat" aria-haspopup="dialog"${invalido(e, 'categoria')}>${lista.length ? 'Todas…' : `${icono('lista', 16)} Elegir categoría`}</button>`;
  return `<div class="cat-frec" role="group" aria-labelledby="cat-l">${chips}${todas}</div>
    ${catSel && catSel.grupo ? `<span class="xs muted cat-grupo">${esc(catSel.nombre)} · ${esc(catSel.grupo)}</span>` : ''}`;
}

/** Texto de la fila «Se paga». */
function modoTexto(c, g, plan) {
  const e = c.estado;
  if (e.modalidad === 'Cuotas') return plan ? `Cuota ${g.nro_cuota} de ${plan.nro_cuotas}` : `En ${e.nroCuotas} cuotas`;
  if (e.modalidad === 'Recurrente') return e.repite === '0' ? 'Termina este mes' : 'Cada mes';
  return 'Una sola vez';
}

/* 3.1 · Reparto, modalidad y quién pagó se eligen en hojas que suben desde abajo (antes, paneles en la página). */
const TITULO_PANEL = { reparto: '¿Cómo se reparte?', modo: '¿Cómo se paga?', pago: '¿Quién pagó?' };

function abrirPanel(c, k) {
  const e = c.estado;
  if (e.bloqueado) return;
  e.panel = k;
  c.preguntar({ titulo: TITULO_PANEL[k], get html() { return panelHtml(c, k); }, botones: [], cancelar: 'Listo' });
}

function panelHtml(c, k) {
  const { S, estado: e } = c;
  const ps = L.personas(S);
  const mes = mesDe(e.fecha);
  if (k === 'pago') {
    return `<div class="op31">${ps.map((p) => `<button type="button" class="op31-b${p.id === e.pagado_por ? ' on' : ''}" data-a="elegirPagador" data-v="${esc(p.id)}" aria-pressed="${p.id === e.pagado_por}">${avatar(p, 36)}<span class="grow b">${esc(p.nombre)}</span>${p.id === e.pagado_por ? icono('check', 20) : ''}</button>`).join('')}</div>`;
  }
  if (k === 'modo') {
    const g = e.id ? st.fila('Gastos', e.id) : null;
    const plan = g?.plan_id ? L.idx(S).plan.get(g.plan_id) : null;
    const catSel = L.categoria(S, e.categoria_id);
    const m = parseMonto(e.monto);
    const ctx = [e.nota && esc(e.nota), m > 0 && `<b class="num">${esc(fmt(m, { moneda: e.moneda }))}</b>`, catSel && esc(catSel.nombre)].filter(Boolean).join(' · ');
    return `${ctx ? `<p class="sm muted modo-ctx">${ctx}</p>` : ''}<div class="stack modo31">${panelModo(c, g, plan, e.tipo || catSel?.tipo || 'Variable')}</div>`;
  }
  const soles = solesDelMes(c);
  return `${soles > 0 ? `<p class="sm muted">De ${esc(fmt(soles))}, a cada uno le toca:</p>` : ''}
    <div class="chips">
      <button type="button" class="chip${presetActivo(c) === 'hogar' ? ' on' : ''}" data-a="preset" data-v="hogar">Hogar ${L.barrasReparto(S, L.participacion(S, mes))}</button>
      ${ps.map((p) => `<button type="button" class="chip${presetActivo(c) === p.id ? ' on' : ''}" data-a="preset" data-v="${esc(p.id)}">Todo ${esc(p.alias || p.nombre.split(' ')[0])}</button>`).join('')}
      ${ps.length === 2 ? `<button type="button" class="chip${presetActivo(c) === 'mitad' ? ' on' : ''}" data-a="preset" data-v="mitad">50/50</button>` : ''}
    </div>
    ${ps.length === 2
      ? `<label class="sr" for="slider">Porcentaje de ${esc(ps[0].nombre)}</label>
         <input id="slider" type="range" class="slider" min="0" max="100" step="1" data-f="slider" value="${Math.round(np(e['pct_' + ps[0].id]))}">
         <div class="pct-pair">${ps.map((p) => `<label class="pct-box"><span class="sm">${avatar(p, 22)} ${esc(p.alias || p.nombre.split(' ')[0])}</span>
           <span class="pct-w"><input class="inl pct" data-f="pct_${esc(p.id)}" inputmode="decimal" enterkeyhint="done" value="${esc(e['pct_' + p.id])}" aria-label="Porcentaje de ${esc(p.nombre)}"> %</span>
           <span class="pct-m num" id="pm_${esc(p.id)}" aria-live="polite">${montoPctHtml(c, p.id)}</span></label>`).join('')}</div>
         <p class="xs muted">Mueve la barra o escribe el porcentaje de una persona, por ejemplo 66: la otra se completa sola.</p>`
      : ps.map((p) => `<label class="frow"><span>${avatar(p, 22)} ${esc(p.nombre)}</span><span class="pct-w"><input class="inl pct" data-f="pct_${esc(p.id)}" inputmode="decimal" value="${esc(e['pct_' + p.id])}"> %</span></label>`).join('')}
    <div id="repDet" class="stack-sm">${detalleRepartoHtml(c)}</div>
    <p class="rep-info xs" id="repInfo">${infoReparto(c)}</p>`;
}

/** Monto que corresponde a un porcentaje en el panel de reparto («= S/ 120.00»). */
function montoPctHtml(c, id) {
  const soles = solesDelMes(c);
  if (!(soles > 0)) return '<span class="muted">= S/ —</span>';
  const f = L.calcularReparto(soles, pctsActuales(c)).find((r) => r.persona_id === id);
  return '= ' + esc(fmt(f ? f.monto_soles : 0));
}

function detalleRepartoHtml(c) {
  const { S } = c;
  const soles = solesDelMes(c);
  const p = pctsActuales(c);
  const filas = L.calcularReparto(soles, p);
  const suma = L.sumaPcts(p);
  if (L.personas(S).length === 2) return suma === 100 ? '' : `<p class="bad-t xs">Suma ${suma} %; debe ser 100 %.</p>`;
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
  const lista = q.montos.slice(0, 12).map((m, i) => `<li><span class="q31-n">${i + 1}</span><span class="grow">${esc(nombreMes(sumarMeses(ini, i)))}</span><span class="num${Math.abs(m - q.cuota) > 0.004 ? ' b' : ''}">${esc(fmt(m, { moneda: e.moneda }))}</span></li>`).join('');
  return `<p class="sm">${q.n} cuotas de <strong>${esc(fmt(q.cuota, { moneda: e.moneda }))}</strong>${doble}, de ${esc(nombreMes(ini, { corto: true }))} a ${esc(nombreMes(sumarMeses(ini, q.n - 1), { corto: true }))}${Math.abs(q.total - parseMonto(e.monto)) > 0.004 ? ` · total ${esc(fmt(q.total, { moneda: e.moneda }))}` : ''}</p>
    <div class="split vc q31-h"><span class="lbl">Así quedan las cuotas</span><span class="num sm b">Total ${esc(fmt(q.total, { moneda: e.moneda }))}</span></div>
    <ol class="q31">${lista}</ol>${q.n > 12 ? `<p class="xs muted">… y ${q.n - 12} cuotas más.</p>` : ''}
    <p class="xs muted">Después puedes cambiar el total o ajustar cualquier cuota desde el plan.</p>`;
}

function recurrenteHtml(c) {
  const e = c.estado;
  const m = parseMonto(e.monto) || 0;
  const dia = diaEfectivo(e);
  const doble = e.dobles.length && m > 0 ? ` y ${esc(fmt(r2(m * 2), { moneda: e.moneda }))} en ${esc(doblesTexto(e))}` : '';
  const ultimo = e.sinFin === '0' && num(e.durN) > 0 ? ` El último mes es ${esc(nombreMes(sumarMeses(mesDe(e.fecha), num(e.durN) - 1)).toLowerCase())}.` : '';
  return `<p class="muted xs">Queda programado ${dia >= 31 ? 'el último día de cada mes' : `cada mes, el día ${dia}`}${m > 0 ? `: ${esc(fmt(m, { moneda: e.moneda }))}${doble}` : ''}.${ultimo} Cada mes queda por pagar hasta que lo marques como pagado.</p>`;
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

/** Qué significa el estado elegido (y, en un plan nuevo, a qué mes se aplica). */
function pagoInfo(c, plan) {
  const e = c.estado;
  const planNuevo = !e.id && e.modalidad !== 'Unico';
  // 3.2: sin monto no se puede pagar: queda por pagar aunque esté marcado «Pagado».
  if (e.modalidad === 'Recurrente' && !(parseMonto(e.monto) > 0)) return '<b>Sin monto queda por pagar</b>: aparece en Inicio › Pendientes y, al marcarlo como pagado, te pedirá cuánto fue.';
  if (e.pagado === '1') {
    return planNuevo ? 'El primer mes queda pagado; los siguientes, por pagar hasta que los marques.'
      : 'Cuenta en lo gastado del mes y en las cuentas entre ustedes (quién pagó y cuánto le toca a cada uno).';
  }
  return `${planNuevo ? 'Todos los meses quedan por pagar. ' : ''}Queda como recordatorio: aparece en Inicio › Por pagar y en el presupuesto como comprometido, pero no en las cuentas entre ustedes hasta que lo marques como pagado.`;
}

function refrescar(c, { sugs = true } = {}) {
  const set = (id, html) => { const el = document.getElementById(id); if (el) el.innerHTML = html; };
  set('uso', usoHtml(c));
  const conv = document.getElementById('conv');
  if (conv) { const tmp = document.createElement('div'); tmp.innerHTML = tcHtml(c); const n = tmp.querySelector('#conv'); if (n) { conv.className = n.className; conv.innerHTML = n.innerHTML; } }
  set('repDet', detalleRepartoHtml(c));
  // Solo si cambió: al salir del monto (blur) la tarjeta no se reemplaza bajo el dedo y el toque llega.
  { const rr = document.getElementById('repRes'); const h = repResumenHtml(c); if (rr && rr.dataset.h !== h) { rr.innerHTML = h; rr.dataset.h = h; } }
  L.personas(c.S).forEach((x) => set('pm_' + x.id, montoPctHtml(c, x.id)));
  set('cuotas', cuotasHtml(c));
  set('recInfo', recurrenteHtml(c));
  const pr = document.getElementById('pillRep'); if (pr) pr.textContent = etiquetaReparto(c);
  set('repInfo', infoReparto(c));
  set('pagoInfo', pagoInfo(c));
  const sp = document.querySelector('[data-k="pagado"]')?.closest('.seg');
  if (sp) sp.querySelectorAll('button').forEach((b) => { const on = b.dataset.v === c.estado.pagado; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });
  document.querySelector('.pago-card')?.classList.toggle('pagado', c.estado.pagado === '1');
  document.querySelector('.pago-card')?.classList.toggle('por-pagar', c.estado.pagado !== '1');
  // Al salir del campo («change») no se redibujan: el toque sobre una sugerencia debe llegar a su botón.
  if (sugs) set('sugBox', sugerenciasHtml(c));
  const act = presetActivo(c);
  document.querySelectorAll('[data-a="preset"]').forEach((b) => { b.classList.toggle('on', b.dataset.v === act); });
  const g = document.getElementById('btnGuardar'); if (g) g.innerHTML = textoGuardar(c);
  set('diaInfo', diaInfo(c.estado));
  const sm = document.querySelector('.sin-monto-i'); if (sm) sm.textContent = parseMonto(c.estado.monto) > 0 ? 'Monto de cada mes.' : '¿Aún no sabes el monto? Déjalo en 0: queda como recordatorio «por pagar» cada mes y lo completas cuando llegue el recibo.';
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
  if (e.modalidad === 'Recurrente' && !(m > 0)) return 'Guardar recordatorio mensual';
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
    e.bloqueado = !!bloqueado;
    const ps = L.personas(S);
    const pagador = L.persona(S, e.pagado_por);
    const catSel = L.categoria(S, e.categoria_id);
    const dis = bloqueado ? 'disabled' : '';
    const tieneEv = conEvidencia(c, g);
    const nombreCorto = pagador?.alias || pagador?.nombre?.split(' ')[0] || '';
    const flecha = bloqueado ? '' : `<span class="f31-ir" aria-hidden="true">${icono('adelante', 16)}</span>`;
    // 3.1 · Filas de detalle como en el prototipo: etiqueta a la izquierda, valor a la derecha.
    const fila = (k, attrs, v, extra = '') => `<button type="button" class="f31${extra ? ' ' + extra : ''}" ${attrs} ${dis}><span class="f31-k">${k}</span><span class="f31-v">${v}</span>${flecha}</button>`;

    return `<header class="top reg-top">
      <button type="button" class="link reg-cancel" data-a="atras">${bloqueado ? 'Volver' : 'Cancelar'}</button>
      <h1 class="top-t">${edit ? 'Editar gasto' : 'Nuevo gasto'}</h1>
      <span class="reg-top-d"></span>
    </header>
    <main class="pad form has-footer reg31">
      ${cerrado && !bloqueado ? alerta('warn', `${nombreMes(mes)} está cerrado`, edit ? 'No se puede cambiar. El administrador puede reabrirlo en Cuentas.' : 'Cambia la fecha a un mes abierto o pide al administrador que lo reabra.') : ''}
      ${bloqueado ? alerta('warn', anulado ? 'Este gasto está anulado' : `${nombreMes(g.mes)} está cerrado`, anulado ? 'No cuenta en los totales.' : 'Solo se puede ver.') : ''}
      ${plan ? `<p class="muted sm center">${plan.modalidad === 'Cuotas' ? `<a class="link" href="#/plan/${esc(plan.id)}">Cuota ${esc(g.nro_cuota)} de ${esc(plan.nro_cuotas)}</a>` : 'Gasto mensual'} · ${esc(plan.descripcion)} · ${g.estado === L.ESTADO.CONF ? 'Pagado' : g.estado === L.ESTADO.PROG ? 'Por pagar' : esc(g.estado)}</p>` : ''}

      <section class="monto31${e.falta?.campo === 'monto' ? ' error' : ''}" data-err="monto">
        <div class="cur-seg" role="group" aria-label="Moneda">
          <button type="button" class="${e.moneda === 'PEN' ? 'on' : ''}" data-a="moneda" data-v="PEN" aria-pressed="${e.moneda === 'PEN'}" ${dis}>S/</button>
          <button type="button" class="${e.moneda === 'USD' ? 'on' : ''}" data-a="moneda" data-v="USD" aria-pressed="${e.moneda === 'USD'}" ${dis}>US$</button>
        </div>
        <div class="amount">
          <span class="monto-s" aria-hidden="true">${SIMBOLO[e.moneda]}</span>
          <label class="sr" for="monto">${e.modalidad === 'Cuotas' && !plan ? 'Monto total' : 'Monto'}</label>
          <input id="monto" class="monto-i" data-f="monto" data-keep inputmode="decimal" autocomplete="off" enterkeyhint="next" placeholder="0.00" value="${esc(e.monto)}"${invalido(e, 'monto')} ${dis}>
        </div>
        ${e.modalidad === 'Cuotas' && !plan ? '<span class="xs muted">Monto total: se reparte en las cuotas</span>' : ''}
        ${e.modalidad === 'Recurrente' && !bloqueado ? `<span class="xs muted sin-monto-i">${parseMonto(e.monto) > 0 ? 'Monto de cada mes.' : '¿Aún no sabes el monto? Déjalo en 0: queda como recordatorio «por pagar» cada mes y lo completas cuando llegue el recibo.'}</span>` : ''}
      </section>
      ${errorDe(e, 'monto')}
      <div id="tcbox">${tcHtml(c)}</div>
      ${errorDe(e, 'tc')}

      <div class="campo-desc${e.falta?.campo === 'nota' ? ' error' : ''}" data-err="nota">
        <label class="lbl" for="nota">Descripción</label>
        <input id="nota" class="input desc-i" data-f="nota" data-keep maxlength="${ops.MAX_DESCRIPCION}" autocomplete="off" autocapitalize="sentences" enterkeyhint="done" placeholder="¿En qué gastaste? Ej.: Supermercado" value="${esc(e.nota)}" aria-required="true"${invalido(e, 'nota')} ${dis}>
        ${errorDe(e, 'nota')}
        ${e.notaPropuesta && !bloqueado ? '<p class="xs muted">Este gasto no tenía descripción: se propone el nombre de la categoría. Puedes cambiarla.</p>' : ''}
      </div>
      <div id="sugBox">${bloqueado ? '' : sugerenciasHtml(c)}</div>

      <div class="cat31${e.falta?.campo === 'categoria' ? ' error' : ''}" data-err="categoria">
        <span class="lbl" id="cat-l">Categoría</span>
        ${catFilaHtml(c, catSel, dis)}
        ${errorDe(e, 'categoria')}
        <div id="uso">${usoHtml(c)}</div>
      </div>

      <section class="card det31" aria-label="Detalle del gasto">
        <label class="f31 pill-date${bloqueado ? ' off' : ''}"><span class="f31-k">Fecha</span><span class="f31-v">${esc(fechaCorta(e.fecha))}</span>${flecha}
          <input type="date" data-f="fecha" data-r value="${esc(e.fecha)}" aria-label="Fecha del gasto: ${esc(fechaCorta(e.fecha))}. Toca para cambiarla" ${dis}></label>
        <div class="f31 mes31" role="group" aria-label="Mes del gasto">
          <span class="f31-k">Mes</span>
          <span class="mes-reg-c">
            <button type="button" class="btn-ic" data-a="mesReg" data-d="-1" aria-label="Mes anterior" ${dis}>${icono('atras', 20)}</button>
            <span class="mes-reg-t"><strong>${esc(nombreMes(mes))}</strong>${cerrado ? ' <span class="badge">Cerrado</span>' : ''}</span>
            <button type="button" class="btn-ic" data-a="mesReg" data-d="1" aria-label="Mes siguiente" ${dis}>${icono('adelante', 20)}</button>
          </span>
        </div>
        ${!edit && e.fecha !== hoy() ? `<button type="button" class="link f31-hoy" data-a="mesHoy">Usar la fecha de hoy</button>` : ''}
        ${ps.length > 1 ? fila('Pagó', `data-a="${ps.length === 2 ? 'pagador' : 'panel'}" data-k="pago" aria-label="Pagó ${esc(pagador?.nombre || '')}. Toca para cambiar"`,
          `${avatar(pagador, 24)} ${esc(nombreCorto)}${ps.length === 2 && !bloqueado ? ` <span class="f31-cambio">${icono('cambiar', 14)}</span>` : ''}`, 'fila-pago') : ''}
        ${ps.length > 1 ? fila('Reparto', 'data-a="panel" data-k="reparto" aria-haspopup="dialog"', `<span id="pillRep">${esc(etiquetaReparto(c))}</span>`) : ''}
        ${ps.length > 1 ? `<div id="repRes" class="f31-sub">${repResumenHtml(c)}</div>` : ''}
        ${fila('Se paga', 'data-a="panel" data-k="modo" aria-haspopup="dialog"', `${esc(modoTexto(c, g, plan))}${e.dobles.length ? ' <span class="badge soft">×2</span>' : ''}`)}
        ${!anulado ? `<div class="f31 pago-card${e.pagado === '1' ? ' pagado' : ' por-pagar'}">
          <span class="f31-k" id="pago-t">¿Ya se pagó?</span>${segmentado('pagado', [{ v: '1', l: 'Pagado' }, { v: '0', l: 'Por pagar' }], e.pagado, '¿Ya se pagó?')}
        </div>
        <p class="xs muted f31-nota" id="pagoInfo">${pagoInfo(c, plan)}</p>` : ''}
        <label class="f31 pill-file${tieneEv ? ' on' : ''}${bloqueado ? ' off' : ''}"><span class="f31-k">Comprobante</span><span class="f31-v link-t">${tieneEv ? 'Foto lista' : 'Agregar foto'}</span><span class="f31-ir" aria-hidden="true">${icono('foto', 18)}</span>
          <input type="file" accept="image/*" data-file="ev" aria-label="Agregar foto o captura del gasto" ${dis}></label>
      </section>

      <div id="evBox">${evCardHtml(c, g, bloqueado)}</div>

      ${edit && !bloqueado && !cerrado ? `<div class="links">
        <a class="link" href="#/nuevo?copia=${esc(e.id)}">Registrar otro igual</a>
        <button type="button" class="link bad-t" data-a="anular">Anular gasto</button>
      </div>` : ''}
    </main>
    ${!bloqueado && !cerrado ? `<div class="footer"><button type="button" id="btnGuardar" class="btn pri" data-a="guardar">${textoGuardar(c)}</button></div>` : ''}`;
  },

  montar(raiz, c) {
    const e = c.estado;
    // 3.1: en un gasto nuevo el cursor empieza en el monto, que ahora va primero.
    if (!e.id && !e.montado) {
      e.montado = true;
      const d = raiz.querySelector(e.monto ? '#nota' : '#monto');
      // Solo si la persona todavía no tocó otro campo (si ya está escribiendo el monto, no se le quita).
      if (d) setTimeout(() => { const a = document.activeElement; if (!a || a === document.body || a === d || !a.closest?.('main')) d.focus(); }, 60);
    }
    // «Listo» en el teclado de la descripción lo cierra; en el monto, «Siguiente» pasa a la descripción.
    const nota = raiz.querySelector('#nota');
    if (nota && !nota.dataset.enter) {
      nota.dataset.enter = '1';
      nota.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') { ev.preventDefault(); nota.blur(); } });
    }
    const monto = raiz.querySelector('#monto');
    if (monto && !monto.dataset.enter) {
      monto.dataset.enter = '1';
      monto.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') { ev.preventDefault(); raiz.querySelector('#nota')?.focus(); } });
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
      // Mientras la persona no elija, una fecha futura propone «Por pagar» y una de hoy o antes, «Pagado».
      if (!e.pagadoManual) e.pagado = e.fecha > hoy() ? '0' : '1';
      if (e.modalidad !== 'Cuotas' || e.planOrig) e.mesInicio = mesDe(e.fecha);
      if (e.moneda === 'USD' && !e.tcManual) e.tc = String(L.tipoCambio(c.S, mesDe(e.fecha)) || '');
      if (e.rep === 'hogar') cargarPcts(c, L.participacion(c.S, mesDe(e.fecha)));
    }
    refrescar(c, { sugs: ev?.type !== 'change' });
  },

  alElegir(c, k) {
    if (k === 'tipo') c.estado.tipoManual = true;
    if (k === 'pagado') c.estado.pagadoManual = true;
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
      if (!parseMonto(e.monto)) setTimeout(() => document.getElementById('monto')?.focus(), 30);
    },
    elegirCat(c, d) {
      const e = c.estado;
      e.categoria_id = d.v;
      if (e.falta?.campo === 'categoria') e.falta = null;
      if (!e.tipoManual) e.tipo = '';
      c.preguntar(null);
    },
    // 3.0: atajo de una categoría frecuente (lo mismo que elegirla en la lista).
    catFrecuente(c, d) {
      const e = c.estado;
      e.categoria_id = d.v;
      if (e.falta?.campo === 'categoria') e.falta = null;
      if (!e.tipoManual) e.tipo = '';
      c.render();
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
    panel(c, d) { abrirPanel(c, d.k); },
    elegirPagador(c, d) {
      c.estado.pagado_por = d.v;
      c.preguntar(null);
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
      if (pcts && L.sumaPcts(pcts) !== 100) { abrirPanel(c, 'reparto'); throw new ops.ErrorApp('El reparto debe sumar 100 %.'); }
      if (e.dobles.length && !c.meta.demo && (num(c.meta.schemaServidor) || 3) < 4 && (!e.planOrig || e.dobles.join(',') !== e.planOrig.dobles)) {
        throw new ops.ErrorApp('Las cuotas dobles necesitan el Code.gs de la versión 1.4 o posterior en la hoja. Pide al dueño de la hoja que lo actualice.');
      }
      const f = {
        monto, moneda: e.moneda, tipoCambio: e.moneda === 'USD' ? tcVigente(c) : 1,
        categoria_id: e.categoria_id, pagado_por: e.pagado_por, fecha: e.fecha, nota: ops.limpiarDescripcion(e.nota), tipo: e.tipo || '',
        pcts, repHogar: e.rep === 'hogar', modalidad: e.modalidad,
        nroCuotas: e.nroCuotas, mesInicio: e.mesInicio, montoCuota: parseMonto(e.montoCuota) || 0,
        duracion: e.sinFin === '1' ? 0 : num(e.durN), mesesDobles: e.dobles,
        dia: e.modalidad === 'Recurrente' && !e.planOrig ? diaEfectivo(e) : undefined,
        // 3.2: sin monto, siempre queda por pagar (no se puede pagar «nada»).
        estado: e.pagado === '1' && monto > 0 ? L.ESTADO.CONF : L.ESTADO.PROG
      };
      if (!(monto > 0)) e.pagado = '0';
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
        c.avisar(texto, '', deshacerId ? { l: 'Deshacer', fn: (c2) => { ops.deshacer(deshacerId); st.quitarAvisos(deshacerId); c2.avisar('Registro deshecho'); } } : null);
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
      if (e.planOrig && e.modalidad === 'Recurrente' && e.repite !== '0' && e.sinFin === '0' && (!/^\d{4}-\d{2}$/.test(e.hasta || '') || e.hasta < mesDe(e.fecha))) {
        throw new ops.ErrorApp(`El último mes no puede ser anterior a ${nombreMes(mesDe(e.fecha)).toLowerCase()}. Para terminar aquí, elige «Termina en ${nombreMes(mesDe(e.fecha), { anio: false }).toLowerCase()}».`);
      }
      const hacer = (alcance) => {
        const id = ops.guardarGasto(f, { id: e.id || null, alcance });
        // 2.0: un gasto nuevo avisa a la otra persona (viaja con la sincronización).
        if (!e.id) { try { st.encolarAvisos(L.avisosDeRegistro(st.foto(), id, c.meta.personaId)); } catch (err) { console.error(err); } }
        if (g?.plan_id && cambiosPlan) ops.actualizarPlan(g.plan_id, cambiosPlan, g.mes, { excluir: Math.abs(monto - num(g.monto)) > 0.004 ? g.id : null });
        // La foto se une al gasto (en cuotas o cada mes, a la primera cuota).
        const gid = !e.id && (e.modalidad === 'Cuotas' || e.modalidad === 'Recurrente') ? L.idGastoDePlan(id, 0) : (e.id || id);
        if (e.ev) evid.encolar(gid, e.ev, nombreFoto);
        else if (e.evQuitar && e.id) evid.quitar(e.id);
        const n = Math.floor(num(e.nroCuotas));
        const texto = e.id ? (cambiosPlan?.terminar ? 'Listo: deja de repetirse después de este mes' : e.pagado !== e.pagadoOrig ? (e.pagado === '1' ? 'Marcado como pagado' : 'Marcado como por pagar') : 'Cambios guardados')
          : e.modalidad === 'Cuotas' ? `Se programaron ${n} cuotas` : e.modalidad === 'Recurrente' ? (monto > 0 ? 'Gasto mensual programado' : 'Recordatorio mensual sin monto: complétalo cuando llegue el recibo') : e.pagado === '1' ? 'Gasto guardado como pagado' : 'Guardado como por pagar: te lo recordamos en Inicio';
        terminar(texto, e.id ? null : id);
      };
      const cambioDelGasto = g && (Math.abs(monto - num(g.monto)) > 0.004 || g.categoria_id !== e.categoria_id || g.pagado_por !== e.pagado_por
        || g.moneda !== e.moneda || (g.nota || '') !== f.nota
        || e.rep !== e.repOrig || (e.rep !== 'hogar' && L.personas(c.S).some((p) => num(e['pct_' + p.id]) !== num(e.pctsOrig?.[p.id]))));
      // 2.5: en cuotas, al cambiar el monto de una se puede mantener el total repartiendo la diferencia.
      const planG = g?.plan_id ? st.fila('Planes', g.plan_id) : null;
      const cambioMonto = g && Math.abs(monto - num(g.monto)) > 0.004 && g.moneda === e.moneda;
      const compensable = planG?.modalidad === 'Cuotas' && cambioMonto && !ops.previaCuota(g.id, monto, 'compensar').error;
      // 3.3: también en un mes ya pagado se puede aplicar el cambio (por ejemplo, un reparto nuevo) a los que siguen.
      const haySiguientes = !!g?.plan_id && (L.idx(c.S).gastosPorPlan.get(g.plan_id) || []).some((x) => x.estado === L.ESTADO.PROG && num(x.nro_cuota) > num(g.nro_cuota) && !L.mesCerrado(c.S, x.mes));
      if (g?.plan_id && (g.estado === L.ESTADO.PROG || compensable || haySiguientes) && cambioDelGasto) {
        const botones = planG?.modalidad === 'Cuotas' && cambioMonto
          ? [{ l: 'Solo esta cuota (cambia el total)', estilo: 'sec', fn: () => hacer('este') },
            ...(compensable ? [{ l: 'Mantener el total (repartir la diferencia en las que siguen)', estilo: 'pri', fn: () => { ops.ajustarCuota(g.id, monto, 'compensar'); hacer('este'); } }] : []),
            ...(g.estado === L.ESTADO.PROG ? [{ l: 'Mismo monto en esta y las siguientes', estilo: 'sec', fn: () => hacer('siguientes') }] : [])]
          : [{ l: `Solo ${nombreMes(g.mes, { anio: false }).toLowerCase()}`, estilo: 'sec', fn: () => hacer('este') },
            ...(haySiguientes || g.estado === L.ESTADO.PROG ? [{ l: `${nombreMes(g.mes, { anio: false })} y los meses siguientes`, estilo: 'pri', fn: () => hacer('siguientes') }] : [])];
        const repCambio = e.repOrig !== undefined && (e.rep !== e.repOrig || L.personas(c.S).some((p) => num(e['pct_' + p.id]) !== num(e.pctsOrig?.[p.id])));
        c.preguntar({ titulo: '¿A qué meses aplica el cambio?', texto: planG?.modalidad === 'Cuotas' && cambioMonto
          ? `La cuota ${g.nro_cuota} pasa de ${fmt(num(g.monto), { moneda: g.moneda })} a ${fmt(monto, { moneda: g.moneda })}.`
          : repCambio ? `Cambiaste el reparto. Con «${nombreMes(g.mes, { anio: false })} y los meses siguientes», los meses anteriores conservan su reparto y los que vienen usan el nuevo.`
            : 'Este gasto es parte de un plan de cuotas o mensual. Los meses anteriores no cambian.', botones });
        return;
      }
      hacer('este');
    },
    // 3.2: misma confirmación que en el resto de la app; al anular vuelve a Gastos.
    anular(c) { pedirAnular(c, c.estado.id, { despues: (c2) => c2.volver('gastos') }); }
  }
};

export default pantalla;

/** Contenido del panel de modalidad: al registrar, o al editar un gasto suelto, mensual o en cuotas. */
function panelModo(c, g, plan, tipoEf) {
  const e = c.estado;
  const tipo = `<div class="frow"><span class="muted">Tipo</span>${segmentado('tipo', [{ v: 'Fijo', l: 'Fijo' }, { v: 'Variable', l: 'Variable' }], tipoEf, 'Tipo de gasto')}</div>`;
  if (plan && plan.modalidad === 'Recurrente') {
    const n = difMeses(plan.mes_inicio, g.mes) + 1;
    const mesG = nombreMes(g.mes, { anio: false }).toLowerCase();
    const siguen = (L.idx(c.S).gastosPorPlan.get(plan.id) || []).filter((x) => x.estado === L.ESTADO.PROG && x.mes > g.mes && !L.mesCerrado(c.S, x.mes)).length;
    return `<p class="sm">Gasto mensual desde ${esc(nombreMes(plan.mes_inicio).toLowerCase())}${num(plan.duracion_meses) ? ` hasta ${esc(nombreMes(sumarMeses(plan.mes_inicio, num(plan.duracion_meses) - 1)).toLowerCase())}` : ', sin fin'}. Este es el mes ${n}.</p>
      ${segmentado('repite', [{ v: '1', l: 'Sigue cada mes' }, { v: '0', l: `Termina en ${mesG}` }], e.repite, 'Repetición')}
      ${e.repite === '0' ? `<p class="xs muted">${esc(nombreMes(g.mes))} queda como el último mes. ${siguen ? `Se anulan ${siguen === 1 ? 'el mes programado que sigue' : `los ${siguen} meses programados que siguen`}; si cambias de idea, vuelve a ponerlo «Sin fin» o restáuralos en Gastos anulados.` : 'No hay meses programados después.'}</p>` : `
        <div class="lbl">¿Hasta cuándo?</div>
        ${segmentado('sinFin', [{ v: '1', l: 'Sin fin' }, { v: '0', l: 'Hasta un mes' }], e.sinFin, 'Duración')}
        ${e.sinFin === '0' ? `<label class="frow"><span class="muted">Último mes</span><input type="month" class="inl" data-f="hasta" data-r min="${esc(g.mes)}" value="${esc(e.hasta)}" aria-label="Último mes del gasto mensual"></label>` : ''}
        ${diaHtml(e, true)}
        ${doblesHtml(e, 'Se aplica desde este mes.')}`}
      <p class="xs muted">Para cambiar el monto de los meses que siguen, cámbialo arriba y elige «A este y los siguientes» al guardar.</p>
      ${tipo}`;
  }
  if (plan && plan.modalidad === 'Cuotas') {
    return `<p class="sm">Cuota ${esc(g.nro_cuota)} de ${esc(plan.nro_cuotas)} · total ${esc(fmt(plan.monto_total, { moneda: plan.moneda }))}.</p>
      <a class="btn sec plan-link" href="#/plan/${esc(plan.id)}">${icono('lista', 18)} Ver y ajustar todas las cuotas</a>
      <p class="xs muted">Ahí puedes cambiar el total y repartirlo entre las cuotas por pagar, ajustar una cuota (aunque ya esté pagada) o agregar una cuota de ajuste.</p>
      ${doblesHtml(e, 'Lo que falta pagar se reparte de nuevo desde este mes.')}
      ${tipo}`;
  }
  return `${segmentado('modalidad', [{ v: 'Unico', l: 'Una vez' }, { v: 'Cuotas', l: 'En cuotas' }, { v: 'Recurrente', l: 'Cada mes' }], e.modalidad, 'Modalidad')}
    ${g && e.modalidad !== 'Unico' ? `<p class="xs muted">Este gasto pasa a ser ${e.modalidad === 'Cuotas' ? 'la primera cuota' : 'el primer mes'} del plan, con su foto.</p>` : ''}
    ${e.modalidad === 'Cuotas' ? `
      <div class="frow"><span class="muted">Cuotas</span>
        <span class="stepper"><button type="button" class="btn-ic" data-a="cuotas" data-d="-1" aria-label="Menos cuotas">−</button><strong>${e.nroCuotas}</strong><button type="button" class="btn-ic" data-a="cuotas" data-d="1" aria-label="Más cuotas">+</button></span></div>
      <label class="frow"><span class="muted">Primera cuota</span><input type="month" class="inl" data-f="mesInicio" data-r value="${esc(e.mesInicio)}"></label>
      <label class="frow"><span class="muted">Cuota con intereses</span><input class="inl" data-f="montoCuota" inputmode="decimal" placeholder="Opcional" value="${esc(e.montoCuota)}"></label>
      ${doblesHtml(e)}
      <div id="cuotas" class="stack-sm">${cuotasHtml(c)}</div>` : ''}
    ${e.modalidad === 'Recurrente' ? `
      ${diaHtml(e, false)}
      <div class="lbl">¿Hasta cuándo?</div>
      ${segmentado('sinFin', [{ v: '1', l: 'Sin fin' }, { v: '0', l: 'Por meses' }], e.sinFin, 'Duración')}
      ${e.sinFin === '0' ? `<label class="frow"><span class="muted">Meses</span><input class="inl" data-f="durN" inputmode="numeric" value="${esc(e.durN)}"></label>` : ''}
      ${doblesHtml(e)}
      <div id="recInfo">${recurrenteHtml(c)}</div>` : ''}
    ${tipo}`;
}
