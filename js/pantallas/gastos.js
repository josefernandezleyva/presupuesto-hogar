import * as L from '../logic.js';
import * as ops from '../ops.js';
import { esc, fechaCorta, r2, num, nombreMes, hoy } from '../util.js';
import { tituloGrande, tabbar, avatar, dinero, vacio, icono } from '../ui.js';
import { puntoCat, placaCat, sinMonto, marcarPagado, pedirAnular } from './comun.js';
import { segmentado } from '../ui.js';

/** 3.1 · Filtros activos (tipo, categoría y persona; todos en la hoja «Filtros»). */
const nFiltros = (e) => [e.ft, e.fc, e.fp].filter(Boolean).length;

function filtrar(c) {
  const { S, mes, estado: e } = c;
  let lista = L.gastosMes(S, mes);
  if (e.fe) lista = lista.filter((g) => g.estado === e.fe);
  if (e.fc) lista = lista.filter((g) => g.categoria_id === e.fc);
  if (e.ft) lista = lista.filter((g) => L.tipoGasto(S, g) === e.ft);
  if (e.fp) lista = lista.filter((g) => L.montoPara(S, g, e.fp) > 0);
  return lista.sort((a, b) => (a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : String(b.creado_en).localeCompare(String(a.creado_en))));
}

/** La lista: del mes con sus filtros, o los resultados de la búsqueda en todos los meses. */
function listaHtml(c) {
  const { S, mes, estado: e } = c;
  const cerrado = L.mesCerrado(S, mes);
  const q = String(e.q || '').trim();
  if (q) {
    const res = L.buscarGastos(S, q);
    const porMes = new Map();
    res.forEach((g) => { if (!porMes.has(g.mes)) porMes.set(g.mes, []); porMes.get(g.mes).push(g); });
    const total = r2(res.reduce((a, g) => a + num(g.monto_soles), 0));
    return `<p class="sum-l" role="status">${res.length ? `${res.length} ${res.length === 1 ? 'resultado' : 'resultados'} · <strong class="num">${dinero(total)}</strong>` : 'Sin resultados'} en todos los meses</p>
      ${[...porMes.entries()].map(([m, gs]) => `<h3 class="dia">${esc(nombreMes(m))}</h3>
        <div class="card list">${gs.map((g) => item(c, g, L.mesCerrado(S, g.mes), { fecha: true })).join('')}</div>`).join('')}
      ${res.length ? '' : vacio('Prueba con otra palabra, una categoría o un monto (por ejemplo 85.50).')}`;
  }
  const lista = filtrar(c);
  const total = r2(lista.reduce((a, g) => a + L.montoPara(S, g, e.fp || null), 0));
  const porDia = new Map();
  lista.forEach((g) => { if (!porDia.has(g.fecha)) porDia.set(g.fecha, []); porDia.get(g.fecha).push(g); });
  const anulados = L.gastosMes(S, mes, [L.ESTADO.ANUL]).length;
  return `<p class="sum-l">${lista.length} ${lista.length === 1 ? 'gasto' : 'gastos'} · <strong class="num">${dinero(total)}</strong>${e.fp ? ' (su parte)' : ''}</p>
    ${lista.length ? [...porDia.entries()].map(([fecha, gs]) => `
      <h3 class="dia">${esc(fechaCorta(fecha))}</h3>
      <div class="card list">
        ${gs.map((g) => item(c, g, cerrado)).join('')}
      </div>`).join('') : vacio(nFiltros(e) || e.fe ? 'No hay gastos con estos filtros.' : 'Todavía no hay gastos este mes.', nFiltros(e) || e.fe ? '<button class="btn sec" data-a="limpiar">Quitar filtros</button>' : '<a class="btn pri" href="#/nuevo">Registrar gasto</a>')}
    ${anulados ? `<a class="link sm center ver-anu" href="#/anulados">${anulados} ${anulados === 1 ? 'gasto anulado' : 'gastos anulados'} este mes · Ver y restaurar</a>` : ''}`;
}

