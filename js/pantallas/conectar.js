// Primer uso: conectar la hoja, configurar el hogar y elegir quién usa el celular.

import * as L from '../logic.js';
import * as ops from '../ops.js';
import * as st from '../store.js';
import { llamar, mensajeError } from '../api.js';
import { esc, num, r2 } from '../util.js';
import { avatar, alerta, icono, fila } from '../ui.js';
import { crearEjemplo } from '../ejemplo.js';

const esIOS = () => /iPhone|iPad|iPod/.test(navigator.userAgent);
const instalada = () => window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true;

function leerEnlace(texto, codigo) {
  let url = String(texto || '').trim();
  let token = String(codigo || '').trim();
  const u = url.match(/[?&]u=([^&\s]+)/);
  if (u) {
    const cc = url.match(/[?&]c=([^&\s]+)/);
    if (cc && !token) token = decodeURIComponent(cc[1]);
    url = decodeURIComponent(u[1]);
  }
  return { url, token };
}

const conectar = {
  iniciar(c) {
    c.estado.enlace = c.query.u ? `${location.href.split('#')[0]}#/conectar?u=${encodeURIComponent(c.query.u)}&c=${encodeURIComponent(c.query.c || '')}` : '';
    c.estado.codigo = '';
  },
  vista(c) {
    const e = c.estado;
    const { token } = leerEnlace(e.enlace, e.codigo);
    return `<main class="pad onb">
      <div class="logo">${icono('inicio', 34)}</div>
      <h1 class="onb-t">Presupuesto del hogar</h1>
      <p class="onb-x">Registren los gastos de la casa desde cada celular. Todo se guarda en una hoja de Google Sheets del hogar.</p>
      ${esIOS() && !instalada() ? alerta('info', 'Primero instala la app', 'En Safari toca Compartir y luego «Agregar a inicio». Abre la app desde el ícono y conéctala allí: Safari y la app instalada no comparten datos.') : ''}
      ${window.PP_SOLO_DEMO ? `<section class="card stack"><p class="sm">Esta es una vista de prueba. Desde aquí no se puede conectar una hoja de Google: para usar la app con tus datos, instálala desde GitHub Pages siguiendo la guía.</p><button class="btn pri" data-a="demo">Probar con datos de ejemplo</button></section>` : `<form class="card stack" data-submit="conectar">
        <label class="lbl" for="en">Enlace de conexión o URL del Apps Script</label>
        <textarea id="en" class="input" rows="3" data-f="enlace" placeholder="https://script.google.com/macros/s/…/exec" autocapitalize="off" autocorrect="off" spellcheck="false">${esc(e.enlace)}</textarea>
        ${token && !e.codigo ? '<p class="ok-t sm">' + icono('check', 16) + ' El enlace ya trae el código del hogar.</p>' : `<label class="lbl" for="co">Código del hogar <span class="muted">(si el enlace no lo trae)</span></label>
        <input id="co" class="input" data-f="codigo" placeholder="XXXX-XXXX-XXXX" autocapitalize="characters" autocomplete="off" value="${esc(e.codigo)}">`}
        ${e.error ? alerta('bad', 'No se pudo conectar', e.error) : ''}
        <button class="btn pri" type="submit" ${e.cargando ? 'disabled' : ''}>${e.cargando ? 'Conectando…' : 'Conectar'}</button>
      </form>`}
      <p class="muted sm center">¿Eres quien crea la hoja? Sigue la guía de instalación del proyecto: allí obtienes la URL y el código.</p>
      ${window.PP_SOLO_DEMO ? '' : '<button class="btn ghost wide" data-a="demo">Probar con datos de ejemplo</button>'}
    </main>`;
  },
  acciones: {
    async conectar(c) {
      const e = c.estado;
      const { url, token } = leerEnlace(e.enlace, e.codigo);
      e.error = '';
      if (!/^https:\/\/script\.google(usercontent)?\.com\//.test(url)) { e.error = 'La URL debe empezar con https://script.google.com/'; c.render(); return; }
      if (/\/dev(\?|$)/.test(url)) { e.error = 'Esa es la URL de prueba (/dev). Usa la de la implementación, que termina en /exec.'; c.render(); return; }
      if (!token) { e.error = 'Escribe el código del hogar.'; c.render(); return; }
      e.cargando = true; c.render();
      try {
        const r = await llamar({ url, token }, { action: 'ping' });
        if (!r || !r.ok) throw new Error(r?.error || 'respuesta_invalida');
        st.setMeta({ url, token: token.toUpperCase(), demo: false, since: 0 });
        await st.sincronizar();
        e.cargando = false;
        location.hash = st.foto().Personas.length ? '#/quien' : '#/hogar';
      } catch (err) {
        st.setMeta({ url: '', token: '' });
        e.cargando = false;
        e.error = mensajeError(err.message);
        c.render();
      }
    },
    async demo(c) {
      st.reiniciar();
      st.setMeta({ demo: true, since: 0 });
      crearEjemplo();
      await st.sincronizar().catch(() => {});
      location.hash = '#/inicio';
      c.avisar('Datos de ejemplo cargados');
    }
  }
};

const textoSuma = (s) => `La participación suma ${s} %${s === 100 ? '' : '; debe ser 100 %'}.`;

const hogar = {
  alEscribir(c, f) {
    if (!f.startsWith('p_')) return;
    const e = c.estado;
    const s = r2(Array.from({ length: e.n }, (_, i) => num(e['p_' + i])).reduce((a, b) => a + b, 0));
    const el = document.getElementById('sumaHogar');
    if (el) { el.textContent = textoSuma(s); el.className = 'sm ' + (s === 100 ? 'ok-t' : 'bad-t'); }
  },
  iniciar(c) { Object.assign(c.estado, { n: 2, n_0: '', n_1: '', p_0: '50', p_1: '50' }); },
  vista(c) {
    const e = c.estado;
    const idx = Array.from({ length: e.n }, (_, i) => i);
    const suma = r2(idx.reduce((a, i) => a + num(e['p_' + i]), 0));
    return `<main class="pad onb">
      <h1 class="onb-t">Configura el hogar</h1>
      <p class="onb-x">La hoja está vacía. Escribe quiénes comparten los gastos y cuánto aporta cada uno. Tú quedas como administrador.</p>
      <form class="card stack" data-submit="crear">
        ${idx.map((i) => `<div class="split gap center">
          <input class="input grow" data-f="n_${i}" maxlength="40" placeholder="${i === 0 ? 'Tu nombre' : 'Nombre de la persona ' + (i + 1)}" value="${esc(e['n_' + i])}" aria-label="Nombre ${i + 1}">
          <span class="pct-w"><input class="inl pct" data-f="p_${i}" inputmode="decimal" value="${esc(e['p_' + i])}" aria-label="Participación ${i + 1}"> %</span>
          ${i > 0 && e.n > 1 ? `<button type="button" class="btn-ic" data-a="quitar" data-i="${i}" aria-label="Quitar">${icono('cerrar', 18)}</button>` : '<span class="btn-ic"></span>'}
        </div>`).join('')}
        <div class="split"><button type="button" class="link" data-a="agregar">+ Agregar persona</button><button type="button" class="link" data-a="iguales">Partes iguales</button></div>
        <p id="sumaHogar" class="sm ${suma === 100 ? 'ok-t' : 'bad-t'}">${textoSuma(suma)}</p>
        <p class="xs muted">Ejemplo: 60 % y 40 %. Cada gasto se reparte así, salvo que lo cambies en el gasto. Se crean 13 categorías iniciales que luego puedes editar.</p>
        ${c.sync.ultimo ? '<button class="btn pri" type="submit">Crear hogar</button>' : `${alerta('warn', 'Primero hay que sincronizar', 'Así evitamos crear el hogar dos veces si la hoja ya tiene datos.')}<button type="button" class="btn sec" data-a="sync">Sincronizar</button>`}
      </form>
    </main>`;
  },
  acciones: {
    agregar(c) { const e = c.estado; e['n_' + e.n] = ''; e['p_' + e.n] = '0'; e.n++; c.render(); },
    quitar(c, d) {
      const e = c.estado; const i = Number(d.i);
      for (let k = i; k < e.n - 1; k++) { e['n_' + k] = e['n_' + (k + 1)]; e['p_' + k] = e['p_' + (k + 1)]; }
      e.n--; c.render();
    },
    iguales(c) {
      const e = c.estado; const b = r2(100 / e.n);
      for (let i = 0; i < e.n; i++) e['p_' + i] = String(i === e.n - 1 ? r2(100 - b * (e.n - 1)) : b);
      c.render();
    },
    crear(c) {
      const e = c.estado;
      const idx = Array.from({ length: e.n }, (_, i) => i);
      ops.crearHogar({ nombres: idx.map((i) => e['n_' + i]), pcts: idx.map((i) => num(e['p_' + i])) });
      location.hash = '#/inicio';
      c.avisar('Hogar creado. Define los topes en Más > Presupuesto.');
    }
  }
};

const quien = {
  vista(c) {
    const ps = L.personas(c.S);
    return `<main class="pad onb">
      <h1 class="onb-t">¿Quién eres?</h1>
      <p class="onb-x">Elige tu nombre. Los gastos que registres en este celular saldrán pagados por ti, aunque puedes cambiarlo en cada gasto.</p>
      <section class="card list">
        ${ps.map((p) => fila({ izq: avatar(p, 40), titulo: esc(p.nombre), sub: esc(p.rol), a: 'soy', datos: { id: p.id } })).join('')}
      </section>
      <p class="muted sm center">¿No estás en la lista? Pide al administrador que te agregue en Más > Personas y sincroniza.</p>
      <button class="btn ghost wide" data-a="sync">Sincronizar</button>
    </main>`;
  },
  acciones: {
    soy(c, d) { st.setMeta({ personaId: d.id }); location.hash = '#/inicio'; }
  }
};

export default { conectar, hogar, quien };
