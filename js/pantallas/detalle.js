// 3.0 · Detalle de un gasto, de solo lectura. Tocar un gasto ya no abre directamente la edición (evita
// cambios sin querer): aquí se ve todo y se elige qué hacer. La edición sigue siendo la misma pantalla.

import * as L from '../logic.js';
import * as ops from '../ops.js';
import * as st from '../store.js';
import { esc, num, fmt, fechaCorta, nombreMes } from '../util.js';
import { encabezado, avatar, icono, vacio } from '../ui.js';
import { placaCat, placa, sinMonto, montoTxt, marcarPagado, pedirAnular, pedirRestaurar } from './comun.js';

const corto = (p) => esc(p?.alias || String(p?.nombre || '').split(' ')[0] || '');

export default {
  ver: {
    vista(c) {
      const { S, param: id, meta } = c;
      const g = st.fila('Gastos', id);
      if (!g) return `${encabezado({ titulo: 'Gasto' })}<main class="pad">${vacio('No encontré este gasto. Puede que se haya borrado al sincronizar.', '<a class="btn pri" href="#/gastos">Ir a Gastos</a>')}</main>`;
      const cat = L.categoria(S, g.categoria_id);
      const plan = g.plan_id ? L.idx(S).plan.get(g.plan_id) : null;
      const cerrado = L.mesCerrado(S, g.mes);
      const anulado = g.estado === L.ESTADO.ANUL;
      const pagado = g.estado === L.ESTADO.CONF;
      const vencido = !pagado && !anulado && g.fecha < new Date().toISOString().slice(0, 10);
      const pcts = L.pctsDeGasto(S, g);
      const filas = L.calcularReparto(num(g.monto_soles), pcts);
      const ps = L.personas(S);
      const pagador = L.persona(S, g.pagado_por);
      const ajenos = filas.filter((r) => r.persona_id !== g.pagado_por && r.monto_soles > 0);
      const prog = plan ? L.progresoPlan(S, plan) : null;
      const est = anulado ? ['', 'Anulado'] : pagado ? ['ok', 'Pagado'] : vencido ? ['bad', 'Por pagar · vencido'] : ['warn', 'Por pagar'];
      const repHogar = !g.plan_id ? null : null;
      const fila = (k, v) => `<div class="det-f"><span class="muted">${k}</span><span class="b">${v}</span></div>`;
      return `${encabezado({ titulo: '', derecha: !anulado && !cerrado ? `<a class="link det-editar" href="#/gasto/${esc(g.id)}">Editar</a>` : '' })}
      <main class="pad det">
        <section class="det-cab">
          ${placaCat(cat, 60)}
          <h1 class="det-t">${esc(g.nota || cat?.nombre || 'Gasto')}</h1>
          <div class="det-m num${anulado ? ' tachado' : ''}${sinMonto(g) ? ' por-def' : ''}">${esc(montoTxt(g))}</div>
          ${sinMonto(g) ? '<p class="sm muted center">Es un recordatorio mensual: escribe el monto cuando llegue el recibo (Editar), o al marcarlo como pagado.</p>' : ''}
          ${g.moneda !== 'PEN' && !sinMonto(g) ? `<div class="sm muted">${esc(fmt(num(g.monto_soles)))} al cambio de ${esc(String(g.tipo_cambio))}</div>` : ''}
          <span class="badge ${est[0]} det-est">${est[1]}</span>
        </section>

        <section class="card det-lista">
          ${fila('Categoría', `${esc(cat?.nombre || '—')}${cat?.grupo ? ` <span class="muted">· ${esc(cat.grupo)}</span>` : ''}`)}
          ${fila('Fecha', esc(fechaCorta(g.fecha)) + ' ' + esc(g.fecha.slice(0, 4)))}
          ${fila('Pagó', corto(pagador) || '—')}
          ${fila('Tipo', esc(g.tipo || '—'))}
          ${fila('Registró', corto(L.persona(S, g.registrado_por)) || '—')}
        </section>

        ${ps.length > 1 && filas.length ? `<section class="card det-rep">
          <div class="split vc"><span class="b">Le toca a cada uno</span>${placa('reparto', 'var(--accent)', 28)}</div>
          <div class="rr-bar" aria-hidden="true">${filas.filter((r) => r.monto_soles > 0).map((r) => `<span style="flex:${num(r.porcentaje)};background:${esc(L.persona(S, r.persona_id)?.color || '#888')}"></span>`).join('')}</div>
          <div class="rr-cols${ps.length > 2 ? ' muchas' : ''}">${ps.map((p) => { const r = filas.find((x) => x.persona_id === p.id); return `<div class="rr-p${r && r.monto_soles > 0 ? '' : ' cero'}"><span class="rr-n">${avatar(p, 20)} ${corto(p)}${p.id === meta.personaId ? ' <span class="muted">(tú)</span>' : ''}</span><span class="rr-m num">${esc(fmt(r ? r.monto_soles : 0))}</span><span class="rr-pct">${Number(num(r?.porcentaje || 0).toFixed(2))} %</span></div>`; }).join('')}</div>
          <p class="xs muted">${anulado ? 'Anulado: no cuenta en las cuentas entre ustedes.' : !ajenos.length ? 'Lo asume quien lo pagó: no cambia las cuentas entre ustedes.' : pagado ? `Pagó ${corto(pagador)}: lo que le toca a ${ajenos.map((r) => corto(L.persona(S, r.persona_id))).join(' y ')} ya está en las cuentas entre ustedes.` : `Cuando se marque como pagado, lo que le toca a ${ajenos.map((r) => corto(L.persona(S, r.persona_id))).join(' y ')} se sumará a las cuentas entre ustedes.`}</p>
        </section>` : ''}

        ${plan ? `<a class="card det-plan" href="${plan.modalidad === 'Cuotas' ? '#/plan/' + esc(plan.id) : '#/gasto/' + esc(g.id)}">
          <span class="split vc"><span class="b">${plan.modalidad === 'Cuotas' ? `Cuota ${esc(g.nro_cuota)} de ${esc(plan.nro_cuotas)}` : 'Gasto mensual'}</span><span class="link sm">${plan.modalidad === 'Cuotas' ? 'Ver y ajustar el plan' : 'Ajustar la repetición'} ${icono('adelante', 14)}</span></span>
          ${plan.modalidad === 'Cuotas' ? `<span class="plan-segs" aria-label="${prog.confirmadas} de ${prog.total} cuotas pagadas">${Array.from({ length: prog.total }, (_, i) => `<span class="${i < prog.confirmadas ? 'pag' : ''}"></span>`).join('')}</span>
          <span class="xs muted">${prog.confirmadas} de ${prog.total} pagadas · total ${esc(fmt(plan.monto_total, { moneda: plan.moneda }))}</span>` : `<span class="xs muted">${esc(plan.descripcion)} · cada mes${plan.duracion_meses ? ` por ${esc(plan.duracion_meses)} meses` : ', sin fin'}</span>`}
        </a>` : ''}

        ${g.evidencia_url || g.evidencia_id ? `<a class="card det-foto" href="${esc(g.evidencia_url || '#/gasto/' + g.id)}" ${g.evidencia_url ? 'target="_blank" rel="noopener"' : ''}>${icono('foto', 22)}<span class="grow b">Ver la foto del comprobante</span>${icono('adelante', 18)}</a>`
          : !anulado && !cerrado ? `<a class="card det-foto" href="#/gasto/${esc(g.id)}">${icono('foto', 22)}<span class="grow b">Agregar foto del comprobante</span>${icono('adelante', 18)}</a>` : ''}

        ${cerrado ? `<div class="det-nota">${placa('cerrado', 'var(--muted)', 28)}<span class="sm">${esc(nombreMes(g.mes))} está cerrado: este gasto ya no se puede cambiar. El administrador puede reabrir el mes en Cuentas.</span></div>` : ''}

        <div class="det-acc">
          ${anulado ? (!cerrado ? `<button class="btn pri" data-a="restaurar" data-id="${esc(g.id)}">Restaurar gasto</button>` : '')
            : cerrado ? '' : pagado ? `<button class="btn sec" data-a="desconfirmar" data-id="${esc(g.id)}">Volver a «por pagar»</button>`
            : `<button class="btn pri" data-a="confirmar" data-id="${esc(g.id)}">${icono('check', 18)} Marcar como pagado</button>`}
          ${!anulado && !cerrado ? `<button class="btn ghost bad-t" data-a="anular" data-id="${esc(g.id)}">Anular gasto</button>` : ''}
        </div>
      </main>`;
    },
    acciones: {
      confirmar(c, d) { marcarPagado(c, d.id); },
      desconfirmar(c, d) {
        ops.desconfirmarGasto(d.id);
        c.avisar('Vuelve a estar por pagar', '', { l: 'Deshacer', fn: (c2) => { ops.confirmarGasto(d.id); c2.avisar('Marcado como pagado'); } });
      },
      restaurar(c, d) { pedirRestaurar(c, d.id); },
      anular(c, d) { pedirAnular(c, d.id); }
    }
  }
};