export default {
  iniciar(c) {
    c.estado.fp = '';
    c.estado.ft = '';
    c.estado.fc = c.query.cat || '';
    c.estado.fe = c.query.estado || '';
    c.estado.q = '';
  },
  vista(c) {
    const { S, mes, estado: e } = c;
    const cerrado = L.mesCerrado(S, mes);
    const n = nFiltros(e);
    const nProg = L.gastosMes(S, mes, [L.ESTADO.PROG]).length;
    const buscando = !!String(e.q || '').trim();
    const cat = e.fc ? L.categoria(S, e.fc) : null;
    const per = e.fp ? L.persona(S, e.fp) : null;
    const activos = [e.ft && ['ft', e.ft === 'Fijo' ? 'Fijos' : 'Variables'], cat && ['fc', cat.nombre], per && ['fp', `Parte de ${per.alias || String(per.nombre).split(' ')[0]}`]].filter(Boolean);
    return `<main class="pad has-tabs gastos31${buscando ? ' buscando' : ''}">
      ${tituloGrande({ titulo: 'Gastos', mes, cerrado, mesCompacto: true, derecha: `<a class="btn-ic round" href="#/reporte" aria-label="Reporte de gastos">${icono('reporte', 21)}</a>` })}
      <div class="buscar-fila">
        <div class="buscar" role="search">
          ${icono('buscar', 18)}
          <label class="sr" for="q">Buscar gastos</label>
          <input id="q" type="search" class="buscar-i" data-f="q" data-keep placeholder="Buscar gastos" autocomplete="off" enterkeyhint="search" value="${esc(e.q || '')}">
          <button type="button" class="buscar-x" data-a="borrar-q" aria-label="Borrar búsqueda">×</button>
        </div>
        <button type="button" class="btn sec filtro-b${n ? ' on' : ''}" data-a="filtros" aria-label="Filtros${n ? `, ${n} activos` : ''}">${icono('filtro', 18)}<span>Filtros${n ? ` · ${n}` : ''}</span></button>
      </div>
      <div class="seg-estado">${segmentado('fe', [{ v: '', l: 'Todos' }, { v: 'Programado', l: nProg ? `Por pagar · ${nProg}` : 'Por pagar' }, { v: 'Confirmado', l: 'Pagados' }], e.fe, 'Estado')}</div>
      ${activos.length ? `<div class="filtros-fila" role="group" aria-label="Filtros activos">${activos.map(([k, l]) => `<button type="button" class="chip on" data-a="quitar-f" data-k="${k}" aria-label="Quitar filtro ${esc(l)}">${esc(l)} <span aria-hidden="true">×</span></button>`).join('')}</div>` : ''}
      <div id="lista">${listaHtml(c)}</div>
    </main>${tabbar('gastos')}`;
  },
  alEscribir(c, f) {
    if (f !== 'q') return;
    const box = document.getElementById('lista');
    if (!box) return;
    // Al buscar se ocultan el mes y los filtros (la búsqueda es en todos los meses), sin redibujar el campo.
    box.closest('main')?.classList.toggle('buscando', !!String(c.estado.q || '').trim());
    box.innerHTML = listaHtml(c);
    deslizar(box);
  },
  montar(raiz) { deslizar(raiz); },
  acciones: {
    filtros(c) {
      const { S, estado: e } = c;
      const cats = L.categorias(S, { todas: true });
      const op = (v, l, sel) => `<option value="${esc(v)}"${String(v) === String(sel || '') ? ' selected' : ''}>${esc(l)}</option>`;
      c.preguntar({
        titulo: 'Filtros',
        html: `${L.personas(S).length > 1 ? `<label class="lbl" for="f-p">Persona <span class="muted">(se ve solo su parte de cada gasto)</span></label><select id="f-p" name="fp" class="select">${op('', 'Todos', e.fp)}${L.personas(S).map((p) => op(p.id, p.nombre, e.fp)).join('')}</select>` : ''}
          <label class="lbl" for="f-t">Tipo</label><select id="f-t" name="ft" class="select">${op('', 'Todos', e.ft)}${op('Fijo', 'Fijos', e.ft)}${op('Variable', 'Variables', e.ft)}</select>
          <label class="lbl" for="f-c">Categoría</label><select id="f-c" name="fc" class="select">${op('', 'Todas', e.fc)}${L.categoriasPorGrupo(S, { todas: true }).map(({ grupo, cats: cs }) => `<optgroup label="${esc(grupo.nombre)}">${cs.map((x) => op(x.id, x.nombre, e.fc)).join('')}</optgroup>`).join('') || cats.map((x) => op(x.id, x.nombre, e.fc)).join('')}</select>`,
        botones: [
          { l: 'Aplicar', estilo: 'pri', fn: (c2, v) => { Object.assign(c2.estado, { ft: v.ft, fc: v.fc, fp: v.fp || '' }); c2.render(); } },
          { l: 'Quitar filtros', estilo: 'sec', fn: (c2) => { Object.assign(c2.estado, { ft: '', fc: '', fp: '' }); c2.render(); } }
        ]
      });
    },
    'quitar-f'(c, d) { c.estado[d.k] = ''; c.render(); },
    limpiar(c) { Object.assign(c.estado, { ft: '', fc: '', fe: '', fp: '' }); c.render(); },
    'borrar-q'(c) { c.estado.q = ''; c.render(); },
    // 2.2: «Pagado» marca un gasto por pagar como pagado; el aviso trae «Deshacer» por si fue un toque errado.
    confirmar(c, d) { marcarPagado(c, d.id); },
    // Deslizar a la izquierda y «Anular» (o el botón que VoiceOver ofrece en cada gasto). 3.2: siempre pide confirmación.
    'anular-lista'(c, d) { pedirAnular(c, d.id); }
  }
};

