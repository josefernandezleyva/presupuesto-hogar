// Registrar o editar un gasto, en pocos pasos: monto, categoría y Guardar.
// Todo lo demás (fecha, quién pagó, reparto, nota, cuotas) viene propuesto y se cambia con un toque.

import * as L from '../logic.js';
import * as ops from '../ops.js';
import * as st from '../store.js';
import { esc, hoy, mesActual, mesDe, parseMonto, r2, num, fmt, fmt0, pct, nombreMes, sumarMeses, fechaCorta, SIMBOLO } from '../util.js';
import { encabezado, segmentado, alerta, avatar, icono } from '../ui.js';

/* --------------------------------------------------------------- Estado --- */

function iniciarNuevo(c) {
  const e = c.estado;
  Object.assign(e, {
    monto: '', moneda: c.meta.moneda || 'PEN', tc: '', tcManual: false,
    categoria_id: c.query.cat || '', pagado_por: c.meta.personaId,
    fecha: c.mes === mesActual() ? hoy() : `${c.mes}-01`, nota: '', tipo: '',
    rep: 'hogar', modalidad: 'Unico', nroCuotas: 3, mesInicio: '', montoCuota: '', sinFin: '1', durN: '12',
    panel: null
  });
  e.mesInicio = mesDe(e.fecha);
  if (e.moneda === 'USD') e.tc = String(L.tipoCambio(c.S, mesDe(e.fecha)) || '');
  cargarPcts(c, L.participacion(c.S, mesDe(e.fecha)));
}

function iniciarEdicion(c, g) {
  const e = c.estado;
  const S = c.S;
  Object.assign(e, {
    id: g.id, monto: String(g.monto), moneda: g.moneda, tc: g.moneda === 'USD' ? String(g.tipo_cambio || '') : '', tcManual: true,
    categoria_id: g.categoria_id, pagado_por: g.pagado_por, fecha: g.fecha, nota: g.nota || '', tipo: g.tipo || '',
    modalidad: 'Unico', panel: null
  });
  const pcts = L.pctsDeGasto(S, g);
  const hogar = L.participacion(S, g.mes);
  const igual = (a, b) => L.personas(S, { todas: true }).every((p) => num(a[p.id]) === num(b[p.id]));
  e.rep = igual(pcts, hogar) ? 'hogar' : 'medida';
  cargarPcts(c, pcts);
}

function cargarPcts(c, pcts) {
  L.personas(c.S, { todas: true }).forEach((p) => { c.estado['pct_' + p.id] = String(num(pcts[p.id])); });
}

function pctsActuales(c) {
  const out = {};
  L.personas(c.S).forEach((p) => { out[p.id] = num(c.estado['pct_' + p.id]); });
  return out;
}

function pctsElegidos(c) {
  const e = c.estado;
  if (e.rep === 'hogar') return e.id ? L.participacion(c.S, mesDe(e.fecha)) : null;
  return pctsActuales(c);
}

/* ------------------------------------------------------------ Cálculos --- */

function tcVigente(c) {
  const e = c.estado;
  if (e.moneda === 'PEN') return 1;
  const v = parseMonto(e.tc);
  return v > 0 ? v : null;
}

function cuotasCalc(e) {
  const total = parseMonto(e.monto);
  const n = Math.max(2, Math.floor(num(e.nroCuotas)));
  if (!(total > 0)) return { n, montos: [], cuota: 0, total: 0 };
  let montos = L.montosCuotas(total, n);
  const ed = parseMonto(e.montoCuota);
  if (ed > 0 && Math.abs(ed - montos[0]) > 0.004) montos = Array(n).fill(ed);
  return { n, montos, cuota: montos[0], total: r2(montos.reduce((a, b) => a + b, 0)) };
}

/** Monto en soles que pesa en el mes (para alerta y reparto). */
function solesDelMes(c) {
  const e = c.estado;
  const base = e.modalidad === 'Cuotas' ? cuotasCalc(e).cuota : (parseMonto(e.monto) || 0);
  return r2((base || 0) * (tcVigente(c) || 0));
}

/* -------------------------------------------------- Piezas actualizables --- */

