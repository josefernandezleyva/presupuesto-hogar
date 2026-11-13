// Operaciones que escriben datos: cada una valida las reglas y guarda en la copia local.

import * as st from './store.js';
import * as L from './logic.js';
import { uuid, r2, num, mesDe, mesActual, hoy, sumarMeses, difMeses, norm } from './util.js';

const { ESTADO } = L;
const S = () => st.foto();
const quien = () => st.getMeta().personaId;
const ANTIGUO = '2000-01-01T00:00:00.000Z';

export class ErrorApp extends Error {
  constructor(m, campo = '') { super(m); this.campo = campo; }
}
const falla = (m, campo = '') => { throw new ErrorApp(m, campo); };

/** Largo máximo de la descripción de un gasto (se guarda en la columna nota). */
export const MAX_DESCRIPCION = 80;

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

/**
 * 2.1 · Nuevo orden de las categorías de un grupo (`ids` en el orden deseado). Se renumera la columna
 * `orden` de todas las categorías siguiendo el orden de los grupos, para que el orden sea el mismo en
 * el registro, en Categorías, en Inicio y en el reporte. Solo cambia `orden`; nada más de la fila.
 */
export function ordenarCategorias(grupo, ids) {
  const S0 = S();
  const enGrupo = L.categorias(S0, { todas: true }).filter((c) => norm(c.grupo || 'Otros') === norm(grupo));
  const conocidos = new Set(enGrupo.map((c) => c.id));
  const pedido = ids.filter((id) => conocidos.has(id));
  if (pedido.length !== enGrupo.length) falla('La lista cambió mientras la ordenabas. Vuelve a intentarlo.');
  const nuevoGrupo = pedido.map((id) => enGrupo.find((c) => c.id === id));
  const todas = [];
  L.grupos(S0, { todas: true }).forEach((g) => {
    const xs = norm(g.nombre) === norm(grupo) ? nuevoGrupo : L.categorias(S0, { todas: true }).filter((c) => norm(c.grupo || 'Otros') === norm(g.nombre));
    todas.push(...xs);
  });
  // Categorías cuyo grupo ya no existe: al final, en su orden.
  L.categorias(S0, { todas: true }).forEach((c) => { if (!todas.includes(c)) todas.push(c); });
  const cambios = todas.map((c, k) => ({ c, orden: k + 1 })).filter(({ c, orden }) => num(c.orden) !== orden).map(({ c, orden }) => ['Categorias', { id: c.id, orden }]);
  if (cambios.length) st.guardar(cambios);
  return cambios.length;
}

