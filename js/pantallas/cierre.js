// Cuentas (2.0, pestaña): saldo entre personas, pagos entre ustedes y cierre de mes (RF-37 a RF-40).

import * as L from '../logic.js';
import * as ops from '../ops.js';
import { esc, fmt, fmt0, nombreMes, sumarMeses, hoy, parseMonto, mesActual } from '../util.js';
import { tituloGrande, tabbar, avatar, alerta, dinero0, dinero, chips, icono, encabezado } from '../ui.js';
import { fraseSaldo, nombre, placa, sinMonto } from './comun.js';

/* 3.1 · «Registrar pago» se llena en una hoja que sube desde abajo (antes, un formulario dentro de la página). */
function formPago(c) {
  const { S, estado: e } = c;
  const personas = L.personas(S);
  return `<form class="stack" data-submit="liquidar">
    <p class="sm muted">Lo que una persona le da a la otra para saldar las cuentas del mes.</p>
    <div class="lbl">Quién paga</div>${chips('de', personas.map((p) => ({ v: p.id, l: p.nombre })), e.de)}
    <div class="lbl">Quién recibe</div>${chips('para', personas.map((p) => ({ v: p.id, l: p.nombre })), e.para)}
    <label class="frow"><span class="muted">Monto (S/)</span><input class="inl" data-f="lm" inputmode="decimal" value="${esc(e.lm || '')}"></label>
    <label class="frow"><span class="muted">Fecha</span><input type="date" class="inl" data-f="lf" value="${esc(e.lf || hoy())}"></label>
    <button class="btn pri" type="submit">Guardar pago</button>
  </form>`;
}

function abrirPago(c, datos) {
  Object.assign(c.estado, { lf: hoy() }, datos);
  c.preguntar({ titulo: 'Registrar pago', get html() { return formPago(c); }, botones: [], cancelar: 'Cancelar' });
}

