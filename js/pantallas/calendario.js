// 3.4 · Calendario de pagos: el mes en una cuadrícula, con lo pagado y lo por pagar de cada día.
// Tocar un día muestra sus gastos; los por pagar se marcan como pagados desde aquí.

import * as L from '../logic.js';
import { esc, num, fmt, fmt0, hoy, mesActual, nombreMes, diasEnMes } from '../util.js';
import { encabezado, barraMes, icono } from '../ui.js';
import { placaCat, placa, sinMonto, montoTxt, marcarPagado } from './comun.js';

const DIAS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
const DIAS_L = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

/** Monto corto para la celda: 85, 1.2k. */
const corto = (n) => (n >= 1000 ? (Math.round(n / 100) / 10).toLocaleString('es-PE') + 'k' : String(Math.round(n)));

export default {
  calendario: {
    iniciar(c) { this.alCambiarMes(c); },
    alCambiarMes(c) {
      const dias = L.calendarioMes(c.S, c.mes);
      c.estado.dia = c.mes === mesActual() ? Number(hoy().slice(8, 10)) : (dias.size ? Math.min(...dias.keys()) : 1);
    },
    vista(c) {
      const { S, mes, estado: e } = c;
      const h = hoy();
      const dias = L.calendarioMes(S, mes);
      const n = diasEnMes(mes);
      const primero = (new Date(mes + '-01T12:00:00').getDay() + 6) % 7; // lunes = 0
      const sel = Math.min(Math.max(1, Number(e.dia) || 1), n);
      const prog = L.gastosMes(S, mes, [L.ESTADO.PROG]);
      const conf = L.gastosMes(S, mes, [L.ESTADO.CONF]);
      const vencidos = prog.filter((g) => g.fecha < h);
      const sumar = (l) => l.reduce((a, g) => a + num(g.monto_soles), 0);
      const celdas = [];
      for (let i = 0; i < primero; i++) celdas.push('<span class="cal-v" aria-hidden="true"></span>');
      for (let d = 1; d <= n; d++) {
        const l = dias.get(d) || [];
        const fecha = `${mes}-${String(d).padStart(2, '0')}`;
        const pp = l.filter((g) => g.estado === L.ESTADO.PROG);
        const venc = pp.some((g) => fecha < h);
        const total = sumar(l);
        const cls = ['cal-d', fecha === h ? 'hoy' : '', d === sel ? 'on' : '', venc ? 'venc' : pp.length ? 'pend' : l.length ? 'pag' : ''].filter(Boolean).join(' ');
        const aria = `${d} de ${nombreMes(mes, { anio: false }).toLowerCase()}${l.length ? `: ${pp.length ? `${pp.length} por pagar` : ''}${pp.length && l.length > pp.length ? ', ' : ''}${l.length > pp.length ? `${l.length - pp.length} pagados` : ''}` : ''}`;
        celdas.push(`<button type="button" class="${cls}" data-a="dia" data-v="${d}" aria-label="${esc(aria)}" aria-pressed="${d === sel}">
          <span class="cal-n">${d}</span>${l.length ? `<span class="cal-p">${pp.length ? '<i class="pp"></i>' : ''}${l.length > pp.length ? '<i class="ok"></i>' : ''}</span><span class="cal-m num">${total > 0 ? esc(corto(total)) : '¿?'}</span>` : ''}</button>`);
      }
      const lista = dias.get(sel) || [];
      const fechaSel = `${mes}-${String(sel).padStart(2, '0')}`;
      const diaSem = DIAS_L[new Date(fechaSel + 'T12:00:00').getDay()];
      const fila = (g) => {
        const cat = L.categoria(S, g.categoria_id);
        const pend = g.estado === L.ESTADO.PROG;
        const venc = pend && g.fecha < h;
        return `<div class="row cal-g">
          <a class="con-placa" href="#/ver/${esc(g.id)}">${venc ? placa('vencido', '#B3362A', 36) : placaCat(cat, 36)}
            <span class="row-m"><span class="row-t">${esc(g.nota || cat?.nombre || 'Gasto')}</span>
            <span class="row-s${venc ? ' bad-t' : ''}">${pend ? (venc ? 'Vencido' : 'Por pagar') : 'Pagado'} · <span class="${sinMonto(g) ? 'por-def' : 'num'}">${esc(montoTxt(g))}</span></span></span></a>
          ${pend && !L.mesCerrado(S, g.mes) ? `<button class="btn mini pagar-b" data-a="confirmar" data-id="${esc(g.id)}" aria-label="Marcar ${esc(g.nota || cat?.nombre || 'gasto')} como pagado">${icono('check', 16)} Pagado</button>` : ''}
        </div>`;
      };
      return `${encabezado({ titulo: 'Calendario de pagos' })}
      <main class="pad cal34">
        ${barraMes(mes, { cerrado: L.mesCerrado(S, mes) })}
        <section class="cal-res">
          <div><span class="lbl">Por pagar</span><span class="mid num">${esc(fmt0(sumar(prog)))}</span><span class="xs muted">${prog.length} ${prog.length === 1 ? 'pago' : 'pagos'}${prog.some(sinMonto) ? ` · ${prog.filter(sinMonto).length} sin monto` : ''}</span></div>
          <div><span class="lbl">Pagado</span><span class="mid num">${esc(fmt0(sumar(conf)))}</span><span class="xs muted">${conf.length} ${conf.length === 1 ? 'gasto' : 'gastos'}</span></div>
          ${vencidos.length ? `<div class="bad-t"><span class="lbl">Vencidos</span><span class="mid num">${vencidos.length}</span><span class="xs">${esc(fmt0(sumar(vencidos)))}</span></div>` : ''}
        </section>
        <section class="card cal-grid" aria-label="Días de ${esc(nombreMes(mes).toLowerCase())}">
          ${DIAS.map((d) => `<span class="cal-s" aria-hidden="true">${d}</span>`).join('')}
          ${celdas.join('')}
        </section>
        <div class="leyenda sm cal-ley"><span><i class="pp"></i>Por pagar</span><span><i class="ok"></i>Pagado</span><span><i class="vc"></i>Vencido</span></div>
        <h3 class="dia">${esc(diaSem.charAt(0).toUpperCase() + diaSem.slice(1))} ${sel}${lista.length ? ` · ${esc(fmt(sumar(lista)))}` : ''}</h3>
        ${lista.length ? `<section class="card list">${lista.map(fila).join('')}</section>` : '<p class="sm muted pad-x">Nada este día.</p>'}
      </main>`;
    },
    acciones: {
      dia(c, d) { c.estado.dia = Number(d.v); c.render(); },
      confirmar(c, d) { marcarPagado(c, d.id); }
    }
  }
};
