// Reglas de negocio (sección 6 de la especificación). Funciones puras sobre una
// "foto" S = { Tabla: [filas no eliminadas] }. Nada aquí toca la red ni la pantalla.

import { r2, num, sumarMeses, rangoMeses, difMeses, diasEnMes, norm } from './util.js';

export const ESTADO = { PROG: 'Programado', CONF: 'Confirmado', ANUL: 'Anulado' };

const memo = new WeakMap();
function cache(S, key, fn) {
  let m = memo.get(S);
  if (!m) memo.set(S, (m = new Map()));
  if (!m.has(key)) m.set(key, fn());
  return m.get(key);
}

/* ------------------------------------------------------------- Índices --- */

export function idx(S) {
  return cache(S, 'idx', () => {
    const by = (rows) => new Map(rows.map((r) => [r.id, r]));
    const group = (rows, k) => {
      const m = new Map();
      rows.forEach((r) => { const v = r[k]; if (!m.has(v)) m.set(v, []); m.get(v).push(r); });
      return m;
    };
    return {
      persona: by(S.Personas),
      categoria: by(S.Categorias),
      plan: by(S.Planes),
      gasto: by(S.Gastos),
      gastosPorMes: group(S.Gastos, 'mes'),
      gastosPorPlan: group(S.Gastos.filter((g) => g.plan_id), 'plan_id'),
      repartoPorGasto: group(S.GastosReparto, 'gasto_id'),
      liqPorMes: group(S.Liquidaciones, 'mes'),
      ingresosPorMes: group(S.Ingresos, 'mes'),
      ingresosPorPersona: group(S.Ingresos, 'persona_id'),
      presupuestoPorCat: group(S.Presupuesto, 'categoria_id')
    };
  });
}

export const activo = (r) => Number(r.activo) !== 0;
const porOrden = (a, b) => num(a.orden) - num(b.orden) || String(a.nombre).localeCompare(String(b.nombre));

export function personas(S, { todas = false } = {}) {
  return S.Personas.filter((p) => todas || activo(p)).sort(porOrden);
}
export function categorias(S, { todas = false } = {}) {
  return S.Categorias.filter((c) => todas || activo(c)).sort(porOrden);
}
export const persona = (S, id) => idx(S).persona.get(id);
export const categoria = (S, id) => idx(S).categoria.get(id);
export const esAdmin = (S, id) => persona(S, id)?.rol === 'Administrador';

/* ---------------------------------------------------------------- Grupos --- */

export const COLORES_GRUPO = ['#2F5D8A', '#1F7A5C', '#B4532A', '#6B4FA0', '#A23B72', '#2E7D6B', '#8A6D1F', '#5E5A54', '#C2410C', '#0E7490'];
const COLOR_GRUPO_INICIAL = { 'Vivienda y servicios': '#2F5D8A', 'Alimentación': '#1F7A5C', 'Transporte': '#B4532A', 'Ocio y suscripciones': '#6B4FA0', 'Personal': '#A23B72', 'Salud y educación': '#2E7D6B', 'Ahorro': '#8A6D1F' };
export const colorGrupoInicial = (nombre) => COLOR_GRUPO_INICIAL[nombre] || '#7A7F7C';
export const idGrupo = (nombre) => 'G_' + norm(nombre).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);

/** Grupos de categorías, en su orden. Si la hoja aún no tiene la pestaña Grupos, salen de las categorías. */
export function grupos(S, { todas = false } = {}) {
  return cache(S, 'grupos:' + todas, () => {
    const lista = (S.Grupos || []).filter((g) => todas || activo(g)).sort(porOrden);
    const nombres = new Set((S.Grupos || []).map((g) => norm(g.nombre)));
    // Grupos que solo existen escritos en una categoría (hojas anteriores a la versión 1.4).
    categorias(S, { todas: true }).forEach((c) => {
      const n = String(c.grupo || 'Otros').trim();
      if (!nombres.has(norm(n))) {
        nombres.add(norm(n));
        lista.push({ id: idGrupo(n), nombre: n, color: colorGrupoInicial(n), orden: 900 + lista.length, activo: 1, implicito: true });
      }
    });
    return lista;
  });
}

export function grupoDe(S, nombre) {
  const n = norm(nombre || 'Otros');
  return grupos(S, { todas: true }).find((g) => norm(g.nombre) === n) || null;
}

/** Categorías agrupadas por grupo, en el orden de los grupos. */
export function categoriasPorGrupo(S, { todas = false } = {}) {
  const cats = categorias(S, { todas });
  return grupos(S, { todas: true })
    .map((g) => ({ grupo: g, cats: cats.filter((c) => norm(c.grupo || 'Otros') === norm(g.nombre)) }))
    .filter((x) => x.cats.length);
}

export function config(S, clave, defecto) {
  const r = S.Config.find((c) => c.clave === clave);
  return r && r.valor !== '' ? r.valor : defecto;
}
export const umbral = (S) => num(config(S, 'umbral_alerta', 80)) || 80;

export function nombreDuplicado(rows, nombre, exceptoId) {
  const n = norm(nombre);
  return rows.some((r) => r.id !== exceptoId && norm(r.nombre) === n);
}

/* -------------------------------------------------------- Participación --- */

