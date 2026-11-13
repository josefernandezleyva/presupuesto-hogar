// 3.2 · Gastos anulados: un reporte para revisar lo que se anuló y restaurarlo si fue un error.
// Anular nunca borra: el gasto queda en la hoja con estado «Anulado». Restaurar lo devuelve como pagado o por pagar.

import * as L from '../logic.js';
import { esc, num, fmt, fechaCorta, nombreMes, mesActual, sumarMeses } from '../util.js';
import { encabezado, avatar, icono, vacio, segmentado } from '../ui.js';
import { placaCat, placa, pedirRestaurar } from './comun.js';

const corto = (p) => esc(p?.alias || String(p?.nombre || '').split(' ')[0] || '');

/** Los anulados vigentes (no eliminados), del más reciente al más antiguo, según el periodo elegido. */
export function anuladosDe(S, per = 'todo', q = '') {
  const desde = per === 'mes' ? mesActual() : per === '3' ? sumarMeses(mesActual(), -2) : '';
  const t = String(q || '').trim().toLowerCase();
  return S.Gastos.filter((g) => g.estado === L.ESTADO.ANUL && (!desde || g.mes >= desde))
    .filter((g) => !t || [g.nota, L.categoria(S, g.categoria_id)?.nombre, L.persona(S, g.pagado_por)?.nombre, String(g.monto)].some((x) => String(x || '').toLowerCase().includes(t)))
    .sort((a, b) => (b.fecha + b.id).localeCompare(a.fecha + a.id));
}

export default {
  anulados: {
    iniciar(c) { Object.assign(c.estado, { per: c.estado.per || 'todo', q: '' }); },
    vista(c) {
      const { S, estado: e } = c;
      const lista = anuladosDe(S, e.per, e.q);
      const total = lista.reduce((a, g) => a + num(g.monto_soles), 0);
      const porMes = new Map();
      lista.forEach((g) => { if (!porMes.has(g.mes)) porMes.set(g.mes, []); porMes.get(g.mes).push(g); });
      const fila = (g) => {
        const cat = L.categoria(S, g.categoria_id);
        const plan = g.plan_id ? L.idx(S).plan.get(g.plan_id) : null;
        const cerrado = L.mesCerrado(S, g.mes);
        const sub = [esc(fechaCorta(g.fecha)), g.nota ? esc(cat?.nombre || '') : '', plan ? (plan.modalidad === 'Cuotas' ? `cuota ${esc(g.nro_cuota)} de ${esc(plan.nro_cuotas)}` : 'mensual') : '', corto(L.persona(S, g.pagado_por))].filter(Boolean).join(' · ');
        return `<div class="row anu-f">
          <a class="con-placa" href="#/ver/${esc(g.id)}"><span class="placa-av">${placaCat(cat, 38)}${avatar(L.persona(S, g.pagado_por), 18)}</span>
            <span class="row-m"><span class="row-t">${esc(g.nota || cat?.nombre || 'Gasto')}</span><span class="row-s">${sub}</span></span></a>
          <span class="anu-d"><span class="num tachado">${esc(num(g.monto) > 0 ? fmt(num(g.monto), { moneda: g.moneda }) : 'Sin monto')}</span>
          ${cerrado ? '<span class="badge">Mes cerrado</span>' : `<button type="button" class="btn mini sec" data-a="restaurar" data-id="${esc(g.id)}" aria-label="Restaurar ${esc(g.nota || cat?.nombre || 'gasto')}">Restaurar</button>`}</span>
        </div>`;
      };
      return `${encabezado({ titulo: 'Gastos anulados' })}
      <main class="pad anulados">
        <section class="anu-cab">${placa('anulado', '#9B2C1F', 44)}<p class="sm">Anular no borra nada: el gasto queda en la hoja como anulado. Aquí puedes revisarlos y <b>restaurar</b> los que fueron un error.</p></section>
        ${segmentado('per', [{ v: 'mes', l: 'Este mes' }, { v: '3', l: '3 meses' }, { v: 'todo', l: 'Todos' }], e.per, 'Periodo')}
        <div class="buscar" role="search">${icono('buscar', 18)}<label class="sr" for="qa">Buscar anulados</label>
          <input id="qa" type="search" class="buscar-i" data-f="q" data-r data-keep placeholder="Buscar anulados" autocomplete="off" value="${esc(e.q || '')}"></div>
        ${lista.length ? `<p class="sm muted anu-res">${lista.length === 1 ? '1 gasto anulado' : `${lista.length} gastos anulados`} · ${esc(fmt(total))} que no cuentan</p>
          ${[...porMes.entries()].map(([m, gs]) => `<h3 class="dia">${esc(nombreMes(m))}${L.mesCerrado(S, m) ? ' · cerrado' : ''}</h3><section class="card list">${gs.map(fila).join('')}</section>`).join('')}
          <p class="xs muted center">Un gasto de un mes cerrado solo se restaura si el administrador reabre el mes en Cuentas.</p>`
          : vacio(e.q ? 'No hay anulados con esa búsqueda.' : e.per === 'todo' ? 'No hay gastos anulados.' : 'No hay gastos anulados en este periodo.', e.per !== 'todo' ? '<button class="btn sec" data-a="set" data-k="per" data-v="todo">Ver todos</button>' : '')}
      </main>`;
    },
    acciones: {
      restaurar(c, d) { pedirRestaurar(c, d.id); }
    }
  }
};
