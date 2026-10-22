import * as L from '../logic.js';
import * as ops from '../ops.js';
import { esc, fechaCorta, r2, num } from '../util.js';
import { barraMes, tabbar, avatar, chips, segmentado, dinero, vacio, icono } from '../ui.js';
import { puntoCat } from './comun.js';

export default {
  iniciar(c) {
    c.estado.fp = '';
    c.estado.ft = '';
    c.estado.fc = c.query.cat || '';
    c.estado.fe = c.query.estado || '';
  },
  vista(c) {
    const { S, mes, estado: e } = c;
    const cerrado = L.mesCerrado(S, mes);
    let lista = L.gastosMes(S, mes);
    if (e.fe) lista = lista.filter((g) => g.estado === e.fe);
    if (e.fc) lista = lista.filter((g) => g.categoria_id === e.fc);
    if (e.ft) lista = lista.filter((g) => L.tipoGasto(S, g) === e.ft);
    if (e.fp) lista = lista.filter((g) => L.montoPara(S, g, e.fp) > 0);
    lista.sort((a, b) => (a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : String(b.creado_en).localeCompare(String(a.creado_en))));
    const total = r2(lista.reduce((a, g) => a + L.montoPara(S, g, e.fp || null), 0));
    const porDia = new Map();
    lista.forEach((g) => { if (!porDia.has(g.fecha)) porDia.set(g.fecha, []); porDia.get(g.fecha).push(g); });
    const anulados = L.gastosMes(S, mes, [L.ESTADO.ANUL]).length;

    const personas = [{ v: '', l: 'Todos' }, ...L.personas(S).map((p) => ({ v: p.id, l: p.alias || p.nombre }))];
    const cats = L.categorias(S, { todas: true });

    return `<main class="pad has-tabs">
      ${barraMes(mes, { cerrado, derecha: `<a class="btn-ic round" href="#/reporte" aria-label="Reporte de gastos">${icono('reporte', 22)}</a>` })}
      <div class="filtros">
        ${chips('fp', personas, e.fp, { clase: 'scroll', label: 'Persona' })}
        <div class="split gap">
          ${segmentado('ft', [{ v: '', l: 'Todos' }, { v: 'Fijo', l: 'Fijos' }, { v: 'Variable', l: 'Variables' }], e.ft, 'Tipo')}
        </div>
        <div class="split gap">
          <label class="sr" for="fc">Categoría</label>
          <select id="fc" class="select" data-f="fc" data-r>
            <option value="">Categoría</option>
            ${cats.map((x) => `<option value="${esc(x.id)}"${x.id === e.fc ? ' selected' : ''}>${esc(x.nombre)}</option>`).join('')}
          </select>
          <select class="select" data-f="fe" data-r aria-label="Estado">
            <option value="">Estado</option>
            <option value="Confirmado"${e.fe === 'Confirmado' ? ' selected' : ''}>Confirmados</option>
            <option value="Programado"${e.fe === 'Programado' ? ' selected' : ''}>Programados</option>
          </select>
        </div>
      </div>
      <p class="sum-l">${lista.length} ${lista.length === 1 ? 'gasto' : 'gastos'} · <strong>${dinero(total)}</strong>${e.fp ? ' (su parte)' : ''}</p>

      ${lista.length ? [...porDia.entries()].map(([fecha, gs]) => `
        <h3 class="dia">${esc(fechaCorta(fecha))}</h3>
        <div class="card list">
          ${gs.map((g) => item(c, g, cerrado)).join('')}
        </div>`).join('') : vacio('No hay gastos con estos filtros.', `<a class="btn pri" href="#/nuevo">Registrar gasto</a>`)}
      ${anulados ? `<p class="muted xs center">${anulados} ${anulados === 1 ? 'gasto anulado no se muestra' : 'gastos anulados no se muestran'}.</p>` : ''}
    </main>${tabbar('gastos')}`;
  },
  montar(raiz) { deslizar(raiz); },
  acciones: {
    confirmar(c, d) {
      ops.confirmarGasto(d.id);
      c.avisar('Gasto confirmado');
    },
    // Deslizar a la izquierda y «Anular» (o el botón que VoiceOver ofrece en cada gasto). Se puede deshacer.
    'anular-lista'(c, d) {
      const g = c.S.Gastos.find((x) => x.id === d.id);
      if (!g) return;
      const antes = g.estado;
      ops.anularGasto(g.id, 'este');
      c.avisar(`«${g.nota || L.categoria(c.S, g.categoria_id)?.nombre || 'Gasto'}» anulado`, '', { l: 'Deshacer', fn: (c2) => { ops.restaurarGasto(g.id, antes); c2.avisar('Gasto recuperado'); } });
    }
  }
};