/** Sube (d = -1) o baja (d = 1) una categoría dentro de su grupo. */
export function moverCategoria(id, d) {
  const cat = S().Categorias.find((c) => c.id === id);
  if (!cat) return 0;
  const ids = L.categorias(S(), { todas: true }).filter((c) => norm(c.grupo || 'Otros') === norm(cat.grupo || 'Otros')).map((c) => c.id);
  const i = ids.indexOf(id), j = i + Number(d);
  if (i < 0 || j < 0 || j >= ids.length) return 0;
  [ids[i], ids[j]] = [ids[j], ids[i]];
  return ordenarCategorias(cat.grupo || 'Otros', ids);
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

/** Distribuciones guardadas desde meses posteriores a `mes` (las que una nueva reemplaza). */
export const distribucionesPosteriores = (mes) => L.distribuciones(S()).filter((d) => d.desde > mes);

/**
 * Nuevos porcentajes desde un mes en adelante (RF-19). La nueva distribución reemplaza las guardadas
 * desde meses posteriores: sus filas se marcan como eliminadas (no se borran; se recuperan con eliminado = 0).
 */
export function guardarParticipacion(mes, pcts) {
  if (!/^\d{4}-\d{2}$/.test(mes || '')) falla('Elige el mes.');
  if (L.sumaPcts(pcts) !== 100) falla('La participación debe sumar 100 %.');
  const cambios = [];
  const mismas = S().Participacion.filter((p) => L.mesDeVigencia(p.vigente_desde) === mes);
  const ids = new Set([...Object.keys(pcts), ...mismas.map((p) => p.persona_id)]);
  // Filas del mismo mes con otro id (escritas a mano en la hoja): se reemplazan por las nuevas.
  mismas.filter((p) => p.id !== `PA_${mes}_${p.persona_id}`).forEach((p) => cambios.push(['Participacion', { id: p.id, eliminado: 1 }]));
  ids.forEach((pid) => cambios.push(['Participacion', { id: `PA_${mes}_${pid}`, persona_id: pid, porcentaje: num(pcts[pid]), vigente_desde: mes, eliminado: 0 }]));
  S().Participacion.filter((p) => L.mesDeVigencia(p.vigente_desde) > mes).forEach((p) => cambios.push(['Participacion', { id: p.id, eliminado: 1 }]));
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

/** Descripción limpia: sin espacios de más y con el largo máximo. */
export const limpiarDescripcion = (t) => String(t ?? '').replace(/\s+/g, ' ').trim().slice(0, MAX_DESCRIPCION);

function validarBase(f) {
  if (!limpiarDescripcion(f.nota)) falla('Escribe una descripción.', 'nota');
  // 3.2: un gasto mensual puede guardarse sin monto (S/ 0) como recordatorio, siempre por pagar.
  const sinMontoOk = f.modalidad === 'Recurrente' && f.estado !== ESTADO.CONF && num(f.monto) === 0;
  if (!(num(f.monto) > 0) && !sinMontoOk) falla(f.modalidad === 'Recurrente' && num(f.monto) === 0 ? 'Un gasto sin monto queda «por pagar». Escribe el monto para marcarlo como pagado.' : 'Escribe un monto mayor que cero.', 'monto');
  if (!f.categoria_id) falla('Elige una categoría.', 'categoria');
  if (!f.pagado_por) falla('Elige quién pagó.', 'pagador');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(f.fecha || '')) falla('Elige la fecha.', 'fecha');
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
  if (!tc) falla('Falta el tipo de cambio de dólares para ' + mes + '. El administrador lo carga en Hogar y ajustes › Tipo de cambio.');
  return tc;
}

/**
 * Guarda un gasto. `f`: { monto, moneda, categoria_id, pagado_por, fecha, nota, tipo, pcts|null,
 * modalidad: 'Unico'|'Cuotas'|'Recurrente', nroCuotas, mesInicio, montoCuota, duracion }.
 * Al editar, `alcance` = 'este' | 'siguientes' para gastos de un plan.
 */
/**
 * Gastos iguales ya guardados (misma fecha, categoría, monto y moneda; sin contar anulados),
 * para avisar antes de guardar uno repetido. Excluye el gasto que se está editando.
 */
export function gastosIguales(f, { id = null } = {}) {
  const monto = r2(num(f.monto));
  return S().Gastos.filter((g) => g.id !== id && g.estado !== ESTADO.ANUL && g.fecha === f.fecha
    && g.categoria_id === f.categoria_id && r2(num(g.monto)) === monto && (g.moneda || 'PEN') === (f.moneda || 'PEN'));
}

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
    // 2.2: «¿Ya se pagó?» lo elige la persona (Pagado = Confirmado, Por pagar = Programado). Si no lo dice,
    // un gasto nuevo con fecha futura queda por pagar y uno de hoy o antes, pagado.
    estado: prev ? (prev.estado !== ESTADO.ANUL && (f.estado === ESTADO.CONF || f.estado === ESTADO.PROG) ? f.estado : prev.estado)
      : (f.estado === ESTADO.CONF || f.estado === ESTADO.PROG ? f.estado : (f.fecha > hoy() ? ESTADO.PROG : ESTADO.CONF)),
    plan_id: prev?.plan_id || '', nro_cuota: prev?.nro_cuota || '', nota: limpiarDescripcion(f.nota)
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
      const reparto = f.repHogar ? '' : (f.pcts ? JSON.stringify(f.pcts) : plan.reparto);
      cambios.push(['Planes', { id: plan.id, monto_cuota: base, moneda: f.moneda, tipo_cambio: tc, categoria_id: f.categoria_id, pagado_por: f.pagado_por, tipo: gasto.tipo, descripcion: gasto.nota || plan.descripcion, reparto }]);
    }
  }
  // 2.5: en cuotas, el total del plan es siempre la suma de sus cuotas vigentes.
  if (prev?.plan_id) cambios.push(...totalDelPlan(prev.plan_id, cambios));
  st.guardar(cambios);
  return gasto.id;
}

