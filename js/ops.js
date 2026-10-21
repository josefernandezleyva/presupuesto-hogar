// Operaciones que escriben datos: cada una valida las reglas y guarda en la copia local.

import * as st from './store.js';
import * as L from './logic.js';
import { uuid, r2, num, mesDe, mesActual, hoy, sumarMeses, difMeses, norm } from './util.js';

const { ESTADO } = L;
const S = () => st.foto();
const quien = () => st.getMeta().personaId;
const ANTIGUO = '2000-01-01T00:00:00.000Z';

export class ErrorApp extends Error {}
const falla = (m) => { throw new ErrorApp(m); };

export const COLORES = ['#2F5D8A', '#B4532A', '#6B4FA0', '#2E7D6B', '#A23B72', '#8A6D1F', '#3D6E3A', '#5E5A54'];

export const CATEGORIAS_INICIALES = [
  ['Energía eléctrica', 'Vivienda y servicios', 'Fijo', 'Necesidad'],
  ['Agua', 'Vivienda y servicios', 'Fijo', 'Necesidad'],
  ['Gas', 'Vivienda y servicios', 'Fijo', 'Necesidad'],
  ['Internet y telefonía', 'Vivienda y servicios', 'Fijo', 'Necesidad'],
  ['Comida', 'Alimentación', 'Variable', 'Necesidad'],
  ['Taxi y movilidad', 'Transporte', 'Variable', 'Necesidad'],
  ['Salud', 'Salud y educación', 'Variable', 'Necesidad'],
  ['Educación', 'Salud y educación', 'Fijo', 'Necesidad'],
  ['Streaming', 'Ocio y suscripciones', 'Fijo', 'Deseo'],
  ['Diversión', 'Ocio y suscripciones', 'Variable', 'Deseo'],
  ['Vestimenta', 'Personal', 'Variable', 'Deseo'],
  ['Ahorro', 'Ahorro', 'Fijo', 'Ahorro'],
  ['Otros gastos', 'Otros', 'Variable', 'Deseo']
];

/* ------------------------------------------------------------ Hogar --- */

/** Primer uso: crea personas (la primera es administradora), participación, categorías y ajustes. */
export function crearHogar({ nombres, pcts, mes = mesActual() }) {
  const limpios = nombres.map((n) => String(n).trim()).filter(Boolean);
  if (limpios.length < 1) falla('Escribe al menos un nombre.');
  if (new Set(limpios.map(norm)).size !== limpios.length) falla('Hay nombres repetidos.');
  if (r2(pcts.reduce((a, b) => a + num(b), 0)) !== 100) falla('La participación debe sumar 100 %.');
  const cambios = [];
  const ids = limpios.map(() => uuid());
  limpios.forEach((nombre, i) => {
    cambios.push(['Personas', { id: ids[i], nombre, alias: '', rol: i === 0 ? 'Administrador' : 'Miembro', color: COLORES[i % COLORES.length], activo: 1, orden: i + 1 }]);
    cambios.push(['Participacion', { id: `PA_${mes}_${ids[i]}`, persona_id: ids[i], porcentaje: num(pcts[i]), vigente_desde: mes }]);
  });
  [...new Set(CATEGORIAS_INICIALES.map((c) => c[1]))].forEach((grupo, i) => {
    cambios.push(['Grupos', { id: L.idGrupo(grupo), nombre: grupo, color: L.colorGrupoInicial(grupo), orden: i + 1, activo: 1 }]);
  });
  CATEGORIAS_INICIALES.forEach(([nombre, grupo, tipo, naturaleza], i) => {
    cambios.push(['Categorias', { id: uuid(), nombre, grupo, tipo, naturaleza, tope_sugerido: 0, activo: 1, orden: i + 1 }]);
  });
  cambios.push(['Config', { id: 'CFG_umbral_alerta', clave: 'umbral_alerta', valor: '80' }]);
  cambios.push(['Config', { id: 'CFG_moneda_base', clave: 'moneda_base', valor: 'PEN' }]);
  st.setMeta({ personaId: ids[0] });
  st.guardar(cambios);
  return ids[0];
}

export function setConfig(clave, valor) {
  st.guardarUno('Config', { id: `CFG_${clave}`, clave, valor: String(valor) });
}

/* ---------------------------------------------------------- Maestros --- */

