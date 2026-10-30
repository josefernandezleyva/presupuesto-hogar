// Menú «Más» y pantallas de configuración del mes: ingresos, presupuesto, tipo de cambio, ajustes.

import * as L from '../logic.js';
import * as ops from '../ops.js';
import * as st from '../store.js';
import { esc, fmt, fmt0, nombreMes, sumarMeses, parseMonto, num, r2, mesActual, SIMBOLO } from '../util.js';
import { encabezado, barraMes, tabbar, fila, avatar, icono, alerta, segmentado, dinero0 } from '../ui.js';
import { lineaSync, tarjetaPropuesta, usarPropuesta } from './comun.js';
import { borrarDemo } from '../demo.js';
import { pendientes as fotosPendientes, procesarCola, estadoCola } from '../evidencia.js';
import { mensajeError } from '../api.js';
import { ACENTOS, PERSONAL, colorDe, MODOS, ESTILOS, MATERIALES, ESQUINAS, ICONOS, leerTema, guardarTema, leerIcono, guardarIcono } from '../tema.js';

const flecha = icono('adelante', 18);

const menu = {
  vista(c) {
    const { S, yo, admin, mes } = c;
    const tc = L.tipoCambioDelMes(S, mes);
    const avisosTxt = c.meta.demo ? 'No disponibles en el modo de ejemplo' : c.meta.avisos ? 'Activados en este iPhone' : 'Desactivados';
    return `${encabezado({ titulo: 'Hogar y ajustes' })}
    <main class="pad">
      <section class="card list">
        ${fila({ izq: avatar(yo, 44), titulo: esc(yo?.nombre || ''), sub: `${esc(yo?.rol || '')} · este celular`, der: flecha, href: '#/ajustes' })}
      </section>
      <h3 class="dia">Avisos</h3>
      <section class="card list">
        ${fila({ izq: icono('campana', 22), titulo: 'Avisos de gastos nuevos', sub: avisosTxt, der: flecha, href: '#/avisos' })}
        ${fila({ izq: icono('reloj', 22), titulo: 'Novedades', sub: 'Lo que registró la otra persona', der: flecha, href: '#/novedades' })}
      </section>
      <h3 class="dia">Mes</h3>
      <section class="card list">
        ${fila({ titulo: 'Ingresos', sub: `Sueldos de ${esc(nombreMes(mes).toLowerCase())}`, der: flecha, href: '#/ingresos' })}
        ${fila({ titulo: 'Compromisos', sub: 'Cuotas y recurrentes que vienen', der: flecha, href: '#/compromisos' })}
        ${fila({ titulo: 'Reporte de gastos', sub: 'Filtrar, agrupar y exportar a Excel', der: flecha, href: '#/reporte' })}
      </section>
      <h3 class="dia">Configuración del hogar${admin ? '' : ' (solo lectura)'}</h3>
      <section class="card list">
        ${fila({ titulo: 'Personas y participación', sub: Object.entries(L.participacion(S, mes)).map(([id, p]) => `${esc(L.persona(S, id)?.nombre || '')} ${p} %`).join(' · '), der: flecha, href: '#/personas' })}
        ${fila({ titulo: 'Categorías y grupos', sub: `${L.categorias(S).length} categorías en ${L.grupos(S).length} grupos`, der: flecha, href: '#/categorias' })}
        ${fila({ titulo: 'Presupuesto y topes', sub: `${esc(fmt0(L.presupuestoMes(S, mes)))} en ${esc(nombreMes(mes).toLowerCase())}`, der: flecha, href: '#/presupuesto' })}
        ${fila({ titulo: 'Tipo de cambio', sub: tc ? `US$ 1 = S/ ${tc}` : 'Sin cargar este mes', der: flecha, href: '#/cambio' })}
      </section>
      <h3 class="dia">App</h3>
      <section class="card list">
        ${fila({ izq: icono('paleta', 22), titulo: 'Apariencia', sub: `${esc(ESTILOS.find((m) => m.v === leerTema().estilo)?.l || '')} · ${esc(MODOS.find((m) => m.v === leerTema().modo).l)} · ${esc(leerTema().acento === PERSONAL ? 'Color propio' : ACENTOS.find((a) => a.v === leerTema().acento)?.l || 'Verde')}`, der: flecha, href: '#/apariencia' })}
        ${fila({ titulo: 'Ajustes y sincronización', sub: lineaSync(c).replace(/<[^>]+>/g, ''), der: flecha, href: '#/ajustes' })}
      </section>
      <p class="xs muted center">Presupuesto del Hogar · versión 2.1</p>
    </main>`;
  }
};

