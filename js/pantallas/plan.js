// Compromisos futuros: cuotas y recurrentes ya programados (RF-34).

import * as L from '../logic.js';
import { esc, nombreMes, mesActual, fmt } from '../util.js';
import { encabezado, dinero0, dinero, vacio } from '../ui.js';
import { barras } from '../charts.js';

const compromisos = {
  vista(c) {
    const { S } = c;
    const desde = mesActual();
    const meses = L.compromisos(S, desde, 12);
    const planes = L.planesActivos(S).map((p) => ({ p, prog: L.progresoPlan(S, p) })).filter((x) => x.prog.pendientes > 0)
      .sort((a, b) => b.prog.montoPendiente - a.prog.montoPendiente);
    const total = meses.reduce((a, m) => a + m.monto, 0);
    return `${encabezado({ titulo: 'Compromisos' })}
    <main class="pad">
      <section class="card">
        <div class="lbl">Programado en los próximos 12 meses</div>
        <div class="big">${dinero0(total)}</div>
        ${total > 0 ? barras(meses.map((m) => ({ label: nombreMes(m.mes, { corto: true, anio: false }), valor: m.monto, clase: 'soft' })), { aria: 'Monto programado por mes' }) : ''}
      </section>
      <h3 class="dia">Por mes</h3>
      <section class="card list">
        ${meses.filter((m) => m.monto > 0).map((m) => `<button type="button" class="row" data-a="ver-mes" data-m="${esc(m.mes)}">
          <span class="row-m"><span class="row-t">${esc(nombreMes(m.mes))}</span><span class="row-s">${m.items.length} ${m.items.length === 1 ? 'gasto' : 'gastos'}</span></span><span class="amt">${dinero(m.monto)}</span></button>`).join('') || '<p class="muted sm pad-x">Nada programado.</p>'}
      </section>
      <h3 class="dia">Planes</h3>
      ${planes.length ? `<section class="card list">${planes.map(({ p, prog }) => `<a class="row" href="#/gasto/${esc(prog.proxima?.id || '')}">
        <span class="row-m"><span class="row-t">${esc(p.descripcion)}</span>
        <span class="row-s">${p.modalidad === 'Cuotas' ? `Cuotas: ${prog.confirmadas} de ${p.nro_cuotas} pagadas` : 'Recurrente' + (p.duracion_meses ? ` por ${p.duracion_meses} meses` : ' sin fin')} · ${esc(L.categoria(S, p.categoria_id)?.nombre || '')}</span></span>
        <span class="amt">${esc(fmt(p.monto_cuota, { moneda: p.moneda }))}<span class="row-s">por mes</span></span></a>`).join('')}</section>` : vacio('No hay cuotas ni gastos recurrentes activos. Créalos desde Registrar gasto > Más opciones.')}
    </main>`;
  },
  acciones: {
    'ver-mes'(c, d) { c.setMes(d.m); c.ir('gastos?estado=Programado'); }
  }
};

export default { compromisos };