export function guardarPersona({ id, nombre, alias = '', rol, color, activo = 1 }) {
  nombre = String(nombre || '').trim();
  if (!nombre) falla('Escribe el nombre.');
  if (L.nombreDuplicado(S().Personas, nombre, id)) falla('Ya existe una persona con ese nombre.');
  const nueva = !id;
  const ps = L.personas(S(), { todas: true });
  if (!nueva && rol !== 'Administrador' && L.esAdmin(S(), id) && ps.filter((p) => L.activo(p) && p.rol === 'Administrador').length === 1) {
    falla('Debe quedar al menos un administrador.');
  }
  const row = { id: id || uuid(), nombre, alias, rol: rol || 'Miembro', color: color || COLORES[ps.length % COLORES.length], activo: activo ? 1 : 0 };
  if (nueva) row.orden = ps.length + 1;
  st.guardarUno('Personas', row);
  return row.id;
}

export function guardarCategoria({ id, nombre, grupo, tipo, naturaleza, tope_sugerido = 0, activo = 1 }) {
  nombre = String(nombre || '').trim();
  if (!nombre) falla('Escribe el nombre de la categoría.');
  if (L.nombreDuplicado(S().Categorias, nombre, id)) falla('Ya existe una categoría con ese nombre.');
  const g = L.grupoDe(S(), grupo);
  if (!grupo || !g) falla('Elige un grupo de la lista.');
  const row = { id: id || uuid(), nombre, grupo: g.nombre, tipo: tipo || 'Variable', naturaleza: naturaleza || 'Deseo', tope_sugerido: num(tope_sugerido), activo: activo ? 1 : 0 };
  if (!id) row.orden = S().Categorias.length + 1;
  st.guardarUno('Categorias', row);
  return row.id;
}

/* ------------------------------------------------------------ Grupos --- */

export function guardarGrupo({ id = null, nombre, color = '', activo = 1 }) {
  nombre = String(nombre || '').trim();
  if (!nombre) falla('Escribe el nombre del grupo.');
  const s = S();
  const todos = L.grupos(s, { todas: true });
  const prev = id ? todos.find((g) => g.id === id) : null;
  if (todos.some((g) => g.id !== id && norm(g.nombre) === norm(nombre))) falla('Ya existe un grupo con ese nombre.');
  if (prev && !activo && L.categorias(s).some((c) => norm(c.grupo) === norm(prev.nombre))) falla('Tiene categorías activas: muévelas a otro grupo antes de desactivarlo.');
  let nuevoId = id;
  if (!nuevoId) { nuevoId = L.idGrupo(nombre); if (st.existe('Grupos', nuevoId)) nuevoId = 'G_' + uuid().slice(0, 8); }
  const reales = todos.filter((g) => !g.implicito);
  const row = { id: nuevoId, nombre, color: color || prev?.color || L.COLORES_GRUPO[todos.length % L.COLORES_GRUPO.length], activo: activo ? 1 : 0 };
  if (!prev || prev.implicito) row.orden = reales.length + 1;
  const cambios = [['Grupos', row]];
  // Al renombrar, sus categorías pasan al nombre nuevo.
  if (prev && norm(prev.nombre) !== norm(nombre)) {
    s.Categorias.filter((c) => norm(c.grupo || 'Otros') === norm(prev.nombre)).forEach((c) => cambios.push(['Categorias', { id: c.id, grupo: nombre }]));
  }
  st.guardar(cambios);
  return nuevoId;
}

export function moverGrupo(id, d) {
  const lista = L.grupos(S(), { todas: true }).slice();
  const i = lista.findIndex((g) => g.id === id);
  const j = i + Number(d);
  if (i < 0 || j < 0 || j >= lista.length) return;
  [lista[i], lista[j]] = [lista[j], lista[i]];
  st.guardar(lista.map((g, k) => ['Grupos', { id: g.id, nombre: g.nombre, color: g.color, activo: L.activo(g) ? 1 : 0, orden: k + 1 }]));
}

export function eliminarGrupo(id) {
  const s = S();
  const g = L.grupos(s, { todas: true }).find((x) => x.id === id);
  if (!g) return;
  const n = s.Categorias.filter((c) => norm(c.grupo || 'Otros') === norm(g.nombre)).length;
  if (n) falla(`Tiene ${n} ${n === 1 ? 'categoría' : 'categorías'}: muévelas a otro grupo antes de eliminarlo.`);
  if (st.existe('Grupos', id)) st.eliminar('Grupos', id);
}

