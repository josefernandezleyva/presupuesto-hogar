import * as L from '../logic.js';
import * as ops from '../ops.js';
import { esc, fechaCorta, r2, num } from '../util.js';
import { barraMes, tabbar, avatar, chips, segmentado, dinero, vacio } from '../ui.js';
import { puntoCat } from './comun.js';

export default {
  iniciar(c) {
    c.estado.fp = '';
    c.estado.ft = '';
    c.estado.fc = c.query.cat || '';
    c.estado.fe = c.query.estado || '';
  },
  vista(c) {
    const { S, mes, estado: e } = c;
    const cerrado = L.mesCerrado(S, mes);
    let lista = L.gastosMes(S, mes);
    if (e.fe) lista = lista.filter((g) => g.estado === e.fe);
    if (e.fc) lista = lista.filter((g) => g.categoria_id === e.fc);
    if (e.ft) lista = lista.filter((g) => L.tipoGasto(S, g) === e.ft);
    if (e.fp) lista = lista.filter((g) => L.montoPara(S, g, e.fp) > 0);
    lista.sort((a, b) => (a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : String(b.creado_en).localeCompare(String(a.creado_en))));
    const total = r2(lista.reduce((a, g) => a + L.montoPara(S, g, e.fp || null), 0));
    const porDia = new Map();
    lista.forEach((g) => { if (!porDia.has(g.fecha)) porDia.set(g.fecha, []); porDia.get(g.fecha).push(g); });
    const anulados = L.gastosMes(S, mes, [L.ESTADO.ANUL]).length;

    const personas = [{ v: '', l: 'Todos' }, ...L.personas(S).map((p) => ({ v: p.id, l: p.alias || p.nombre }))];
    const cats = L.categorias(S, { todas: true });

    return `<main class="pad has-tabs">
      ${barraMes(mes, { cerrado })}
      <div class="filtros">
        ${chips('fp', personas, e.fp, { clase: 'scroll', label: 'Persona' })}
        <div class="split gap">
          ${segmentado('ft', [{ v: '', l: 'Todos' }, { v: 'Fijo', l: 'Fijos' }, { v: 'Variable', l: 'Variables' }], e.ft, 'Tipo')}
        </div>
        <div class="split gap">
          <label class="sr" for="fc">Categoría</label>
          <select id="fc" class="select" data-f="fc" data-r>
            <option value="">Categoría</option>
            ${cats.map((x) => `<option value="${esc(x.id)}"${x.id === e.fc ? ' selected' : ''}>${esc(x.nombre)}</option>`).join('')}
          </select>
          <select class="select" data-f="fe" data-r aria-label="Estado">
            <option value="">Estado</option>
            <option value="Confirmado"${e.fe === 'Confirmado' ? ' selected' : ''}>Confirmados</option>
            <option value="Programado"${e.fe === 'Programado' ? ' selected' : ''}>Programados</option>
          </select>
        </div>
      </div>
      <p class="sum-l">${lista.length} ${lista.length === 1 ? 'gasto' : 'gastos'} · <strong>${dinero(total)}</strong>${e.fp ? ' (su parte)' : ''}</p>

      ${lista.length ? [...porDia.entries()].map(([fecha, gs]) => `
        <h3 class="dia">${esc(fechaCorta(fecha))}</h3>
        <div class="card list">
          ${gs.map((g) => item(c, g, cerrado)).join('')}
        </div>`).join('') : vacio('No hay gastos con estos filtros.', `<a class="btn pri" href="#/nuevo">Registrar gasto</a>`)}
      ${anulados ? `<p class="muted xs center">${anulados} ${anulados === 1 ? 'gasto anulado no se muestra' : 'gastos anulados no se muestran'}.</p>` : ''}
    </main>${tabbar('gastos')}`;
  },
  acciones: {
    confirmar(c, d) {
      ops.confirmarGasto(d.id);
      c.avisar('Gasto confirmado');
    }
  }
};

function item(c, g, cerrado) {
  const { S } = c;
  const cat = L.categoria(S, g.categoria_id);
  const plan = g.plan_id ? L.idx(S).plan.get(g.plan_id) : null;
  const sub = [
    plan ? (plan.modalidad === 'Cuotas' ? `Cuota ${g.nro_cuota} de ${plan.nro_cuotas}` : 'Recurrente') : '',
    L.tipoGasto(S, g),
    esc(L.persona(S, g.pagado_por)?.nombre || '')
  ].filter(Boolean).join(' · ');
  const prog = g.estado === L.ESTADO.PROG;
  return `<div class="gitem">
    <a class="gitem-m" href="#/gasto/${esc(g.id)}">
      ${avatar(L.persona(S, g.pagado_por), 32)}
      <span class="row-m"><span class="row-t">${puntoCat(cat)} ${esc(g.nota || cat?.nombre || 'Gasto')}${prog ? ' <span class="badge soft">Programado</span>' : ''}</span>
      <span class="row-s">${g.nota ? esc(cat?.nombre || '') + ' · ' : ''}${sub}</span></span>
      <span class="amt">${dinero(num(g.monto), { moneda: g.moneda })}${g.moneda !== 'PEN' ? `<span class="row-s">${dinero(g.monto_soles)}</span>` : ''}</span>
    </a>
    ${prog && !cerrado ? `<button class="btn mini" data-a="confirmar" data-id="${esc(g.id)}">Confirmar</button>` : ''}
  </div>`;
}