/** Porcentaje de cada persona vigente en `mes` (regla: el último "vigente_desde" ≤ mes). */
/** Año y mes de un «vigente_desde», aunque en la hoja se haya escrito con día o espacios ("2026-10-01", " 2026-10"). */
export function mesDeVigencia(v) {
  const m = String(v ?? '').trim().match(/^(\d{4})-(\d{1,2})/);
  return m ? `${m[1]}-${m[2].padStart(2, '0')}` : '';
}

/** Distribuciones guardadas, por mes de inicio y en orden: [{ desde, pcts }]. */
export function distribuciones(S) {
  return cache(S, 'dist', () => {
    const porMes = new Map();
    S.Participacion.forEach((p) => {
      const m = mesDeVigencia(p.vigente_desde);
      if (!m || !(num(p.porcentaje) > 0)) return;
      if (!porMes.has(m)) porMes.set(m, {});
      porMes.get(m)[p.persona_id] = num(p.porcentaje);
    });
    return [...porMes.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)).map(([desde, pcts]) => ({ desde, pcts }));
  });
}

/**
 * Distribución vigente en `mes`: la de mes de inicio más reciente que no pase de `mes`.
 * Para los meses anteriores a la primera, rige la primera (no partes iguales).
 */
export function vigencia(S, mes) {
  return cache(S, 'vig:' + mes, () => {
    const lista = distribuciones(S);
    const previa = lista.filter((d) => d.desde <= mes).at(-1) || lista[0];
    if (previa) return { desde: previa.desde, pcts: previa.pcts, anterior: previa.desde > mes };
    const ps = personas(S);
    const pcts = {};
    ps.forEach((p, i) => { pcts[p.id] = i === ps.length - 1 ? r2(100 - r2(100 / ps.length) * (ps.length - 1)) : r2(100 / ps.length); });
    return { desde: '', pcts, anterior: false };
  });
}

/**
 * Descripciones ya usadas, para sugerir al escribir (con la categoría con que se usó la última vez).
 * Cuenta los gastos confirmados y programados que no están anulados; un plan cuenta una sola vez.
 * Primero las que empiezan con lo escrito, luego las más usadas y las más recientes.
 */
export function sugerenciasDescripcion(S, texto = '', { max = 4 } = {}) {
  const todas = cache(S, 'sugs', () => {
    const mapa = new Map();
    const planes = new Set();
    for (const g of S.Gastos || []) {
      const nota = String(g.nota ?? '').replace(/\s+/g, ' ').trim();
      if (!nota || g.estado === ESTADO.ANUL || Number(g.eliminado) === 1) continue;
      if (g.plan_id) { if (planes.has(g.plan_id + '|' + nota)) continue; planes.add(g.plan_id + '|' + nota); }
      const k = norm(nota);
      const a = mapa.get(k) || { k, nota, n: 0, fecha: '', categoria_id: '' };
      a.n += 1;
      if (String(g.fecha || '') >= a.fecha) Object.assign(a, { fecha: String(g.fecha || ''), categoria_id: g.categoria_id, nota });
      mapa.set(k, a);
    }
    return [...mapa.values()].sort((a, b) => b.n - a.n || b.fecha.localeCompare(a.fecha));
  });
  const q = norm(texto);
  const activas = (x) => { const c = categoria(S, x.categoria_id); return c && Number(c.activo) !== 0; };
  const lista = todas.filter((x) => x.k !== q && (!q || x.k.includes(q)) && activas(x));
  const empieza = lista.filter((x) => x.k.startsWith(q));
  return [...empieza, ...lista.filter((x) => !x.k.startsWith(q))].slice(0, max);
}

/** Participación de cada persona vigente en `mes` (ver `vigencia`). */
export function participacion(S, mes) {
  return vigencia(S, mes).pcts;
}

/** Texto de un reparto en el orden de las personas: «Lucía 60 % · Jorge 40 %». */
export function textoReparto(S, pcts, { todas = false } = {}) {
  return personas(S, { todas }).filter((p) => num(pcts[p.id]) > 0)
    .map((p) => `${p.alias || p.nombre.split(' ')[0]} ${Number(num(pcts[p.id]).toFixed(2))} %`).join(' · ');
}
/** «60/40» en el orden de las personas. */
export const barrasReparto = (S, pcts) => personas(S).map((p) => Number(num(pcts[p.id]).toFixed(2))).join('/');

/** Reparte un monto según porcentajes; la última persona absorbe el redondeo. */
export function calcularReparto(montoSoles, pcts) {
  const ids = Object.keys(pcts).filter((id) => num(pcts[id]) > 0);
  let resto = r2(montoSoles);
  return ids.map((id, i) => {
    const m = i === ids.length - 1 ? r2(resto) : r2(montoSoles * num(pcts[id]) / 100);
    resto = r2(resto - m);
    return { persona_id: id, porcentaje: num(pcts[id]), monto_soles: m };
  });
}

export function pctsDeGasto(S, gasto) {
  const filas = (idx(S).repartoPorGasto.get(gasto.id) || []).filter((r) => num(r.porcentaje) > 0);
  if (filas.length) {
    const out = {};
    filas.forEach((r) => { out[r.persona_id] = num(r.porcentaje); });
    return out;
  }
  return participacion(S, gasto.mes);
}

export function repartoDeGasto(S, gasto) {
  return cache(S, 'rep:' + gasto.id, () => calcularReparto(num(gasto.monto_soles), pctsDeGasto(S, gasto)));
}

export function montoPara(S, gasto, pid) {
  if (!pid) return num(gasto.monto_soles);
  const f = repartoDeGasto(S, gasto).find((x) => x.persona_id === pid);
  return f ? f.monto_soles : 0;
}