/**
 * Crea en la pestaña Grupos los grupos que hasta ahora solo estaban escritos en las categorías
 * (hogares creados antes de la versión 1.4). Con fecha antigua: si otro celular ya los creó, gana el suyo.
 */
export function asegurarGrupos() {
  const s = S();
  if (!s.Categorias.length) return 0;
  const faltan = L.grupos(s, { todas: true }).filter((g) => g.implicito);
  if (!faltan.length) return 0;
  const base = (s.Grupos || []).length;
  st.guardar(faltan.map((g, i) => ['Grupos', { id: g.id, nombre: g.nombre, color: g.color, orden: base + i + 1, activo: 1 }]), { ts: ANTIGUO });
  return faltan.length;
}

/** Nuevos porcentajes desde un mes en adelante (RF-19). */
export function guardarParticipacion(mes, pcts) {
  if (L.sumaPcts(pcts) !== 100) falla('La participación debe sumar 100 %.');
  const cambios = [];
  const ids = new Set([...Object.keys(pcts), ...S().Participacion.filter((p) => p.vigente_desde === mes).map((p) => p.persona_id)]);
  ids.forEach((pid) => cambios.push(['Participacion', { id: `PA_${mes}_${pid}`, persona_id: pid, porcentaje: num(pcts[pid]), vigente_desde: mes }]));
  st.guardar(cambios);
  // Los programados de planes que siguen el reparto del hogar toman los nuevos porcentajes.
  const s = S();
  const otros = [];
  s.Gastos.filter((g) => g.estado === ESTADO.PROG && g.mes >= mes && g.plan_id && !L.mesCerrado(s, g.mes))
    .forEach((g) => {
      const plan = L.idx(s).plan.get(g.plan_id);
      if (plan && !plan.reparto) otros.push(...filasReparto(g, L.participacion(s, g.mes)));
    });
  if (otros.length) st.guardar(otros);
}

export function guardarTipoCambio(mes, valor) {
  const v = num(valor);
  if (!(v > 0)) falla('Escribe un tipo de cambio mayor que cero.');
  st.guardarUno('TiposCambio', { id: `TC_${mes}_USD`, mes, moneda: 'USD', tipo_cambio: v });
}

export function guardarTopes(mes, topes) {
  const cambios = Object.entries(topes).map(([cat, t]) => ['Presupuesto', { id: `P_${mes}_${cat}`, mes, categoria_id: cat, tope_soles: r2(Math.max(0, num(t))) }]);
  if (cambios.length) st.guardar(cambios);
}

export function guardarIngreso(pid, mes, monto, moneda = 'PEN') {
  const m = num(monto);
  if (m < 0) falla('El ingreso no puede ser negativo.');
  const tc = L.tipoCambio(S(), mes, moneda);
  if (!tc) falla('Falta el tipo de cambio del mes para registrar en dólares.');
  st.guardarUno('Ingresos', { id: `I_${mes}_${pid}`, persona_id: pid, mes, monto: m, moneda, monto_soles: r2(m * tc), eliminado: 0 });
}

/** Quita el sueldo registrado en un mes: vuelve a regir el del mes anterior. */
export function quitarIngreso(pid, mes) {
  if (st.existe('Ingresos', `I_${mes}_${pid}`)) st.eliminar('Ingresos', `I_${mes}_${pid}`);
}

/* ------------------------------------------------------------ Gastos --- */

function filasReparto(gasto, pcts) {
  const nuevas = L.calcularReparto(num(gasto.monto_soles), pcts);
  const cambios = nuevas.map((r) => ['GastosReparto', { id: `${gasto.id}_${r.persona_id}`, gasto_id: gasto.id, persona_id: r.persona_id, porcentaje: r.porcentaje, monto_soles: r.monto_soles, eliminado: 0 }]);
  const vigentes = new Set(nuevas.map((r) => r.persona_id));
  S().GastosReparto.filter((r) => r.gasto_id === gasto.id && !vigentes.has(r.persona_id))
    .forEach((r) => cambios.push(['GastosReparto', { id: r.id, porcentaje: 0, monto_soles: 0, eliminado: 1 }]));
  return cambios;
}