function usoHtml(c) {
  const { S, estado: e } = c;
  if (!e.categoria_id) return '';
  const cat = L.categoria(S, e.categoria_id);
  const mes = e.modalidad === 'Cuotas' ? (e.mesInicio || mesDe(e.fecha)) : mesDe(e.fecha);
  if (e.moneda === 'USD' && !tcVigente(c)) return '';
  const soles = solesDelMes(c);
  const u = L.usoCategoria(S, mes, e.categoria_id, { extra: soles, excluirId: e.id || null });
  if (!(u.tope > 0)) return '';
  const antes = r2(u.usado - soles);
  if (u.estado === 'excede') return alerta('bad', `Superas el tope de ${cat.nombre}`, `Llevas ${fmt0(antes)} de ${fmt0(u.tope)}. Con este gasto serían ${fmt(u.usado)}, ${fmt(u.usado - u.tope)} de más. Puedes guardar igual.`);
  if (u.estado === 'aviso' && soles > 0) return alerta('warn', `Cerca del tope de ${cat.nombre}`, `Con este gasto: ${fmt(u.usado)} de ${fmt0(u.tope)} (${pct(u.pct)}).`);
  return `<p class="muted xs">${esc(cat.nombre)}: ${esc(fmt0(u.usado))} de ${esc(fmt0(u.tope))} este mes (${esc(pct(u.pct))}).</p>`;
}

function tcHtml(c) {
  const e = c.estado;
  if (e.moneda !== 'USD') return '';
  const mes = mesDe(e.fecha);
  const delMes = L.tipoCambioDelMes(c.S, mes) || L.tipoCambio(c.S, mes);
  const tc = tcVigente(c);
  const monto = parseMonto(e.monto) || 0;
  return `<div class="tc-row">
    <label for="tc" class="muted sm">Tipo de cambio</label>
    <span class="pct-w">S/ <input id="tc" class="inl tc" data-f="tc" inputmode="decimal" placeholder="3.75" value="${esc(e.tc)}"> por US$</span>
  </div>
  <p class="xs ${tc ? 'muted' : 'bad-t'}" id="conv">${tc ? `US$ ${esc(fmt(monto, { moneda: 'PEN' }).replace('S/ ', ''))} = <strong>${esc(fmt(monto * tc))}</strong>${delMes && Math.abs(delMes - tc) > 0.00001 ? ` · el del mes es ${delMes}` : (delMes ? ' · tipo de cambio del mes' : '')}` : 'Escribe el tipo de cambio para convertir a soles.'}</p>`;
}

function etiquetaReparto(c) {
  const { S, estado: e } = c;
  const ps = L.personas(S);
  const p = e.rep === 'hogar' ? L.participacion(S, mesDe(e.fecha)) : pctsActuales(c);
  const uno = ps.find((x) => num(p[x.id]) === 100);
  if (uno) return 'Todo ' + (uno.alias || uno.nombre.split(' ')[0]);
  return ps.map((x) => num(p[x.id])).join('/');
}

function presetActivo(c) {
  const { S, estado: e } = c;
  if (e.rep === 'hogar') return 'hogar';
  const p = pctsActuales(c);
  const ps = L.personas(S);
  const uno = ps.find((x) => num(p[x.id]) === 100);
  if (uno) return uno.id;
  if (ps.length === 2 && num(p[ps[0].id]) === 50 && num(p[ps[1].id]) === 50) return 'mitad';
  return null;
}

function detalleRepartoHtml(c) {
  const { S } = c;
  const soles = solesDelMes(c);
  const p = pctsActuales(c);
  const filas = L.calcularReparto(soles, p);
  const suma = L.sumaPcts(p);
  return L.personas(S).map((x) => {
    const f = filas.find((r) => r.persona_id === x.id);
    return `<div class="split sm"><span>${avatar(x, 22)} ${esc(x.nombre)}</span><span><strong>${num(p[x.id])} %</strong> · ${esc(fmt(f ? f.monto_soles : 0))}</span></div>`;
  }).join('') + (suma === 100 ? '' : `<p class="bad-t xs">Suma ${suma} %; debe ser 100 %.</p>`);
}