export const sumaPcts = (pcts) => r2(Object.values(pcts).reduce((a, b) => a + num(b), 0));

/* ---------------------------------------------------- Moneda y cierres --- */

export function tipoCambio(S, mes, moneda = 'USD') {
  if (moneda === 'PEN') return 1;
  const filas = S.TiposCambio.filter((t) => t.moneda === moneda && num(t.tipo_cambio) > 0);
  const previas = filas.filter((t) => t.mes <= mes).sort((a, b) => (a.mes < b.mes ? 1 : -1));
  if (previas.length) return num(previas[0].tipo_cambio);
  return null;
}
export const tipoCambioDelMes = (S, mes) => num(S.TiposCambio.find((t) => t.mes === mes && t.moneda === 'USD')?.tipo_cambio) || null;

export const cierre = (S, mes) => S.Cierres.find((c) => c.mes === mes);
export const mesCerrado = (S, mes) => cierre(S, mes)?.estado === 'Cerrado';

/* -------------------------------------------------------------- Gastos --- */

export function gastosMes(S, mes, estados = [ESTADO.CONF, ESTADO.PROG]) {
  return (idx(S).gastosPorMes.get(mes) || []).filter((g) => estados.includes(g.estado));
}

export function tipoGasto(S, g) {
  return g.tipo || categoria(S, g.categoria_id)?.tipo || 'Variable';
}
export function naturaleza(S, g) {
  return categoria(S, g.categoria_id)?.naturaleza || 'Deseo';
}

/* ---------------------------------------------------- Presupuesto/topes --- */

/** Tope de una categoría en un mes: el del mes, si no el último anterior, si no el sugerido. 0 = sin tope. */
export function tope(S, mes, catId) {
  const filas = (idx(S).presupuestoPorCat.get(catId) || []).filter((p) => p.mes <= mes);
  if (filas.length) {
    const f = filas.reduce((a, b) => (b.mes > a.mes ? b : a));
    return num(f.tope_soles);
  }
  return num(categoria(S, catId)?.tope_sugerido);
}

export function topeExplicito(S, mes, catId) {
  return (idx(S).presupuestoPorCat.get(catId) || []).find((p) => p.mes === mes);
}

export function presupuestoMes(S, mes) {
  return r2(categorias(S).reduce((a, c) => a + tope(S, mes, c.id), 0));
}

export function estadoUso(usado, t, um) {
  if (!(t > 0)) return 'sin_tope';
  if (usado > t + 0.004) return 'excede';
  if (usado >= t * um / 100) return 'aviso';
  return 'ok';
}

/** Regla 11: confirmado + programado del mes + el gasto nuevo, contra el tope. */
export function usoCategoria(S, mes, catId, { extra = 0, excluirId = null, pid = null } = {}) {
  const usado = r2(gastosMes(S, mes).filter((g) => g.categoria_id === catId && g.id !== excluirId)
    .reduce((a, g) => a + montoPara(S, g, pid), 0) + extra);
  let t = tope(S, mes, catId);
  if (pid) t = r2(t * num(participacion(S, mes)[pid]) / 100);
  return { usado, tope: t, pct: t > 0 ? (usado / t) * 100 : 0, estado: estadoUso(usado, t, umbral(S)) };
}

/**
 * Sueldo vigente de una persona en `mes`: el último registrado en ese mes o antes.
 * Un sueldo registrado se mantiene en los meses siguientes hasta que se registre otro.
 */
export function ingresoVigente(S, pid, mes) {
  const filas = (idx(S).ingresosPorPersona.get(pid) || []).filter((i) => i.mes <= mes);
  if (!filas.length) return null;
  const f = filas.reduce((a, b) => (b.mes > a.mes ? b : a));
  let soles = num(f.monto_soles);
  if (f.moneda && f.moneda !== 'PEN') {
    const tc = tipoCambio(S, mes, f.moneda);
    if (tc) soles = r2(num(f.monto) * tc);
  }
  return { fila: f, desde: f.mes, propio: f.mes === mes, monto: num(f.monto), moneda: f.moneda || 'PEN', soles };
}

export function ingresoMes(S, mes, pid = null) {
  return cache(S, `ing:${mes}:${pid}`, () => {
    const ids = pid ? [pid] : [...new Set(S.Ingresos.map((i) => i.persona_id))];
    return r2(ids.reduce((a, id) => a + (ingresoVigente(S, id, mes)?.soles || 0), 0));
  });
}

/**
 * Participación propuesta según los sueldos vigentes del mes: cada uno aporta en proporción a lo que gana.
 * Con 100 y 50 propone 66.67 % y 33.33 %. Devuelve null si falta el sueldo de alguien.
 */
export function participacionPorIngresos(S, mes) {
  const ps = personas(S);
  if (!ps.length) return null;
  const montos = ps.map((p) => ({ p, v: ingresoVigente(S, p.id, mes) }));
  const faltan = montos.filter((x) => !x.v).map((x) => x.p);
  if (faltan.length) return { faltan, pcts: null };
  const total = montos.reduce((a, x) => a + x.v.soles, 0);
  if (!(total > 0)) return { faltan: [], pcts: null };
  const pcts = {};
  let resto = 100;
  montos.forEach((x, i) => {
    const v = i === montos.length - 1 ? r2(resto) : r2(x.v.soles / total * 100);
    pcts[x.p.id] = v;
    resto = r2(resto - v);
  });
  return { faltan: [], pcts, total: r2(total) };
}