/* ----------------------------------------------------------- Ingresos --- */

const ingresos = {
  vista(c) {
    const { S, mes, estado: e } = c;
    const ps = L.personas(S);
    const total = L.ingresoMes(S, mes);
    return `${encabezado({ titulo: 'Ingresos' })}
    <main class="pad">
      ${barraMes(mes)}
      <p class="muted sm">El sueldo que registras se mantiene en los meses siguientes. Si cambia, regístralo en el mes del cambio: rige desde ese mes en adelante.</p>
      ${ps.map((p) => {
        const v = L.ingresoVigente(S, p.id, mes);
        const anterior = v?.propio ? L.ingresoVigente(S, p.id, sumarMeses(mes, -1)) : null;
        const puede = c.admin || p.id === c.meta.personaId;
        const k = 'm_' + p.id, km = 'mo_' + p.id;
        if (e[k] === undefined) { e[k] = v ? String(v.monto) : ''; e[km] = v?.moneda || 'PEN'; }
        const origen = !v ? '<span class="muted sm">Sin registrar</span>'
          : v.propio ? `<span class="row-s">${anterior ? `Cambió este mes (antes ${esc(fmt0(anterior.soles))})` : 'Registrado este mes'}</span>`
          : `<span class="row-s">Vigente desde ${esc(nombreMes(v.desde).toLowerCase())}</span>`;
        return `<section class="card stack">
          <div class="split vc">${avatar(p, 32)}<div class="grow"><div class="b">${esc(p.nombre)}</div>${v ? origen : ''}</div><div class="right">${v ? `<div class="mid">${dinero0(v.soles)}</div>` : origen}</div></div>
          ${puede ? `<div class="split gap"><input class="input" data-f="${k}" inputmode="decimal" placeholder="Sueldo mensual" value="${esc(e[k])}" aria-label="Sueldo de ${esc(p.nombre)}">
            ${segmentado(km, [{ v: 'PEN', l: 'S/' }, { v: 'USD', l: 'US$' }], e[km], 'Moneda')}</div>
            <button class="btn sec" data-a="guardar" data-p="${esc(p.id)}">${v && !v.propio ? `Cambiar desde ${esc(nombreMes(mes).toLowerCase())}` : 'Guardar'}</button>
            ${v?.propio && anterior ? `<button class="link bad-t" data-a="quitar" data-p="${esc(p.id)}">Quitar el cambio de este mes (vuelve a ${esc(fmt0(anterior.soles))})</button>` : ''}` : ''}
        </section>`;
      }).join('')}
      <p class="sum-l">Ingreso del hogar: <strong>${dinero0(total)}</strong></p>
      ${tarjetaPropuesta(c, mes)}
    </main>`;
  },
  alCambiarMes(c) { Object.keys(c.estado).forEach((k) => delete c.estado[k]); },
  acciones: {
    'usar-propuesta'(c, d) { usarPropuesta(c, d, ops); },
    guardar(c, d) {
      const v = parseMonto(c.estado['m_' + d.p]);
      if (isNaN(v)) throw new ops.ErrorApp('Escribe el monto del sueldo.');
      const antes = L.ingresoVigente(c.S, d.p, c.mes);
      if (antes && !antes.propio && Math.abs(antes.monto - v) < 0.005 && antes.moneda === (c.estado['mo_' + d.p] || 'PEN')) { c.avisar('Es el mismo sueldo vigente: no hay nada que cambiar'); return; }
      ops.guardarIngreso(d.p, c.mes, v, c.estado['mo_' + d.p] || 'PEN');
      c.avisar(antes && !antes.propio ? `Nuevo sueldo desde ${nombreMes(c.mes).toLowerCase()}` : 'Sueldo guardado');
    },
    quitar(c, d) {
      ops.quitarIngreso(d.p, c.mes);
      delete c.estado['m_' + d.p];
      c.avisar('Se quitó el cambio de este mes');
    }
  }
};

