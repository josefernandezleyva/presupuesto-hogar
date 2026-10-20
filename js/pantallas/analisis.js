// Dashboards (sección 5.9, RF-41): tres indicadores principales y el resto en «Más indicadores».

import * as L from '../logic.js';
import { esc, nombreMes, pct, r2, mesActual, fmt0 } from '../util.js';
import { barraMes, tabbar, chips, dinero0, barra, vacio } from '../ui.js';
import { barras, linea, barraMeta } from '../charts.js';
import { puntoCat, nombre } from './comun.js';

const corto = (m) => nombreMes(m, { corto: true, anio: false });

export default {
  iniciar(c) { c.estado.fp = ''; },
  vista(c) {
    const { S, mes, estado: e } = c;
    const pid = e.fp || null;
    const r = L.resumenMes(S, mes, pid);
    const total = r2(r.gastado + r.comprometido);
    const ahorro = r2(r.ingreso - total);
    const personas = [{ v: '', l: 'Hogar' }, ...L.personas(S).map((p) => ({ v: p.id, l: p.alias || p.nombre }))];
    const evo = L.evolucion(S, mes, 12, pid);
    const conDatos = evo.some((x) => x.total > 0);
    const cats = r.porCategoria.filter((f) => f.usado > 0 || f.tope > 0).sort((a, b) => b.usado - a.usado);
    const pasados = evo.filter((x) => x.presupuesto > 0 && x.total > x.presupuesto + 0.004 && x.mes < mes);

    let html = `<main class="pad has-tabs">
      ${barraMes(mes)}
      ${chips('fp', personas, e.fp, { clase: 'scroll', label: 'Ver por' })}
      ${pid ? '<p class="muted xs">Montos de su parte según el reparto de cada gasto; topes según su participación.</p>' : ''}

      <section class="card">
        <h2 class="h2">Resumen del mes</h2>
        <div class="quad">
          <div><div class="xs muted">Gastado y comprometido</div><div class="mid">${dinero0(total)}</div></div>
          <div><div class="xs muted">Presupuesto</div><div class="mid">${r.presupuesto > 0 ? dinero0(r.presupuesto) : '—'}</div></div>
          <div><div class="xs muted">Ingreso</div><div class="mid">${r.ingreso > 0 ? dinero0(r.ingreso) : '—'}</div></div>
          <div><div class="xs muted">Ingreso no gastado</div><div class="mid ${ahorro < 0 ? 'bad-t' : ''}">${r.ingreso > 0 ? dinero0(ahorro) : '—'}</div></div>
        </div>
        ${r.presupuesto > 0 ? barra(total / r.presupuesto * 100, total > r.presupuesto ? 'excede' : total >= r.presupuesto * L.umbral(S) / 100 ? 'aviso' : 'ok') : ''}
        ${r.presupuesto > 0 ? `<p class="xs muted">${esc(pct(total / r.presupuesto * 100))} del presupuesto${r.ingreso > 0 ? ` · ${esc(pct(Math.max(0, ahorro) / r.ingreso * 100))} del ingreso sin gastar` : ''}</p>` : ''}
      </section>

      <section class="card">
        <h2 class="h2">Gasto por categoría frente al tope</h2>
        ${cats.length ? cats.map((f) => `<div class="catrow">
          <div class="split sm"><span>${puntoCat(f.cat)} ${esc(f.cat.nombre)}</span><span class="${f.estado === 'excede' ? 'bad-t' : 'muted'}">${dinero0(f.usado)}${f.tope > 0 ? ' / ' + dinero0(f.tope) : ''}</span></div>
          ${f.tope > 0 ? barraMeta(f.pct, 100, f.estado === 'excede' ? 'bad' : f.estado === 'aviso' ? 'warn' : 'ok') : ''}
        </div>`).join('') : '<p class="muted sm">Sin gastos este mes.</p>'}
      </section>

      <section class="card">
        <h2 class="h2">Evolución mensual</h2>
        ${conDatos ? barras(evo.map((x) => ({ label: corto(x.mes), valor: x.total, ref: x.presupuesto, clase: x.presupuesto > 0 && x.total > x.presupuesto + 0.004 ? 'bad' : x.mes === mesActual() ? 'soft' : '', destacar: x.presupuesto > 0 && x.total > x.presupuesto + 0.004 })), { aria: 'Gasto de los últimos 12 meses frente al presupuesto', etiquetas: 'auto' }) : vacio('Aún no hay meses con gastos.')}
        <p class="xs muted"><span class="legend ref"></span> presupuesto del mes · <span class="legend bad"></span> superó el presupuesto${pasados.length ? ` (${pasados.map((x) => corto(x.mes)).join(', ')})` : ''}</p>
      </section>

      <a class="btn ghost wide" href="#/reporte">Ver el reporte de gastos registrados</a>
      <button class="btn sec wide" data-a="toggle" data-k="mas">${e.mas ? 'Ocultar indicadores' : 'Más indicadores'}</button>`;

    if (e.mas) html += masIndicadores(c, pid);
    return html + `</main>${tabbar('analisis')}`;
  }
};

