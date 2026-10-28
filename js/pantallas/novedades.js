// 2.0 · Novedades (lo que registró la otra persona) y Avisos (activar las notificaciones push).

import * as L from '../logic.js';
import * as st from '../store.js';
import { esc, fechaCorta } from '../util.js';
import { encabezado, alerta, icono, vacio } from '../ui.js';
import { itemNovedad } from './inicio.js';
import * as avisos from '../avisos.js';
import { mensajeError } from '../api.js';

const novedades = {
  iniciar(c) {
    // Lo que se ve aquí deja de contarse como nuevo al salir (así se distingue al entrar).
    c.estado.visto = c.meta.novedadesVistas || '';
    st.setMeta({ novedadesVistas: new Date().toISOString() });
    avisos.limpiarGlobo();
  },
  vista(c) {
    const { S, yo, meta } = c;
    const lista = L.novedades(S, yo?.id, { visto: c.estado.visto, max: 60 });
    const porDia = new Map();
    lista.forEach((n) => { const d = String(n.cuando).slice(0, 10); if (!porDia.has(d)) porDia.set(d, []); porDia.get(d).push(n); });
    const activos = !!meta.avisos;
    return `${encabezado({ titulo: 'Novedades', derecha: `<a class="btn-ic" href="#/avisos" aria-label="Avisos">${icono('campana', 22)}</a>` })}
    <main class="pad">
      <p class="muted sm">Los gastos que registró ${L.personas(S).filter((p) => p.id !== yo?.id).map((p) => esc(p.alias || p.nombre)).join(' y ') || 'la otra persona'}, con lo que te toca de cada uno.</p>
      ${!activos && !meta.demo ? `<a class="card row-card" href="#/avisos">${icono('campana', 22)}<span class="row-m"><span class="row-t">Recibe un aviso con cada gasto nuevo</span><span class="row-s">Activa las notificaciones en este iPhone</span></span>${icono('adelante', 20)}</a>` : ''}
      ${lista.length ? [...porDia.entries()].map(([dia, ns]) => `<h3 class="dia">${esc(fechaCorta(dia))}</h3>
        <section class="card list">${ns.map((n) => itemNovedad(S, n)).join('')}</section>`).join('')
        : vacio('Todavía no hay gastos registrados por la otra persona.')}
    </main>`;
  }
};

const ESTADOS = {
  activo: ['ok', 'Avisos activados en este iPhone', 'Te llega un aviso cada vez que la otra persona registra un gasto.'],
  apagado: ['info', 'Avisos desactivados', 'Actívalos para enterarte al momento de cada gasto nuevo.']
};

const pantallaAvisos = {
  iniciar(c) {
    c.estado.cargando = true;
    avisos.suscripcion().then((sub) => {
      c.estado.cargando = false;
      c.estado.sub = !!sub;
      if (c.meta.avisos && !sub) st.setMeta({ avisos: false });
      c.render();
    });
  },
  vista(c) {
    const { meta, estado: e, S } = c;
    const sop = avisos.soporte();
    const activo = !!meta.avisos && e.sub !== false;
    const otros = L.personas(S).filter((p) => p.id !== meta.personaId).map((p) => esc(p.alias || p.nombre)).join(' y ');
    const est = sop.ok ? ESTADOS[activo ? 'activo' : 'apagado'] : ['warn', 'Los avisos no están disponibles aquí', avisos.MOTIVOS[sop.motivo] || ''];
    const r = st.estadoSync.avisos;
    return `${encabezado({ titulo: 'Avisos' })}
    <main class="pad">
      ${alerta(est[0], est[1], est[2])}
      <section class="card stack">
        <h2 class="h2">Qué avisa</h2>
        <p class="sm">Cuando ${otros || 'la otra persona'} registra un gasto, te llega un aviso como este:</p>
        <div class="noti-muestra" aria-hidden="true">
          <span class="noti-ic"><img src="./icons/icon-192.png" alt="" width="38" height="38"></span>
          <span class="noti-m"><span class="noti-h"><b>Presupuesto</b><span>ahora</span></span>
            <b class="noti-t">${esc(otros.split(' y ')[0] || 'Jorge')} registró un gasto</b>
            <span>Supermercado · S/ 85.00</span><span>Comida · Te toca S/ 34.00 (40 %)</span></span>
        </div>
        <p class="xs muted">Avisa los gastos nuevos (también los mensuales y las cuotas, una sola vez). Los tuyos no te avisan. Al tocar el aviso se abre el gasto.</p>
      </section>
      ${sop.ok ? `<div class="actions">
        ${activo ? `<button class="btn sec" data-a="probar" ${e.ocupado ? 'disabled' : ''}>Enviarme un aviso de prueba</button>
          <button class="btn ghost bad-t" data-a="desactivar" ${e.ocupado ? 'disabled' : ''}>Desactivar en este iPhone</button>`
          : `<button class="btn pri" data-a="activar" ${e.ocupado || e.cargando ? 'disabled' : ''}>${e.ocupado ? 'Activando…' : 'Activar avisos'}</button>`}
      </div>` : ''}
      ${e.error ? alerta('bad', 'No se pudieron activar', e.error) : ''}
      ${r?.error === 'permiso_avisos' ? alerta('warn', 'Falta un permiso en la hoja', 'El dueño de la hoja debe abrir el menú Presupuesto › Inicializar y aceptar «Conectarse a un servicio externo».') : ''}
      <section class="card stack">
        <h2 class="h2">Si no llegan</h2>
        <ul class="lista-sm sm">
          <li>Abre la app desde su ícono de inicio, no desde Safari.</li>
          <li>En Ajustes del iPhone › Notificaciones › Presupuesto, deja activado «Permitir notificaciones».</li>
          <li>Con «No molestar» o un Modo de concentración activo, el aviso llega en silencio.</li>
          <li>Cada persona activa los avisos en su propio iPhone.</li>
        </ul>
      </section>
    </main>`;
  },
  acciones: {
    async activar(c) {
      c.estado.ocupado = true; c.estado.error = ''; c.render();
      try {
        await avisos.activar();
        c.estado.sub = true;
        c.avisar('Avisos activados. Te llegó uno de prueba.');
      } catch (err) {
        const m = String(err.message || err);
        c.estado.error = avisos.MOTIVOS[m] || mensajeError(m);
      } finally { c.estado.ocupado = false; c.render(); }
    },
    async desactivar(c) {
      c.estado.ocupado = true; c.render();
      try { await avisos.desactivar(); c.estado.sub = false; c.avisar('Avisos desactivados en este iPhone'); }
      finally { c.estado.ocupado = false; c.render(); }
    },
    async probar(c) {
      const { llamar } = await import('../api.js');
      const r = await llamar(c.meta, { action: 'pushProbar', persona_id: c.meta.personaId }).catch((err) => ({ ok: false, error: err.message }));
      if (r?.avisos?.enviados) c.avisar('Aviso de prueba enviado');
      else c.avisar(r?.avisos?.error === 'permiso_avisos' ? 'Falta el permiso en la hoja (Presupuesto › Inicializar)' : 'No se pudo enviar. Desactiva y vuelve a activar los avisos.', 'bad');
    }
  }
};

export default { novedades, avisos: pantallaAvisos };
