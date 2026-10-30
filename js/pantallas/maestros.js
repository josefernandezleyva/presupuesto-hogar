// Maestros: personas, participación y categorías. Solo el administrador los cambia.

import * as L from '../logic.js';
import * as ops from '../ops.js';
import * as st from '../store.js';
import { esc, fmt0, nombreMes, num, r2, mesActual } from '../util.js';
import { encabezado, fila, avatar, icono, alerta, segmentado } from '../ui.js';
import { puntoCat, tarjetaPropuesta, usarPropuesta, confirmarDistribucion } from './comun.js';
import { norm } from '../util.js';

const flecha = icono('adelante', 18);

const personas = {
  vista(c) {
    const { S, admin, estado: e } = c;
    const todas = L.personas(S, { todas: true });
    const act = L.personas(S);
    const vig = L.vigencia(S, mesActual());
    const part = vig.pcts;
    const desde = vig.desde;
    const proximas = L.distribuciones(S).filter((d) => d.desde > mesActual());
    const total = Object.values(part).reduce((a, b) => a + b, 0) || 1;
    if (e.editPart && e.mesPart === undefined) {
      e.mesPart = mesActual();
      act.forEach((p) => { e['pp_' + p.id] = String(part[p.id] || 0); });
    }
    const sumaNueva = r2(act.reduce((a, p) => a + num(e['pp_' + p.id]), 0));
    return `${encabezado({ titulo: 'Personas' })}
    <main class="pad">
      ${!admin ? alerta('info', 'Solo el administrador cambia personas y participación') : ''}
      <section class="card stack">
        <div class="split"><h2 class="h2">Participación en el hogar</h2><span class="xs muted">${desde ? 'Desde ' + esc(nombreMes(desde).toLowerCase()) : ''}</span></div>
        <div class="pbar" role="img" aria-label="${act.map((p) => `${esc(p.nombre)} ${part[p.id] || 0} %`).join(', ')}">
          ${act.filter((p) => part[p.id]).map((p) => `<div style="width:${(part[p.id] / total) * 100}%;background:${esc(p.color)}">${part[p.id]} %</div>`).join('')}
        </div>
        ${proximas.length ? `<p class="xs muted">Próximos cambios: ${proximas.map((d) => `desde ${esc(nombreMes(d.desde).toLowerCase())}, ${esc(L.textoReparto(S, d.pcts))}`).join('; ')}.</p>` : ''}
        ${admin && !e.editPart ? '<button class="btn sec" data-a="toggle" data-k="editPart">Cambiar desde un mes</button>' : ''}
        ${e.editPart ? `
          <label class="frow"><span class="muted">Vigente desde</span><input type="month" class="inl" data-f="mesPart" value="${esc(e.mesPart)}"></label>
          ${act.map((p) => `<label class="frow"><span>${avatar(p, 24)} ${esc(p.nombre)}</span><span class="pct-w"><input class="inl pct" data-f="pp_${esc(p.id)}" inputmode="decimal" value="${esc(e['pp_' + p.id])}"> %</span></label>`).join('')}
          <p id="sumaPart" class="sm ${sumaNueva === 100 ? 'ok-t' : 'bad-t'}">Suma ${sumaNueva} %</p>
          ${L.participacionPorIngresos(S, e.mesPart || mesActual())?.pcts ? '<button type="button" class="link" data-a="proponer">Proponer según los sueldos</button>' : ''}
          <p class="xs muted">Rige desde ese mes en adelante y reemplaza los cambios guardados desde meses posteriores. Los gastos ya registrados conservan su reparto.</p>
          <div class="split gap"><button class="btn ghost" data-a="toggle" data-k="editPart">Cancelar</button><button class="btn pri" data-a="guardar-part">Guardar</button></div>` : ''}
      </section>
      ${!e.editPart ? tarjetaPropuesta(c, mesActual()) : ''}
      <section class="card list">
        <div class="split pad-x"><h2 class="h2">Personas</h2>${admin ? '<a class="link" href="#/persona/nueva">+ Agregar persona</a>' : ''}</div>
        ${todas.map((p) => fila({ izq: avatar(p, 36), titulo: esc(p.nombre) + (p.id === c.meta.personaId ? ' (tú)' : ''), sub: `${esc(p.rol)}${L.activo(p) ? '' : ' · inactiva'}`, der: admin ? flecha : '', href: admin ? '#/persona/' + p.id : '' })).join('')}
        <p class="xs muted pad-x">Los nombres se eligen siempre de esta lista; no se escriben dentro de un gasto.</p>
      </section>
    </main>`;
  },
  alEscribir(c, f) {
    if (!f.startsWith('pp_')) return;
    const s = r2(L.personas(c.S).reduce((a, p) => a + num(c.estado['pp_' + p.id]), 0));
    const el = document.getElementById('sumaPart');
    if (el) { el.textContent = `Suma ${s} %`; el.className = 'sm ' + (s === 100 ? 'ok-t' : 'bad-t'); }
  },
  acciones: {
    'usar-propuesta'(c, d) { usarPropuesta(c, d, ops); },
    proponer(c) {
      const prop = L.participacionPorIngresos(c.S, c.estado.mesPart || mesActual());
      if (!prop?.pcts) return;
      Object.entries(prop.pcts).forEach(([id, v]) => { c.estado['pp_' + id] = String(v); });
      c.render();
    },
    'guardar-part'(c) {
      const pcts = {};
      L.personas(c.S).forEach((p) => { pcts[p.id] = num(c.estado['pp_' + p.id]); });
      if (!/^\d{4}-\d{2}$/.test(c.estado.mesPart || '')) throw new ops.ErrorApp('Elige el mes.');
      if (L.sumaPcts(pcts) !== 100) throw new ops.ErrorApp('La participación debe sumar 100 %.');
      confirmarDistribucion(c, ops, c.estado.mesPart, pcts, { alGuardar: (c2) => { Object.keys(c2.estado).forEach((k) => delete c2.estado[k]); c2.render(); } });
    }
  }
};

