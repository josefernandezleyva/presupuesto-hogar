// Inicio (2.0): responde de un vistazo cuánto se gastó, cuánto queda, quién debe a quién,
// qué registró la otra persona y qué pagos vienen.

import * as L from '../logic.js';
import * as ops from '../ops.js';
import { esc, pct, hoy, mesActual, fechaCorta, num, fmt } from '../util.js';
import { tituloGrande, tabbar, barra, alerta, dinero, dinero0, avatar, icono, anillo, haceCuanto } from '../ui.js';
import { lineaSync, fraseSaldo, puntoCat, nombre, botonSync } from './comun.js';
import { soporte, MOTIVOS } from '../avisos.js';

const corto = (p) => esc(p?.alias || String(p?.nombre || '').split(' ')[0] || '');

function saludo() {
  const h = new Date().getHours();
  return h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches';
}

export default {
  vista(c) {
    const { S, mes, yo, meta } = c;
    const r = L.resumenMes(S, mes);
    const cerrado = L.mesCerrado(S, mes);
    const usado = r.gastado + r.comprometido;
    const conTope = r.presupuesto > 0;
    const pG = conTope ? r.gastado / r.presupuesto * 100 : 0, pC = conTope ? r.comprometido / r.presupuesto * 100 : 0;
    const estado = r.excedePresupuesto ? 'bad' : pG + pC >= L.umbral(S) ? 'warn' : 'ok';
    const dia = L.disponiblePorDia(S, mes, hoy());
    const filas = L.saldosMes(S, mes);
    const mia = filas.find((f) => f.persona_id === yo?.id);
    const trans = L.transferencias(filas);
    const visto = meta.novedadesVistas || '';
    const nov = L.novedades(S, yo?.id, { visto, max: 3 });
    const sinVer = L.novedadesSinVer(S, yo?.id, visto);
    const prox = mes === mesActual() ? L.proximos(S, hoy(), { dias: 31 }).slice(0, 4) : [];
    const orden = { excede: 0, aviso: 1, ok: 2, sin_tope: 3 };
    const cats = r.porCategoria.filter((f) => f.usado > 0 || f.tope > 0).sort((a, b) => orden[a.estado] - orden[b.estado] || b.usado - a.usado);
    const visibles = c.estado.todas ? cats : cats.slice(0, 5);
    const sop = soporte();
    const ofrecerAvisos = !meta.demo && meta.url && !meta.avisos && !meta.avisosNoOfrecer && (sop.ok || sop.motivo === 'inicio');

    const acciones = `<button class="btn-ic round" data-a="privado" aria-label="${c.privado ? 'Mostrar montos' : 'Ocultar montos'}" aria-pressed="${!!c.privado}">${icono(c.privado ? 'ojoNo' : 'ojo', 20)}</button>
      <a class="btn-ic round campana" href="#/novedades" aria-label="Novedades${sinVer ? `, ${sinVer} sin ver` : ''}">${icono('campana', 21)}${sinVer ? `<span class="globo" aria-hidden="true">${sinVer > 9 ? '9+' : sinVer}</span>` : ''}</a>
      <a class="yo-btn" href="#/mas" aria-label="Hogar y ajustes">${avatar(yo, 36)}</a>`;

    return `<main class="pad has-tabs inicio">
      ${tituloGrande({ titulo: 'Inicio', sub: `${saludo()}, ${corto(yo)}`, derecha: acciones, mes, cerrado })}
      <div class="sync-fila">${lineaSync(c)}${botonSync(c)}</div>

      <section class="card hero">
        <div class="hero-fila">
          <div class="hero-m">
            <div class="lbl">Gastado este mes</div>
            <div class="big num">${dinero0(r.gastado)}</div>
            ${conTope ? `<div class="sm muted">de ${dinero0(r.presupuesto)} de presupuesto</div>` : '<a href="#/presupuesto" class="link">Definir presupuesto</a>'}
          </div>
          ${conTope ? anillo(pG, pC, { estado, texto: 'usado' }) : ''}
        </div>
        ${conTope ? `<div class="hero-pie">
          <div><div class="lbl">Disponible</div><div class="val num${r.disponible < 0 ? ' bad-t' : ''}">${dinero0(r.disponible)}</div></div>
          ${dia ? `<div><div class="lbl">Por día</div><div class="val num">${dinero0(dia.porDia)}</div><div class="xs muted">${dia.dias} ${dia.dias === 1 ? 'día' : 'días'}</div></div>` : `<div><div class="lbl">Comprometido</div><div class="val num">${dinero0(r.comprometido)}</div></div>`}
          <div class="right"><div class="lbl">Ingreso</div><div class="val num">${r.ingreso > 0 ? dinero0(r.ingreso) : '<a href="#/ingresos" class="link">Registrar</a>'}</div></div>
        </div>` : ''}
      </section>

      ${r.excedePresupuesto ? alerta('bad', 'Superaron el presupuesto del mes', `Gasto y compromisos suman ${dinero0(usado)}, ${dinero0(usado - r.presupuesto)} sobre el presupuesto.`) : ''}
      ${r.excedeIngreso ? alerta('bad', 'El gasto supera el ingreso del hogar', `Gasto y compromisos: ${dinero0(usado)}. Ingreso: ${dinero0(r.ingreso)}.`) : ''}

      <a class="card saldo-card" href="#/cierre">
        <div class="saldo-avs">${trans.length ? avatar(L.persona(S, trans[0].de), 40) + `<span class="saldo-fl">${icono('adelante', 16)}</span>` + avatar(L.persona(S, trans[0].a), 40) : avatar(yo, 40)}</div>
        <div class="row-m">
          <span class="lbl">Cuentas entre ustedes</span>
          <span class="saldo-t">${fraseSaldo(S, trans)}</span>
          ${mia ? `<span class="row-s">Te corresponde ${dinero0(mia.corresponde)} · pagaste ${dinero0(mia.pagado)}</span>` : ''}
        </div>
        ${icono('adelante', 20)}
      </a>

      ${ofrecerAvisos ? `<section class="card oferta">
        <div class="split vc"><span class="oferta-ic">${icono('campana', 22)}</span><div class="grow"><div class="b">Entérate de cada gasto</div><div class="sm muted">${sop.ok ? 'Recibe un aviso cuando la otra persona registre un gasto, con cuánto te toca.' : esc(MOTIVOS.inicio)}</div></div></div>
        <div class="split gap">${sop.ok ? '<a class="btn pri" href="#/avisos">Activar avisos</a>' : ''}<button class="btn ghost" data-a="no-ofrecer">Ahora no</button></div>
      </section>` : ''}

      ${nov.length ? `<section class="card list">
        <div class="list-h"><h2 class="h2">Novedades${sinVer ? ` <span class="badge soft">${sinVer} ${sinVer === 1 ? 'nueva' : 'nuevas'}</span>` : ''}</h2><a class="link" href="#/novedades">Ver todas</a></div>
        ${nov.map((n) => itemNovedad(S, n)).join('')}
      </section>` : ''}

      ${prox.length ? `<section class="card list">
        <div class="list-h"><h2 class="h2">Próximos pagos</h2><a class="link" href="#/compromisos">Ver más</a></div>
        ${prox.map(({ gasto: g, atrasado }) => {
          const cat = L.categoria(S, g.categoria_id);
          return `<div class="row prox">
            <a class="row-m" href="#/gasto/${esc(g.id)}"><span class="row-t">${puntoCat(cat)}&nbsp;${esc(g.nota || cat?.nombre || 'Gasto')}</span>
              <span class="row-s${atrasado ? ' warn-t' : ''}">${atrasado ? 'Vencido · ' : ''}${esc(fechaCorta(g.fecha))} · ${dinero(num(g.monto), { moneda: g.moneda })}</span></a>
            <button class="btn mini" data-a="confirmar" data-id="${esc(g.id)}" aria-label="Confirmar ${esc(g.nota || cat?.nombre || 'gasto')}">Confirmar</button>
          </div>`;
        }).join('')}
      </section>` : ''}

      <section class="card">
        <div class="split"><h2 class="h2">Categorías</h2>${cats.length > 5 ? `<button class="link" data-a="toggle" data-k="todas">${c.estado.todas ? 'Ver menos' : 'Ver todas'}</button>` : ''}</div>
        ${visibles.length ? visibles.map((f) => `
          <a class="catrow" href="#/gastos?cat=${esc(f.cat.id)}">
            <div class="split sm"><span>${puntoCat(f.cat)} ${esc(f.cat.nombre)}${f.tope > 0 ? ` <span class="${f.estado === 'excede' ? 'bad-t b' : f.estado === 'aviso' ? 'warn-t' : 'muted'} xs">${f.estado === 'excede' ? '▲ ' : ''}${esc(pct(f.pct))}</span>` : ''}</span>
            <span class="muted num">${dinero0(f.usado)}${f.tope > 0 ? ' de ' + dinero0(f.tope) : ''}</span></div>
            ${f.tope > 0 ? barra(f.pct, f.estado) : ''}
          </a>`).join('') : '<p class="muted">Todavía no hay gastos este mes. Toca + para registrar el primero.</p>'}
      </section>
    </main>${tabbar('inicio')}`;
  },
  acciones: {
    confirmar(c, d) {
      ops.confirmarGasto(d.id);
      c.avisar('Gasto confirmado');
    },
    'no-ofrecer'(c) { c.setMeta({ avisosNoOfrecer: true }); c.render(); }
  }
};