export const mismosPcts = (a, b) => [...new Set([...Object.keys(a || {}), ...Object.keys(b || {})])]
  .every((id) => Math.abs(num(a?.[id]) - num(b?.[id])) < 0.005);

export function resumenMes(S, mes, pid = null) {
  return cache(S, `res:${mes}:${pid}`, () => {
    const gs = gastosMes(S, mes);
    let gastado = 0, comprometido = 0;
    const porCat = new Map();
    gs.forEach((g) => {
      const m = montoPara(S, g, pid);
      if (g.estado === ESTADO.CONF) gastado += m; else comprometido += m;
      const c = porCat.get(g.categoria_id) || { gastado: 0, comprometido: 0 };
      if (g.estado === ESTADO.CONF) c.gastado += m; else c.comprometido += m;
      porCat.set(g.categoria_id, c);
    });
    const factor = pid ? num(participacion(S, mes)[pid]) / 100 : 1;
    const um = umbral(S);
    const filas = categorias(S, { todas: true })
      .filter((c) => activo(c) || porCat.has(c.id))
      .map((c) => {
        const v = porCat.get(c.id) || { gastado: 0, comprometido: 0 };
        const t = r2(tope(S, mes, c.id) * factor);
        const usado = r2(v.gastado + v.comprometido);
        return { cat: c, gastado: r2(v.gastado), comprometido: r2(v.comprometido), usado, tope: t, pct: t > 0 ? usado / t * 100 : 0, estado: estadoUso(usado, t, um) };
      });
    const presupuesto = r2(presupuestoMes(S, mes) * factor);
    const ingreso = ingresoMes(S, mes, pid);
    gastado = r2(gastado); comprometido = r2(comprometido);
    return {
      gastado, comprometido, presupuesto, ingreso,
      disponible: r2(presupuesto - gastado - comprometido),
      porCategoria: filas,
      excedePresupuesto: presupuesto > 0 && gastado + comprometido > presupuesto + 0.004,
      excedeIngreso: ingreso > 0 && gastado + comprometido > ingreso + 0.004,
      pendientes: gs.filter((g) => g.estado === ESTADO.PROG).length
    };
  });
}

/* --------------------------------------------------- Saldos y arrastre --- */

function primerMes(S) {
  let m = null;
  S.Gastos.forEach((g) => { if (g.estado === ESTADO.CONF && g.mes && (!m || g.mes < m)) m = g.mes; });
  S.Liquidaciones.forEach((l) => { if (l.mes && (!m || l.mes < m)) m = l.mes; });
  S.CierresSaldos.forEach((f) => { if (f.mes && (!m || f.mes < m)) m = f.mes; });
  return m;
}

/**
 * Reglas 4 a 6. Saldo final = saldo inicial + pagado − le corresponde + liquidaciones pagadas − recibidas.
 * El saldo inicial de un mes es el saldo final del mes anterior. La suma de todos es cero.
 */
export function saldosHasta(S, mesHasta, { sinFotosDesde = null } = {}) {
  return cache(S, `saldos:${mesHasta}:${sinFotosDesde}`, () => {
    const inicio = primerMes(S);
    const ids = new Set(personas(S).map((p) => p.id));
    S.Gastos.forEach((g) => { if (g.estado === ESTADO.CONF && g.pagado_por) ids.add(g.pagado_por); });
    S.GastosReparto.forEach((r) => ids.add(r.persona_id));
    S.Liquidaciones.forEach((l) => { ids.add(l.de_persona_id); ids.add(l.a_persona_id); });
    S.CierresSaldos.forEach((f) => ids.add(f.persona_id));
    const lista = [...ids].filter(Boolean);
    const out = new Map();
    let previo = Object.fromEntries(lista.map((id) => [id, 0]));
    if (!inicio || inicio > mesHasta) {
      out.set(mesHasta, filasSaldo(lista, previo, {}, {}, {}, {}));
      return out;
    }
    const fotos = new Map();
    S.CierresSaldos.forEach((f) => { if (!fotos.has(f.mes)) fotos.set(f.mes, []); fotos.get(f.mes).push(f); });
    for (const mes of rangoMeses(inicio, mesHasta)) {
      // Un mes cerrado queda congelado: se usan los saldos guardados al cerrarlo.
      const foto = fotos.get(mes);
      if (foto && mesCerrado(S, mes) && !(sinFotosDesde && mes >= sinFotosDesde)) {
        const filas = lista.map((id) => {
          const f = foto.find((x) => x.persona_id === id);
          const liq = num(f?.liquidado);
          return {
            persona_id: id, saldo_inicial: r2(num(f?.saldo_inicial)), pagado: r2(num(f?.pagado)), corresponde: r2(num(f?.corresponde)),
            liq_pagado: liq > 0 ? r2(liq) : 0, liq_recibido: liq < 0 ? r2(-liq) : 0,
            saldo_mes: r2(num(f?.pagado) - num(f?.corresponde)), saldo_final: r2(num(f?.saldo_final))
          };
        });
        out.set(mes, filas);
        previo = Object.fromEntries(filas.map((f) => [f.persona_id, f.saldo_final]));
        continue;
      }
      const pagado = {}, corresponde = {}, liqPag = {}, liqRec = {};
      gastosMes(S, mes, [ESTADO.CONF]).forEach((g) => {
        pagado[g.pagado_por] = (pagado[g.pagado_por] || 0) + num(g.monto_soles);
        repartoDeGasto(S, g).forEach((r) => { corresponde[r.persona_id] = (corresponde[r.persona_id] || 0) + r.monto_soles; });
      });
      (idx(S).liqPorMes.get(mes) || []).forEach((l) => {
        liqPag[l.de_persona_id] = (liqPag[l.de_persona_id] || 0) + num(l.monto_soles);
        liqRec[l.a_persona_id] = (liqRec[l.a_persona_id] || 0) + num(l.monto_soles);
      });
      const filas = filasSaldo(lista, previo, pagado, corresponde, liqPag, liqRec);
      out.set(mes, filas);
      previo = Object.fromEntries(filas.map((f) => [f.persona_id, f.saldo_final]));
    }
    return out;
  });
}