/* -------------------------------------------------------- Presupuesto --- */

const presupuesto = {
  vista(c) {
    const { S, mes, estado: e, admin } = c;
    const cats = L.categorias(S);
    const r = L.resumenMes(S, mes);
    let suma = 0;
    const filas = cats.map((cat) => {
      const k = 't_' + cat.id;
      if (e[k] === undefined) e[k] = String(L.tope(S, mes, cat.id) || '');
      suma += num(parseMonto(e[k]) || 0);
      const uso = r.porCategoria.find((f) => f.cat.id === cat.id);
      const propio = !!L.topeExplicito(S, mes, cat.id);
      return `<label class="frow"><span class="row-m"><span class="row-t">${esc(cat.nombre)}</span><span class="row-s">${uso?.usado ? 'Lleva ' + esc(fmt0(uso.usado)) : 'Sin gasto'}${!propio && L.tope(S, mes, cat.id) ? ' · viene de un mes anterior' : ''}</span></span>
        <span class="pct-w">S/ <input class="inl num" data-f="${k}" inputmode="decimal" placeholder="Sin tope" value="${esc(e[k])}" ${admin ? '' : 'disabled'}></span></label>`;
    });
    return `${encabezado({ titulo: 'Presupuesto y topes' })}
    <main class="pad">
      ${barraMes(mes)}
      <p class="muted sm">El tope de cada categoría se mantiene en los meses siguientes hasta que lo cambies. El presupuesto del mes es la suma de los topes. Las alertas salen al ${L.umbral(S)} % del tope.</p>
      ${!admin ? alerta('info', 'Solo el administrador cambia los topes') : ''}
      <section class="card list">${filas.join('')}</section>
      <p class="sum-l" id="sumaTopes">Presupuesto del mes: <strong>${esc(fmt0(suma))}</strong></p>
      ${admin ? '<div class="actions"><button class="btn pri" data-a="guardar">Guardar topes</button></div>' : ''}
    </main>`;
  },
  alCambiarMes(c) { Object.keys(c.estado).forEach((k) => delete c.estado[k]); },
  alEscribir(c) {
    const suma = L.categorias(c.S).reduce((a, cat) => a + (parseMonto(c.estado['t_' + cat.id]) || 0), 0);
    const el = document.getElementById('sumaTopes');
    if (el) el.innerHTML = `Presupuesto del mes: <strong>${esc(fmt0(suma))}</strong>`;
  },
  acciones: {
    guardar(c) {
      const topes = {};
      L.categorias(c.S).forEach((cat) => {
        const v = parseMonto(c.estado['t_' + cat.id]) || 0;
        if (Math.abs(v - L.tope(c.S, c.mes, cat.id)) > 0.004 || !L.topeExplicito(c.S, c.mes, cat.id)) topes[cat.id] = v;
      });
      ops.guardarTopes(c.mes, topes);
      c.avisar('Topes guardados');
    }
  }
};

/* ------------------------------------------------------ Tipo de cambio --- */

const cambio = {
  vista(c) {
    const { S, mes, estado: e, admin } = c;
    const actual = L.tipoCambioDelMes(S, mes);
    if (e.v === undefined) e.v = actual ? String(actual) : '';
    const hist = S.TiposCambio.filter((t) => t.moneda === 'USD').sort((a, b) => (a.mes < b.mes ? 1 : -1)).slice(0, 12);
    return `${encabezado({ titulo: 'Tipo de cambio' })}
    <main class="pad">
      ${barraMes(mes)}
      <p class="muted sm">Los gastos en dólares se convierten a soles con el tipo de cambio de su mes. Cada gasto guarda el que usó, así un cambio posterior no lo modifica.</p>
      <section class="card stack">
        <label class="lbl" for="tc">US$ 1 equivale a</label>
        <div class="monto-w"><span class="monto-s">S/</span><input id="tc" class="monto-i" data-f="v" inputmode="decimal" placeholder="3.75" value="${esc(e.v)}" ${admin ? '' : 'disabled'}></div>
        ${!actual && L.tipoCambio(S, mes) ? `<p class="muted sm">Mientras tanto se usa el del último mes cargado: S/ ${L.tipoCambio(S, mes)}.</p>` : ''}
        ${admin ? '<button class="btn pri" data-a="guardar">Guardar</button>' : alerta('info', 'Solo el administrador carga el tipo de cambio')}
      </section>
      ${hist.length ? `<h3 class="dia">Historial</h3><section class="card list">${hist.map((t) => fila({ titulo: esc(nombreMes(t.mes)), der: `<span class="amt">S/ ${esc(t.tipo_cambio)}</span>` })).join('')}</section>` : ''}
    </main>`;
  },
  alCambiarMes(c) { delete c.estado.v; },
  acciones: {
    guardar(c) { ops.guardarTipoCambio(c.mes, parseMonto(c.estado.v)); c.avisar('Tipo de cambio guardado'); }
  }
};

