// Primer uso (3.1, como el prototipo): bienvenida con tres caminos (unirme, crear, probar), el formulario de
// conexión, la configuración del hogar con un ejemplo en vivo, «¿Quién eres?» y un paso opcional de avisos.

import * as L from '../logic.js';
import * as ops from '../ops.js';
import * as st from '../store.js';
import { llamar, mensajeError } from '../api.js';
import { esc, num, r2, mesActual } from '../util.js';
import { avatar, alerta, icono, fila } from '../ui.js';
import { crearEjemplo } from '../ejemplo.js';
import { soporte } from '../avisos.js';
import { placa } from './comun.js';

/** Paso final opcional: ofrecer los avisos (solo si este celular puede recibirlos). */
const puedeAvisos = (c) => !c.meta.demo && soporte().ok;
function pasoAvisos() {
  return `<main class="pad onb onb31">
    <div class="onb-cab">${placa('campana', '#B3362A', 64)}
      <h1 class="onb-t">Entérate de cada gasto</h1>
      <p class="onb-x">Cuando la otra persona registre un gasto, te llega un aviso con cuánto te toca.</p></div>
    <div class="aviso-demo" aria-hidden="true"><span class="b">Presupuesto</span><span class="muted xs">ahora</span>
      <span class="b">Jorge registró un gasto</span><span class="sm">Farmacia · S/ 45.90</span><span class="sm muted">Salud · Te toca S/ 27.54 (60 %)</span></div>
    <p class="sm muted center">En iPhone funciona con la app abierta desde su ícono de inicio. Puedes activarlos después en Hogar y ajustes › Avisos.</p>
    <a class="btn pri" href="#/avisos">Activar avisos</a>
    <a class="btn ghost" href="#/inicio" data-a="ahora-no">Ahora no</a>
  </main>`;
}

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
    // Con un enlace de invitación se va directo al formulario (ya viene lleno).
    c.estado.paso = c.query.u ? 'unir' : 'inicio';
  },
  vista(c) {
    const e = c.estado;
    const { token } = leerEnlace(e.enlace, e.codigo);
    const instalar = esIOS() && !instalada() ? alerta('info', 'Primero instala la app', 'En Safari toca Compartir y luego «Agregar a inicio». Abre la app desde el ícono y conéctala allí: Safari y la app instalada no comparten datos.') : '';
    if (e.paso === 'inicio' || window.PP_SOLO_DEMO) {
      const op = (a, ic, t, sub) => `<button type="button" class="card op-onb" data-a="${a}">${placa(ic, 'var(--accent)', 44)}<span class="row-m"><span class="row-t">${t}</span><span class="row-s">${sub}</span></span>${icono('adelante', 18)}</button>`;
      return `<main class="pad onb onb31">
        <div class="onb-cab"><div class="logo">${icono('inicio', 34)}</div>
          <h1 class="onb-t">Presupuesto del Hogar</h1>
          <p class="onb-x">Registren sus gastos, sepan cuánto les queda y quién le debe a quién. Todo queda en su hoja de Google.</p></div>
        ${instalar}
        ${window.PP_SOLO_DEMO ? '<p class="sm card">Esta es una vista de prueba. Desde aquí no se puede conectar una hoja de Google: para usar la app con tus datos, instálala desde GitHub Pages siguiendo la guía.</p>'
          : `${op('ir-unir', 'llave', 'Unirme a mi hogar', 'Con el enlace que te mandó tu familia')}
             ${op('ir-crear', 'hogarTodos', 'Crear un hogar nuevo', 'Para el administrador, con la hoja ya preparada')}`}
        <button class="btn ghost wide" data-a="demo">Probar con datos de ejemplo</button>
      </main>`;
    }
    const crear = e.paso === 'crear';
    return `<main class="pad onb onb31">
      <button type="button" class="btn-ic onb-atras" data-a="ir-inicio" aria-label="Atrás">${icono('atras', 24)}</button>
      <h1 class="onb-t">${crear ? 'Conecta la hoja del hogar' : 'Unirme a mi hogar'}</h1>
      <p class="onb-x">${crear ? 'Pega la URL del Apps Script (termina en /exec) y el código que muestra la hoja. Los obtienes siguiendo la guía de instalación.' : 'Pega el enlace que te mandó tu familia por WhatsApp o correo. Si te dieron un código aparte, escríbelo abajo.'}</p>
      ${instalar}
      <form class="card stack" data-submit="conectar">
        <label class="lbl" for="en">${crear ? 'URL del Apps Script o enlace de conexión' : 'Enlace de conexión'}</label>
        <textarea id="en" class="input" rows="3" data-f="enlace" placeholder="https://script.google.com/macros/s/…/exec" autocapitalize="off" autocorrect="off" spellcheck="false">${esc(e.enlace)}</textarea>
        ${navigator.clipboard?.readText && !e.enlace ? `<button type="button" class="link" data-a="pegar">${icono('copiar', 16)} Pegar el enlace copiado</button>` : ''}
        ${token && !e.codigo ? '<p class="ok-t sm">' + icono('check', 16) + ' El enlace ya trae el código del hogar.</p>' : `<label class="lbl" for="co">Código del hogar <span class="muted">(si el enlace no lo trae)</span></label>
        <input id="co" class="input" data-f="codigo" placeholder="XXXX-XXXX-XXXX" autocapitalize="characters" autocomplete="off" value="${esc(e.codigo)}">`}
        ${e.error ? alerta('bad', 'No se pudo conectar', e.error) : ''}
        <button class="btn pri" type="submit" ${e.cargando ? 'disabled' : ''}>${e.cargando ? 'Conectando…' : 'Conectar'}</button>
      </form>
      <p class="muted sm center">${crear ? 'Si la hoja ya tiene un hogar, solo te pedirá elegir quién eres.' : '¿No tienes el enlace? Pídeselo a quien administra la hoja (Hogar y ajustes › Invitar).'}</p>
    </main>`;
  },
  acciones: {
    'ir-unir'(c) { c.estado.paso = 'unir'; c.render(); },
    'ir-crear'(c) { c.estado.paso = 'crear'; c.render(); },
    'ir-inicio'(c) { Object.assign(c.estado, { paso: 'inicio', error: '' }); c.render(); },
    async pegar(c) {
      try {
        const t = await navigator.clipboard.readText();
        if (t) { c.estado.enlace = t.trim(); c.render(); }
      } catch { c.avisar('No se pudo leer el portapapeles. Mantén presionado el recuadro y toca Pegar.', 'bad'); }
    },
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

/** 3.1 · Ejemplo en vivo: cuánto pone cada uno de un gasto de S/ 200. */
function ejemploHogar(e) {
  const partes = Array.from({ length: e.n }, (_, i) => `${String(e['n_' + i] || '').trim().split(' ')[0] || (i === 0 ? 'Tú' : 'Persona ' + (i + 1))} pone S/ ${r2(200 * num(e['p_' + i]) / 100)}`);
  return `De un gasto de S/ 200: ${partes.join(partes.length > 2 ? ', ' : ' y ')}.`;
}

const hogar = {
  alEscribir(c, f) {
    if (!f.startsWith('p_')) return;
    const e = c.estado;
    const s = r2(Array.from({ length: e.n }, (_, i) => num(e['p_' + i])).reduce((a, b) => a + b, 0));
    const el = document.getElementById('sumaHogar');
    if (el) { el.textContent = textoSuma(s); el.className = 'sm ' + (s === 100 ? 'ok-t' : 'bad-t'); }
    const ej = document.getElementById('ejHogar');
    if (ej) ej.textContent = ejemploHogar(e);
  },
  iniciar(c) { Object.assign(c.estado, { n: 2, n_0: '', n_1: '', p_0: '50', p_1: '50', paso: '' }); },
  vista(c) {
    const e = c.estado;
    if (e.paso === 'avisos') return pasoAvisos();
    const idx = Array.from({ length: e.n }, (_, i) => i);
    const suma = r2(idx.reduce((a, i) => a + num(e['p_' + i]), 0));
    return `<main class="pad onb">
      <h1 class="onb-t">Configura el hogar</h1>
      <p class="onb-x">¿Quiénes comparten los gastos? El porcentaje es cuánto aporta cada uno a los gastos comunes; se puede cambiar después. Tú quedas como administrador.</p>
      <form class="card stack" data-submit="crear">
        ${idx.map((i) => `<div class="hog-f">
          <label class="hog-n"><span class="lbl">${i === 0 ? 'Tu nombre' : 'Otra persona'}</span>
            <input class="input" data-f="n_${i}" maxlength="40" placeholder="${i === 0 ? 'Tu nombre' : 'Nombre de la persona ' + (i + 1)}" value="${esc(e['n_' + i])}" aria-label="Nombre ${i + 1}"></label>
          <label class="hog-p"><span class="lbl">Aporta</span><span class="pct-w"><input class="inl pct" data-f="p_${i}" inputmode="decimal" value="${esc(e['p_' + i])}" aria-label="Participación ${i + 1}"> %</span></label>
          ${i > 0 && e.n > 1 ? `<button type="button" class="btn-ic" data-a="quitar" data-i="${i}" aria-label="Quitar">${icono('cerrar', 18)}</button>` : '<span class="btn-ic" aria-hidden="true"></span>'}
        </div>`).join('')}
        <div class="split"><button type="button" class="link" data-a="agregar">+ Agregar persona</button><button type="button" class="link" data-a="iguales">Partes iguales</button></div>
        <p id="sumaHogar" class="sm ${suma === 100 ? 'ok-t' : 'bad-t'}">${textoSuma(suma)}</p>
        <p class="sm ej-hogar" id="ejHogar">${esc(ejemploHogar(e))}</p>
        <p class="xs muted">Cada gasto se reparte así, salvo que lo cambies en el gasto. Se crean 13 categorías iniciales que luego puedes editar.</p>
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
      c.avisar('Hogar creado. Define los topes en Hogar y ajustes › Presupuesto.');
      if (puedeAvisos(c)) { e.paso = 'avisos'; c.render(); } else location.hash = '#/inicio';
    },
    'ahora-no'(c) { location.hash = '#/inicio'; }
  }
};

const quien = {
  vista(c) {
    if (c.estado.paso === 'avisos') return pasoAvisos();
    const ps = L.personas(c.S);
    const part = L.participacion(c.S, mesActual());
    return `<main class="pad onb onb31">
      <h1 class="onb-t">¿Quién eres?</h1>
      <p class="onb-x">Elige tu nombre: así sabremos qué gastos son tuyos y a quién avisar. Lo que registres en este celular saldrá pagado por ti (se puede cambiar en cada gasto).</p>
      <section class="card list">
        ${ps.map((p) => fila({ izq: avatar(p, 44), titulo: esc(p.nombre), sub: `${esc(p.rol)}${part[p.id] != null ? ` · ${esc(String(part[p.id]))} %` : ''}`, a: 'soy', datos: { id: p.id } })).join('')}
      </section>
      <p class="muted sm center">¿No estás en la lista? Pide al administrador que te agregue en Hogar y ajustes › Personas y sincroniza.</p>
      <button class="btn ghost wide" data-a="sync">Sincronizar</button>
    </main>`;
  },
  acciones: {
    soy(c, d) {
      st.setMeta({ personaId: d.id });
      if (puedeAvisos(c)) { c.estado.paso = 'avisos'; c.render(); } else location.hash = '#/inicio';
    },
    'ahora-no'(c) { location.hash = '#/inicio'; }
  }
};

export default { conectar, hogar, quien };