function filasSaldo(lista, previo, pagado, corresponde, liqPag, liqRec) {
  return lista.map((id) => {
    const f = {
      persona_id: id,
      saldo_inicial: r2(previo[id] || 0),
      pagado: r2(pagado[id] || 0),
      corresponde: r2(corresponde[id] || 0),
      liq_pagado: r2(liqPag[id] || 0),
      liq_recibido: r2(liqRec[id] || 0)
    };
    f.saldo_mes = r2(f.pagado - f.corresponde);
    f.saldo_final = r2(f.saldo_inicial + f.saldo_mes + f.liq_pagado - f.liq_recibido);
    return f;
  });
}

export function saldosMes(S, mes, opciones = {}) {
  const m = saldosHasta(S, mes, opciones);
  if (m.has(mes)) return m.get(mes);
  // Mes anterior a cualquier movimiento: todo en cero.
  return [...m.values()].at(-1).map((f) => ({ ...f, saldo_inicial: 0, pagado: 0, corresponde: 0, liq_pagado: 0, liq_recibido: 0, saldo_mes: 0, saldo_final: 0 }));
}

/** Regla 7: quienes deben pagan a quienes les deben, empezando por los saldos más grandes. */
export function transferencias(filas) {
  const deudores = filas.filter((f) => f.saldo_final < -0.004).map((f) => ({ id: f.persona_id, v: -f.saldo_final })).sort((a, b) => b.v - a.v);
  const acreedores = filas.filter((f) => f.saldo_final > 0.004).map((f) => ({ id: f.persona_id, v: f.saldo_final })).sort((a, b) => b.v - a.v);
  const out = [];
  let i = 0, j = 0;
  while (i < deudores.length && j < acreedores.length) {
    const m = r2(Math.min(deudores[i].v, acreedores[j].v));
    if (m > 0.004) out.push({ de: deudores[i].id, a: acreedores[j].id, monto: m });
    deudores[i].v = r2(deudores[i].v - m);
    acreedores[j].v = r2(acreedores[j].v - m);
    if (deudores[i].v <= 0.004) i++;
    if (acreedores[j].v <= 0.004) j++;
  }
  return out;
}

/* ---------------------------------------------------- Cuotas y planes --- */

/** Regla 9: total ÷ n con 2 decimales; la última cuota absorbe la diferencia. */
export function montosCuotas(total, n, factores = null) {
  n = Math.max(1, Math.floor(n));
  const f = factores && factores.length === n ? factores : Array(n).fill(1);
  const unidades = f.reduce((a, b) => a + b, 0);
  const c = r2(total / unidades);
  const out = f.map((x) => r2(c * x));
  out[n - 1] = r2(total - out.slice(0, -1).reduce((a, b) => a + b, 0));
  return out;
}

/* ------------------------------------------------------- Cuotas dobles --- */

export const MESES_CORTOS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
export const MESES_LARGOS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

/** Meses del año (1 a 12) en que el plan paga el doble, por ejemplo "6,12". */
export function mesesDobles(valor) {
  const v = Array.isArray(valor) ? valor.join(',') : (typeof valor === 'object' && valor !== null ? valor.meses_dobles : valor);
  return [...new Set(String(v || '').split(/[^0-9]+/).map(Number).filter((m) => m >= 1 && m <= 12))].sort((a, b) => a - b);
}
export const textoMesesDobles = (lista) => {
  const n = lista.map((m) => MESES_LARGOS[m - 1]);
  return n.length > 1 ? n.slice(0, -1).join(', ') + ' y ' + n.at(-1) : (n[0] || '');
};
/** 2 si en ese mes el plan paga doble; 1 si no. */
export const factorMes = (dobles, mes) => (mesesDobles(dobles).includes(Number(String(mes).slice(5, 7))) ? 2 : 1);
export const factoresDe = (dobles, meses) => meses.map((m) => factorMes(dobles, m));

/**
 * Cuotas de una compra: el total se divide en unidades (una cuota doble vale dos) y la última absorbe
 * el redondeo. `cuotaEditada` (con intereses) reemplaza la cuota normal; las dobles valen el doble.
 */
export function planCuotas(total, n, mesInicio, dobles, cuotaEditada = 0) {
  n = Math.max(1, Math.floor(num(n)));
  const meses = Array.from({ length: n }, (_, k) => sumarMeses(mesInicio, k));
  const factores = factoresDe(dobles, meses);
  const unidades = factores.reduce((a, b) => a + b, 0);
  let base = r2(num(total) / unidades);
  let montos = montosCuotas(r2(num(total)), n, factores);
  if (num(cuotaEditada) > 0 && Math.abs(num(cuotaEditada) - base) > 0.004) {
    base = r2(num(cuotaEditada));
    montos = factores.map((f) => r2(base * f));
  }
  return { meses, factores, montos, base, total: r2(montos.reduce((a, b) => a + b, 0)), dobles: factores.filter((f) => f === 2).length };
}