const persona = {
  iniciar(c) {
    const p = c.param !== 'nueva' ? st.fila('Personas', c.param) : null;
    Object.assign(c.estado, p ? { id: p.id, nombre: p.nombre, alias: p.alias || '', rol: p.rol, color: p.color, activo: L.activo(p) ? '1' : '0' } : { nombre: '', alias: '', rol: 'Miembro', color: ops.COLORES[c.S.Personas.length % ops.COLORES.length], activo: '1' });
  },
  vista(c) {
    const e = c.estado;
    if (!c.admin) return `${encabezado({ titulo: 'Persona' })}<main class="pad">${alerta('info', 'Solo el administrador edita personas')}</main>`;
    return `${encabezado({ titulo: e.id ? 'Editar persona' : 'Nueva persona' })}
    <main class="pad form">
      <section class="card stack">
        <label class="lbl" for="pn">Nombre</label><input id="pn" class="input" data-f="nombre" maxlength="40" value="${esc(e.nombre)}">
        <label class="lbl" for="pa">Nombre corto (opcional)</label><input id="pa" class="input" data-f="alias" maxlength="12" value="${esc(e.alias)}">
        <div class="lbl">Rol</div>${segmentado('rol', [{ v: 'Miembro', l: 'Miembro' }, { v: 'Administrador', l: 'Administrador' }], e.rol, 'Rol')}
        <div class="lbl">Color</div>
        <div class="chips">${ops.COLORES.map((col) => `<button type="button" class="swatch${col === e.color ? ' on' : ''}" style="background:${col}" data-a="set" data-k="color" data-v="${col}" aria-label="Color ${col}" aria-pressed="${col === e.color}"></button>`).join('')}</div>
        ${e.id ? `<div class="lbl">Estado</div>${segmentado('activo', [{ v: '1', l: 'Activa' }, { v: '0', l: 'Inactiva' }], e.activo, 'Estado')}
        <p class="xs muted">Una persona inactiva deja de aparecer en registros nuevos, pero su historial y saldos se mantienen.</p>` : `<p class="xs muted">Al agregarla, revisa la participación del hogar para incluirla.</p>`}
      </section>
      <div class="actions"><button class="btn pri" data-a="guardar">Guardar</button></div>
    </main>`;
  },
  acciones: {
    guardar(c) {
      const e = c.estado;
      ops.guardarPersona({ id: e.id, nombre: e.nombre, alias: e.alias, rol: e.rol, color: e.color, activo: e.activo === '1' });
      c.avisar('Persona guardada');
      c.volver('personas');
    }
  }
};