/** Cambio del total de un plan de cuotas tras los cambios en curso (o nada si no es de cuotas o no cambia). */
function totalDelPlan(planId, cambios = [], extraPlan = {}) {
  const plan = st.fila('Planes', planId);
  if (!plan || plan.modalidad !== 'Cuotas') return [];
  const nuevos = new Map(cambios.filter(([t, f]) => t === 'Gastos' && f.plan_id === planId).map(([, f]) => [f.id, f]));
  const vivos = (L.idx(S()).gastosPorPlan.get(planId) || []).map((g) => nuevos.get(g.id) || g);
  nuevos.forEach((f, id) => { if (!vivos.some((g) => g.id === id)) vivos.push(f); });
  const total = r2(vivos.filter((g) => g.estado !== ESTADO.ANUL).reduce((a, g) => a + num(g.monto), 0));
  const fila = { id: planId, ...extraPlan };
  if (Math.abs(total - num(plan.monto_total)) > 0.004) fila.monto_total = total;
  return Object.keys(fila).length > 1 ? [['Planes', fila]] : [];
}

/* ------------------------------------------------- 2.5 · Ajustes de cuotas --- */

const dinero = (n, moneda = 'PEN') => (moneda === 'USD' ? 'US$ ' : 'S/ ') + r2(n).toFixed(2);

/** Cuotas de un plan, ordenadas, con lo que se puede cambiar: las por pagar de meses abiertos. */
export function cuotasDelPlan(planId) {
  const s = S();
  const plan = st.fila('Planes', planId);
  if (!plan || plan.modalidad !== 'Cuotas') falla('No encontré el plan de cuotas.');
  const todas = (L.idx(s).gastosPorPlan.get(planId) || []).slice().sort((a, b) => num(a.nro_cuota) - num(b.nro_cuota));
  const vivas = todas.filter((g) => g.estado !== ESTADO.ANUL);
  const libre = (g) => g.estado === ESTADO.PROG && !L.mesCerrado(s, g.mes);
  return { plan, todas, vivas, libres: vivas.filter(libre), fijas: vivas.filter((g) => !libre(g)), libre };
}

function rehacerCuota(g, monto) {
  const tc = num(g.tipo_cambio) || 1;
  const otro = { ...g, monto: r2(monto), monto_soles: r2(r2(monto) * tc) };
  return [['Gastos', otro], ...filasReparto(otro, L.pctsDeGasto(S(), g))];
}

/** Reparte `resto` entre las cuotas `libres` (respetando las cuotas dobles) y devuelve los cambios. */
function repartirEn(plan, libres, resto) {
  if (!libres.length) return [];
  const factores = L.factoresDe(plan, libres.map((g) => g.mes));
  const montos = L.montosCuotas(r2(resto), libres.length, factores);
  if (montos.some((m) => !(m > 0))) falla('El monto no alcanza para repartirlo entre las cuotas por pagar.');
  const cambios = [];
  libres.forEach((g, i) => { if (Math.abs(montos[i] - num(g.monto)) > 0.004) cambios.push(...rehacerCuota(g, montos[i])); });
  return cambios;
}

/**
 * Vista previa de un cambio del total: lo fijo (pagado o en meses cerrados) se mantiene y lo que falta
 * se reparte entre las cuotas por pagar. { fijo, resto, libres, montos, error }.
 */