export function fechaEnMes(mes, dia) {
  return `${mes}-${String(Math.min(Math.max(1, num(dia) || 1), diasEnMes(mes))).padStart(2, '0')}`;
}

/** Meses que debe tener un plan hasta `horizonte` (incluido). */
export function mesesDePlan(plan, horizonte) {
  if (plan.modalidad === 'Cuotas') {
    return Array.from({ length: num(plan.nro_cuotas) }, (_, k) => sumarMeses(plan.mes_inicio, k));
  }
  const dur = num(plan.duracion_meses);
  const fin = dur > 0 ? sumarMeses(plan.mes_inicio, dur - 1) : horizonte;
  const hasta = fin < horizonte ? fin : horizonte;
  return hasta >= plan.mes_inicio ? rangoMeses(plan.mes_inicio, hasta) : [];
}

export const idGastoDePlan = (planId, k) => `${planId}-${String(k + 1).padStart(3, '0')}`;

/* ------------------------------------------------------- Indicadores --- */

export function evolucion(S, mesFin, n = 12, pid = null) {
  return rangoMeses(sumarMeses(mesFin, -(n - 1)), mesFin).map((mes) => {
    const r = resumenMes(S, mes, pid);
    return { mes, gastado: r.gastado, comprometido: r.comprometido, total: r2(r.gastado + r.comprometido), presupuesto: r.presupuesto, ingreso: r.ingreso };
  });
}

export function mapaCategorias(S, mesFin, n = 6, pid = null) {
  const meses = rangoMeses(sumarMeses(mesFin, -(n - 1)), mesFin);
  const res = meses.map((m) => resumenMes(S, m, pid));
  const totales = new Map();
  res.forEach((r) => r.porCategoria.forEach((f) => totales.set(f.cat.id, (totales.get(f.cat.id) || 0) + f.usado)));
  const cats = categorias(S, { todas: true }).filter((c) => (totales.get(c.id) || 0) > 0)
    .sort((a, b) => totales.get(b.id) - totales.get(a.id));
  return {
    meses,
    filas: cats.map((c) => ({
      cat: c,
      valores: res.map((r) => {
        const f = r.porCategoria.find((x) => x.cat.id === c.id);
        return f && f.tope > 0 ? { pct: f.pct, estado: f.estado, usado: f.usado } : (f && f.usado > 0 ? { pct: null, estado: 'sin_tope', usado: f.usado } : null);
      })
    }))
  };
}

export function concentracion(S, mes, pid = null, top = 5) {
  const r = resumenMes(S, mes, pid);
  const total = r2(r.gastado + r.comprometido);
  return r.porCategoria.filter((f) => f.usado > 0).sort((a, b) => b.usado - a.usado).slice(0, top)
    .map((f) => ({ cat: f.cat, monto: f.usado, pct: total > 0 ? f.usado / total * 100 : 0 }));
}

export function fijoVariable(S, mesFin, n = 6, pid = null) {
  return rangoMeses(sumarMeses(mesFin, -(n - 1)), mesFin).map((mes) => {
    let fijo = 0, variable = 0;
    gastosMes(S, mes).forEach((g) => {
      const m = montoPara(S, g, pid);
      if (tipoGasto(S, g) === 'Fijo') fijo += m; else variable += m;
    });
    return { mes, fijo: r2(fijo), variable: r2(variable) };
  });
}

/** Regla 50/30/20 sobre el ingreso: necesidades, deseos y lo que queda (ahorro). */
export function regla503020(S, mes, pid = null) {
  const ingreso = ingresoMes(S, mes, pid);
  let necesidad = 0, deseo = 0, ahorroCat = 0;
  gastosMes(S, mes).forEach((g) => {
    const m = montoPara(S, g, pid);
    const nat = naturaleza(S, g);
    if (nat === 'Necesidad') necesidad += m; else if (nat === 'Ahorro') ahorroCat += m; else deseo += m;
  });
  const ahorro = r2(ingreso - necesidad - deseo);
  const p = (v) => (ingreso > 0 ? v / ingreso * 100 : 0);
  return { ingreso, necesidad: r2(necesidad), deseo: r2(deseo), ahorroCat: r2(ahorroCat), ahorro,
    pNecesidad: p(necesidad), pDeseo: p(deseo), pAhorro: p(ahorro) };
}

export function tasaAhorro(S, mesFin, n = 12, pid = null) {
  return evolucion(S, mesFin, n, pid).map((e) => ({ mes: e.mes, ingreso: e.ingreso, ahorro: r2(e.ingreso - e.total), pct: e.ingreso > 0 ? (e.ingreso - e.total) / e.ingreso * 100 : null }));
}

export function deudaEvolucion(S, mesFin, n = 6) {
  const mapa = saldosHasta(S, mesFin);
  return rangoMeses(sumarMeses(mesFin, -(n - 1)), mesFin).map((mes) => {
    const filas = mapa.get(mes);
    if (!filas) return { mes, deuda: 0, transferencias: [] };
    const t = transferencias(filas);
    return { mes, deuda: r2(t.reduce((a, x) => a + x.monto, 0)), transferencias: t };
  });
}