const categorias = {
  vista(c) {
    const { S, admin, estado: e } = c;
    const grupos = L.categoriasPorGrupo(S, { todas: true });
    const ordenando = admin && e.ordenar;
    const derecha = !admin ? '' : ordenando
      ? '<button class="btn-ic link listo-b" data-a="toggle" data-k="ordenar">Listo</button>'
      : `<a class="btn-ic link" href="#/categoria/nueva" aria-label="Nueva categoría">${icono('mas', 24)}</a>`;
    return `${encabezado({ titulo: 'Categorías', derecha })}
    <main class="pad">
      ${!admin ? alerta('info', 'Solo el administrador crea o cambia categorías') : ''}
      ${ordenando ? '<p class="sm muted">Arrastra cada categoría por el asa ≡ para cambiar su lugar dentro del grupo, o usa las flechas. El orden se usa al registrar, en Inicio y en el reporte.</p>'
        : `<section class="card list">${fila({ izq: icono('grupo', 22), titulo: 'Grupos de categorías', sub: `${L.grupos(S).length} grupos · ordenan la lista al registrar`, der: icono('adelante', 18), href: '#/grupos' })}</section>
        ${admin ? `<button class="btn sec" data-a="toggle" data-k="ordenar">${icono('cambiar', 18)} Ordenar categorías</button>` : ''}`}
      ${grupos.map(({ grupo, cats: xs }) => `<h3 class="dia">${puntoCat({ grupo: grupo.nombre })} ${esc(grupo.nombre)}</h3>
        <section class="card list${ordenando ? ' ordenable' : ''}" data-grupo="${esc(grupo.nombre)}">
        ${xs.map((x, i) => ordenando ? `<div class="row cat-orden" data-id="${esc(x.id)}">
            <button type="button" class="asa" aria-label="Arrastrar ${esc(x.nombre)}" aria-describedby="asa-ayuda">${icono('asa', 22)}</button>
            ${puntoCat(x)}<span class="row-m"><span class="row-t">${esc(x.nombre)}${L.activo(x) ? '' : ' <span class="badge soft">Inactiva</span>'}</span></span>
            <span class="ordenar"><button type="button" class="btn-ic" data-a="mover-cat" data-id="${esc(x.id)}" data-d="-1" aria-label="Subir ${esc(x.nombre)}" ${i === 0 ? 'disabled' : ''}>${icono('subir', 18)}</button><button type="button" class="btn-ic" data-a="mover-cat" data-id="${esc(x.id)}" data-d="1" aria-label="Bajar ${esc(x.nombre)}" ${i === xs.length - 1 ? 'disabled' : ''}>${icono('bajar', 18)}</button></span>
          </div>`
          : fila({ izq: puntoCat(x), titulo: esc(x.nombre) + (L.activo(x) ? '' : ' <span class="badge soft">Inactiva</span>'), sub: `${esc(x.tipo)} · ${esc(x.naturaleza)}${num(x.tope_sugerido) ? ' · tope sugerido ' + esc(fmt0(x.tope_sugerido)) : ''}`, der: admin ? flecha : '', href: admin ? '#/categoria/' + x.id : '' })).join('')}
      </section>`).join('')}
      ${ordenando ? '<p id="asa-ayuda" class="sr">Mantén presionado el asa y arrastra hacia arriba o abajo. Con teclado, flechas arriba y abajo.</p><button class="btn pri" data-a="toggle" data-k="ordenar">Listo</button>' : ''}
    </main>`;
  },
  montar(raiz, c) { if (c.estado.ordenar) arrastrar(raiz, c); },
  acciones: {
    'mover-cat'(c, d) {
      ops.moverCategoria(d.id, Number(d.d));
      c.render();
      // El foco sigue en la flecha de la misma categoría, para seguir moviéndola.
      const b = document.querySelector(`[data-a="mover-cat"][data-id="${CSS.escape(d.id)}"][data-d="${d.d}"]`);
      if (b && !b.disabled) b.focus(); else document.querySelector(`[data-a="mover-cat"][data-id="${CSS.escape(d.id)}"]:not([disabled])`)?.focus();
      c.anunciar(`${L.categoria(c.S, d.id)?.nombre || 'Categoría'} movida`);
    }
  }
};

/**
 * 2.1 · Arrastrar para ordenar (como la edición de listas de iOS): se toma la fila por el asa, se mueve
 * dentro de su grupo y, al soltarla, se guarda el nuevo orden. Funciona con el dedo, el mouse y el teclado.
 */
