import * as L from '../logic.js';
import { esc, pct } from '../util.js';
import { barraMes, tabbar, barra, alerta, dinero, dinero0, avatar, icono } from '../ui.js';
import { botonSync, lineaSync, fraseSaldo, puntoCat } from './comun.js';

export default {
  vista(c) {
    const { S, mes } = c;
    const r = L.resumenMes(S, mes);
    const cerrado = L.mesCerrado(S, mes);
    const usado = r.gastado + r.comprometido;
    const base = r.presupuesto > 0 ? r.presupuesto : Math.max(usado, 1);
    const pG = r.gastado / base * 100, pC = r.comprometido / base * 100;
    const orden = { excede: 0, aviso: 1, ok: 2, sin_tope: 3 };
    const cats = r.porCategoria.filter((f) => f.usado > 0 || f.tope > 0)
      .sort((a, b) => orden[a.estado] - orden[b.estado] || b.usado - a.usado);
    const visibles = c.estado.todas ? cats : cats.slice(0, 5);
    const trans = L.transferencias(L.saldosMes(S, mes));

    return `<main class="pad has-tabs">
      ${barraMes(mes, { derecha: botonSync(c), cerrado })}
      ${lineaSync(c)}

      <section class="card">
        <div class="split">
          <div><div class="lbl">Gastado este mes</div><div class="big">${dinero0(r.gastado)}</div></div>
          <div class="right"><div class="lbl">Presupuesto</div><div class="mid">${r.presupuesto > 0 ? dinero0(r.presupuesto) : '<a href="#/presupuesto" class="link">Definir</a>'}</div></div>
        </div>
        ${r.presupuesto > 0 ? `<div class="track" role="img" aria-label="${Math.round(pG)} % gastado y ${Math.round(pC)} % comprometido">
          <div class="fill ${r.excedePresupuesto ? 'bad' : 'ok'}" style="width:${Math.min(100, pG)}%"></div>
          <div class="fill soft" style="width:${Math.max(0, Math.min(100 - Math.min(100, pG), pC))}%"></div>
        </div>` : '<p class="muted xs">Define los topes en Más > Presupuesto para ver cuánto te queda.</p>'}
        <div class="trio">
          <div><div class="lbl">Disponible</div><div class="val${r.presupuesto > 0 && r.disponible < 0 ? ' bad-t' : ''}">${r.presupuesto > 0 ? dinero0(r.disponible) : '—'}</div></div>
          <div><div class="lbl">Comprometido</div><div class="val">${dinero0(r.comprometido)}</div></div>
          <div class="right"><div class="lbl">Ingreso del hogar</div><div class="val">${r.ingreso > 0 ? dinero0(r.ingreso) : '<a href="#/ingresos" class="link">Registrar</a>'}</div></div>
        </div>
      </section>

      ${r.excedePresupuesto ? alerta('bad', 'Superaste el presupuesto del mes', `Gasto y compromisos suman ${esc(dinero0(usado))}, ${esc(dinero0(usado - r.presupuesto))} sobre el presupuesto.`) : ''}
      ${r.excedeIngreso ? alerta('bad', 'El gasto supera el ingreso del hogar', `Gasto y compromisos: ${esc(dinero0(usado))}. Ingreso: ${esc(dinero0(r.ingreso))}.`) : ''}
      ${r.pendientes ? `<a class="card row-card" href="#/gastos?estado=Programado">${icono('info', 22)}<span class="row-m"><span class="row-t">${r.pendientes} ${r.pendientes === 1 ? 'gasto programado' : 'gastos programados'} por confirmar</span><span class="row-s">Cuotas y recurrentes de este mes</span></span>${icono('adelante', 20)}</a>` : ''}

      <section class="card">
        <div class="split"><h2 class="h2">Categorías</h2>${cats.length > 5 ? `<button class="link" data-a="toggle" data-k="todas">${c.estado.todas ? 'Ver menos' : 'Ver todas'}</button>` : ''}</div>
        ${visibles.length ? visibles.map((f) => `
          <a class="catrow" href="#/gastos?cat=${esc(f.cat.id)}">
            <div class="split sm"><span>${puntoCat(f.cat)} ${esc(f.cat.nombre)}${f.tope > 0 ? ` <span class="${f.estado === 'excede' ? 'bad-t b' : f.estado === 'aviso' ? 'warn-t' : 'muted'} xs">${f.estado === 'excede' ? '▲ ' : ''}${esc(pct(f.pct))}</span>` : ''}</span>
            <span class="muted">${dinero0(f.usado)}${f.tope > 0 ? ' de ' + dinero0(f.tope) : ''}</span></div>
            ${f.tope > 0 ? barra(f.pct, f.estado) : ''}
          </a>`).join('') : '<p class="muted">Todavía no hay gastos este mes. Toca + para registrar el primero.</p>'}
      </section>

      <a class="card row-card" href="#/cierre">
        <span class="avs">${trans.length ? avatar(L.persona(S, trans[0].de), 32) + avatar(L.persona(S, trans[0].a), 32) : ''}</span>
        <span class="row-m"><span class="lbl">Saldo entre personas</span><span class="row-t">${fraseSaldo(S, trans)}</span></span>
        ${icono('adelante', 20)}
      </a>
    </main>${tabbar('inicio')}`;
  }
};

export { dinero };