export function compromisos(S, desde, n = 12) {
  return rangoMeses(desde, sumarMeses(desde, n - 1)).map((mes) => {
    const items = gastosMes(S, mes, [ESTADO.PROG]);
    return { mes, monto: r2(items.reduce((a, g) => a + num(g.monto_soles), 0)), items };
  });
}

export function planesActivos(S) {
  return S.Planes.filter((p) => p.estado !== 'Cancelado');
}

export function progresoPlan(S, plan) {
  const gs = (idx(S).gastosPorPlan.get(plan.id) || []);
  const vivos = gs.filter((g) => g.estado !== ESTADO.ANUL);
  const conf = vivos.filter((g) => g.estado === ESTADO.CONF).length;
  const prog = vivos.filter((g) => g.estado === ESTADO.PROG);
  return { total: vivos.length, confirmadas: conf, pendientes: prog.length, montoPendiente: r2(prog.reduce((a, g) => a + num(g.monto_soles), 0)), proxima: prog.sort((a, b) => (a.mes < b.mes ? -1 : 1))[0] };
}

export { difMeses };

/* --------------------------------------------------------------- Reporte --- */

/**
 * Gastos registrados entre dos meses, con filtros, y sus totales por categoría, persona y mes.
 * filtros: { desde, hasta, pagador, cat, estado: 'todos'|'conf'|'prog', tipo, evidencia: ''|'con'|'sin' }
 */
export function reporte(S, f) {
  const estados = f.estado === 'conf' ? [ESTADO.CONF] : f.estado === 'prog' ? [ESTADO.PROG] : [ESTADO.CONF, ESTADO.PROG];
  const meses = rangoMeses(f.desde, f.hasta);
  let filas = [];
  meses.forEach((m) => filas.push(...gastosMes(S, m, estados)));
  if (f.pagador) filas = filas.filter((g) => g.pagado_por === f.pagador);
  if (f.cat) filas = filas.filter((g) => g.categoria_id === f.cat);
  if (f.tipo) filas = filas.filter((g) => tipoGasto(S, g) === f.tipo);
  if (f.evidencia === 'con') filas = filas.filter((g) => g.evidencia_id);
  if (f.evidencia === 'sin') filas = filas.filter((g) => !g.evidencia_id);
  filas.sort((a, b) => (a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : String(b.creado_en).localeCompare(String(a.creado_en))));

  const total = r2(filas.reduce((a, g) => a + num(g.monto_soles), 0));
  const porCat = new Map();
  const porMes = new Map(meses.map((m) => [m, { mes: m, total: 0, n: 0 }]));
  const pagado = new Map(), corresponde = new Map(), nPer = new Map();
  filas.forEach((g) => {
    const v = num(g.monto_soles);
    const c = porCat.get(g.categoria_id) || { cat: categoria(S, g.categoria_id) || { id: g.categoria_id, nombre: '(sin categoría)' }, total: 0, n: 0 };
    c.total += v; c.n++; porCat.set(g.categoria_id, c);
    const m = porMes.get(g.mes); if (m) { m.total += v; m.n++; }
    pagado.set(g.pagado_por, (pagado.get(g.pagado_por) || 0) + v);
    nPer.set(g.pagado_por, (nPer.get(g.pagado_por) || 0) + 1);
    repartoDeGasto(S, g).forEach((r) => corresponde.set(r.persona_id, (corresponde.get(r.persona_id) || 0) + r.monto_soles));
  });
  const pctDe = (v) => (total > 0 ? (v / total) * 100 : 0);
  const ids = new Set([...pagado.keys(), ...corresponde.keys()]);
  return {
    filas, total, n: filas.length, meses: meses.length,
    promedioMes: r2(total / Math.max(1, meses.length)),
    conEvidencia: filas.filter((g) => g.evidencia_id).length,
    porCategoria: [...porCat.values()].map((c) => ({ ...c, total: r2(c.total), pct: pctDe(c.total) })).sort((a, b) => b.total - a.total),
    porMes: [...porMes.values()].map((m) => ({ ...m, total: r2(m.total) })),
    porPersona: [...ids].map((id) => ({ persona: persona(S, id) || { id, nombre: '—' }, pagado: r2(pagado.get(id) || 0), corresponde: r2(corresponde.get(id) || 0), n: nPer.get(id) || 0 }))
      .sort((a, b) => b.pagado - a.pagado)
  };
}

/* ------------------------------------------------- 2.0 · Novedades y ayudas --- */

/** Filas creadas automáticamente (renovación de mensuales) llevan esta fecha antigua y no son novedades. */
const esGenerada = (g) => String(g.creado_en || '').startsWith('2000-');
const autorDe = (g) => g.registrado_por || g.creado_por || '';

/**
 * Gastos que registró otra persona, del más reciente al más antiguo. Un plan (cuotas o mensual) cuenta una
 * vez, con su primer mes. `visto` (ISO) marca cuáles son nuevos para este celular.
 */