function arrastrar(raiz, c) {
  raiz.querySelectorAll('.ordenable').forEach((lista) => {
    const grupo = lista.dataset.grupo;
    const guardar = () => {
      const ids = [...lista.querySelectorAll('.cat-orden')].map((f) => f.dataset.id);
      if (ops.ordenarCategorias(grupo, ids)) { c.anunciar('Orden guardado'); c.avisar('Orden guardado'); }
      else c.render();
    };
    lista.querySelectorAll('.cat-orden .asa').forEach((asa) => {
      const fila = asa.closest('.cat-orden');
      asa.addEventListener('pointerdown', (ev) => {
        if (ev.button !== undefined && ev.button !== 0) return;
        ev.preventDefault();
        asa.setPointerCapture?.(ev.pointerId);
        const filas = [...lista.querySelectorAll('.cat-orden')];
        const y0 = ev.clientY;
        const alto = fila.getBoundingClientRect().height;
        let pos = filas.indexOf(fila);
        const inicio = pos;
        fila.classList.add('arrastrando');
        lista.classList.add('en-arrastre');
        const mover = (e2) => {
          const dy = e2.clientY - y0;
          fila.style.transform = `translateY(${dy}px)`;
          const nuevo = Math.max(0, Math.min(filas.length - 1, inicio + Math.round(dy / alto)));
          if (nuevo !== pos) {
            pos = nuevo;
            filas.forEach((f, k) => {
              if (f === fila) return;
              const desplaza = inicio < pos ? (k > inicio && k <= pos ? -alto : 0) : (k < inicio && k >= pos ? alto : 0);
              f.style.transform = desplaza ? `translateY(${desplaza}px)` : '';
            });
          }
        };
        const soltar = () => {
          asa.removeEventListener('pointermove', mover);
          asa.removeEventListener('pointerup', soltar);
          asa.removeEventListener('pointercancel', soltar);
          filas.forEach((f) => { f.style.transform = ''; });
          fila.classList.remove('arrastrando');
          lista.classList.remove('en-arrastre');
          if (pos !== inicio) {
            const ref = filas.filter((f) => f !== fila)[pos] || null;
            lista.insertBefore(fila, ref);
            guardar();
          }
        };
        asa.addEventListener('pointermove', mover);
        asa.addEventListener('pointerup', soltar);
        asa.addEventListener('pointercancel', soltar);
      });
      asa.addEventListener('keydown', (ev) => {
        if (ev.key !== 'ArrowUp' && ev.key !== 'ArrowDown') return;
        ev.preventDefault();
        const id = fila.dataset.id;
        if (ops.moverCategoria(id, ev.key === 'ArrowUp' ? -1 : 1)) {
          c.render();
          document.querySelector(`.cat-orden[data-id="${CSS.escape(id)}"] .asa`)?.focus();
          c.anunciar(`${L.categoria(c.S, id)?.nombre || 'Categoría'} movida`);
        }
      });
    });
  });
}

