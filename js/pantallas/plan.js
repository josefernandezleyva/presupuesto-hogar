// Compromisos futuros: cuotas y recurrentes ya programados (RF-34).

import * as L from '../logic.js';
import * as ops from '../ops.js';
import * as st from '../store.js';
import { esc, nombreMes, mesActual, fmt, num, r2, parseMonto, hoy } from '../util.js';
import { encabezado, dinero0, dinero, vacio, alerta, icono } from '../ui.js';
import { barras } from '../charts.js';

/** 3.0 · Contenido de Compromisos (también en Presupuesto › Próximos). */
export function compromisosHtml(c) {
  const { S } = c;
  {
    const desde = mesActual();
    const meses = L.compromisos(S, desde, 12);
    const planes = L.planesActivos(S).map((p) => ({ p, prog: L.progresoPlan(S, p) })).filter((x) => x.prog.pendientes > 0)
      .sort((a, b) => b.prog.montoPendiente - a.prog.montoPendiente);
    const total = meses.reduce((a, m) => a + m.monto, 0);
    return `
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
      ${planes.length ? `<section class="card list">${planes.map(({ p, prog }) => `<a class="row" href="${p.modalidad === 'Cuotas' ? '#/plan/' + esc(p.id) : '#/gasto/' + esc(prog.proxima?.id || '')}">
        <span class="row-m"><span class="row-t">${esc(p.descripcion)}</span>
        <span class="row-s">${p.modalidad === 'Cuotas' ? `Cuotas: ${prog.confirmadas} de ${p.nro_cuotas} pagadas` : 'Recurrente' + (p.duracion_meses ? ` por ${p.duracion_meses} meses` : ' sin fin')} · ${esc(L.categoria(S, p.categoria_id)?.nombre || '')}</span></span>
        <span class="amt">${esc(fmt(p.monto_cuota, { moneda: p.moneda }))}<span class="row-s">por mes</span></span></a>`).join('')}</section>` : vacio('No hay cuotas ni gastos recurrentes activos. Créalos al registrar un gasto, en «Se paga».')}`;
  }
}

const compromisos = {
  vista(c) {
    return `${encabezado({ titulo: 'Compromisos' })}<main class="pad">${compromisosHtml(c)}</main>`;
  },
  acciones: {
    'ver-mes'(c, d) { c.setMes(d.m); c.ir('gastos?estado=Programado'); }
  }
};

/* ------------------------------------------------ 2.5 · Plan de cuotas --- */

const m$ = (n, plan) => esc(fmt(n, { moneda: plan?.moneda || 'PEN' }));
const MSG_MES = 'Las cuotas de meses cerrados no se pueden cambiar.';

/** Texto de los montos nuevos: «S/ 275.00» si son iguales, o «entre S/ 275.00 y S/ 550.00». */
function rango(montos, plan) {
  if (!montos.length) return '';
  const min = Math.min(...montos), max = Math.max(...montos);
  return Math.abs(max - min) < 0.005 ? m$(min, plan) : `entre ${m$(min, plan)} y ${m$(max, plan)}`;
}
const signo = (n, plan) => (n > 0 ? '+' : n < 0 ? '−' : '') + m$(Math.abs(n), plan);

function previaTotalHtml(id, txt) {
  const p = ops.previaTotal(id, parseMonto(txt));
  if (p.error === 'sin_pendientes') {
    return p.diferencia > 0.004
      ? `<p class="sm">Ya no quedan cuotas por pagar. Al aplicar, la diferencia de <b>${m$(p.diferencia, p.plan)}</b> se agrega como una cuota de ajuste.</p>`
      : '<p class="sm warn-t">Ya no quedan cuotas por pagar para repartir. Para bajar el total, ajusta una cuota de un mes abierto.</p>';
  }
  if (p.error) return `<p class="sm bad-t">${esc(p.error)}</p>`;
  return `<ul class="previa">
    <li><span>Pagado o en meses cerrados</span><b>${m$(p.fijo, p.plan)}</b><small>${p.fijas.length} ${p.fijas.length === 1 ? 'cuota, no cambia' : 'cuotas, no cambian'}</small></li>
    <li><span>${p.libres.length} ${p.libres.length === 1 ? 'cuota por pagar queda' : 'cuotas por pagar quedan'} en</span><b>${rango(p.montos, p.plan)}</b><small>antes ${rango(p.libres.map((g) => num(g.monto)), p.plan)}</small></li>
    <li><span>Diferencia con el total actual</span><b>${signo(p.diferencia, p.plan)}</b></li>
  </ul>`;
}