/* -------------------------------------------------------------- Ajustes --- */

function enlaceConexion(meta) {
  const base = location.href.split('#')[0];
  return `${base}#/conectar?u=${encodeURIComponent(meta.url || '')}&c=${encodeURIComponent(meta.token || '')}`;
}

const ajustes = {
  vista(c) {
    const { S, meta, admin, yo } = c;
    const standalone = window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone;
    return `${encabezado({ titulo: 'Ajustes' })}
    <main class="pad">
      <h3 class="dia">Quién usa este celular</h3>
      <section class="card list">
        ${fila({ izq: avatar(yo, 36), titulo: esc(yo?.nombre || ''), sub: esc(yo?.rol || ''), der: '<span class="link">Cambiar</span>', a: 'cambiar-persona' })}
      </section>
      <h3 class="dia">Avisos</h3>
      <section class="card list">
        ${fila({ izq: icono('campana', 22), titulo: 'Avisos de gastos nuevos', sub: meta.demo ? 'No disponibles en el modo de ejemplo' : meta.avisos ? 'Activados en este iPhone' : 'Desactivados', der: icono('adelante', 18), href: '#/avisos' })}
      </section>
      <h3 class="dia">Sincronización</h3>
      <section class="card stack">
        ${lineaSync(c)}
        <button class="btn sec" data-a="sync">${icono('sync', 18)} Sincronizar ahora</button>
        <div id="fotosCola"></div>
        ${!meta.demo && meta.url && meta.ultimoSync && (num(meta.schemaServidor) || 3) < 4 ? alerta('warn', 'La hoja tiene un Code.gs anterior', 'Los grupos y las cuotas dobles esperan en este celular hasta que el dueño de la hoja pegue el Code.gs de la versión 2.0 y publique una nueva versión.') : ''}
        ${!meta.demo && meta.url && meta.ultimoSync && (num(meta.schemaServidor) || 3) >= 4 && meta.codigoServidor !== '2.0' ? `<p class="xs muted">La hoja tiene el Code.gs ${esc(meta.codigoServidor || '1.4')}: todo funciona, salvo los avisos al celular, que necesitan el de la 2.0.</p>` : ''}
        ${!meta.demo ? `<p class="xs muted ell">Hoja: ${esc(meta.url || '')}</p>` : ''}
      </section>
      ${admin && !meta.demo ? `<h3 class="dia">Sumar otro celular</h3>
      <section class="card stack">
        <p class="sm">Envía este enlace a la otra persona. Ella instala la app desde el enlace y, dentro de la app, lo pega en la pantalla de conexión.</p>
        <div class="split gap"><button class="btn sec" data-a="compartir">${icono('compartir', 18)} Compartir</button><button class="btn sec" data-a="copiar">${icono('copiar', 18)} Copiar</button></div>
        <p class="xs muted">El enlace incluye el código del hogar: compártelo solo con tu familia.</p>
      </section>` : ''}
      ${admin ? `<h3 class="dia">Alertas</h3>
      <section class="card stack">
        <label class="frow"><span class="muted">Avisar al llegar al</span><span class="pct-w"><input class="inl pct" data-f="umbral" inputmode="numeric" value="${esc(c.estado.umbral ?? L.umbral(S))}"> % del tope</span></label>
        <button class="btn sec" data-a="umbral">Guardar</button>
      </section>` : ''}
      ${!standalone ? `<h3 class="dia">Instalar en el iPhone</h3><section class="card"><p class="sm">En Safari, toca Compartir ${icono('compartir', 16)} y luego «Agregar a inicio». La app se abre como cualquier otra y funciona sin conexión.</p></section>` : ''}
      <h3 class="dia">Este celular</h3>
      <section class="card stack">
        ${meta.demo ? '<button class="btn sec" data-a="salir-demo">Salir del modo de ejemplo</button>' : ''}
        <button class="btn ghost bad-t" data-a="desconectar">Desconectar y borrar datos de este celular</button>
        <p class="xs muted">Los datos de la hoja no se borran.</p>
      </section>
      <p class="xs muted center" id="version">Presupuesto del Hogar · versión 2.1${!meta.demo && meta.ultimoSync ? ` · Code.gs ${esc(meta.codigoServidor || (num(meta.schemaServidor) >= 4 ? '1.4' : 'anterior'))}` : ''}</p>
      <p class="xs muted center">Copia en este celular: ${st.infoCopia().gastos} ${st.infoCopia().gastos === 1 ? 'gasto' : 'gastos'}, en ${esc(st.infoCopia().donde)}</p>
    </main>`;
  },
  montar() {
    // Fotos que aún esperan subir a Drive (por ejemplo, registradas sin conexión).
    fotosPendientes().then((n) => {
      const box = document.getElementById('fotosCola');
      if (!box || !n) return;
      box.innerHTML = `<div class="split gap sm"><span>${icono('foto', 16)} ${n} ${n === 1 ? 'foto espera' : 'fotos esperan'} subir a Drive</span><button type="button" class="link" data-a="subir-fotos">Subir ahora</button></div>
        ${estadoCola.error ? `<p class="xs bad-t">${esc(mensajeError(estadoCola.error))}</p>` : ''}`;
    }).catch(() => {});
  },
  acciones: {
    async 'subir-fotos'(c) {
      const n = await procesarCola();
      c.render();
      c.avisar(n ? `${n} ${n === 1 ? 'foto subida' : 'fotos subidas'}` : (estadoCola.error ? mensajeError(estadoCola.error) : 'Sin conexión: se reintenta después.'), n ? '' : 'bad');
    },
    'cambiar-persona'(c) {
      c.preguntar({ titulo: '¿Quién usa este celular?', texto: 'Los gastos nuevos aparecerán pagados por esta persona por defecto.',
        botones: L.personas(c.S).map((p) => ({ l: p.nombre, estilo: p.id === c.meta.personaId ? 'pri' : 'sec', fn: (c2) => { st.setMeta({ personaId: p.id }); c2.avisar('Listo'); } })) });
    },
    async compartir(c) {
      const url = enlaceConexion(c.meta);
      if (navigator.share) { try { await navigator.share({ title: 'Presupuesto del hogar', text: 'Instala la app de presupuesto del hogar con este enlace:', url }); } catch { /* cancelado */ } }
      else { await navigator.clipboard?.writeText(url); c.avisar('Enlace copiado'); }
    },
    async copiar(c) {
      try { await navigator.clipboard.writeText(enlaceConexion(c.meta)); c.avisar('Enlace copiado'); }
      catch { c.preguntar({ titulo: 'Copia este enlace', html: `<textarea class="input" rows="4" readonly>${esc(enlaceConexion(c.meta))}</textarea>`, botones: [] }); }
    },
    umbral(c) {
      const v = Math.round(num(c.estado.umbral));
      if (v < 1 || v > 100) throw new ops.ErrorApp('Escribe un porcentaje entre 1 y 100.');
      ops.setConfig('umbral_alerta', v); c.avisar('Guardado');
    },
    'salir-demo'(c) {
      c.preguntar({ titulo: 'Salir del modo de ejemplo', texto: 'Se borran los datos de ejemplo de este celular.', botones: [{ l: 'Salir', estilo: 'pri', fn: () => { borrarDemo(); st.reiniciar(); location.hash = '#/conectar'; location.reload(); } }] });
    },
    desconectar(c) {
      c.preguntar({ titulo: '¿Desconectar este celular?', texto: 'Se borra la copia local. Si hay cambios sin subir, se perderán. La hoja queda intacta.',
        botones: [{ l: 'Desconectar', estilo: 'danger', fn: () => { if (c.meta.demo) borrarDemo(); st.reiniciar(); location.hash = '#/conectar'; location.reload(); } }] });
    }
  }
};