const cuentas = {
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

      <section class="card cuentas-tabla">
        <div class="ct-f ct-h"><span>${cerrado ? 'Al cierre' : 'Este mes'}</span><span>Pagó</span><span>Le toca</span></div>
        ${filas.map((f) => {
          const p = L.persona(S, f.persona_id);
          const extra = [Math.abs(f.saldo_inicial) > 0.004 ? `saldo anterior ${fmt(f.saldo_inicial, { signo: true })}` : '', Math.abs(f.liq_pagado - f.liq_recibido) > 0.004 ? `pagos ${fmt(f.liq_pagado - f.liq_recibido, { signo: true })}` : ''].filter(Boolean).join(' · ');
          const etiqueta = f.saldo_final > 0.004 ? `Le deben ${fmt(f.saldo_final)}` : f.saldo_final < -0.004 ? `Debe ${fmt(-f.saldo_final)}` : 'Al día';
          return `<div class="ct-f">
            <span class="ct-p">${avatar(p, 30)}<span class="row-m"><span class="b">${esc(p.alias || p.nombre)} · ${part[p.id] || 0} %</span><span class="xs ${f.saldo_final > 0.004 ? 'ok-t' : f.saldo_final < -0.004 ? 'warn-t' : 'muted'}">${esc(etiqueta)}${extra ? ` <span class="muted">· ${esc(extra)}</span>` : ''}</span></span></span>
            <span class="num">${dinero0(f.pagado)}</span><span class="num">${dinero0(f.corresponde)}</span>
          </div>`;
        }).join('')}
        <p class="xs muted">Cuenta lo pagado. Los gastos por pagar entran al marcarlos como pagados.</p>
      </section>

      ${prog.length && !cerrado ? alerta('warn', `${prog.length} ${prog.length === 1 ? 'gasto por pagar' : 'gastos por pagar'}`,
        `${prog.slice(0, 3).map((g) => `${g.nota || L.categoria(S, g.categoria_id)?.nombre} (${fmt(g.monto_soles)})`).join(', ')}${prog.length > 3 ? '…' : ''}. Al cerrar se marcan como pagados con su monto previsto${proyeccion ? ' y el saldo queda: ' + (proyeccion.length ? proyeccion.map((t) => `${L.persona(S, t.de)?.nombre} debe ${fmt(t.monto)} a ${L.persona(S, t.a)?.nombre}`).join('; ') : 'al día') : ''}.`) : ''}

      <section class="card">
        <div class="split"><h2 class="h2">Pagos entre personas</h2>${!cerrado ? '<button class="link" data-a="nuevo-pago">Registrar pago</button>' : ''}</div>
        ${!cerrado && trans.length ? trans.map((t) => `<button type="button" class="row" data-a="sugerido" data-de="${esc(t.de)}" data-para="${esc(t.a)}" data-m="${t.monto}">
            <span class="row-m"><span class="row-t">${nombre(S, t.de)} paga ${esc(fmt(t.monto))} a ${nombre(S, t.a)}</span><span class="row-s">Toca para registrar este pago</span></span>${icono('adelante', 18)}</button>`).join('') : ''}
        ${liqs.length ? liqs.map((l) => `<div class="row"><span class="row-m"><span class="row-t">${nombre(S, l.de_persona_id)} → ${nombre(S, l.a_persona_id)}</span><span class="row-s">${esc(l.fecha)}</span></span><span class="amt">${dinero(l.monto_soles)}</span>
          ${!cerrado ? `<button class="btn-ic" data-a="borrar-liq" data-id="${esc(l.id)}" aria-label="Eliminar pago">${icono('cerrar', 18)}</button>` : ''}</div>`).join('') : (!trans.length || cerrado ? '<p class="muted sm">Sin pagos este mes.</p>' : '')}
      </section>

      <div class="actions">
        ${cerrado
          ? `<p class="muted sm center">Cerrado por ${nombre(S, cerr.cerrado_por)}. Lo pendiente pasó como saldo inicial a ${esc(nombreMes(sumarMeses(mes, 1)))}.</p>
             ${c.admin ? '<button class="btn sec" data-a="reabrir">Reabrir mes</button>' : ''}`
          : c.admin
            ? `<p class="muted sm center">El saldo pendiente pasa como saldo inicial a ${esc(nombreMes(sumarMeses(mes, 1)))}.</p>
               <a class="card fila-cerrar" href="#/cerrar" data-a="cerrar">${placa('cerrado', 'var(--ink)', 40)}<span class="row-m"><span class="row-t">Cerrar ${esc(nombreMes(mes, { anio: false }).toLowerCase())}</span><span class="row-s">Revisa pendientes, salden y bloquea el mes</span></span>${icono('adelante', 18)}</a>`
            : '<p class="muted sm center">Solo el administrador puede cerrar el mes.</p>'}
      </div>
    </main>${tabbar('cierre')}`;
  },
  acciones: {
    sugerido(c, d) { abrirPago(c, { de: d.de, para: d.para, lm: d.m }); },
    'nuevo-pago'(c) {
      const ps = L.personas(c.S);
      abrirPago(c, { de: c.estado.de || c.meta.personaId || ps[0]?.id, para: c.estado.para || ps.find((p) => p.id !== (c.estado.de || c.meta.personaId))?.id, lm: '' });
    },
    liquidar(c) {
      const e = c.estado;
      ops.registrarLiquidacion({ mes: c.mes, de: e.de, a: e.para, monto: parseMonto(e.lm), fecha: e.lf || hoy() });
      Object.assign(e, { lm: '' });
      c.preguntar(null);
      c.avisar('Pago registrado');
    },
    'borrar-liq'(c, d) {
      c.preguntar({ titulo: 'Eliminar pago', texto: 'El saldo vuelve a calcularse sin este pago.', botones: [{ l: 'Eliminar', estilo: 'danger', fn: () => { ops.anularLiquidacion(d.id); c.avisar('Pago eliminado'); } }] });
    },
    cerrar(c) { c.ir('cerrar'); },
    cerrarYa(c) {
      const mes = c.mes;
      const futuro = mes > mesActual();
      c.preguntar({
        titulo: `¿Cerrar ${nombreMes(mes)}?`,
        texto: `${futuro ? 'Ojo: este mes todavía no termina. ' : ''}Los gastos por pagar se marcan como pagados con su monto previsto, se guardan los saldos en la hoja y el mes queda bloqueado.`,
        botones: [{ l: 'Cerrar mes', estilo: 'pri', fn: () => { ops.cerrarMes(mes); c.avisar('Mes cerrado'); } }]
      });
    },
    reabrir(c) {
      c.preguntar({ titulo: '¿Reabrir el mes?', texto: 'Se podrán cambiar sus gastos. Al cerrarlo de nuevo se recalculan los saldos de los meses siguientes.', botones: [{ l: 'Reabrir', estilo: 'pri', fn: () => { ops.reabrirMes(c.mes); c.avisar('Mes reabierto'); } }] });
    }
  }
};

/* ------------------------------------------- 3.0 · Cerrar el mes en 3 pasos --- */
// 1 · pendientes por pagar, 2 · saldar (o dejar el saldo para el mes siguiente), 3 · confirmar el cierre.
// La lógica es la misma de siempre (ops.cerrarMes); solo se guía el paso a paso.
const cerrarMes = {
  iniciar(c) { c.estado.paso = 1; },
  vista(c) {
    const { S, mes, estado: e } = c;
    const nm = nombreMes(mes, { anio: false }).toLowerCase();
    if (!c.admin) return `${encabezado({ titulo: 'Cerrar el mes' })}<main class="pad">${alerta('info', 'Solo el administrador puede cerrar el mes', 'Pídeselo a quien administra el hogar.')}</main>`;
    if (L.mesCerrado(S, mes) && e.paso < 4) return `${encabezado({ titulo: 'Cerrar el mes' })}<main class="pad">${alerta('ok', nombreMes(mes) + ' ya está cerrado', '')}<a class="btn sec wide" href="#/cierre">Volver a Cuentas</a></main>`;
    const prog = L.gastosMes(S, mes, [L.ESTADO.PROG]);
    const S2 = { ...S, Gastos: S.Gastos.map((g) => (g.mes === mes && g.estado === L.ESTADO.PROG ? { ...g, estado: L.ESTADO.CONF } : g)) };
    const proy = L.transferencias(L.saldosMes(S2, mes));
    const r = L.resumenMes(S, mes);
    const pasos = ['Pendientes', 'Saldar', 'Cerrar'];
    const barra = `<ol class="pasos" aria-label="Pasos">${pasos.map((p, i) => `<li class="${i + 1 <= e.paso ? 'on' : ''}"${i + 1 === e.paso ? ' aria-current="step"' : ''}><span></span>${i + 1} · ${p}</li>`).join('')}</ol>`;
    let cuerpo = '';
    if (e.paso === 1) {
      cuerpo = prog.length ? `<h2 class="paso-t">${prog.length === 1 ? 'Queda 1 gasto por pagar' : `Quedan ${prog.length} gastos por pagar`}</h2>
        <p class="sm muted">Al cerrar, los que sigan por pagar se marcan como pagados con su monto previsto. Si alguno no se pagó o cambió de monto, ajústalo antes.</p>
        <section class="card list">${prog.map((g) => `<a class="row" href="#/ver/${esc(g.id)}"><span class="row-m"><span class="row-t">${esc(g.nota || L.categoria(S, g.categoria_id)?.nombre || 'Gasto')}</span><span class="row-s">${esc(g.fecha)}</span></span><span class="amt num">${sinMonto(g) ? '<span class="por-def">Por definir</span>' : dinero(g.monto_soles)}</span></a>`).join('')}</section>
        ${prog.some(sinMonto) ? alerta('warn', 'Hay gastos sin monto', 'Escribe su monto antes de cerrar (tócalos para abrirlos). Si no, se cerrarán en S/ 0.') : ''}`
        : `<h2 class="paso-t">No hay gastos por pagar</h2><p class="sm muted">Todo lo de ${esc(nm)} está marcado como pagado.</p>`;
    } else if (e.paso === 2) {
      const t = proy[0];
      cuerpo = t ? `<h2 class="paso-t">${esc(nombre(S, t.de))} le debe ${esc(fmt(t.monto))} a ${esc(nombre(S, t.a))}</h2>
        <p class="sm muted">${prog.length ? 'Incluye los gastos que se marcarán como pagados. ' : ''}Pueden saldarlo ahora o cerrar y que pase como saldo inicial a ${esc(nombreMes(sumarMeses(mes, 1)).toLowerCase())}.</p>
        <button class="btn sec wide" data-a="pagar-cierre" data-de="${esc(t.de)}" data-para="${esc(t.a)}" data-m="${t.monto}">Registrar pago de ${esc(fmt(t.monto))}</button>`
        : `<h2 class="paso-t">Están al día</h2><p class="sm muted">Nadie le debe a nadie en ${esc(nm)}.</p>`;
    } else if (e.paso === 3) {
      const t = proy[0];
      cuerpo = `<h2 class="paso-t">Listo para cerrar</h2>
        <section class="card list">
          <div class="row"><span class="row-m">Gastado en ${esc(nm)}</span><span class="amt num">${dinero0(r.gastado + r.comprometido)}</span></div>
          <div class="row"><span class="row-m">Presupuesto</span><span class="amt num">${r.presupuesto > 0 ? dinero0(r.presupuesto) : '—'}</span></div>
          <div class="row"><span class="row-m">Por pagar que se marcan pagados</span><span class="amt">${prog.length}</span></div>
          <div class="row"><span class="row-m">Saldo entre ustedes</span><span class="amt">${t ? `${esc(nombre(S, t.de))} debe ${esc(fmt(t.monto))}` : 'Al día'}</span></div>
        </section>
        ${mes > mesActual() ? alerta('warn', 'Este mes todavía no termina', 'Puedes cerrarlo igual, pero no podrán registrar más gastos en él.') : ''}
        <div class="det-nota">${placa('cerrado', 'var(--warn, #B26B00)', 28)}<span class="sm">Después de cerrar, nadie podrá cambiar gastos de ${esc(nm)}. Solo el administrador puede reabrirlo.</span></div>`;
    } else {
      cuerpo = `<section class="center stack hecho">${placa('pagado', 'var(--accent)', 76)}<h2 class="paso-t">${esc(nombreMes(mes))} está cerrado</h2><p class="sm muted">Quedó guardado en la hoja. El resto del hogar también lo verá cerrado.</p></section>`;
    }
    const pie = e.paso === 4 ? '<a class="btn pri wide" href="#/cierre">Volver a Cuentas</a>'
      : `<button class="btn ${e.paso === 3 ? 'lock' : 'pri'} wide" data-a="${e.paso === 3 ? 'confirmar-cierre' : 'siguiente'}">${e.paso === 3 ? `Cerrar ${esc(nm)}` : e.paso === 2 && proy.length ? 'Seguir sin saldar' : 'Seguir'}</button>
         ${e.paso > 1 ? '<button class="btn ghost wide" data-a="atras-paso">Atrás</button>' : ''}`;
    return `${encabezado({ titulo: 'Cerrar ' + nm })}<main class="pad cerrar-mes">${e.paso < 4 ? barra : ''}${cuerpo}<div class="actions">${pie}</div></main>`;
  },
  acciones: {
    siguiente(c) { c.estado.paso += 1; c.render(); },
    'atras-paso'(c) { c.estado.paso = Math.max(1, c.estado.paso - 1); c.render(); },
    'pagar-cierre'(c, d) {
      ops.registrarLiquidacion({ mes: c.mes, de: d.de, a: d.para, monto: Number(d.m), fecha: hoy() });
      c.avisar('Pago registrado');
    },
    'confirmar-cierre'(c) { ops.cerrarMes(c.mes); c.estado.paso = 4; c.avisar('Mes cerrado'); }
  }
};

export default { cierre: cuentas, cerrar: cerrarMes };