function cuotasHtml(c) {
  const e = c.estado;
  const q = cuotasCalc(e);
  if (!q.montos.length) return '<p class="muted xs">Escribe el monto total arriba.</p>';
  const ini = e.mesInicio || mesDe(e.fecha);
  return `<p class="sm">${q.n} cuotas de <strong>${esc(fmt(q.cuota, { moneda: e.moneda }))}</strong>, de ${esc(nombreMes(ini, { corto: true }))} a ${esc(nombreMes(sumarMeses(ini, q.n - 1), { corto: true }))}${Math.abs(q.total - parseMonto(e.monto)) > 0.004 ? ` · total ${esc(fmt(q.total, { moneda: e.moneda }))}` : ''}</p>`;
}

function refrescar(c) {
  const set = (id, html) => { const el = document.getElementById(id); if (el) el.innerHTML = html; };
  set('uso', usoHtml(c));
  const conv = document.getElementById('conv');
  if (conv) { const tmp = document.createElement('div'); tmp.innerHTML = tcHtml(c); const n = tmp.querySelector('#conv'); if (n) { conv.className = n.className; conv.innerHTML = n.innerHTML; } }
  set('repDet', detalleRepartoHtml(c));
  set('cuotas', cuotasHtml(c));
  const pr = document.getElementById('pillRep'); if (pr) pr.textContent = etiquetaReparto(c);
  const act = presetActivo(c);
  document.querySelectorAll('[data-a="preset"]').forEach((b) => { b.classList.toggle('on', b.dataset.v === act); });
  const g = document.getElementById('btnGuardar'); if (g) g.innerHTML = textoGuardar(c);
}

function textoGuardar(c) {
  const e = c.estado;
  const m = parseMonto(e.monto);
  const monto = m > 0 ? ' · ' + esc(fmt(m, { moneda: e.moneda })) : '';
  if (e.id) return 'Guardar cambios' + monto;
  if (e.modalidad === 'Cuotas') return 'Programar cuotas' + monto;
  return 'Guardar' + monto;
}

function categoriasOrdenadas(S) {
  const desde = hoy(new Date(Date.now() - 90 * 864e5));
  const uso = new Map();
  S.Gastos.forEach((g) => { if (g.fecha >= desde) uso.set(g.categoria_id, (uso.get(g.categoria_id) || 0) + 1); });
  return L.categorias(S).sort((a, b) => (uso.get(b.id) || 0) - (uso.get(a.id) || 0) || num(a.orden) - num(b.orden));
}

/* --------------------------------------------------------------- Vista --- */