const ANCHO = 92; // ancho del botón «Anular» que aparece al deslizar

/** Gesto de iOS: deslizar un gasto a la izquierda muestra «Anular»; un deslizamiento largo anula de una vez. */
function deslizar(raiz) {
  let act = null;
  const cerrarOtros = (menos) => raiz.querySelectorAll('.swipe.abierto').forEach((x) => { if (x !== menos) { x.classList.remove('abierto', 'mov'); x.querySelector('.sw-cont').style.transform = ''; } });
  raiz.querySelectorAll('.swipe').forEach((it) => {
    const cont = it.querySelector('.sw-cont');
    it.addEventListener('touchstart', (ev) => {
      const t = ev.touches[0];
      act = { it, x: t.clientX, y: t.clientY, dx: 0, base: it.classList.contains('abierto') ? -ANCHO : 0, eje: null };
      cerrarOtros(it);
    }, { passive: true });
    it.addEventListener('touchmove', (ev) => {
      if (!act || act.it !== it) return;
      const t = ev.touches[0];
      const dx = t.clientX - act.x; const dy = t.clientY - act.y;
      if (!act.eje && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) act.eje = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
      if (act.eje !== 'x') return;
      act.dx = dx;
      it.classList.add('mov');
      const x = Math.min(0, act.base + dx);
      cont.style.transition = 'none';
      cont.style.transform = `translateX(${x}px)`;
      it.classList.toggle('largo', x < -it.offsetWidth * 0.55);
    }, { passive: true });
    it.addEventListener('touchend', () => {
      if (!act || act.it !== it) return;
      const x = act.base + act.dx;
      cont.style.transition = '';
      if (act.eje === 'x' && x < -it.offsetWidth * 0.55) it.querySelector('.sw-anular')?.click();
      else if (act.eje === 'x' && x < -ANCHO / 2) { it.classList.add('abierto'); cont.style.transform = `translateX(${-ANCHO}px)`; }
      else { it.classList.remove('abierto'); cont.style.transform = ''; }
      it.classList.remove('largo', 'mov');
      // Tras deslizar no se abre el gasto.
      if (act.eje === 'x') { it.dataset.desliz = '1'; setTimeout(() => { delete it.dataset.desliz; }, 350); }
      act = null;
    });
    it.addEventListener('click', (ev) => { if (it.dataset.desliz && ev.target.closest('.gitem-m')) { ev.preventDefault(); ev.stopPropagation(); } }, true);
  });
}

function item(c, g, cerrado) {
  const { S } = c;
  const cat = L.categoria(S, g.categoria_id);
  const plan = g.plan_id ? L.idx(S).plan.get(g.plan_id) : null;
  const sub = [
    plan ? (plan.modalidad === 'Cuotas' ? `Cuota ${g.nro_cuota} de ${plan.nro_cuotas}` : 'Recurrente') : '',
    L.tipoGasto(S, g),
    esc(L.persona(S, g.pagado_por)?.nombre || '')
  ].filter(Boolean).join(' · ');
  const prog = g.estado === L.ESTADO.PROG;
  const titulo = g.nota || cat?.nombre || 'Gasto';
  const fila = `<div class="gitem${cerrado ? '' : ' sw-cont'}">
    <a class="gitem-m" href="#/gasto/${esc(g.id)}">
      ${avatar(L.persona(S, g.pagado_por), 32)}
      <span class="row-m"><span class="row-t">${puntoCat(cat)} ${esc(g.nota || cat?.nombre || 'Gasto')}${g.evidencia_id ? ` <span class="clip" aria-label="Tiene foto">${icono('foto', 14)}</span>` : ''}${prog ? ' <span class="badge soft">Programado</span>' : ''}</span>
      <span class="row-s">${g.nota ? esc(cat?.nombre || '') + ' · ' : ''}${sub}</span></span>
      <span class="amt">${dinero(num(g.monto), { moneda: g.moneda })}${g.moneda !== 'PEN' ? `<span class="row-s">${dinero(g.monto_soles)}</span>` : ''}</span>
    </a>
    ${prog && !cerrado ? `<button class="btn mini" data-a="confirmar" data-id="${esc(g.id)}">Confirmar</button>` : ''}
  </div>`;
  if (cerrado) return fila;
  return `<div class="swipe">
    <div class="sw-acc"><button type="button" class="sw-anular" data-a="anular-lista" data-id="${esc(g.id)}" aria-label="Anular ${esc(titulo)}">${icono('basura', 20)}<span>Anular</span></button></div>
    ${fila}
  </div>`;
}