function masIndicadores(c, pid) {
  const { S, mes } = c;
  const mapa = L.mapaCategorias(S, mes, 6, pid);
  const conc = L.concentracion(S, mes, pid);
  const fv = L.fijoVariable(S, mes, 6, pid);
  const rg = L.regla503020(S, mes, pid);
  const ta = L.tasaAhorro(S, mes, 12, pid);
  const deuda = L.deudaEvolucion(S, mes, 6);
  const comp = L.compromisos(S, mes, 12);
  const deudaActual = deuda.at(-1);
  const celda = (v) => {
    if (!v) return '<div class="hm none">·</div>';
    if (v.pct === null) return `<div class="hm none" title="Sin tope">${esc(fmt0(v.usado).replace('S/ ', ''))}</div>`;
    const cl = v.estado === 'excede' ? 'bad' : v.estado === 'aviso' ? 'warn' : 'ok';
    return `<div class="hm ${cl}">${v.estado === 'excede' ? '▲' : ''}${Math.round(v.pct)}</div>`;
  };

  return `
    <section class="card">
      <h2 class="h2">Uso del tope por categoría y mes (%)</h2>
      ${mapa.filas.length ? `<div class="hmgrid" style="grid-template-columns: 92px repeat(${mapa.meses.length}, minmax(0,1fr))">
        <div></div>${mapa.meses.map((m) => `<div class="xs muted center">${esc(corto(m))}</div>`).join('')}
        ${mapa.filas.slice(0, 8).map((f) => `<div class="xs ell">${esc(f.cat.nombre)}</div>${f.valores.map(celda).join('')}`).join('')}
      </div>
      <p class="xs muted"><span class="legend ok"></span> hasta ${L.umbral(S)} · <span class="legend warn"></span> cerca del tope · <span class="legend bad"></span> ▲ superó el tope</p>` : '<p class="muted sm">Sin datos.</p>'}
    </section>

    <section class="card">
      <h2 class="h2">Dónde se concentra el gasto</h2>
      ${conc.length ? conc.map((x, i) => `<div class="catrow"><div class="split sm"><span>${i + 1}. ${esc(x.cat.nombre)}</span><span class="muted">${dinero0(x.monto)} · ${esc(pct(x.pct))}</span></div>${barra(x.pct, 'ok')}</div>`).join('') : '<p class="muted sm">Sin gastos este mes.</p>'}
    </section>

    <section class="card">
      <h2 class="h2">Gasto fijo y variable</h2>
      ${barras(fv.map((x) => ({ label: corto(x.mes), valor: x.fijo + x.variable, apilado: [{ valor: x.fijo, clase: 'dark' }, { valor: x.variable, clase: 'soft' }] })), { aria: 'Gasto fijo y variable por mes', etiquetas: 'todas' })}
      <p class="xs muted"><span class="legend dark"></span> fijo · <span class="legend soft"></span> variable${fv.at(-1).fijo + fv.at(-1).variable > 0 ? ` · este mes ${esc(pct(fv.at(-1).fijo / (fv.at(-1).fijo + fv.at(-1).variable) * 100))} fijo` : ''}</p>
    </section>

    <section class="card">
      <h2 class="h2">Regla 50/30/20</h2>
      ${rg.ingreso > 0 ? `
        <div class="catrow"><div class="split sm"><span>Necesidades</span><span class="muted">${esc(pct(rg.pNecesidad))} · meta 50 %</span></div>${barraMeta(rg.pNecesidad, 50, rg.pNecesidad > 50 ? 'warn' : 'ok')}</div>
        <div class="catrow"><div class="split sm"><span>Deseos</span><span class="muted">${esc(pct(rg.pDeseo))} · meta 30 %</span></div>${barraMeta(rg.pDeseo, 30, rg.pDeseo > 30 ? 'warn' : 'ok')}</div>
        <div class="catrow"><div class="split sm"><span>Ahorro (ingreso no gastado)</span><span class="muted">${esc(pct(rg.pAhorro))} · meta 20 %</span></div>${barraMeta(Math.max(0, rg.pAhorro), 20, rg.pAhorro < 20 ? 'warn' : 'ok')}</div>
        <p class="xs muted">Porcentajes sobre el ingreso de ${esc(fmt0(rg.ingreso))}. La naturaleza de cada categoría se define en Categorías.</p>`
        : '<p class="muted sm">Registra los ingresos del mes para calcular esta regla.</p>'}
    </section>

    <section class="card">
      <h2 class="h2">Tasa de ahorro</h2>
      ${linea(ta.map((x) => ({ label: corto(x.mes), valor: x.pct === null ? null : Math.round(x.pct) })), { aria: 'Porcentaje del ingreso sin gastar por mes', sufijo: '%' })}
      <p class="xs muted">Porcentaje del ingreso que quedó sin gastar cada mes.</p>
    </section>

    <section class="card">
      <h2 class="h2">Deuda entre personas</h2>
      <p class="sm">${deudaActual.transferencias.length ? deudaActual.transferencias.map((t) => `${nombre(S, t.de)} debe ${esc(fmt0(t.monto))} a ${nombre(S, t.a)}`).join('<br>') : 'Al día al final de este mes.'}</p>
      ${barras(deuda.map((x) => ({ label: corto(x.mes), valor: x.deuda, clase: 'warn' })), { aria: 'Deuda pendiente al final de cada mes', etiquetas: 'todas', alto: 120 })}
      <p class="xs muted">Monto pendiente al final de cada mes, que se arrastra al siguiente.</p>
    </section>

    <section class="card">
      <h2 class="h2">Compromisos futuros</h2>
      ${comp.some((x) => x.monto > 0) ? barras(comp.map((x) => ({ label: corto(x.mes), valor: x.monto, clase: 'soft' })), { aria: 'Cuotas y recurrentes programados por mes', etiquetas: 'auto' }) : '<p class="muted sm">No hay cuotas ni recurrentes programados.</p>'}
      <a class="link" href="#/compromisos">Ver detalle de compromisos</a>
    </section>`;
}