export function novedades(S, yo, { visto = '', max = 40 } = {}) {
  return cache(S, `nov:${yo}:${visto}:${max}`, () => {
    const planes = new Map();
    const lista = [];
    for (const g of S.Gastos) {
      const autor = autorDe(g);
      if (!autor || autor === yo || esGenerada(g)) continue;
      if (g.plan_id) {
        const prev = planes.get(g.plan_id);
        if (!prev || num(g.nro_cuota) < num(prev.nro_cuota)) planes.set(g.plan_id, g);
        continue;
      }
      lista.push(g);
    }
    lista.push(...planes.values());
    return lista
      .sort((a, b) => String(b.creado_en).localeCompare(String(a.creado_en)))
      .slice(0, max)
      .map((g) => ({
        gasto: g,
        plan: g.plan_id ? idx(S).plan.get(g.plan_id) || null : null,
        autor: autorDe(g),
        cuando: g.creado_en,
        nueva: !!visto && String(g.creado_en) > visto,
        parte: montoPara(S, g, yo)
      }));
  });
}
export const novedadesSinVer = (S, yo, visto) => (visto ? novedades(S, yo, { visto }).filter((n) => n.nueva).length : 0);

/** Programados por confirmar hasta `dias` adelante (incluye los atrasados), por fecha. */
export function proximos(S, hoyStr, { dias = 31 } = {}) {
  const lim = new Date(hoyStr + 'T12:00:00'); lim.setDate(lim.getDate() + dias);
  const tope = lim.toISOString().slice(0, 10);
  const mes = hoyStr.slice(0, 7);
  const meses = [sumarMeses(mes, -1), mes, sumarMeses(mes, 1)];
  return meses.flatMap((m) => gastosMes(S, m, [ESTADO.PROG]))
    .filter((g) => g.fecha <= tope && !mesCerrado(S, g.mes))
    .sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0))
    .map((g) => ({ gasto: g, atrasado: g.fecha < hoyStr }));
}

/** Cuánto se puede gastar por día lo que queda del mes sin pasar el presupuesto (solo el mes en curso). */
export function disponiblePorDia(S, mes, hoyStr) {
  if (hoyStr.slice(0, 7) !== mes) return null;
  const r = resumenMes(S, mes);
  if (!(r.presupuesto > 0)) return null;
  const quedan = diasEnMes(mes) - Number(hoyStr.slice(8, 10)) + 1;
  const disponible = r2(r.presupuesto - r.gastado - r.comprometido);
  return { disponible, dias: quedan, porDia: quedan > 0 ? r2(Math.max(0, disponible) / quedan) : 0 };
}

/** Busca gastos por descripción, categoría, grupo, quién pagó o monto, en todos los meses. */
export function buscarGastos(S, texto, { max = 60 } = {}) {
  const q = norm(texto);
  if (!q) return [];
  const monto = Number(q.replace(',', '.'));
  return S.Gastos.filter((g) => g.estado !== ESTADO.ANUL)
    .filter((g) => {
      const cat = categoria(S, g.categoria_id);
      const hay = norm([g.nota, cat?.nombre, cat?.grupo, persona(S, g.pagado_por)?.nombre].join(' '));
      return hay.includes(q) || (monto > 0 && Math.abs(num(g.monto) - monto) < 0.005);
    })
    .sort((a, b) => (a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : 0))
    .slice(0, max);
}

const nombreCorto = (p) => p?.alias || String(p?.nombre || '').split(' ')[0] || '';
const dineroTxt = (n, moneda = 'PEN') => `${moneda === 'USD' ? 'US$' : 'S/'} ${Number(n || 0).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/**
 * Avisos push de un registro nuevo para cada otra persona del hogar: quién lo registró, la descripción,
 * el monto, la categoría y cuánto le toca a quien lo recibe. `id` es un gasto o un plan.
 */
export function avisosDeRegistro(S, id, yo) {
  const plan = idx(S).plan.get(id) || null;
  const g = plan ? S.Gastos.find((x) => x.id === idGastoDePlan(id, 0)) || S.Gastos.find((x) => x.plan_id === id) : S.Gastos.find((x) => x.id === id);
  if (!g) return [];
  const autor = persona(S, yo);
  const cat = categoria(S, g.categoria_id);
  const desc = String(g.nota || plan?.descripcion || cat?.nombre || 'Gasto');
  const pagador = persona(S, g.pagado_por);
  let que;
  if (plan?.modalidad === 'Cuotas') que = `${desc} · ${dineroTxt(plan.monto_total, plan.moneda)} en ${plan.nro_cuotas} cuotas de ${dineroTxt(plan.monto_cuota, plan.moneda)}`;
  else if (plan?.modalidad === 'Recurrente') que = `${desc} · ${dineroTxt(plan.monto_cuota, plan.moneda)} cada mes`;
  else que = `${desc} · ${dineroTxt(g.monto, g.moneda)}`;
  return personas(S).filter((p) => p.id !== yo).map((p) => {
    const reparto = repartoDeGasto(S, g).find((x) => x.persona_id === p.id);
    const parte = reparto ? reparto.monto_soles : 0;
    const toca = parte > 0 ? `Te toca ${dineroTxt(parte)} (${Number(reparto.porcentaje).toLocaleString('es-PE', { maximumFractionDigits: 2 })} %)${plan ? ' al mes' : ''}` : 'No te toca nada';
    const pago = g.pagado_por === p.id ? ' · lo pagaste tú' : g.pagado_por !== yo && pagador ? ` · pagó ${nombreCorto(pagador)}` : '';
    return {
      para: p.id,
      titulo: `${nombreCorto(autor)} registró un gasto`,
      cuerpo: `${que}\n${cat?.nombre || 'Sin categoría'} · ${toca}${pago}`,
      url: `#/gasto/${g.id}`,
      tag: plan ? plan.id : g.id
    };
  });
}
