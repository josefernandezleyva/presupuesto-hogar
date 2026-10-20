// Reporte de gastos registrados: filtros, totales, agrupaciones y exportación a Excel (CSV).

import * as L from '../logic.js';
import { esc, fmt, pct, nombreMes, sumarMeses, fechaCorta, num, difMeses } from '../util.js';
import { encabezado, barraMes, chips, segmentado, dinero, dinero0, barra, avatar, icono, vacio, alerta } from '../ui.js';
import { barras } from '../charts.js';
import { puntoCat } from './comun.js';

const PERIODOS = [{ v: '1', l: 'Mes' }, { v: '3', l: '3 meses' }, { v: '12', l: '12 meses' }, { v: 'rango', l: 'Elegir' }];
const VISTAS = [{ v: 'detalle', l: 'Detalle' }, { v: 'categoria', l: 'Categoría' }, { v: 'persona', l: 'Persona' }, { v: 'mes', l: 'Mes' }];

function filtros(c) {
  const e = c.estado;
  let desde, hasta;
  if (e.periodo === 'rango') {
    desde = /^\d{4}-\d{2}$/.test(e.desde || '') ? e.desde : c.mes;
    hasta = /^\d{4}-\d{2}$/.test(e.hasta || '') ? e.hasta : c.mes;
    if (desde > hasta) [desde, hasta] = [hasta, desde];
    if (difMeses(desde, hasta) > 59) desde = sumarMeses(hasta, -59);
  } else {
    hasta = c.mes;
    desde = sumarMeses(hasta, -(Number(e.periodo) - 1));
  }
  return { desde, hasta, pagador: e.pagador, cat: e.cat, estado: e.est, tipo: e.tipo, evidencia: e.ev };
}

function textoPeriodo(f) {
  const m = (x) => `${nombreMes(x, { corto: true, anio: false })} ${x.slice(0, 4)}`;
  return f.desde === f.hasta ? nombreMes(f.hasta) : `${m(f.desde)} – ${m(f.hasta)}`;
}

