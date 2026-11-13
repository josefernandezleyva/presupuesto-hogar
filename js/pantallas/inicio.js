// Inicio (2.0): responde de un vistazo cuánto se gastó, cuánto queda, quién debe a quién,
// qué registró la otra persona y qué pagos vienen.

import * as L from '../logic.js';
import * as ops from '../ops.js';
import { esc, pct, hoy, mesActual, fechaCorta, num, fmt, nombreMes } from '../util.js';
import { svg } from '../iconos.js';
import { tituloGrande, tabbar, barra, alerta, dinero, dinero0, avatar, icono, anillo, haceCuanto } from '../ui.js';
import { lineaSync, fraseSaldo, puntoCat, placaCat, placa, nombre, botonSync } from './comun.js';
import { soporte, MOTIVOS } from '../avisos.js';
import { pendientes } from '../store.js';

const corto = (p) => esc(p?.alias || String(p?.nombre || '').split(' ')[0] || '');

// 3.1 · Encabezado como el prototipo: la fecha de hoy arriba y «Hola, <nombre>» grande.
const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
function fechaHoy() {
  const d = new Date();
  return `${DIAS[d.getDay()]} ${d.getDate()} de ${nombreMes(mesActual(), { anio: false }).toLowerCase()}`;
}

/** La línea de sincronización solo aparece cuando dice algo útil (cambios por subir, sincronizando, modo de ejemplo o datos viejos). */
function syncNecesaria(c) {
  if (c.meta.demo || c.sync.corriendo || pendientes() > 0 || !c.sync.ultimo) return true;
  if (c.sync.error) return false; // ya lo dice la tarjeta «Sin conexión»
  return Date.now() - new Date(c.sync.ultimo).getTime() > 30 * 60 * 1000;
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

    // 3.0 · Inicio responde primero «¿cuánto nos queda?» y junta en «Pendientes» todo lo que pide acción.
    const vacioMes = mes === mesActual() && !L.gastosMes(S, mes).length;
    const pC2 = Math.min(100 - Math.min(100, pG), pC);
    const novNuevas = nov.filter((n) => n.nueva).slice(0, 2);
    const excedidas = cats.filter((f) => f.estado === 'excede').slice(0, 2);
    const nPend = prox.length + novNuevas.length + excedidas.length;
    const hero = vacioMes ? `<section class="card hero vacio-mes">
        ${placa('mesNuevo', 'var(--accent)', 60)}
        <h2 class="h2">${esc(nombreMes(mes, { anio: false }))} empieza en cero</h2>
        <p class="sm muted">Todavía no hay gastos este mes${prox.length ? '. Ya están programados ' + esc(prox.slice(0, 3).map((x) => x.gasto.nota || L.categoria(S, x.gasto.categoria_id)?.nombre).join(', ')) : ''}.</p>
        <div class="big num sr">${dinero0(0)}</div>
      </section>
      <section class="card list">
        <div class="list-h"><h2 class="h2">Para empezar el mes</h2></div>
        <a class="row" href="#/presupuesto">${placa('meta', 'var(--accent)', 34)}<span class="row-m"><span class="row-t">${conTope ? 'Revisar el presupuesto' : 'Definir el presupuesto'}</span><span class="row-s">${conTope ? 'Sigue el anterior: ' + dinero0(r.presupuesto) + ' con sus topes' : 'Y los topes por categoría'}</span></span>${icono('adelante', 18)}</a>
        <a class="row" href="#/ingresos">${placa('sueldo', '#2E7D6B', 34)}<span class="row-m"><span class="row-t">Registrar los ingresos</span><span class="row-s">${r.ingreso > 0 ? 'Ya hay ' + dinero0(r.ingreso) : 'Para ver cuánto ahorran'}</span></span>${icono('adelante', 18)}</a>
        <a class="row" href="#/nuevo">${placa('super', '#B4532A', 34)}<span class="row-m"><span class="row-t">Registrar el primer gasto</span><span class="row-s">Toma menos de 10 segundos</span></span>${icono('adelante', 18)}</a>
      </section>`
      : `<section class="card hero">
        <div class="lbl">${conTope ? `Te queda para ${esc(nombreMes(mes, { anio: false }).toLowerCase())}` : 'Gastado este mes'}</div>
        <div class="hero-n"><span class="big num${conTope && r.disponible < 0 ? ' bad-t' : ''}">${conTope ? (r.disponible < 0 ? '−' + dinero0(-r.disponible) : dinero0(r.disponible)) : dinero0(r.gastado)}</span>
          ${conTope ? `<span class="muted sm">de ${dinero0(r.presupuesto)}</span>` : '<a href="#/presupuesto" class="link sm">Definir presupuesto</a>'}</div>
        ${conTope ? `<div class="track dos ${estado}" role="img" aria-label="Gastado ${Math.round(pG)} %, por pagar ${Math.round(pC2)} %"><span class="g" style="width:${Math.min(100, pG)}%"></span><span class="c" style="width:${pC2}%"></span></div>
        <div class="leyenda sm"><span><i class="g"></i>Gastado este mes ${dinero0(r.gastado)}</span><span><i class="c"></i>Por pagar ${dinero0(r.comprometido)}</span></div>
        ${dia ? `<div class="por-dia">${svg('porDia', 20)}<span>Puedes gastar <b class="num">${dinero0(dia.porDia)}</b> por día</span><span class="muted">${dia.dias} ${dia.dias === 1 ? 'día' : 'días'}</span></div>` : ''}
        <div class="hero-pie"><a href="#/ingresos"><div class="lbl">Ingreso</div><div class="val num">${r.ingreso > 0 ? dinero0(r.ingreso) : 'Registrar'}</div></a><a href="#/analisis" class="right"><div class="lbl">Uso del presupuesto</div><div class="val num">${esc(pct(pG + pC))}</div></a></div>` : ''}
      </section>`;

    return `<main class="pad has-tabs inicio">
      ${tituloGrande({ titulo: yo ? `Hola, ${String(yo.alias || String(yo.nombre || '').split(' ')[0] || '')}` : 'Inicio', mini: 'Inicio', sub: esc(fechaHoy()), derecha: acciones, mes, cerrado })}
      ${c.sync.error && !meta.demo ? `<section class="card sin-red" role="status">${placa('sinConexion', '#B26B00', 40)}<span class="row-m"><span class="row-t">${navigator.onLine === false ? 'Sin conexión' : 'No se pudo sincronizar'}</span><span class="row-s">${pendientes() ? (pendientes() === 1 ? '1 cambio espera en este celular y se enviará solo.' : `${pendientes()} cambios esperan en este celular y se enviarán solos.`) : 'Tus datos están a salvo en este celular.'}</span></span><button class="btn sec mini" data-a="sync">Reintentar</button></section>` : ''}
      ${syncNecesaria(c) ? `<div class="sync-fila">${lineaSync(c)}${botonSync(c)}</div>` : ''}
      ${hero}

      ${r.excedePresupuesto ? alerta('bad', 'Superaron el presupuesto del mes', `Gasto y compromisos suman ${dinero0(usado)}, ${dinero0(usado - r.presupuesto)} sobre el presupuesto.`) : ''}
      ${r.excedeIngreso ? alerta('bad', 'El gasto supera el ingreso del hogar', `Gasto y compromisos: ${dinero0(usado)}. Ingreso: ${dinero0(r.ingreso)}.`) : ''}

      ${nPend && !vacioMes ? `<section class="card list pendientes">
        <div class="list-h"><h2 class="h2">Pendientes <span class="badge warn">${nPend}</span></h2>${prox.length ? '<a class="link" href="#/gastos?estado=Programado">Ver por pagar</a>' : ''}</div>
        ${prox.map(({ gasto: g, atrasado }) => {
          const cat = L.categoria(S, g.categoria_id);
          return `<div class="row prox">
            <a class="con-placa" href="#/ver/${esc(g.id)}">${atrasado ? placa('vencido', '#B3362A', 36) : placaCat(cat, 36)}<span class="row-m"><span class="row-t">${esc(g.nota || cat?.nombre || 'Gasto')}</span>
              <span class="row-s${atrasado ? ' bad-t' : ''}">${atrasado ? 'Venció el ' : 'Vence el '}${esc(fechaCorta(g.fecha))} · ${dinero(num(g.monto), { moneda: g.moneda })}</span></span></a>
            <button class="btn mini pagar-b" data-a="confirmar" data-id="${esc(g.id)}" aria-label="Marcar ${esc(g.nota || cat?.nombre || 'gasto')} como pagado">${icono('check', 16)} Pagado</button>
          </div>`;
        }).join('')}
        ${novNuevas.map((n) => itemNovedad(S, n)).join('')}
        ${excedidas.map((f) => `<a class="row" href="#/analisis">${placa('excedido', '#B3362A', 36)}<span class="row-m"><span class="row-t">${esc(f.cat.nombre)} superó su tope</span><span class="row-s">${dinero0(f.usado)} de ${dinero0(f.tope)}</span></span>${icono('adelante', 18)}</a>`).join('')}
        ${sinVer > novNuevas.length ? `<a class="row" href="#/novedades">${placa('campana', '#2F5D8A', 36)}<span class="row-m"><span class="row-t">Ver las ${sinVer} novedades</span><span class="row-s">Gastos que registró la otra persona</span></span>${icono('adelante', 18)}</a>` : ''}
      </section>` : ''}

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
        <div class="split vc">${placa('campana', '#B3362A', 44)}<div class="grow"><div class="b">Entérate de cada gasto</div><div class="sm muted">${sop.ok ? 'Recibe un aviso cuando la otra persona registre un gasto, con cuánto te toca.' : esc(MOTIVOS.inicio)}</div></div></div>
        <div class="split gap">${sop.ok ? '<a class="btn pri" href="#/avisos">Activar avisos</a>' : ''}<button class="btn ghost" data-a="no-ofrecer">Ahora no</button></div>
      </section>` : ''}

      ${nov.length && !novNuevas.length ? `<section class="card list">
        <div class="list-h"><h2 class="h2">Novedades</h2><a class="link" href="#/novedades">Ver todas</a></div>
        ${nov.slice(0, 2).map((n) => itemNovedad(S, n)).join('')}
      </section>` : ''}

      ${cats.length ? `<section class="card">
        <div class="split"><h2 class="h2">Dónde se va el dinero</h2>${cats.length > 5 ? `<button class="link" data-a="toggle" data-k="todas">${c.estado.todas ? 'Ver menos' : 'Ver todas'}</button>` : '<a class="link" href="#/analisis">Ver topes</a>'}</div>
        ${visibles.map((f) => `
          <a class="catrow" href="#/gastos?cat=${esc(f.cat.id)}">
            <div class="split sm"><span>${puntoCat(f.cat)} ${esc(f.cat.nombre)}${f.tope > 0 ? ` <span class="${f.estado === 'excede' ? 'bad-t b' : f.estado === 'aviso' ? 'warn-t' : 'muted'} xs">${f.estado === 'excede' ? '▲ ' : ''}${esc(pct(f.pct))}</span>` : ''}</span>
            <span class="muted num">${dinero0(f.usado)}${f.tope > 0 ? ' de ' + dinero0(f.tope) : ''}</span></div>
            ${f.tope > 0 ? barra(f.pct, f.estado) : ''}
          </a>`).join('')}
      </section>` : ''}
    </main>${tabbar('inicio')}`;
  },
  acciones: {
    confirmar(c, d) {
      ops.confirmarGasto(d.id);
      c.avisar('Marcado como pagado', '', { l: 'Deshacer', fn: (c2) => { ops.desconfirmarGasto(d.id); c2.avisar('Vuelve a estar por pagar'); } });
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
  return `<a class="row nov${n.nueva ? ' nueva' : ''}" href="#/ver/${esc(g.id)}">
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