export default {
  iniciar(c) {
    if (c.ruta === 'gasto') {
      const g = st.fila('Gastos', c.param);
      if (g && Number(g.eliminado) !== 1) { iniciarEdicion(c, g); return; }
    }
    iniciarNuevo(c);
  },

  vista(c) {
    const { S, estado: e } = c;
    const edit = !!e.id;
    const g = edit ? st.fila('Gastos', e.id) : null;
    if (c.ruta === 'gasto' && !g) return `${encabezado({ titulo: 'Gasto' })}<main class="pad">${alerta('warn', 'No encontré este gasto', 'Puede que se haya eliminado en otro celular.')}</main>`;
    const plan = g?.plan_id ? L.idx(S).plan.get(g.plan_id) : null;
    const mes = mesDe(e.fecha);
    const cerrado = L.mesCerrado(S, mes);
    const anulado = g?.estado === L.ESTADO.ANUL;
    const bloqueado = anulado || (g && L.mesCerrado(S, g.mes));
    const ps = L.personas(S);
    const pagador = L.persona(S, e.pagado_por);

    const todas = categoriasOrdenadas(S);
    let visibles = e.todasCat ? todas : todas.slice(0, 8);
    if (e.categoria_id && !visibles.some((x) => x.id === e.categoria_id)) {
      const sel = L.categoria(S, e.categoria_id);
      if (sel) visibles = [sel, ...visibles.slice(0, 7)];
    }
    const catSel = L.categoria(S, e.categoria_id);
    const tipoEf = e.tipo || catSel?.tipo || 'Variable';
    const modoLabel = e.modalidad === 'Cuotas' ? `${e.nroCuotas} cuotas` : e.modalidad === 'Recurrente' ? 'Cada mes' : 'Pago único';
    const dis = bloqueado ? 'disabled' : '';

    const pill = (k, contenido, extra = '') => `<button type="button" class="pill${e.panel === k ? ' on' : ''}" data-a="panel" data-k="${k}" aria-expanded="${e.panel === k}" ${dis} ${extra}>${contenido}</button>`;

    return `${encabezado({ titulo: edit ? 'Editar gasto' : 'Nuevo gasto' })}
    <main class="pad form has-footer">
      ${cerrado && !bloqueado ? alerta('warn', `${nombreMes(mes)} está cerrado`, edit ? 'No se puede cambiar. El administrador puede reabrirlo en Cierre de mes.' : 'Cambia la fecha a un mes abierto o pide al administrador que lo reabra.') : ''}
      ${bloqueado ? alerta('warn', anulado ? 'Este gasto está anulado' : `${nombreMes(g.mes)} está cerrado`, anulado ? 'No cuenta en los totales.' : 'Solo se puede ver.') : ''}
      ${plan ? `<p class="muted sm">${plan.modalidad === 'Cuotas' ? `Cuota ${g.nro_cuota} de ${plan.nro_cuotas}` : 'Gasto recurrente'} · ${esc(plan.descripcion)} · ${esc(g.estado)}</p>` : ''}

      <section class="amount">
        <span class="monto-s" aria-hidden="true">${SIMBOLO[e.moneda]}</span>
        <label class="sr" for="monto">${e.modalidad === 'Cuotas' ? 'Monto total' : 'Monto'}</label>
        <input id="monto" class="monto-i" data-f="monto" data-keep inputmode="decimal" autocomplete="off" enterkeyhint="done" placeholder="0.00" value="${esc(e.monto)}" ${dis}>
        <div class="cur-seg" role="group" aria-label="Moneda">
          <button type="button" class="${e.moneda === 'PEN' ? 'on' : ''}" data-a="moneda" data-v="PEN" aria-pressed="${e.moneda === 'PEN'}" ${dis}>S/</button>
          <button type="button" class="${e.moneda === 'USD' ? 'on' : ''}" data-a="moneda" data-v="USD" aria-pressed="${e.moneda === 'USD'}" ${dis}>US$</button>
        </div>
      </section>
      <div id="tcbox">${tcHtml(c)}</div>

      <div class="chips cats" role="group" aria-label="Categoría">
        ${visibles.map((x) => `<button type="button" class="chip${x.id === e.categoria_id ? ' on' : ''}" data-a="cat" data-v="${esc(x.id)}" aria-pressed="${x.id === e.categoria_id}" ${dis}>${esc(x.nombre)}</button>`).join('')}
        ${todas.length > 8 ? `<button type="button" class="chip ghost-chip" data-a="toggle" data-k="todasCat">${e.todasCat ? 'Menos' : `Más (${todas.length - 8})`}</button>` : ''}
        ${c.admin && e.todasCat ? '<button type="button" class="chip dashed" data-a="nueva-cat">+ Nueva</button>' : ''}
      </div>
      <div id="uso">${usoHtml(c)}</div>

      <div class="pills" role="group" aria-label="Detalles">
        <label class="pill pill-date${bloqueado ? ' off' : ''}">${icono('calendario', 16)}<span>${esc(fechaCorta(e.fecha))}</span>
          <input type="date" data-f="fecha" data-r value="${esc(e.fecha)}" aria-label="Fecha" ${dis}></label>
        ${ps.length === 2
          ? `<button type="button" class="pill" data-a="pagador" ${dis} aria-label="Pagó ${esc(pagador?.nombre || '')}. Toca para cambiar">${avatar(pagador, 20)}<span>Pagó ${esc(pagador?.alias || pagador?.nombre || '')}</span></button>`
          : pill('pago', `${avatar(pagador, 20)}<span>Pagó ${esc(pagador?.alias || pagador?.nombre || '')}</span>`)}
        ${pill('reparto', `${icono('reparto', 16)}<span id="pillRep">${esc(etiquetaReparto(c))}</span>`)}
        ${pill('nota', `${icono('nota', 16)}<span>${e.nota ? esc(e.nota.length > 18 ? e.nota.slice(0, 17) + '…' : e.nota) : 'Nota'}</span>`)}
        ${!edit ? pill('modo', `${icono('repetir', 16)}<span>${esc(modoLabel)}</span>`) : ''}
      </div>

      ${e.panel === 'pago' ? `<section class="card panel">
        <div class="lbl">¿Quién pagó?</div>
        <div class="chips">${ps.map((p) => `<button type="button" class="chip${p.id === e.pagado_por ? ' on' : ''}" data-a="set" data-k="pagado_por" data-v="${esc(p.id)}">${avatar(p, 24)} ${esc(p.nombre)}</button>`).join('')}</div>
      </section>` : ''}

      ${e.panel === 'reparto' ? `<section class="card panel">
        <div class="lbl">¿Cómo se reparte este gasto?</div>
        <div class="chips">
          <button type="button" class="chip${presetActivo(c) === 'hogar' ? ' on' : ''}" data-a="preset" data-v="hogar">Hogar ${Object.values(L.participacion(S, mes)).join('/')}</button>
          ${ps.map((p) => `<button type="button" class="chip${presetActivo(c) === p.id ? ' on' : ''}" data-a="preset" data-v="${esc(p.id)}">Todo ${esc(p.alias || p.nombre.split(' ')[0])}</button>`).join('')}
          ${ps.length === 2 ? `<button type="button" class="chip${presetActivo(c) === 'mitad' ? ' on' : ''}" data-a="preset" data-v="mitad">50/50</button>` : ''}
        </div>
        ${ps.length === 2
          ? `<label class="sr" for="slider">Porcentaje de ${esc(ps[0].nombre)}</label>
             <input id="slider" type="range" class="slider" min="0" max="100" step="5" data-f="slider" value="${num(e['pct_' + ps[0].id])}">`
          : ps.map((p) => `<label class="frow"><span>${avatar(p, 22)} ${esc(p.nombre)}</span><span class="pct-w"><input class="inl pct" data-f="pct_${esc(p.id)}" inputmode="decimal" value="${esc(e['pct_' + p.id])}"> %</span></label>`).join('')}
        <div id="repDet" class="stack-sm">${detalleRepartoHtml(c)}</div>
      </section>` : ''}

      ${e.panel === 'nota' ? `<section class="card panel">
        <label class="lbl" for="nota">Nota</label>
        <input id="nota" class="input" data-f="nota" maxlength="80" placeholder="Ej.: Supermercado" value="${esc(e.nota)}" enterkeyhint="done">
      </section>` : ''}

      ${e.panel === 'modo' ? `<section class="card panel stack">
        ${segmentado('modalidad', [{ v: 'Unico', l: 'Pago único' }, { v: 'Cuotas', l: 'En cuotas' }, { v: 'Recurrente', l: 'Cada mes' }], e.modalidad, 'Modalidad')}
        ${e.modalidad === 'Cuotas' ? `
          <div class="frow"><span class="muted">Cuotas</span>
            <span class="stepper"><button type="button" class="btn-ic" data-a="cuotas" data-d="-1" aria-label="Menos cuotas">−</button><strong>${e.nroCuotas}</strong><button type="button" class="btn-ic" data-a="cuotas" data-d="1" aria-label="Más cuotas">+</button></span></div>
          <label class="frow"><span class="muted">Primera cuota</span><input type="month" class="inl" data-f="mesInicio" data-r value="${esc(e.mesInicio)}"></label>
          <label class="frow"><span class="muted">Cuota con intereses</span><input class="inl" data-f="montoCuota" inputmode="decimal" placeholder="Opcional" value="${esc(e.montoCuota)}"></label>
          <div id="cuotas">${cuotasHtml(c)}</div>` : ''}
        ${e.modalidad === 'Recurrente' ? `
          ${segmentado('sinFin', [{ v: '1', l: 'Sin fin' }, { v: '0', l: 'Por meses' }], e.sinFin, 'Duración')}
          ${e.sinFin === '0' ? `<label class="frow"><span class="muted">Meses</span><input class="inl" data-f="durN" inputmode="numeric" value="${esc(e.durN)}"></label>` : ''}
          <p class="muted xs">Queda programado cada mes, el día ${Number(e.fecha.slice(8, 10))}. Lo confirmas con un toque.</p>` : ''}
        <div class="frow"><span class="muted">Tipo</span>${segmentado('tipo', [{ v: 'Fijo', l: 'Fijo' }, { v: 'Variable', l: 'Variable' }], tipoEf, 'Tipo de gasto')}</div>
      </section>` : ''}

      ${edit && !bloqueado && !cerrado ? `<div class="links">
        ${g?.estado === L.ESTADO.PROG ? '<button type="button" class="link" data-a="confirmar">Confirmar con este monto</button>' : ''}
        <button type="button" class="link bad-t" data-a="anular">Anular gasto</button>
      </div>` : ''}
    </main>
    ${!bloqueado && !cerrado ? `<div class="footer"><button type="button" id="btnGuardar" class="btn pri" data-a="guardar">${textoGuardar(c)}</button></div>` : ''}`;
  },

  montar(raiz, c) {
    // En un gasto nuevo el teclado numérico se abre de inmediato.
    if (!c.estado.id && !c.estado.montado) {
      c.estado.montado = true;
      const m = raiz.querySelector('#monto');
      if (m) setTimeout(() => m.focus(), 60);
    }
  },

  alEscribir(c, f, el) {
    const e = c.estado;
    if (f === 'slider') {
      const [a, b] = L.personas(c.S);
      e['pct_' + a.id] = String(el.value);
      e['pct_' + b.id] = String(100 - Number(el.value));
      e.rep = 'medida';
    }
    if (f.startsWith('pct_')) e.rep = 'medida';
    if (f === 'tc') e.tcManual = true;
    if (f === 'fecha') {
      if (e.modalidad !== 'Cuotas') e.mesInicio = mesDe(e.fecha);
      if (e.moneda === 'USD' && !e.tcManual) e.tc = String(L.tipoCambio(c.S, mesDe(e.fecha)) || '');
      if (e.rep === 'hogar') cargarPcts(c, L.participacion(c.S, mesDe(e.fecha)));
    }
    refrescar(c);
  },

  alElegir(c, k) {
    if (k === 'tipo') c.estado.tipoManual = true;
  },

  acciones: {
    cat(c, d) {
      const e = c.estado;
      e.categoria_id = d.v;
      if (!e.tipoManual) e.tipo = '';
      c.render();
    },
    moneda(c, d) {
      const e = c.estado;
      e.moneda = d.v || (e.moneda === 'PEN' ? 'USD' : 'PEN');
      if (e.moneda === 'USD' && !e.tc) e.tc = String(L.tipoCambio(c.S, mesDe(e.fecha)) || '');
      c.render();
    },
    pagador(c) {
      const ps = L.personas(c.S);
      const i = ps.findIndex((p) => p.id === c.estado.pagado_por);
      c.estado.pagado_por = ps[(i + 1) % ps.length].id;
      c.render();
    },
    panel(c, d) {
      c.estado.panel = c.estado.panel === d.k ? null : d.k;
      c.render();
      if (c.estado.panel === 'nota') setTimeout(() => document.getElementById('nota')?.focus(), 30);
    },
    preset(c, d) {
      const e = c.estado;
      const ps = L.personas(c.S);
      if (d.v === 'hogar') { e.rep = 'hogar'; cargarPcts(c, L.participacion(c.S, mesDe(e.fecha))); }
      else if (d.v === 'mitad') { e.rep = 'medida'; cargarPcts(c, Object.fromEntries(ps.map((p) => [p.id, 50]))); }
      else { e.rep = 'medida'; cargarPcts(c, Object.fromEntries(ps.map((p) => [p.id, p.id === d.v ? 100 : 0]))); }
      c.render();
    },
    cuotas(c, d) {
      c.estado.nroCuotas = Math.min(72, Math.max(2, num(c.estado.nroCuotas) + Number(d.d)));
      c.estado.montoCuota = '';
      c.render();
    },
    'nueva-cat'(c) {
      c.preguntar({
        titulo: 'Nueva categoría',
        html: `<label class="lbl" for="nc">Nombre</label><input id="nc" name="nombre" class="input" maxlength="40" autocomplete="off">
          <label class="lbl" for="nt">Tipo</label><select id="nt" name="tipo" class="select"><option>Variable</option><option>Fijo</option></select>`,
        botones: [{ l: 'Crear categoría', estilo: 'pri', fn: (c2, v) => {
          const id = ops.guardarCategoria({ nombre: v.nombre, grupo: 'Otros', tipo: v.tipo, naturaleza: 'Deseo' });
          c2.estado.categoria_id = id;
          c2.render();
          c2.avisar('Categoría creada');
        } }]
      });
    },
    guardar(c) {
      const e = c.estado;
      const monto = parseMonto(e.monto);
      if (!(monto > 0)) { document.getElementById('monto')?.focus(); throw new ops.ErrorApp('Escribe el monto.'); }
      if (!e.categoria_id) throw new ops.ErrorApp('Elige una categoría.');
      if (e.moneda === 'USD' && !tcVigente(c)) { document.getElementById('tc')?.focus(); throw new ops.ErrorApp('Escribe el tipo de cambio.'); }
      const pcts = pctsElegidos(c);
      if (pcts && L.sumaPcts(pcts) !== 100) { e.panel = 'reparto'; c.render(); throw new ops.ErrorApp('El reparto debe sumar 100 %.'); }
      const f = {
        monto, moneda: e.moneda, tipoCambio: e.moneda === 'USD' ? tcVigente(c) : 1,
        categoria_id: e.categoria_id, pagado_por: e.pagado_por, fecha: e.fecha, nota: e.nota, tipo: e.tipo || '',
        pcts, repHogar: e.rep === 'hogar', modalidad: e.modalidad,
        nroCuotas: e.nroCuotas, mesInicio: e.mesInicio, montoCuota: parseMonto(e.montoCuota) || 0,
        duracion: e.sinFin === '1' ? 0 : num(e.durN)
      };
      const g = e.id ? st.fila('Gastos', e.id) : null;
      const hacer = (alcance) => {
        const id = ops.guardarGasto(f, { id: e.id || null, alcance });
        st.setMeta({ moneda: e.moneda });
        const n = Math.floor(num(e.nroCuotas));
        const texto = e.id ? 'Cambios guardados' : e.modalidad === 'Cuotas' ? `Se programaron ${n} cuotas` : e.modalidad === 'Recurrente' ? 'Gasto mensual programado' : 'Gasto guardado';
        c.volver('inicio');
        c.avisar(texto, '', e.id ? null : { l: 'Deshacer', fn: (c2) => { ops.deshacer(id); c2.avisar('Registro deshecho'); } });
      };
      if (g?.plan_id && g.estado === L.ESTADO.PROG) {
        c.preguntar({ titulo: '¿A qué gastos aplica el cambio?', texto: 'Este gasto es parte de un plan de cuotas o mensual.', botones: [
          { l: 'Solo a este', estilo: 'sec', fn: () => hacer('este') },
          { l: 'A este y los siguientes', estilo: 'pri', fn: () => hacer('siguientes') }
        ] });
        return;
      }
      hacer('este');
    },
    confirmar(c) {
      ops.confirmarGasto(c.estado.id, parseMonto(c.estado.monto), c.estado.moneda === 'USD' ? tcVigente(c) : null);
      c.volver('gastos');
      c.avisar('Gasto confirmado');
    },
    anular(c) {
      const g = st.fila('Gastos', c.estado.id);
      const fin = (alcance) => { ops.anularGasto(g.id, alcance); c.volver('gastos'); c.avisar('Gasto anulado'); };
      if (g.plan_id) {
        c.preguntar({ titulo: 'Anular gasto', texto: 'Es parte de un plan. ¿Anulas solo este o también los programados que siguen?', botones: [
          { l: 'Solo este', estilo: 'sec', fn: () => fin('este') },
          { l: 'Este y los siguientes', estilo: 'danger', fn: () => fin('siguientes') }
        ] });
      } else {
        c.preguntar({ titulo: 'Anular gasto', texto: 'Deja de contar en los totales, pero queda en la hoja como anulado.', botones: [{ l: 'Anular', estilo: 'danger', fn: () => fin('este') }] });
      }
    }
  }
};