const categoria = {
  iniciar(c) {
    const x = c.param !== 'nueva' ? st.fila('Categorias', c.param) : null;
    Object.assign(c.estado, x ? { id: x.id, nombre: x.nombre, grupo: x.grupo, tipo: x.tipo, naturaleza: x.naturaleza, tope: num(x.tope_sugerido) ? String(x.tope_sugerido) : '', activo: L.activo(x) ? '1' : '0' } : { nombre: '', grupo: 'Otros', tipo: 'Variable', naturaleza: 'Deseo', tope: '', activo: '1' });
  },
  vista(c) {
    const e = c.estado;
    if (!c.admin) return `${encabezado({ titulo: 'Categoría' })}<main class="pad">${alerta('info', 'Solo el administrador edita categorías')}</main>`;
    const grupos = L.grupos(c.S);
    return `${encabezado({ titulo: e.id ? 'Editar categoría' : 'Nueva categoría' })}
    <main class="pad form">
      <section class="card stack">
        <label class="lbl" for="cn">Nombre</label><input id="cn" class="input" data-f="nombre" maxlength="40" value="${esc(e.nombre)}">
        <div class="lbl">Grupo</div>
        <div class="chips" role="group" aria-label="Grupo">${grupos.map((g) => {
          const on = norm(g.nombre) === norm(e.grupo);
          return `<button type="button" class="chip${on ? ' on' : ''}" data-a="set" data-k="grupo" data-v="${esc(g.nombre)}" aria-pressed="${on}"><span class="dot" style="background:${esc(g.color)}" aria-hidden="true"></span> ${esc(g.nombre)}</button>`;
        }).join('')}<button type="button" class="chip dashed" data-a="nuevo-grupo">+ Nuevo grupo</button></div>
        <p class="xs muted">Los grupos se crean, ordenan y cambian en Categorías › Grupos de categorías.</p>
        <div class="lbl">Tipo</div>${segmentado('tipo', [{ v: 'Fijo', l: 'Fijo' }, { v: 'Variable', l: 'Variable' }], e.tipo, 'Tipo')}
        <div class="lbl">Naturaleza (regla 50/30/20)</div>${segmentado('naturaleza', [{ v: 'Necesidad', l: 'Necesidad' }, { v: 'Deseo', l: 'Deseo' }, { v: 'Ahorro', l: 'Ahorro' }], e.naturaleza, 'Naturaleza')}
        <label class="frow"><span class="muted">Tope mensual sugerido</span><span class="pct-w">S/ <input class="inl num" data-f="tope" inputmode="decimal" placeholder="Sin tope" value="${esc(e.tope)}"></span></label>
        <p class="xs muted">Se usa en los meses que no tienen un tope propio en Presupuesto.</p>
        ${e.id ? `<div class="lbl">Estado</div>${segmentado('activo', [{ v: '1', l: 'Activa' }, { v: '0', l: 'Inactiva' }], e.activo, 'Estado')}` : ''}
      </section>
      <div class="actions"><button class="btn pri" data-a="guardar">Guardar</button></div>
    </main>`;
  },
  acciones: {
    'nuevo-grupo'(c) {
      c.preguntar({
        titulo: 'Nuevo grupo',
        html: '<label class="lbl" for="gn">Nombre del grupo</label><input id="gn" name="nombre" class="input" maxlength="40" autocomplete="off" placeholder="Ej.: Mascotas">',
        botones: [{ l: 'Crear grupo', estilo: 'pri', fn: (c2, v) => {
          ops.guardarGrupo({ nombre: v.nombre });
          c2.estado.grupo = String(v.nombre).trim();
          c2.render();
          c2.avisar('Grupo creado');
        } }]
      });
    },
    guardar(c) {
      const e = c.estado;
      ops.guardarCategoria({ id: e.id, nombre: e.nombre, grupo: e.grupo, tipo: e.tipo, naturaleza: e.naturaleza, tope_sugerido: num(String(e.tope).replace(/,/g, '')), activo: e.activo === '1' });
      c.avisar('Categoría guardada');
      c.volver('categorias');
    }
  }
};

/* -------------------------------------------------------------- Grupos --- */

const grupos = {
  vista(c) {
    const { S, admin, meta } = c;
    const lista = L.grupos(S, { todas: true });
    const n = (g) => S.Categorias.filter((x) => norm(x.grupo || 'Otros') === norm(g.nombre)).length;
    const viejo = !meta.demo && (num(meta.schemaServidor) || 3) < 4;
    return `${encabezado({ titulo: 'Grupos', derecha: admin ? '<a class="btn-ic link" href="#/grupo/nuevo" aria-label="Nuevo grupo">' + icono('mas', 24) + '</a>' : '' })}
    <main class="pad">
      <p class="muted sm">Los grupos ordenan las categorías al registrar un gasto, en Categorías y en el reporte.</p>
      ${!admin ? alerta('info', 'Solo el administrador crea o cambia grupos') : ''}
      ${viejo ? alerta('warn', 'La hoja aún no tiene la pestaña Grupos', 'Los cambios esperan en este celular y suben cuando el dueño de la hoja pegue el Code.gs de la versión 1.4 o posterior.') : ''}
      <section class="card list">
        ${lista.map((g, i) => `<div class="row grupo-row">
          <span class="dot dot-l" style="background:${esc(g.color)}" aria-hidden="true"></span>
          <a class="row-m" href="${admin ? '#/grupo/' + esc(g.id) : '#/categorias'}"><span class="row-t">${esc(g.nombre)}${L.activo(g) ? '' : ' <span class="badge soft">Inactivo</span>'}</span><span class="row-s">${n(g)} ${n(g) === 1 ? 'categoría' : 'categorías'}</span></a>
          ${admin ? `<span class="ordenar"><button type="button" class="btn-ic" data-a="mover" data-id="${esc(g.id)}" data-d="-1" aria-label="Subir ${esc(g.nombre)}" ${i === 0 ? 'disabled' : ''}>${icono('subir', 18)}</button><button type="button" class="btn-ic" data-a="mover" data-id="${esc(g.id)}" data-d="1" aria-label="Bajar ${esc(g.nombre)}" ${i === lista.length - 1 ? 'disabled' : ''}>${icono('bajar', 18)}</button></span>` : ''}
        </div>`).join('')}
      </section>
      ${admin ? '<a class="btn sec wide" href="#/grupo/nuevo">+ Nuevo grupo</a>' : ''}
    </main>`;
  },
  acciones: {
    mover(c, d) { ops.moverGrupo(d.id, Number(d.d)); }
  }
};