function validarBase(f) {
  if (!(num(f.monto) > 0)) falla('Escribe un monto mayor que cero.');
  if (!f.categoria_id) falla('Elige una categoría.');
  if (!f.pagado_por) falla('Elige quién pagó.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(f.fecha || '')) falla('Elige la fecha.');
  if (f.pcts && L.sumaPcts(f.pcts) !== 100) falla('El reparto debe sumar 100 %.');
}

const tc4 = (v) => Math.round(num(v) * 10000) / 10000;

/** Tipo de cambio de un gasto: el que escribió la persona, o el del mes. */
function tcElegido(f, mes) {
  if (f.moneda === 'PEN') return 1;
  if (num(f.tipoCambio) > 0) return tc4(f.tipoCambio);
  return tcPara(mes, f.moneda);
}

function tcPara(mes, moneda) {
  const tc = L.tipoCambio(S(), mes, moneda);
  if (!tc) falla('Falta el tipo de cambio de dólares para ' + mes + '. El administrador lo carga en Más > Tipo de cambio.');
  return tc;
}

/**
 * Guarda un gasto. `f`: { monto, moneda, categoria_id, pagado_por, fecha, nota, tipo, pcts|null,
 * modalidad: 'Unico'|'Cuotas'|'Recurrente', nroCuotas, mesInicio, montoCuota, duracion }.
 * Al editar, `alcance` = 'este' | 'siguientes' para gastos de un plan.
 */
export function guardarGasto(f, { id = null, alcance = 'este' } = {}) {
  validarBase(f);
  const s = S();
  const modalidad = id ? 'Unico' : (f.modalidad || 'Unico');
  if (modalidad === 'Cuotas') return crearCuotas(f);
  if (modalidad === 'Recurrente') return crearRecurrente(f);

  const prev = id ? st.fila('Gastos', id) : null;
  const mes = mesDe(f.fecha);
  if (L.mesCerrado(s, mes)) falla(`${mes} está cerrado. Para cambiarlo, el administrador debe reabrirlo.`);
  if (prev && L.mesCerrado(s, prev.mes)) falla(`${prev.mes} está cerrado. Para cambiarlo, el administrador debe reabrirlo.`);
  const mismoTc = prev && prev.moneda === f.moneda && prev.mes === mes && num(prev.tipo_cambio) > 0;
  const tc = f.moneda === 'PEN' ? 1 : (num(f.tipoCambio) > 0 ? tc4(f.tipoCambio) : (mismoTc ? num(prev.tipo_cambio) : tcPara(mes, f.moneda)));
  const monto = r2(num(f.monto));
  const gasto = {
    id: id || uuid(),
    fecha: f.fecha, mes, monto, moneda: f.moneda, tipo_cambio: tc, monto_soles: r2(monto * tc),
    categoria_id: f.categoria_id, pagado_por: f.pagado_por,
    registrado_por: prev?.registrado_por || quien(),
    tipo: f.tipo || L.categoria(s, f.categoria_id)?.tipo || 'Variable',
    estado: prev ? prev.estado : (f.fecha > hoy() ? ESTADO.PROG : ESTADO.CONF),
    plan_id: prev?.plan_id || '', nro_cuota: prev?.nro_cuota || '', nota: String(f.nota || '').trim()
  };
  const pcts = f.pcts || (prev ? L.pctsDeGasto(s, prev) : L.participacion(s, mes));
  const cambios = [['Gastos', gasto], ...filasReparto(gasto, pcts)];

  if (prev?.plan_id && alcance === 'siguientes') {
    const plan = st.fila('Planes', prev.plan_id);
    // Con cuotas dobles, el monto escrito en un mes doble equivale a dos cuotas normales.
    const base = plan ? r2(monto / L.factorMes(plan, prev.mes)) : monto;
    L.idx(s).gastosPorPlan.get(prev.plan_id)?.filter((g) => g.id !== id && g.estado === ESTADO.PROG && num(g.nro_cuota) > num(prev.nro_cuota) && !L.mesCerrado(s, g.mes))
      .forEach((g) => {
        const tcg = f.moneda === 'PEN' ? 1 : (L.tipoCambio(s, g.mes, f.moneda) || tc);
        const m = plan ? r2(base * L.factorMes(plan, g.mes)) : monto;
        const otro = { ...g, monto: m, moneda: f.moneda, tipo_cambio: tcg, monto_soles: r2(m * tcg), categoria_id: f.categoria_id, pagado_por: f.pagado_por, tipo: gasto.tipo, nota: gasto.nota };
        const pctsOtro = f.repHogar ? L.participacion(s, g.mes) : (f.pcts || L.pctsDeGasto(s, g));
        cambios.push(['Gastos', otro], ...filasReparto(otro, pctsOtro));
      });
    if (plan) {
      const reparto = f.repHogar ? (plan.modalidad === 'Recurrente' ? '' : plan.reparto) : (f.pcts ? JSON.stringify(f.pcts) : plan.reparto);
      cambios.push(['Planes', { id: plan.id, monto_cuota: base, moneda: f.moneda, tipo_cambio: tc, categoria_id: f.categoria_id, pagado_por: f.pagado_por, tipo: gasto.tipo, descripcion: gasto.nota || plan.descripcion, reparto }]);
    }
  }
  st.guardar(cambios);
  return gasto.id;
}

function gastoDePlan(plan, k, mes, monto, pcts, estado = ESTADO.PROG) {
  const s = S();
  // El primer mes usa el tipo de cambio elegido al registrar; los siguientes, el de su mes.
  const tc = plan.moneda === 'PEN' ? 1 : ((k === 0 && num(plan.tipo_cambio)) || L.tipoCambioDelMes(s, mes) || num(plan.tipo_cambio) || L.tipoCambio(s, mes, plan.moneda) || 0);
  const g = {
    id: L.idGastoDePlan(plan.id, k), fecha: L.fechaEnMes(mes, plan.dia), mes, monto, moneda: plan.moneda,
    tipo_cambio: tc, monto_soles: r2(monto * tc), categoria_id: plan.categoria_id, pagado_por: plan.pagado_por,
    registrado_por: quien(), tipo: plan.tipo, estado, plan_id: plan.id, nro_cuota: k + 1, nota: plan.descripcion
  };
  return [['Gastos', g], ...filasReparto(g, pcts || L.participacion(s, mes))];
}

function planBase(f, modalidad) {
  const s = S();
  return {
    id: uuid(), modalidad, descripcion: String(f.nota || '').trim() || L.categoria(s, f.categoria_id)?.nombre || '',
    moneda: f.moneda, categoria_id: f.categoria_id, pagado_por: f.pagado_por,
    tipo: f.tipo || L.categoria(s, f.categoria_id)?.tipo || 'Variable', dia: Number(f.fecha.slice(8, 10)), estado: 'Activo',
    meses_dobles: L.mesesDobles(f.mesesDobles).join(',')
  };
}

function crearCuotas(f) {
  const n = Math.floor(num(f.nroCuotas));
  if (n < 2 || n > 72) falla('El número de cuotas debe estar entre 2 y 72.');
  const mesInicio = f.mesInicio || mesDe(f.fecha);
  const tc = tcElegido(f, mesInicio);
  const s = S();
  const q = L.planCuotas(num(f.monto), n, mesInicio, f.mesesDobles, num(f.montoCuota));
  const montos = q.montos;
  const pcts = f.pcts || L.participacion(s, mesInicio);
  const plan = { ...planBase(f, 'Cuotas'), monto_total: q.total, nro_cuotas: n, monto_cuota: q.base, mes_inicio: mesInicio, duracion_meses: n, reparto: JSON.stringify(pcts), tipo_cambio: tc };
  const meses = L.mesesDePlan(plan, mesInicio);
  meses.forEach((m) => { if (L.mesCerrado(s, m)) falla(`${m} está cerrado; no se pueden poner cuotas en ese mes.`); });
  const cambios = [['Planes', plan]];
  meses.forEach((m, k) => cambios.push(...gastoDePlan(plan, k, m, montos[k], pcts)));
  st.guardar(cambios);
  return plan.id;
}

function crearRecurrente(f) {
  const dur = Math.floor(num(f.duracion));
  if (dur < 0 || dur > 120) falla('La duración debe estar entre 1 y 120 meses, o sin fin.');
  const mesInicio = mesDe(f.fecha);
  if (L.mesCerrado(S(), mesInicio)) falla(`${mesInicio} está cerrado.`);
  const tc = tcElegido(f, mesInicio);
  const plan = { ...planBase(f, 'Recurrente'), monto_cuota: r2(num(f.monto)), monto_total: '', nro_cuotas: '', mes_inicio: mesInicio, duracion_meses: dur || '', reparto: f.pcts ? JSON.stringify(f.pcts) : '', tipo_cambio: tc };
  const s = S();
  const meses = L.mesesDePlan(plan, horizonte(mesInicio));
  const cambios = [['Planes', plan]];
  meses.forEach((m, k) => { if (!L.mesCerrado(s, m)) cambios.push(...gastoDePlan(plan, k, m, r2(plan.monto_cuota * L.factorMes(plan, m)), f.pcts)); });
  st.guardar(cambios);
  return plan.id;
}

const horizonte = (desde) => { const h = sumarMeses(mesActual(), 11); const h2 = sumarMeses(desde, 11); return h > h2 ? h : h2; };

/**
 * Renueva los recurrentes sin fin hasta 12 meses adelante. Se ejecuta después de sincronizar.
 * Las filas nuevas se escriben con fecha antigua: si otro celular ya las creó, gana la suya.
 */
export function asegurarRecurrentes() {
  const s = S();
  const cambios = [];
  s.Planes.filter((p) => p.modalidad === 'Recurrente' && p.estado !== 'Cancelado').forEach((plan) => {
    const pcts = plan.reparto ? JSON.parse(plan.reparto) : null;
    L.mesesDePlan(plan, horizonte(plan.mes_inicio)).forEach((m) => {
      const k = difMeses(plan.mes_inicio, m);
      if (!st.existe('Gastos', L.idGastoDePlan(plan.id, k)) && !L.mesCerrado(s, m)) cambios.push(...gastoDePlan(plan, k, m, r2(num(plan.monto_cuota) * L.factorMes(plan, m)), pcts));
    });
  });
  if (cambios.length) st.guardar(cambios, { ts: ANTIGUO });
  return cambios.length;
}

/**
 * Repara filas generadas automáticamente que nadie tocó (siguen con la fecha antigua):
 * si su plan se canceló, se anulan; si el plan cambió de monto, categoría o pagador, se alinean.
 */
export function repararGenerados() {
  const s = S();
  const anular = [];
  const alinear = [];
  s.Gastos.filter((g) => g.estado === ESTADO.PROG && g.actualizado_en === ANTIGUO && g.plan_id && !L.mesCerrado(s, g.mes)).forEach((g) => {
    const plan = L.idx(s).plan.get(g.plan_id);
    if (!plan) return;
    if (plan.estado === 'Cancelado') { anular.push(['Gastos', { id: g.id, estado: ESTADO.ANUL }]); return; }
    if (plan.modalidad !== 'Recurrente') return;
    const esperado = r2(num(plan.monto_cuota) * L.factorMes(plan, g.mes));
    if (num(g.monto) !== esperado || g.categoria_id !== plan.categoria_id || g.pagado_por !== plan.pagado_por || g.moneda !== plan.moneda) {
      alinear.push(...gastoDePlan(plan, num(g.nro_cuota) - 1, g.mes, esperado, plan.reparto ? JSON.parse(plan.reparto) : null));
    }
  });
  if (anular.length) st.guardar(anular);
  if (alinear.length) st.guardar(alinear, { ts: ANTIGUO });
  return anular.length + alinear.length;
}

/**
 * Convierte un gasto de pago único en cuotas o en un gasto mensual (desde su propio mes).
 * El gasto original se reemplaza por el primero del plan, que conserva su foto y su estado.
 */
export function convertirEnPlan(id, f) {
  const g = st.fila('Gastos', id);
  if (!g) falla('No encontré el gasto.');
  if (g.plan_id) falla('Este gasto ya es parte de un plan.');
  if (L.mesCerrado(S(), g.mes)) falla(`${g.mes} está cerrado.`);
  const planId = f.modalidad === 'Cuotas' ? crearCuotas(f) : crearRecurrente(f);
  const s = S();
  const cambios = [['Gastos', { id, eliminado: 1 }]];
  s.GastosReparto.filter((r) => r.gasto_id === id).forEach((r) => cambios.push(['GastosReparto', { id: r.id, eliminado: 1 }]));
  const primero = st.fila('Gastos', L.idGastoDePlan(planId, 0));
  if (primero) {
    const extra = g.evidencia_id ? { evidencia_id: g.evidencia_id, evidencia_url: g.evidencia_url || '' } : {};
    const nuevo = { ...primero, ...extra, registrado_por: g.registrado_por || primero.registrado_por };
    if (g.estado === ESTADO.CONF && primero.fecha <= hoy()) cambios.push(...confirmacion(nuevo, null, nuevo.tipo_cambio));
    else cambios.push(['Gastos', nuevo]);
  }
  st.guardar(cambios);
  return planId;
}

/**
 * Ajusta un plan desde un mes: meses con cuota doble y, en los mensuales, la duración o el fin.
 * Recalcula los gastos programados desde ese mes (los de meses cerrados no se tocan).
 * `excluir`: id de un gasto cuyo monto la persona acaba de escribir a mano.
 */
export function actualizarPlan(planId, { duracion, mesesDobles, terminar = false } = {}, desde, { excluir = null } = {}) {
  const s = S();
  const plan = st.fila('Planes', planId);
  if (!plan) falla('No encontré el plan.');
  const cambio = { id: plan.id };
  if (mesesDobles !== undefined) cambio.meses_dobles = L.mesesDobles(mesesDobles).join(',');
  if (plan.modalidad === 'Recurrente') {
    const minimo = difMeses(plan.mes_inicio, desde) + 1;
    if (terminar) cambio.duracion_meses = minimo;
    else if (duracion !== undefined) {
      const d = Math.floor(num(duracion));
      if (d && d < minimo) falla(`Ya van ${minimo} meses desde ${plan.mes_inicio}: la duración debe ser de ${minimo} o más.`);
      if (d > 240) falla('La duración debe ser de 240 meses o menos.');
      cambio.duracion_meses = d || '';
    }
  }
  const nuevo = { ...plan, ...cambio };
  const cambios = [['Planes', cambio]];
  const prog = (L.idx(s).gastosPorPlan.get(plan.id) || [])
    .filter((g) => g.estado === ESTADO.PROG && g.mes >= desde && !L.mesCerrado(s, g.mes) && g.id !== excluir)
    .sort((a, b) => num(a.nro_cuota) - num(b.nro_cuota));
  const rehacer = (g, monto) => {
    const tc = num(g.tipo_cambio) || 1;
    const otro = { ...g, monto, monto_soles: r2(monto * tc) };
    cambios.push(['Gastos', otro], ...filasReparto(otro, L.pctsDeGasto(s, g)));
  };
  if (plan.modalidad === 'Recurrente') {
    const dur = num(nuevo.duracion_meses);
    const fin = dur > 0 ? sumarMeses(plan.mes_inicio, dur - 1) : null;
    prog.forEach((g) => {
      if (fin && g.mes > fin) { cambios.push(['Gastos', { id: g.id, estado: ESTADO.ANUL }]); return; }
      const m = r2(num(plan.monto_cuota) * L.factorMes(nuevo, g.mes));
      if (m !== num(g.monto)) rehacer(g, m);
    });
  } else if (prog.length) {
    // Cuotas: lo que falta pagar se reparte de nuevo, con las cuotas dobles en sus meses.
    const resto = r2(prog.reduce((a, g) => a + num(g.monto), 0));
    const montos = L.montosCuotas(resto, prog.length, L.factoresDe(nuevo, prog.map((g) => g.mes)));
    prog.forEach((g, i) => { if (montos[i] !== num(g.monto)) rehacer(g, montos[i]); });
    cambio.monto_cuota = r2(resto / L.factoresDe(nuevo, prog.map((g) => g.mes)).reduce((a, b) => a + b, 0));
  }
  st.guardar(cambios);
  if (plan.modalidad === 'Recurrente') asegurarRecurrentes();
}

/** RF-35: confirma un programado, opcionalmente con el monto real. */
export function confirmarGasto(id, montoReal = null, tcManual = null) {
  const g = st.fila('Gastos', id);
  if (!g) falla('No encontré el gasto.');
  if (L.mesCerrado(S(), g.mes)) falla(`${g.mes} está cerrado.`);
  st.guardar(confirmacion(g, montoReal, tcManual));
}

function confirmacion(g, montoReal, tcManual = null) {
  const s = S();
  const monto = montoReal !== null && num(montoReal) > 0 ? r2(num(montoReal)) : num(g.monto);
  const tc = g.moneda === 'PEN' ? 1 : (num(tcManual) > 0 ? tc4(tcManual) : (L.tipoCambioDelMes(s, g.mes) || num(g.tipo_cambio)));
  const nuevo = { ...g, monto, tipo_cambio: tc, monto_soles: r2(monto * tc), estado: ESTADO.CONF };
  return [['Gastos', nuevo], ...filasReparto(nuevo, L.pctsDeGasto(s, g))];
}

/** Deshace un registro recién hecho (desde el aviso «Deshacer»): lo elimina con su reparto. */
export function deshacer(id) {
  const s = S();
  const cambios = [];
  const borrarGasto = (gid) => {
    cambios.push(['Gastos', { id: gid, eliminado: 1 }]);
    s.GastosReparto.filter((r) => r.gasto_id === gid).forEach((r) => cambios.push(['GastosReparto', { id: r.id, eliminado: 1 }]));
  };
  if (st.existe('Planes', id)) {
    cambios.push(['Planes', { id, estado: 'Cancelado', eliminado: 1 }]);
    s.Gastos.filter((g) => g.plan_id === id).forEach((g) => borrarGasto(g.id));
  } else if (st.existe('Gastos', id)) borrarGasto(id);
  if (cambios.length) st.guardar(cambios);
}

/** Anula (nunca borra). Con alcance 'siguientes' anula también los programados posteriores del plan. */
export function anularGasto(id, alcance = 'este') {
  const s = S();
  const g = st.fila('Gastos', id);
  if (!g) falla('No encontré el gasto.');
  if (L.mesCerrado(s, g.mes)) falla(`${g.mes} está cerrado.`);
  const cambios = [['Gastos', { id, estado: ESTADO.ANUL }]];
  if (g.plan_id && alcance === 'siguientes') {
    L.idx(s).gastosPorPlan.get(g.plan_id)?.filter((x) => x.estado === ESTADO.PROG && num(x.nro_cuota) > num(g.nro_cuota) && !L.mesCerrado(s, x.mes))
      .forEach((x) => cambios.push(['Gastos', { id: x.id, estado: ESTADO.ANUL }]));
    cambios.push(['Planes', { id: g.plan_id, estado: 'Cancelado' }]);
  }
  st.guardar(cambios);
}

/* ------------------------------------------------------ Cierre de mes --- */

export function registrarLiquidacion({ mes, de, a, monto, fecha = hoy(), nota = '' }) {
  if (L.mesCerrado(S(), mes)) falla(`${mes} está cerrado.`);
  if (!de || !a || de === a) falla('Elige quién paga y quién recibe.');
  if (!(num(monto) > 0)) falla('Escribe un monto mayor que cero.');
  st.guardarUno('Liquidaciones', { id: uuid(), mes, de_persona_id: de, a_persona_id: a, monto_soles: r2(num(monto)), fecha, nota });
}

export function anularLiquidacion(id) {
  const l = st.fila('Liquidaciones', id);
  if (l && L.mesCerrado(S(), l.mes)) falla(`${l.mes} está cerrado.`);
  st.eliminar('Liquidaciones', id);
}

/** RF-39: confirma programados pendientes, guarda saldos, bloquea el mes y arrastra lo pendiente. */
export function cerrarMes(mes) {
  const s = S();
  if (!L.esAdmin(s, quien())) falla('Solo el administrador puede cerrar el mes.');
  const cambios = [];
  L.gastosMes(s, mes, [ESTADO.PROG]).forEach((g) => cambios.push(...confirmacion(g, null)));
  if (cambios.length) st.guardar(cambios);
  const cierre = [['Cierres', { id: `C_${mes}`, mes, estado: 'Cerrado', cerrado_por: quien(), cerrado_en: new Date().toISOString() }]];
  st.guardar(cierre);
  guardarFotosDeSaldos(mes);
}

function guardarFotosDeSaldos(desde) {
  const s = S();
  const cambios = [];
  s.Cierres.filter((c) => c.estado === 'Cerrado' && c.mes >= desde).forEach((c) => {
    L.saldosMes(s, c.mes, { sinFotosDesde: desde }).forEach((f) => cambios.push(['CierresSaldos', {
      id: `CS_${c.mes}_${f.persona_id}`, mes: c.mes, persona_id: f.persona_id, saldo_inicial: f.saldo_inicial,
      pagado: f.pagado, corresponde: f.corresponde, liquidado: r2(f.liq_pagado - f.liq_recibido), saldo_final: f.saldo_final
    }]));
  });
  if (cambios.length) st.guardar(cambios);
}

export function reabrirMes(mes) {
  if (!L.esAdmin(S(), quien())) falla('Solo el administrador puede reabrir el mes.');
  st.guardarUno('Cierres', { id: `C_${mes}`, mes, estado: 'Abierto', cerrado_por: '', cerrado_en: '' });
}