export function previaTotal(planId, nuevoTotal) {
  const { plan, libres, fijas } = cuotasDelPlan(planId);
  const total = r2(num(nuevoTotal));
  const fijo = r2(fijas.reduce((a, g) => a + num(g.monto), 0));
  const resto = r2(total - fijo);
  let error = '';
  if (!(total > 0)) error = 'Escribe un total mayor que cero.';
  else if (!libres.length) error = 'sin_pendientes';
  else if (!(resto >= 0.01 * libres.length)) error = `El total debe ser mayor que lo ya pagado o en meses cerrados (${dinero(fijo, plan.moneda)}).`;
  const montos = !error ? L.montosCuotas(resto, libres.length, L.factoresDe(plan, libres.map((g) => g.mes))) : [];
  return { plan, total, fijo, resto, libres, fijas, montos, error, diferencia: r2(total - num(plan.monto_total)) };
}

/** Cambia el total de un plan de cuotas y reparte la diferencia entre las cuotas por pagar. */
export function cambiarTotalPlan(planId, nuevoTotal) {
  const p = previaTotal(planId, nuevoTotal);
  if (p.error === 'sin_pendientes') falla('No quedan cuotas por pagar en meses abiertos. Agrega la diferencia como una cuota de ajuste.');
  if (p.error) falla(p.error);
  const cambios = repartirEn(p.plan, p.libres, p.resto);
  const unidades = L.factoresDe(p.plan, p.libres.map((g) => g.mes)).reduce((a, b) => a + b, 0);
  cambios.push(...totalDelPlan(planId, cambios, { monto_cuota: r2(p.resto / unidades) }));
  st.guardar(cambios);
}

/**
 * Ajusta el monto de una cuota (pagada o por pagar, en un mes abierto).
 * modo 'solo': el total del plan cambia. modo 'compensar': el total se mantiene y la diferencia se
 * reparte entre las cuotas por pagar que siguen.
 */
export function previaCuota(gastoId, nuevoMonto, modo = 'solo') {
  const g = st.fila('Gastos', gastoId);
  if (!g?.plan_id) return { error: 'No encontré la cuota.' };
  const { plan, libres, vivas } = cuotasDelPlan(g.plan_id);
  const monto = r2(num(nuevoMonto));
  const siguen = libres.filter((x) => num(x.nro_cuota) > num(g.nro_cuota));
  const base = { g, plan, monto, siguen, nuevos: [], total: num(plan.monto_total), error: '' };
  if (g.estado === ESTADO.ANUL) return { ...base, error: 'La cuota está anulada.' };
  if (L.mesCerrado(S(), g.mes)) return { ...base, error: `${g.mes} está cerrado. Para cambiarlo, el administrador debe reabrirlo.` };
  if (!(monto > 0)) return { ...base, error: 'Escribe un monto mayor que cero.' };
  const sumaVivas = r2(vivas.reduce((a, x) => a + num(x.monto), 0));
  if (modo !== 'compensar') return { ...base, total: r2(sumaVivas - num(g.monto) + monto) };
  if (!siguen.length) return { ...base, error: 'No hay cuotas por pagar después de esta para repartir la diferencia.' };
  // La diferencia se reparte entre las que siguen (en partes iguales, dobles en sus meses), sin borrar
  // los ajustes que ya tenga alguna de ellas.
  const partes = L.montosCuotas(r2(num(g.monto) - monto), siguen.length, L.factoresDe(plan, siguen.map((x) => x.mes)));
  const nuevos = siguen.map((x, i) => r2(num(x.monto) + partes[i]));
  if (nuevos.some((m) => !(m > 0))) return { ...base, error: 'La diferencia es mayor que lo que falta pagar en las cuotas siguientes.' };
  return { ...base, nuevos, total: sumaVivas };
}

/**
 * Ajusta el monto de una cuota (pagada o por pagar, en un mes abierto).
 * modo 'solo': el total del plan cambia. modo 'compensar': el total se mantiene y la diferencia se
 * reparte entre las cuotas por pagar que siguen.
 */
export function ajustarCuota(gastoId, nuevoMonto, modo = 'solo') {
  const p = previaCuota(gastoId, nuevoMonto, modo);
  if (p.error) falla(p.error);
  const cambios = rehacerCuota(p.g, p.monto);
  p.siguen.forEach((x, i) => { if (p.nuevos.length && Math.abs(p.nuevos[i] - num(x.monto)) > 0.004) cambios.push(...rehacerCuota(x, p.nuevos[i])); });
  cambios.push(...totalDelPlan(p.g.plan_id, cambios));
  st.guardar(cambios);
}

