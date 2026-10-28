// Cuentas (2.0, pestaña): saldo entre personas, pagos entre ustedes y cierre de mes (RF-37 a RF-40).

import * as L from '../logic.js';
import * as ops from '../ops.js';
import { esc, fmt, fmt0, nombreMes, sumarMeses, hoy, parseMonto, mesActual } from '../util.js';
import { tituloGrande, tabbar, avatar, alerta, dinero0, dinero, chips, icono } from '../ui.js';
import { fraseSaldo, nombre } from './comun.js';

export default {
  vista(c) {
    const { S, mes, estado: e } = c;
    const cerr = L.cierre(S, mes);
    const cerrado = cerr?.estado === 'Cerrado';
    const filas = L.saldosMes(S, mes).filter((f) => L.persona(S, f.persona_id));
    const trans = L.transferencias(filas);
    const part = L.participacion(S, mes);
    const prog = L.gastosMes(S, mes, [L.ESTADO.PROG]);
    const liqs = (L.idx(S).liqPorMes.get(mes) || []).sort((a, b) => (a.fecha < b.fecha ? 1 : -1));
    const arrastre = filas.filter((f) => Math.abs(f.saldo_inicial) > 0.004);
    const personas = L.personas(S);

    // Saldo si se confirman los programados con su monto previsto.
    let proyeccion = null;
    if (prog.length && !cerrado) {
      const S2 = { ...S, Gastos: S.Gastos.map((g) => (g.mes === mes && g.estado === L.ESTADO.PROG ? { ...g, estado: L.ESTADO.CONF } : g)) };
      proyeccion = L.transferencias(L.saldosMes(S2, mes));
    }

    const t0 = trans[0];
    return `<main class="pad has-tabs">
      ${tituloGrande({ titulo: 'Cuentas', mes, cerrado, derecha: `<span class="badge ${cerrado ? '' : 'ok'}">${cerrado ? 'Cerrado' : 'Abierto'}</span>` })}

      <section class="card cuentas-hero">
        <div class="ch-avs">${t0 ? `${avatar(L.persona(S, t0.de), 48)}<span class="ch-fl">${icono('adelante', 20)}</span>${avatar(L.persona(S, t0.a), 48)}` : personas.map((p) => avatar(p, 48)).join('')}</div>
        <div class="lbl">Saldo entre personas${cerrado ? ' al cierre' : ''}</div>
        <div class="frase num">${fraseSaldo(S, trans)}</div>
        ${!cerrado && t0 ? `<button class="btn pri" data-a="sugerido" data-de="${esc(t0.de)}" data-para="${esc(t0.a)}" data-m="${t0.monto}">Registrar este pago</button>` : ''}
        ${arrastre.length ? `<div class="xs">Incluye el saldo que viene de ${esc(nombreMes(sumarMeses(mes, -1), { anio: false }).toLowerCase())}: ${arrastre.filter((f) => f.saldo_inicial < 0).map((f) => `${nombre(S, f.persona_id)} arrastra ${esc(fmt(-f.saldo_inicial))}`).join(', ')}.</div>` : ''}
      </section>

      ${filas.map((f) => {
        const p = L.persona(S, f.persona_id);
        const etiqueta = f.saldo_final > 0.004 ? 'Le deben' : f.saldo_final < -0.004 ? 'Debe' : 'Al día';
        return `<section class="card">
          <div class="split vc">${avatar(p, 36)}<div class="grow"><div class="b">${esc(p.nombre)}</div><div class="xs muted">Participación ${part[p.id] || 0} %</div></div>
          <div class="right"><div class="xs muted">${etiqueta}</div><div class="mid ${f.saldo_final > 0.004 ? 'ok-t' : ''}">${dinero(Math.abs(f.saldo_final))}</div></div></div>
          <div class="quad">
            <div><div class="xs muted">Saldo inicial</div><div class="sm b">${dinero(f.saldo_inicial, { signo: true })}</div></div>
            <div><div class="xs muted">Pagó</div><div class="sm b">${dinero0(f.pagado)}</div></div>
            <div><div class="xs muted">Le corresponde</div><div class="sm b">${dinero0(f.corresponde)}</div></div>
            <div class="right"><div class="xs muted">Pagos</div><div class="sm b">${dinero0(f.liq_pagado - f.liq_recibido, { signo: true })}</div></div>
          </div>
        </section>`;
      }).join('')}

      ${prog.length && !cerrado ? alerta('warn', `${prog.length} ${prog.length === 1 ? 'gasto programado sin confirmar' : 'gastos programados sin confirmar'}`,
        `${prog.slice(0, 3).map((g) => `${g.nota || L.categoria(S, g.categoria_id)?.nombre} (${fmt(g.monto_soles)})`).join(', ')}${prog.length > 3 ? '…' : ''}. Al cerrar se confirman con su monto previsto${proyeccion ? ' y el saldo queda: ' + (proyeccion.length ? proyeccion.map((t) => `${L.persona(S, t.de)?.nombre} debe ${fmt(t.monto)} a ${L.persona(S, t.a)?.nombre}`).join('; ') : 'al día') : ''}.`) : ''}

      <section class="card">
        <div class="split"><h2 class="h2">Pagos entre personas</h2>${!cerrado ? '<button class="link" data-a="toggle" data-k="form">Registrar pago</button>' : ''}</div>
        ${!cerrado && trans.length && !e.form ? trans.map((t) => `<button type="button" class="row" data-a="sugerido" data-de="${esc(t.de)}" data-para="${esc(t.a)}" data-m="${t.monto}">
            <span class="row-m"><span class="row-t">${nombre(S, t.de)} paga ${esc(fmt(t.monto))} a ${nombre(S, t.a)}</span><span class="row-s">Toca para registrar este pago</span></span>${icono('adelante', 18)}</button>`).join('') : ''}
        ${e.form ? `<form class="stack" data-submit="liquidar">
          <div class="lbl">Quién paga</div>${chips('de', personas.map((p) => ({ v: p.id, l: p.nombre })), e.de)}
          <div class="lbl">Quién recibe</div>${chips('para', personas.map((p) => ({ v: p.id, l: p.nombre })), e.para)}
          <label class="frow"><span class="muted">Monto (S/)</span><input class="inl" data-f="lm" inputmode="decimal" value="${esc(e.lm || '')}"></label>
          <label class="frow"><span class="muted">Fecha</span><input type="date" class="inl" data-f="lf" value="${esc(e.lf || hoy())}"></label>
          <button class="btn pri" type="submit">Guardar pago</button>
        </form>` : ''}
        ${liqs.length ? liqs.map((l) => `<div class="row"><span class="row-m"><span class="row-t">${nombre(S, l.de_persona_id)} → ${nombre(S, l.a_persona_id)}</span><span class="row-s">${esc(l.fecha)}</span></span><span class="amt">${dinero(l.monto_soles)}</span>
          ${!cerrado ? `<button class="btn-ic" data-a="borrar-liq" data-id="${esc(l.id)}" aria-label="Eliminar pago">${icono('cerrar', 18)}</button>` : ''}</div>`).join('') : (!trans.length || cerrado ? '<p class="muted sm">Sin pagos este mes.</p>' : '')}
      </section>

      <div class="actions">
        ${cerrado
          ? `<p class="muted sm center">Cerrado por ${nombre(S, cerr.cerrado_por)}. Lo pendiente pasó como saldo inicial a ${esc(nombreMes(sumarMeses(mes, 1)))}.</p>
             ${c.admin ? '<button class="btn sec" data-a="reabrir">Reabrir mes</button>' : ''}`
          : c.admin
            ? `<p class="muted sm center">El saldo pendiente pasa como saldo inicial a ${esc(nombreMes(sumarMeses(mes, 1)))}.</p>
               <button class="btn pri" data-a="cerrar">Cerrar ${esc(nombreMes(mes, { anio: false }).toLowerCase())}</button>`
            : '<p class="muted sm center">Solo el administrador puede cerrar el mes.</p>'}
      </div>
    </main>${tabbar('cierre')}`;
  },
  acciones: {
    sugerido(c, d) {
      Object.assign(c.estado, { form: true, de: d.de, para: d.para, lm: d.m, lf: hoy() });
      c.render();
    },
    liquidar(c) {
      const e = c.estado;
      ops.registrarLiquidacion({ mes: c.mes, de: e.de, a: e.para, monto: parseMonto(e.lm), fecha: e.lf || hoy() });
      Object.assign(e, { form: false, lm: '' });
      c.avisar('Pago registrado');
    },
    'borrar-liq'(c, d) {
      c.preguntar({ titulo: 'Eliminar pago', texto: 'El saldo vuelve a calcularse sin este pago.', botones: [{ l: 'Eliminar', estilo: 'danger', fn: () => { ops.anularLiquidacion(d.id); c.avisar('Pago eliminado'); } }] });
    },
    cerrar(c) {
      const mes = c.mes;
      const futuro = mes > mesActual();
      c.preguntar({
        titulo: `¿Cerrar ${nombreMes(mes)}?`,
        texto: `${futuro ? 'Ojo: este mes todavía no termina. ' : ''}Se confirman los programados pendientes, se guardan los saldos en la hoja y el mes queda bloqueado.`,
        botones: [{ l: 'Cerrar mes', estilo: 'pri', fn: () => { ops.cerrarMes(mes); c.avisar('Mes cerrado'); } }]
      });
    },
    reabrir(c) {
      c.preguntar({ titulo: '¿Reabrir el mes?', texto: 'Se podrán cambiar sus gastos. Al cerrarlo de nuevo se recalculan los saldos de los meses siguientes.', botones: [{ l: 'Reabrir', estilo: 'pri', fn: () => { ops.reabrirMes(c.mes); c.avisar('Mes reabierto'); } }] });
    }
  }
};