/* ----------------------------------------------------------- Apariencia --- */

/** Enlace para agregar la app con otro ícono; trae la conexión para no tener que escribirla. */
function enlaceIcono(meta, icono) {
  const base = location.origin + location.pathname;
  return `${base}?icono=${icono}` + (meta.url ? `#/conectar?u=${encodeURIComponent(meta.url)}&c=${encodeURIComponent(meta.token || '')}` : '');
}

const apariencia = {
  // Color propio: se ve en vivo mientras se elige y la pantalla se redibuja al terminar.
  alEscribir(c, f, el, ev) {
    if (f !== 'acentoColor' || !/^#[0-9a-f]{6}$/i.test(el.value)) return;
    guardarTema({ acento: PERSONAL, acentoColor: el.value.toUpperCase() });
    if (ev?.type === 'change') c.render();
  },
  vista(c) {
    const t = leerTema();
    const glass = t.estilo === 'glass';
    const ico = leerIcono();
    const instalada = window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true;
    return `${encabezado({ titulo: 'Apariencia' })}
    <main class="pad has-tabs">
      <h3 class="dia">Ícono de la app</h3>
      <div class="iconos" role="group" aria-label="Ícono de la app">
        ${ICONOS.map((i) => `<button type="button" class="icono-op${i.v === ico ? ' on' : ''}" data-a="icono" data-v="${i.v}" aria-pressed="${i.v === ico}">
          <img src="./icons/${i.v === 'verde' ? '' : i.v + '/'}icon-192.png" alt="" width="60" height="60" loading="lazy"><span>${esc(i.l)}</span></button>`).join('')}
      </div>
      ${c.estado.icoCambiado || ico !== 'verde' ? `<section class="card stack pasos-icono">
        <p class="sm"><strong>Para verlo en la pantalla de inicio</strong>, el iPhone pide agregar la app otra vez:</p>
        <ol class="sm">
          <li>Toca <strong>Copiar enlace con este ícono</strong>.</li>
          <li>Abre <strong>Safari</strong>, pega el enlace y toca <strong>Compartir › Agregar a inicio</strong>. Ya aparece el ícono nuevo.</li>
          <li>Abre la app desde el ícono nuevo, pega el mismo enlace y toca <strong>Conectar</strong>.</li>
          <li>Borra el ícono anterior: mantenlo presionado y toca <strong>Eliminar app</strong>.</li>
        </ol>
        <button type="button" class="btn pri" data-a="copiar-icono">${icono('copiar', 18)} Copiar enlace con este ícono</button>
        <p class="xs muted">${instalada ? 'Los datos están en la hoja, así que no se pierden. Antes de borrar el ícono anterior, revisa en Ajustes que no queden cambios por subir.' : 'Como estás en Safari, puedes tocar Compartir › Agregar a inicio ahora mismo.'} El enlace trae el código del hogar: no lo compartas fuera de la familia.</p>
      </section>` : '<p class="xs muted">Elige el ícono que verás en la pantalla de inicio del iPhone.</p>'}
      <h3 class="dia">Diseño</h3>
      ${segmentadoTema('estilo', ESTILOS, t.estilo, 'Diseño')}
      <p class="xs muted">${glass ? 'Liquid Glass: tarjetas, botones y barras de cristal que dejan ver el color de fondo, con la barra de pestañas flotante.' : 'Clásico: superficies sólidas y planas.'}</p>
      ${glass ? `<h3 class="dia">Material</h3>
      ${segmentadoTema('material', MATERIALES, t.material, 'Material')}
      <p class="xs muted">De más transparente (ultrafino) a más opaco (grueso). Si activas «Reducir transparencia» en el iPhone, el cristal se vuelve opaco.</p>` : ''}
      <h3 class="dia">Esquinas</h3>
      ${segmentadoTema('esquinas', ESQUINAS, t.esquinas, 'Esquinas')}
      <p class="xs muted">Squircle: curvatura continua, como las esquinas del iPhone. Redondeadas: arco circular.</p>
      <h3 class="dia">Formas concéntricas</h3>
      ${segmentadoTema('concentrico', [{ v: '1', l: 'Activadas' }, { v: '0', l: 'Desactivadas' }], t.concentrico ? '1' : '0', 'Formas concéntricas')}
      <p class="xs muted">El radio de lo que va dentro de una tarjeta es el de la tarjeta menos su margen, y las hojas flotantes siguen las esquinas de la pantalla.</p>
      <h3 class="dia">Modo</h3>
      ${segmentadoTema('modo', MODOS, t.modo, 'Modo')}
      <h3 class="dia">Color</h3>
      <div class="colores" role="group" aria-label="Color de la app">
        ${ACENTOS.map((a) => `<button type="button" class="color-op${a.v === t.acento ? ' on' : ''}" data-a="acento" data-v="${a.v}" aria-pressed="${a.v === t.acento}"><span class="color-dot" style="background:${a.c}">${a.v === t.acento ? icono('check', 18) : ''}</span><span class="color-l">${esc(a.l)}</span></button>`).join('')}
        <label class="color-op${t.acento === PERSONAL ? ' on' : ''}"><span class="color-dot propio" style="${t.acento === PERSONAL ? `background:${esc(colorDe(t))}` : ''}">${t.acento === PERSONAL ? icono('check', 18) : icono('mas', 18)}</span><span class="color-l">Propio</span>
          <input type="color" class="sr" data-f="acentoColor" value="${esc(colorDe({ ...t, acento: PERSONAL }))}" aria-label="Elegir un color propio"></label>
      </div>
      <p class="xs muted">${ACENTOS.length} colores y uno propio. Los tonos claros y oscuros se ajustan para que el texto se lea bien.</p>
      <h3 class="dia">Vista previa</h3>
      <section class="card stack">
        <div class="split sm"><span>Comida</span><span class="muted">S/ 865 de S/ 1,400</span></div>
        ${'<div class="track"><div class="fill ok" style="width:62%"></div></div>'}
        <div class="mini-c"><div class="xs muted">Contenido interior</div><div class="sm b">Radio concéntrico</div></div>
        <div class="chips"><span class="chip on">Seleccionado</span><span class="chip">Opción</span></div>
        <button type="button" class="btn pri" tabindex="-1">Botón principal</button>
      </section>
      <p class="xs muted">Se guarda solo en este celular; cada persona elige el suyo.</p>
    </main>`;
  },
  acciones: {
    icono(c, d) { guardarIcono(d.v); c.estado.icoCambiado = true; c.render(); },
    async 'copiar-icono'(c) {
      const url = enlaceIcono(c.meta, leerIcono());
      try { await navigator.clipboard.writeText(url); c.avisar('Enlace copiado: pégalo en Safari'); }
      catch { c.preguntar({ titulo: 'Copia este enlace', html: `<textarea class="input" rows="4" readonly>${esc(url)}</textarea>`, botones: [], cancelar: 'Cerrar' }); }
    },
    modo(c, d) { guardarTema({ modo: d.v }); c.render(); },
    acento(c, d) { guardarTema({ acento: d.v }); c.render(); },
    estilo(c, d) { guardarTema({ estilo: d.v }); c.render(); },
    material(c, d) { guardarTema({ material: d.v }); c.render(); },
    esquinas(c, d) { guardarTema({ esquinas: d.v }); c.render(); },
    concentrico(c, d) { guardarTema({ concentrico: d.v === '1' }); c.render(); }
  }
};

function segmentadoTema(k, opciones, sel, label) {
  return `<div class="seg" role="group" aria-label="${esc(label)}">${opciones.map((o) => `<button type="button" class="${o.v === sel ? 'on' : ''}" data-a="${k}" data-v="${o.v}" aria-pressed="${o.v === sel}">${esc(o.l)}</button>`).join('')}</div>`;
}

export default { mas: menu, ingresos, presupuesto, cambio, ajustes, apariencia };
export { r2, SIMBOLO, mesActual };