/**
 * Agrega al plan una cuota de ajuste (por ejemplo, una diferencia que apareció al final).
 * Queda como una cuota más: «Cuota 7 de 7», en el mes elegido.
 */
export function agregarCuotaAjuste(planId, montoTxt, mes, { estado = ESTADO.PROG } = {}) {
  const { plan, todas } = cuotasDelPlan(planId);
  const monto = r2(num(montoTxt));
  if (!(monto > 0)) falla('Escribe un monto mayor que cero.');
  if (!/^\d{4}-\d{2}$/.test(mes || '')) falla('Elige el mes de la cuota.');
  if (L.mesCerrado(S(), mes)) falla(`${mes} está cerrado; elige un mes abierto.`);
  const k = Math.max(num(plan.nro_cuotas), ...todas.map((g) => num(g.nro_cuota))); // índice de la nueva (base 0)
  if (st.existe('Gastos', L.idGastoDePlan(planId, k))) falla('Ya existe esa cuota. Sincroniza e intenta de nuevo.');
  const pcts = plan.reparto ? JSON.parse(plan.reparto) : null;
  const cambios = gastoDePlan(plan, k, mes, monto, pcts, estado === ESTADO.CONF ? ESTADO.CONF : ESTADO.PROG);
  cambios[0][1].nota = `${plan.descripcion} (ajuste)`;
  cambios.push(...totalDelPlan(planId, cambios, { nro_cuotas: k + 1 }));
  st.guardar(cambios);
  return cambios[0][1].id;
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
    id: uuid(), modalidad, descripcion: limpiarDescripcion(f.nota) || L.categoria(s, f.categoria_id)?.nombre || '',
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
  // Con el reparto del hogar, cada cuota sigue la participación vigente de su mes (también si cambia después).
  const pcts = f.pcts || null;
  const plan = { ...planBase(f, 'Cuotas'), monto_total: q.total, nro_cuotas: n, monto_cuota: q.base, mes_inicio: mesInicio, duracion_meses: n, reparto: pcts ? JSON.stringify(pcts) : '', tipo_cambio: tc };
  const meses = L.mesesDePlan(plan, mesInicio);
  meses.forEach((m) => { if (L.mesCerrado(s, m)) falla(`${m} está cerrado; no se pueden poner cuotas en ese mes.`); });
  const cambios = [['Planes', plan]];
  meses.forEach((m, k) => cambios.push(...gastoDePlan(plan, k, m, montos[k], pcts, k === 0 && f.estado === ESTADO.CONF ? ESTADO.CONF : ESTADO.PROG)));
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
  meses.forEach((m, k) => { if (!L.mesCerrado(s, m)) cambios.push(...gastoDePlan(plan, k, m, r2(plan.monto_cuota * L.factorMes(plan, m)), f.pcts, k === 0 && f.estado === ESTADO.CONF ? ESTADO.CONF : ESTADO.PROG)); });
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

/**
 * 2.2 · Vuelve a «por pagar» un gasto marcado como pagado por error (o que aún no se paga).
 * Deja de contar en las cuentas entre personas y sigue contando en el presupuesto como comprometido.
 */
export function desconfirmarGasto(id) {
  const g = st.fila('Gastos', id);
  if (!g) falla('No encontré el gasto.');
  if (L.mesCerrado(S(), g.mes)) falla(`${g.mes} está cerrado. Para cambiarlo, el administrador debe reabrirlo.`);
  if (g.estado !== ESTADO.CONF) return;
  st.guardar([['Gastos', { id, estado: ESTADO.PROG }]]);
}

/** RF-35: confirma un programado, opcionalmente con el monto real. */
export function confirmarGasto(id, montoReal = null, tcManual = null) {
  const g = st.fila('Gastos', id);
  if (!g) falla('No encontré el gasto.');
  if (L.mesCerrado(S(), g.mes)) falla(`${g.mes} está cerrado.`);
  if (!(num(montoReal) > 0) && !(num(g.monto) > 0)) falla('Escribe cuánto fue para marcarlo como pagado.', 'monto');
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
  // 3.2: se devuelve lo que había antes, para «Deshacer».
  const antes = { gastos: [[id, g.estado]], plan: null };
  if (g.plan_id && alcance === 'siguientes') {
    L.idx(s).gastosPorPlan.get(g.plan_id)?.filter((x) => x.estado === ESTADO.PROG && num(x.nro_cuota) > num(g.nro_cuota) && !L.mesCerrado(s, x.mes))
      .forEach((x) => { cambios.push(['Gastos', { id: x.id, estado: ESTADO.ANUL }]); antes.gastos.push([x.id, x.estado]); });
    const plan = st.fila('Planes', g.plan_id);
    antes.plan = [g.plan_id, plan?.estado || 'Activo'];
    cambios.push(['Planes', { id: g.plan_id, estado: 'Cancelado' }]);
  }
  st.guardar(cambios);
  return antes;
}

/** 3.2 · «Deshacer» de una anulación: cada gasto vuelve a su estado y el plan, si se canceló, se reactiva. */
export function deshacerAnulacion(antes) {
  const s = S();
  const cambios = (antes?.gastos || []).filter(([id]) => { const g = st.fila('Gastos', id); return g && !L.mesCerrado(s, g.mes); })
    .map(([id, estado]) => ['Gastos', { id, estado: estado === ESTADO.ANUL ? ESTADO.PROG : estado }]);
  if (antes?.plan) cambios.push(['Planes', { id: antes.plan[0], estado: antes.plan[1] }]);
  if (cambios.length) st.guardar(cambios);
}

/**
 * 3.2 · Restaurar desde «Gastos anulados». `comoQueda` es Confirmado (pagado) o Programado (por pagar).
 * Con `conPlan`, si el gasto es de un plan cancelado, el plan se reactiva y vuelven también los gastos
 * anulados que le siguen (como por pagar), en meses abiertos.
 */
export function restaurarAnulado(id, comoQueda, { conPlan = false } = {}) {
  const s = S();
  const g = st.fila('Gastos', id);
  if (!g) falla('No encontré el gasto.');
  if (g.estado !== ESTADO.ANUL) falla('Ese gasto ya no está anulado.');
  if (L.mesCerrado(s, g.mes)) falla(`${g.mes} está cerrado: el administrador debe reabrirlo para restaurar el gasto.`);
  if (comoQueda !== ESTADO.CONF && comoQueda !== ESTADO.PROG) falla('Elige cómo queda el gasto.');
  if (comoQueda === ESTADO.CONF && !(num(g.monto) > 0)) falla('Este gasto no tiene monto: restáuralo como por pagar.');
  const cambios = [['Gastos', { id, estado: comoQueda }]];
  let n = 1;
  if (conPlan && g.plan_id) {
    const plan = st.fila('Planes', g.plan_id);
    if (plan?.estado === 'Cancelado') cambios.push(['Planes', { id: plan.id, estado: 'Activo' }]);
    (L.idx(s).gastosPorPlan.get(g.plan_id) || []).filter((x) => x.estado === ESTADO.ANUL && num(x.nro_cuota) > num(g.nro_cuota) && !L.mesCerrado(s, x.mes))
      .forEach((x) => { cambios.push(['Gastos', { id: x.id, estado: ESTADO.PROG }]); n++; });
  }
  st.guardar(cambios);
  return n;
}

/** Deshace una anulación recién hecha (aviso «Deshacer» al deslizar en Gastos): vuelve al estado que tenía. */
export function restaurarGasto(id, estado) {
  const g = st.fila('Gastos', id);
  if (!g) falla('No encontré el gasto.');
  if (L.mesCerrado(S(), g.mes)) falla(`${g.mes} está cerrado.`);
  if (estado !== ESTADO.CONF && estado !== ESTADO.PROG) falla('Ese estado no se puede recuperar.');
  st.guardar([['Gastos', { id, estado }]]);
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
