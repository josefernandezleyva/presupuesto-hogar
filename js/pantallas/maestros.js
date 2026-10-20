// Maestros: personas, participación y categorías. Solo el administrador los cambia.

import * as L from '../logic.js';
import * as ops from '../ops.js';
import * as st from '../store.js';
import { esc, fmt0, nombreMes, num, r2, mesActual } from '../util.js';
import { encabezado, fila, avatar, icono, alerta, segmentado } from '../ui.js';
import { puntoCat } from './comun.js';

const flecha = icono('adelante', 18);

const personas = {
  vista(c) {
    const { S, admin, estado: e } = c;
    const todas = L.personas(S, { todas: true });
    const act = L.personas(S);
    const part = L.participacion(S, mesActual());
    const desde = S.Participacion.filter((p) => p.vigente_desde <= mesActual()).reduce((m, p) => (p.vigente_desde > m ? p.vigente_desde : m), '');
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
        ${admin && !e.editPart ? '<button class="btn sec" data-a="toggle" data-k="editPart">Cambiar desde un mes</button>' : ''}
        ${e.editPart ? `
          <label class="frow"><span class="muted">Vigente desde</span><input type="month" class="inl" data-f="mesPart" value="${esc(e.mesPart)}"></label>
          ${act.map((p) => `<label class="frow"><span>${avatar(p, 24)} ${esc(p.nombre)}</span><span class="pct-w"><input class="inl pct" data-f="pp_${esc(p.id)}" inputmode="decimal" value="${esc(e['pp_' + p.id])}"> %</span></label>`).join('')}
          <p id="sumaPart" class="sm ${sumaNueva === 100 ? 'ok-t' : 'bad-t'}">Suma ${sumaNueva} %</p>
          <p class="xs muted">Los gastos ya registrados conservan su reparto. Los nuevos desde ese mes usan estos porcentajes.</p>
          <div class="split gap"><button class="btn ghost" data-a="toggle" data-k="editPart">Cancelar</button><button class="btn pri" data-a="guardar-part">Guardar</button></div>` : ''}
      </section>
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
    'guardar-part'(c) {
      const pcts = {};
      L.personas(c.S).forEach((p) => { pcts[p.id] = num(c.estado['pp_' + p.id]); });
      if (!/^\d{4}-\d{2}$/.test(c.estado.mesPart || '')) throw new ops.ErrorApp('Elige el mes.');
      ops.guardarParticipacion(c.estado.mesPart, pcts);
      Object.keys(c.estado).forEach((k) => delete c.estado[k]);
      c.avisar('Participación guardada');
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
    const { S, admin } = c;
    const grupos = new Map();
    L.categorias(S, { todas: true }).forEach((x) => { const g = x.grupo || 'Otros'; if (!grupos.has(g)) grupos.set(g, []); grupos.get(g).push(x); });
    return `${encabezado({ titulo: 'Categorías', derecha: admin ? '<a class="btn-ic link" href="#/categoria/nueva" aria-label="Nueva categoría">' + icono('mas', 24) + '</a>' : '' })}
    <main class="pad">
      ${!admin ? alerta('info', 'Solo el administrador crea o cambia categorías') : ''}
      ${[...grupos.entries()].map(([g, xs]) => `<h3 class="dia">${esc(g)}</h3><section class="card list">
        ${xs.map((x) => fila({ izq: puntoCat(x), titulo: esc(x.nombre) + (L.activo(x) ? '' : ' <span class="badge soft">Inactiva</span>'), sub: `${esc(x.tipo)} · ${esc(x.naturaleza)}${num(x.tope_sugerido) ? ' · tope sugerido ' + esc(fmt0(x.tope_sugerido)) : ''}`, der: admin ? flecha : '', href: admin ? '#/categoria/' + x.id : '' })).join('')}
      </section>`).join('')}
    </main>`;
  }
};

const categoria = {
  iniciar(c) {
    const x = c.param !== 'nueva' ? st.fila('Categorias', c.param) : null;
    Object.assign(c.estado, x ? { id: x.id, nombre: x.nombre, grupo: x.grupo, tipo: x.tipo, naturaleza: x.naturaleza, tope: num(x.tope_sugerido) ? String(x.tope_sugerido) : '', activo: L.activo(x) ? '1' : '0' } : { nombre: '', grupo: 'Otros', tipo: 'Variable', naturaleza: 'Deseo', tope: '', activo: '1' });
  },
  vista(c) {
    const e = c.estado;
    if (!c.admin) return `${encabezado({ titulo: 'Categoría' })}<main class="pad">${alerta('info', 'Solo el administrador edita categorías')}</main>`;
    const grupos = [...new Set(L.categorias(c.S, { todas: true }).map((x) => x.grupo).filter(Boolean))];
    return `${encabezado({ titulo: e.id ? 'Editar categoría' : 'Nueva categoría' })}
    <main class="pad form">
      <section class="card stack">
        <label class="lbl" for="cn">Nombre</label><input id="cn" class="input" data-f="nombre" maxlength="40" value="${esc(e.nombre)}">
        <label class="lbl" for="cg">Grupo</label><input id="cg" class="input" data-f="grupo" list="grupos" maxlength="40" value="${esc(e.grupo)}">
        <datalist id="grupos">${grupos.map((g) => `<option value="${esc(g)}">`).join('')}</datalist>
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
    guardar(c) {
      const e = c.estado;
      ops.guardarCategoria({ id: e.id, nombre: e.nombre, grupo: e.grupo, tipo: e.tipo, naturaleza: e.naturaleza, tope_sugerido: num(String(e.tope).replace(/,/g, '')), activo: e.activo === '1' });
      c.avisar('Categoría guardada');
      c.volver('categorias');
    }
  }
};

export default { personas, persona, categorias, categoria };