function csv(c, r) {
  const { S } = c;
  const ps = L.personas(S, { todas: true });
  const q = (v) => {
    const s = String(v ?? '');
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const cab = ['Fecha', 'Mes', 'Categoría', 'Grupo', 'Tipo', 'Nota', 'Pagado por', 'Monto', 'Moneda', 'Tipo de cambio', 'Monto en soles', 'Estado', 'Cuota',
    ...ps.map((p) => `Le corresponde a ${p.nombre}`), 'Evidencia'];
  const filas = r.filas.map((g) => {
    const cat = L.categoria(S, g.categoria_id);
    const plan = g.plan_id ? L.idx(S).plan.get(g.plan_id) : null;
    const rep = L.repartoDeGasto(S, g);
    return [g.fecha, g.mes, cat?.nombre || '', cat?.grupo || '', L.tipoGasto(S, g), g.nota || '', L.persona(S, g.pagado_por)?.nombre || '',
      num(g.monto).toFixed(2), g.moneda, num(g.tipo_cambio) || 1, num(g.monto_soles).toFixed(2), g.estado,
      plan && plan.modalidad === 'Cuotas' ? `${g.nro_cuota}/${plan.nro_cuotas}` : '',
      ...ps.map((p) => (rep.find((x) => x.persona_id === p.id)?.monto_soles || 0).toFixed(2)), g.evidencia_url || (g.evidencia_id ? 'sí' : '')];
  });
  return '﻿' + [cab, ...filas].map((l) => l.map(q).join(',')).join('\r\n');
}

async function exportar(c) {
  const f = filtros(c);
  const r = L.reporte(c.S, f);
  if (!r.n) { c.avisar('No hay gastos para exportar con estos filtros.', 'bad'); return; }
  const nombre = `gastos_${f.desde}${f.hasta !== f.desde ? '_a_' + f.hasta : ''}.csv`;
  const archivo = new File([csv(c, r)], nombre, { type: 'text/csv' });
  try {
    if (navigator.canShare && navigator.canShare({ files: [archivo] })) {
      await navigator.share({ files: [archivo], title: 'Reporte de gastos' });
      return;
    }
  } catch (e) {
    if (e && e.name === 'AbortError') return;
  }
  const url = URL.createObjectURL(archivo);
  const a = document.createElement('a');
  a.href = url; a.download = nombre; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  c.avisar('Archivo listo: ' + nombre);
}

export default {
  iniciar(c) {
    Object.assign(c.estado, { periodo: '1', vista: 'detalle', pagador: '', cat: '', est: 'todos', tipo: '', ev: '', desde: sumarMeses(c.mes, -2), hasta: c.mes });
  },
  vista(c) {
    const { S, estado: e } = c;
    const f = filtros(c);
    const r = L.reporte(S, f);
    const personas = [{ v: '', l: 'Todos' }, ...L.personas(S).map((p) => ({ v: p.id, l: p.alias || p.nombre }))];
    const cats = L.categorias(S, { todas: true });

    return `${encabezado({ titulo: 'Reporte de gastos' })}
    <main class="pad">
      ${e.periodo === 'rango' ? '' : barraMes(c.mes)}
      ${segmentado('periodo', PERIODOS, e.periodo, 'Periodo')}
      ${e.periodo === 'rango' ? `<section class="card stack">
        <label class="frow"><span class="muted">Desde</span><input type="month" class="inl" data-f="desde" data-r value="${esc(e.desde)}"></label>
        <label class="frow"><span class="muted">Hasta</span><input type="month" class="inl" data-f="hasta" data-r value="${esc(e.hasta)}"></label>
      </section>` : ''}

      <section class="card stack">
        <div class="lbl">Pagado por</div>
        ${chips('pagador', personas, e.pagador, { clase: 'scroll', label: 'Pagado por' })}
        <div class="split gap">
          <select class="select" data-f="cat" data-r aria-label="Categoría"><option value="">Categoría</option>${cats.map((x) => `<option value="${esc(x.id)}"${x.id === e.cat ? ' selected' : ''}>${esc(x.nombre)}</option>`).join('')}</select>
          <select class="select" data-f="est" data-r aria-label="Estado">
            <option value="todos"${e.est === 'todos' ? ' selected' : ''}>Estado</option>
            <option value="conf"${e.est === 'conf' ? ' selected' : ''}>Confirmados</option>
            <option value="prog"${e.est === 'prog' ? ' selected' : ''}>Programados</option>
          </select>
        </div>
        <div class="split gap">
          <select class="select" data-f="tipo" data-r aria-label="Tipo"><option value="">Tipo</option><option value="Fijo"${e.tipo === 'Fijo' ? ' selected' : ''}>Solo fijos</option><option value="Variable"${e.tipo === 'Variable' ? ' selected' : ''}>Solo variables</option></select>
          <select class="select" data-f="ev" data-r aria-label="Evidencia"><option value="">Foto</option><option value="con"${e.ev === 'con' ? ' selected' : ''}>Con foto</option><option value="sin"${e.ev === 'sin' ? ' selected' : ''}>Sin foto</option></select>
        </div>
      </section>

      <section class="card">
        <div class="lbl">${esc(textoPeriodo(f))}</div>
        <div class="quad">
          <div><div class="xs muted">Total</div><div class="mid">${dinero(r.total)}</div></div>
          <div><div class="xs muted">Gastos</div><div class="mid">${r.n}</div></div>
          <div><div class="xs muted">${r.meses > 1 ? 'Promedio por mes' : 'Promedio por gasto'}</div><div class="mid">${dinero0(r.meses > 1 ? r.promedioMes : (r.n ? r.total / r.n : 0))}</div></div>
          <div><div class="xs muted">Con foto</div><div class="mid">${r.conEvidencia} de ${r.n}</div></div>
        </div>
      </section>

      ${segmentado('vista', VISTAS, e.vista, 'Agrupar por')}
      ${r.n ? vistaDe(c, r) : vacio('No hay gastos registrados con estos filtros.')}

      <button type="button" class="btn sec wide" data-a="exportar">${icono('compartir', 18)} Exportar a Excel (CSV)</button>
      <p class="xs muted center">El archivo trae una fila por gasto, con el reparto de cada persona y el enlace a la foto en Drive.</p>
    </main>`;
  },
  acciones: {
    exportar: (c) => exportar(c)
  }
};

function vistaDe(c, r) {
  const { S, estado: e } = c;
  if (e.vista === 'categoria') {
    return `<section class="card">${r.porCategoria.map((x) => `<div class="catrow">
      <div class="split sm"><span>${puntoCat(x.cat)} ${esc(x.cat.nombre)} <span class="muted xs">· ${x.n}</span></span><span><strong>${dinero(x.total)}</strong> <span class="muted xs">${esc(pct(x.pct))}</span></span></div>
      ${barra(x.pct, 'ok')}</div>`).join('')}</section>`;
  }
  if (e.vista === 'persona') {
    return `<section class="card list">${r.porPersona.map((x) => `<div class="row">${avatar(x.persona, 32)}
      <span class="row-m"><span class="row-t">${esc(x.persona.nombre)}</span><span class="row-s">${x.n} ${x.n === 1 ? 'gasto pagado' : 'gastos pagados'} · le corresponde ${esc(fmt(x.corresponde))}</span></span>
      <span class="amt">${dinero(x.pagado)}<span class="row-s">pagó</span></span></div>`).join('')}</section>
      <p class="xs muted">«Le corresponde» es su parte según el reparto de cada gasto. La diferencia entre lo que pagó y lo que le corresponde es lo que se compensa en el cierre de mes.</p>`;
  }
  if (e.vista === 'mes') {
    const corto = (m) => nombreMes(m, { corto: true, anio: r.meses > 12 });
    return `<section class="card">
      ${r.meses > 1 ? barras(r.porMes.map((m) => ({ label: corto(m.mes), valor: m.total })), { aria: 'Total registrado por mes', etiquetas: r.meses <= 6 ? 'todas' : 'auto' }) : ''}
      <div class="list">${r.porMes.filter((m) => m.n > 0).reverse().map((m) => `<div class="split sm" style="padding:6px 0"><span>${esc(nombreMes(m.mes))} <span class="muted xs">· ${m.n}</span></span><strong>${dinero(m.total)}</strong></div>`).join('')}</div>
    </section>`;
  }
  // Detalle, agrupado por mes y ordenado del más reciente al más antiguo.
  const grupos = new Map();
  r.filas.forEach((g) => { if (!grupos.has(g.mes)) grupos.set(g.mes, []); grupos.get(g.mes).push(g); });
  const limite = 300;
  let mostrados = 0;
  return [...grupos.entries()].map(([mes, gs]) => {
    if (mostrados >= limite) return '';
    const parte = gs.slice(0, limite - mostrados);
    mostrados += parte.length;
    const totalMes = gs.reduce((a, g) => a + num(g.monto_soles), 0);
    return `<h3 class="dia">${esc(nombreMes(mes))} · ${esc(fmt(totalMes))}</h3><section class="card list">${parte.map((g) => {
      const cat = L.categoria(S, g.categoria_id);
      const plan = g.plan_id ? L.idx(S).plan.get(g.plan_id) : null;
      return `<a class="row" href="#/gasto/${esc(g.id)}">
        <span class="row-m"><span class="row-t">${puntoCat(cat)} ${esc(g.nota || cat?.nombre || 'Gasto')}${g.evidencia_id ? ` <span class="clip" aria-label="Tiene foto">${icono('foto', 14)}</span>` : ''}${g.estado === L.ESTADO.PROG ? ' <span class="badge soft">Programado</span>' : ''}</span>
        <span class="row-s">${esc(fechaCorta(g.fecha))} · ${esc(cat?.nombre || '')}${plan && plan.modalidad === 'Cuotas' ? ` · cuota ${g.nro_cuota}/${plan.nro_cuotas}` : ''} · pagó ${esc(L.persona(S, g.pagado_por)?.nombre || '')}</span></span>
        <span class="amt">${dinero(num(g.monto), { moneda: g.moneda })}${g.moneda !== 'PEN' ? `<span class="row-s">${dinero(g.monto_soles)}</span>` : ''}</span></a>`;
    }).join('')}</section>`;
  }).join('') + (r.n > limite ? alerta('info', `Se muestran los ${limite} gastos más recientes`, 'Exporta a Excel para ver todos o acota el periodo.') : '');
}