const corto = (p) => p?.alias || String(p?.nombre || '').split(' ')[0] || '';

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

/** 2.4 · Tu parte de un gasto compartido («tú S/ 120.00»); nada si es todo tuyo. */
function tuParte(c, g) {
  const yo = c.meta.personaId;
  if (!yo || L.personas(c.S).length < 2 || g.estado === L.ESTADO.ANUL) return '';
  const total = num(g.monto_soles);
  const parte = L.montoPara(c.S, g, yo);
  if (!(total > 0) || Math.abs(parte - total) < 0.005) return '';
  return parte > 0 ? `<span class="row-s tu-parte">tú ${dinero(parte)}</span>` : '<span class="row-s tu-parte cero">no te toca</span>';
}

function item(c, g, cerrado, { fecha = false } = {}) {
  const { S } = c;
  const cat = L.categoria(S, g.categoria_id);
  const plan = g.plan_id ? L.idx(S).plan.get(g.plan_id) : null;
  const sub = [
    plan ? (plan.modalidad === 'Cuotas' ? `Cuota ${g.nro_cuota} de ${plan.nro_cuotas}` : 'Recurrente') : '',
    fecha ? esc(fechaCorta(g.fecha)) : L.tipoGasto(S, g),
    esc(corto(L.persona(S, g.pagado_por)))
  ].filter(Boolean).join(' · ');
  const vencido = g.fecha < hoy();
  // 3.2: la etiqueta de estado va siempre al inicio de la línea de detalle (antes saltaba de línea según el largo del título).
  const etiqueta = g.estado === L.ESTADO.PROG ? `<span class="badge ${vencido ? 'bad' : 'warn'}">${vencido ? 'Vencido' : 'Por pagar'}</span>` : '';
  const prog = g.estado === L.ESTADO.PROG;
  const titulo = g.nota || cat?.nombre || 'Gasto';
  const fila = `<div class="gitem${cerrado ? '' : ' sw-cont'}">
    <a class="gitem-m" href="#/ver/${esc(g.id)}">
      <span class="placa-av">${placaCat(cat, 38)}${avatar(L.persona(S, g.pagado_por), 18)}</span>
      <span class="row-m"><span class="row-t">${esc(g.nota || cat?.nombre || 'Gasto')}${g.evidencia_id ? ` <span class="clip" aria-label="Tiene foto">${icono('foto', 14)}</span>` : ''}</span>
      ${etiqueta ? `<span class="row-est">${etiqueta}</span>` : ''}
      <span class="row-s">${g.nota ? esc(cat?.nombre || '') + ' · ' : ''}${sub}</span></span>
      <span class="amt num">${sinMonto(g) ? '<span class="por-def">Por definir</span>' : `${dinero(num(g.monto), { moneda: g.moneda })}${g.moneda !== 'PEN' ? `<span class="row-s">${dinero(g.monto_soles)}</span>` : ''}${tuParte(c, g)}`}</span>
    </a>
    ${prog && !cerrado && !fecha ? `<button class="pagar-c" data-a="confirmar" data-id="${esc(g.id)}" aria-label="Marcar ${esc(titulo)} como pagado" title="Marcar como pagado">${icono('check', 20)}</button>` : ''}
  </div>`;
  if (cerrado) return fila;
  return `<div class="swipe">
    <div class="sw-acc"><button type="button" class="sw-anular" data-a="anular-lista" data-id="${esc(g.id)}" aria-label="Anular ${esc(titulo)}">${icono('basura', 20)}<span>Anular</span></button></div>
    ${fila}
  </div>`;
}