const grupo = {
  iniciar(c) {
    const g = c.param !== 'nuevo' ? L.grupos(c.S, { todas: true }).find((x) => x.id === c.param) : null;
    Object.assign(c.estado, g ? { id: g.id, nombre: g.nombre, color: g.color, activo: L.activo(g) ? '1' : '0' } : { nombre: '', color: L.COLORES_GRUPO[L.grupos(c.S, { todas: true }).length % L.COLORES_GRUPO.length], activo: '1' });
  },
  vista(c) {
    const e = c.estado;
    if (!c.admin) return `${encabezado({ titulo: 'Grupo' })}<main class="pad">${alerta('info', 'Solo el administrador edita grupos')}</main>`;
    const original = e.id ? L.grupos(c.S, { todas: true }).find((x) => x.id === e.id) : null;
    const cats = original ? L.categorias(c.S, { todas: true }).filter((x) => norm(x.grupo || 'Otros') === norm(original.nombre)) : [];
    return `${encabezado({ titulo: e.id ? 'Editar grupo' : 'Nuevo grupo' })}
    <main class="pad form">
      <section class="card stack">
        <label class="lbl" for="gn">Nombre</label><input id="gn" class="input" data-f="nombre" maxlength="40" value="${esc(e.nombre)}" placeholder="Ej.: Mascotas">
        <div class="lbl">Color</div>
        <div class="chips">${L.COLORES_GRUPO.map((col) => `<button type="button" class="swatch${col === e.color ? ' on' : ''}" style="background:${col}" data-a="set" data-k="color" data-v="${col}" aria-label="Color ${col}" aria-pressed="${col === e.color}"></button>`).join('')}</div>
        ${e.id ? `<div class="lbl">Estado</div>${segmentado('activo', [{ v: '1', l: 'Activo' }, { v: '0', l: 'Inactivo' }], e.activo, 'Estado')}` : ''}
        ${original && norm(original.nombre) !== norm(e.nombre) && cats.length ? `<p class="xs muted">Al guardar, ${cats.length === 1 ? 'su categoría pasa' : `sus ${cats.length} categorías pasan`} al nombre nuevo.</p>` : ''}
      </section>
      ${cats.length ? `<h3 class="dia">Categorías del grupo</h3><section class="card list">${cats.map((x) => fila({ izq: puntoCat(x), titulo: esc(x.nombre), sub: `${esc(x.tipo)} · ${esc(x.naturaleza)}`, der: icono('adelante', 18), href: '#/categoria/' + x.id })).join('')}</section>` : ''}
      <div class="actions"><button class="btn pri" data-a="guardar">Guardar</button>
        ${e.id && !cats.length ? '<button class="btn ghost bad-t" data-a="eliminar">Eliminar grupo</button>' : ''}</div>
    </main>`;
  },
  acciones: {
    guardar(c) {
      const e = c.estado;
      ops.guardarGrupo({ id: e.id || null, nombre: e.nombre, color: e.color, activo: e.activo === '1' });
      c.avisar('Grupo guardado');
      c.volver('grupos');
    },
    eliminar(c) {
      c.preguntar({ titulo: 'Eliminar grupo', texto: 'No tiene categorías. Se quita de la lista.', botones: [{ l: 'Eliminar', estilo: 'danger', fn: (c2) => { ops.eliminarGrupo(c.estado.id); c2.volver('grupos'); c2.avisar('Grupo eliminado'); } }] });
    }
  }
};

export default { personas, persona, categorias, categoria, grupos, grupo };