/** Fila de una novedad: quién, qué, cuánto y cuánto te toca. */
export function itemNovedad(S, n) {
  const g = n.gasto;
  const cat = L.categoria(S, g.categoria_id);
  const autor = L.persona(S, n.autor);
  const plan = n.plan;
  const monto = plan?.modalidad === 'Cuotas' ? `${dinero(num(plan.monto_total), { moneda: plan.moneda })} en ${esc(plan.nro_cuotas)} cuotas`
    : plan?.modalidad === 'Recurrente' ? `${dinero(num(plan.monto_cuota), { moneda: plan.moneda })} cada mes` : dinero(num(g.monto), { moneda: g.moneda });
  const anulado = g.estado === L.ESTADO.ANUL;
  return `<a class="row nov${n.nueva ? ' nueva' : ''}" href="#/gasto/${esc(g.id)}">
    ${avatar(autor, 36)}
    <span class="row-m">
      <span class="row-t">${esc(g.nota || plan?.descripcion || cat?.nombre || 'Gasto')}${anulado ? ' <span class="badge">Anulado</span>' : ''}</span>
      <span class="row-s">${corto(autor)} · ${esc(cat?.nombre || '')} · ${esc(haceCuanto(n.cuando))}</span>
    </span>
    <span class="amt num">${monto}${n.parte > 0 ? `<span class="row-s">te toca ${dinero(n.parte)}${plan ? '/mes' : ''}</span>` : ''}</span>
    ${n.nueva ? '<span class="punto-nuevo" aria-label="Nueva"></span>' : ''}
  </a>`;
}

export { dinero, fmt };