function previaCuotaHtml(gid, txt, modo) {
  const p = ops.previaCuota(gid, parseMonto(txt), modo);
  if (p.error) return `<p class="sm bad-t">${esc(p.error)}</p>`;
  const dif = r2(p.monto - num(p.g.monto));
  if (Math.abs(dif) < 0.005) return '<p class="sm muted">Escribe el monto nuevo de la cuota.</p>';
  if (modo === 'compensar') {
    return `<p class="sm">La cuota ${esc(p.g.nro_cuota)} pasa a <b>${m$(p.monto, p.plan)}</b> (${signo(dif, p.plan)}) y ${p.siguen.length === 1 ? 'la cuota por pagar que sigue queda' : `las ${p.siguen.length} cuotas por pagar que siguen quedan`} ${rango(p.nuevos, p.plan).startsWith('entre') ? '' : 'en '}<b>${rango(p.nuevos, p.plan)}</b>. El total se mantiene en ${m$(p.total, p.plan)}.</p>`;
  }
  return `<p class="sm">La cuota ${esc(p.g.nro_cuota)} pasa a <b>${m$(p.monto, p.plan)}</b> (${signo(dif, p.plan)}). Las demás no cambian y el total pasa a <b>${m$(p.total, p.plan)}</b>.</p>`;
}

function previaAjusteHtml(plan, txt, mes) {
  const m = parseMonto(txt);
  if (!(m > 0)) return '<p class="sm muted">Escribe el monto de la diferencia.</p>';
  return `<p class="sm">Se agrega la cuota ${num(plan.nro_cuotas) + 1} en ${esc(nombreMes(mes || mesActual()).toLowerCase())} por <b>${m$(m, plan)}</b>. El plan pasa a ${num(plan.nro_cuotas) + 1} cuotas y a un total de <b>${m$(r2(num(plan.monto_total) + m), plan)}</b>.</p>`;
}

const estadoCuota = (S, g) => g.estado === L.ESTADO.ANUL ? ['', 'Anulada'] : L.mesCerrado(S, g.mes) ? ['', 'Mes cerrado']
  : g.estado === L.ESTADO.CONF ? ['ok', 'Pagada'] : g.fecha < hoy() ? ['warn', 'Vencida'] : ['soft', 'Por pagar'];

const planCuotas = {
  vista(c) {
    const { S } = c;
    const plan = st.fila('Planes', c.param);
    if (!plan || plan.modalidad !== 'Cuotas') return `${encabezado({ titulo: 'Plan de cuotas' })}<main class="pad">${vacio('No encontré este plan de cuotas.')}</main>`;
    const { todas, vivas, libres } = ops.cuotasDelPlan(plan.id);
    const pagado = r2(vivas.filter((g) => g.estado === L.ESTADO.CONF).reduce((a, g) => a + num(g.monto), 0));
    const total = r2(vivas.reduce((a, g) => a + num(g.monto), 0));
    const nPag = vivas.filter((g) => g.estado === L.ESTADO.CONF).length;
    const pct = total > 0 ? Math.min(100, pagado / total * 100) : 0;
    const cat = L.categoria(S, plan.categoria_id);
    const editable = (g) => g.estado !== L.ESTADO.ANUL && !L.mesCerrado(S, g.mes);
    return `${encabezado({ titulo: 'Plan de cuotas' })}
    <main class="pad plan-cuotas">
      <section class="card hero plan-hero">
        <div class="lbl">${esc(plan.descripcion)}${cat ? ' · ' + esc(cat.nombre) : ''}</div>
        <div class="big num">${m$(total, plan)}</div>
        <div class="sm muted">${vivas.length} cuotas · ${nPag} ${nPag === 1 ? 'pagada' : 'pagadas'}</div>
        <div class="track" role="img" aria-label="${Math.round(pct)} % pagado"><div class="fill ok" style="width:${pct}%"></div></div>
        <div class="hero-pie">
          <div><div class="lbl">Pagado</div><div class="val num">${m$(pagado, plan)}</div></div>
          <div class="right"><div class="lbl">Por pagar</div><div class="val num">${m$(r2(total - pagado), plan)}</div></div>
        </div>
        <div class="plan-acc">
          <button type="button" class="btn sec" data-a="cambiar-total">Cambiar el total</button>
          <button type="button" class="btn sec" data-a="agregar-ajuste">${icono('mas', 18)} Agregar ajuste</button>
        </div>
      </section>
      ${!libres.length && vivas.length ? alerta('info', 'Todas las cuotas están pagadas', 'Si apareció una diferencia, agrégala como cuota de ajuste o ajusta la última cuota si su mes sigue abierto.') : ''}
      <h3 class="dia">Cuotas</h3>
      <section class="card list">
        ${todas.map((g) => {
          const [cls, txt] = estadoCuota(S, g);
          const inner = `<span class="nro${g.estado === L.ESTADO.CONF ? ' pag' : ''}" aria-hidden="true">${g.estado === L.ESTADO.CONF ? icono('check', 14) : esc(g.nro_cuota)}</span>
            <span class="row-m"><span class="row-t">Cuota ${esc(g.nro_cuota)} · ${esc(nombreMes(g.mes, { corto: true }))}</span>
              <span class="row-s"><span class="badge ${cls}">${txt}</span>${/\(ajuste\)$/.test(g.nota || '') ? ' Ajuste' : ''}</span></span>
            <span class="amt num${g.estado === L.ESTADO.ANUL ? ' tachado' : ''}">${m$(num(g.monto), plan)}</span>`;
          return editable(g) ? `<button type="button" class="row cuota-f" data-a="ajustar-cuota" data-id="${esc(g.id)}" aria-label="Ajustar cuota ${esc(g.nro_cuota)}">${inner}${icono('adelante', 18)}</button>`
            : `<div class="row cuota-f fija">${inner}<span class="ic-sp"></span></div>`;
        }).join('')}
      </section>
      <p class="xs muted">Toca una cuota para ajustar su monto, aunque ya esté pagada. ${MSG_MES}</p>
    </main>`;
  },
  alEscribir(c, f) {
    const e = c.estado;
    const set = (id, h) => { const el = document.getElementById(id); if (el) el.innerHTML = h; };
    if (f === 'nuevoTotal') set('prevTotal', previaTotalHtml(c.param, e.nuevoTotal));
    if (f === 'cuotaMonto' || f === 'cuotaModo') set('prevCuota', previaCuotaHtml(e.cuotaId, e.cuotaMonto, e.cuotaModo));
    if (f === 'ajMonto' || f === 'ajMes') set('prevAjuste', previaAjusteHtml(st.fila('Planes', c.param), e.ajMonto, e.ajMes));
  },
  acciones: {
    'cambiar-total'(c) {
      const plan = st.fila('Planes', c.param);
      const e = c.estado;
      e.nuevoTotal = String(num(plan.monto_total));
      c.preguntar({
        titulo: 'Cambiar el total',
        texto: 'Lo pagado y las cuotas de meses cerrados se mantienen; el resto se reparte entre las cuotas por pagar.',
        get html() {
          return `<label class="campo-h"><span class="lbl">Total nuevo (${plan.moneda === 'USD' ? 'US$' : 'S/'})</span>
            <input class="inp num" name="total" data-f="nuevoTotal" data-keep inputmode="decimal" enterkeyhint="done" value="${esc(e.nuevoTotal)}" aria-label="Total nuevo"></label>
            <div id="prevTotal" aria-live="polite">${previaTotalHtml(c.param, e.nuevoTotal)}</div>`;
        },
        botones: [{ l: 'Aplicar', estilo: 'pri', fn: (c2, v) => {
          const p = ops.previaTotal(c2.param, parseMonto(v.total));
          if (p.error === 'sin_pendientes' && p.diferencia > 0.004) { planCuotas.acciones['agregar-ajuste'](c2, { monto: String(p.diferencia) }); return; }
          ops.cambiarTotalPlan(c2.param, parseMonto(v.total));
          c2.avisar(`Total actualizado a ${fmt(parseMonto(v.total), { moneda: plan.moneda })}`);
        } }]
      });
    },
    'ajustar-cuota'(c, d) {
      const g = st.fila('Gastos', d.id);
      const plan = st.fila('Planes', c.param);
      const e = c.estado;
      e.cuotaId = g.id; e.cuotaMonto = String(num(g.monto));
      const hay = ops.cuotasDelPlan(plan.id).libres.some((x) => num(x.nro_cuota) > num(g.nro_cuota));
      e.cuotaModo = 'solo';
      c.preguntar({
        titulo: `Cuota ${g.nro_cuota} · ${nombreMes(g.mes)}`,
        texto: g.estado === L.ESTADO.CONF ? 'Esta cuota ya está pagada; se ajusta con el monto real que se pagó.' : '',
        get html() {
          const op = (v, t, x, dis = false) => `<label class="opcion${e.cuotaModo === v ? ' on' : ''}${dis ? ' dis' : ''}"><input type="radio" name="modo" value="${v}" data-f="cuotaModo" ${e.cuotaModo === v ? 'checked' : ''} ${dis ? 'disabled' : ''}>
            <span><b>${t}</b><small>${x}</small></span></label>`;
          return `<label class="campo-h"><span class="lbl">Monto de la cuota (${plan.moneda === 'USD' ? 'US$' : 'S/'})</span>
            <input class="inp num" name="monto" data-f="cuotaMonto" data-keep inputmode="decimal" enterkeyhint="done" value="${esc(e.cuotaMonto)}" aria-label="Monto de la cuota"></label>
            <div class="opciones" role="radiogroup" aria-label="Qué pasa con el total">
              ${op('solo', 'Solo esta cuota', 'Las demás no cambian; el total del plan cambia.')}
              ${op('compensar', 'Mantener el total', hay ? 'La diferencia se reparte entre las cuotas por pagar que siguen.' : 'No hay cuotas por pagar después de esta.', !hay)}
            </div>
            <div id="prevCuota" aria-live="polite">${previaCuotaHtml(e.cuotaId, e.cuotaMonto, e.cuotaModo)}</div>
            <a class="link sm" href="#/gasto/${esc(g.id)}">Abrir la cuota para cambiar otros datos</a>`;
        },
        botones: [{ l: 'Guardar', estilo: 'pri', fn: (c2, v) => {
          ops.ajustarCuota(e.cuotaId, parseMonto(v.monto), e.cuotaModo);
          c2.avisar(e.cuotaModo === 'compensar' ? 'Cuota ajustada; el total se mantiene' : 'Cuota ajustada');
        } }]
      });
    },
    'agregar-ajuste'(c, d = {}) {
      const plan = st.fila('Planes', c.param);
      const e = c.estado;
      e.ajMonto = d.monto || ''; e.ajMes = mesActual();
      c.preguntar({
        titulo: 'Agregar cuota de ajuste',
        texto: 'Para una diferencia que apareció al final (intereses, comisiones o redondeo). Queda como una cuota más del plan.',
        get html() {
          return `<label class="campo-h"><span class="lbl">Monto (${plan.moneda === 'USD' ? 'US$' : 'S/'})</span>
            <input class="inp num" name="monto" data-f="ajMonto" data-keep inputmode="decimal" enterkeyhint="done" value="${esc(e.ajMonto)}" aria-label="Monto de la cuota de ajuste"></label>
            <label class="campo-h"><span class="lbl">Mes</span><input class="inp" type="month" name="mes" data-f="ajMes" value="${esc(e.ajMes)}"></label>
            <label class="campo-h"><span class="lbl">¿Ya se pagó?</span><select class="inp" name="estado"><option value="${L.ESTADO.PROG}">Por pagar</option><option value="${L.ESTADO.CONF}">Pagado</option></select></label>
            <div id="prevAjuste" aria-live="polite">${previaAjusteHtml(plan, e.ajMonto, e.ajMes)}</div>`;
        },
        botones: [{ l: 'Agregar', estilo: 'pri', fn: (c2, v) => {
          ops.agregarCuotaAjuste(c2.param, parseMonto(v.monto), v.mes, { estado: v.estado });
          c2.avisar(`Cuota de ajuste agregada: ${fmt(parseMonto(v.monto), { moneda: plan.moneda })}`);
        } }]
      });
    }
  }
};

export default { compromisos, plan: planCuotas };
