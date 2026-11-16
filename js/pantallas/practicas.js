// 3.5 · Buenas prácticas de presupuesto: dinero sin asignar (P6), ritmo por categoría (P8),
// fondo de emergencia (P14) y este mes frente al promedio (P18). Se usan en Inicio y en Presupuesto.
// Nada de esto cambia la hoja: se calcula con los datos de siempre y la configuración va en la pestaña Config.

import * as L from '../logic.js';
import * as ops from '../ops.js';
import { esc, hoy, mesActual, pct, nombreMes, parseMonto, fmt0 } from '../util.js';
import { dinero0, icono } from '../ui.js';
import { placa } from './comun.js';

const dia = (n) => `el ${n}`;

/** P8 · Marca de «hoy» sobre una barra de tope (a qué altura del mes vamos). */
export const marcaHoy = (rit) => (rit && rit.pctMes != null ? `<i class="hoy-m" style="left:${Math.min(100, rit.pctMes).toFixed(1)}%" aria-hidden="true"></i>` : '');

/** P8 · Fila de aviso de ritmo (para Pendientes de Inicio). */
export function filaRitmo(a) {
  return `<a class="row ritmo" href="#/gastos?cat=${esc(a.cat.id)}">${placa('porDia', '#B26B00', 36)}<span class="row-m"><span class="row-t">${esc(a.cat.nombre)} va rápido</span>
    <span class="row-s">Lleva ${esc(pct(a.pctTope))} del tope y el mes va en ${esc(pct(a.pctMes))}: a este ritmo lo pasa ${esc(dia(a.diaCruce))}</span></span>${icono('adelante', 18)}</a>`;
}

/** P8 · Etiqueta corta para la lista de topes de Presupuesto. */
export const tagRitmo = (a) => (a ? `<span class="badge warn" title="A este ritmo pasa el tope ${esc(dia(a.diaCruce))}">Se pasaría ${esc(dia(a.diaCruce))}</span>` : '');

/** P18 · «▲ 38 %» junto al monto de una categoría. */
export function tagVariacion(v) {
  if (!v) return '';
  return `<span class="var-t ${v.sube ? 'sube' : 'baja'}" aria-label="${v.sube ? 'Subió' : 'Bajó'} ${Math.round(v.pct)} % frente a su promedio">${v.sube ? '▲' : '▼'} ${Math.round(v.pct)} %</span>`;
}

/** P18 · Frases con las mayores subidas (arriba de «Dónde se va el dinero»). */
export function frasesSubidas(comp) {
  if (!comp?.subidas?.length) return '';
  return `<div class="subidas">${comp.subidas.map((f) => `<p class="sm">${icono('alerta', 16)}<span><b>${esc(f.cat.nombre)}</b> subió ${dinero0(f.delta)} (▲ ${Math.round(f.pct)} %) frente a su promedio${comp.enCurso ? ' a esta altura del mes' : ''}.</span></p>`).join('')}</div>`;
}

/** P18 · Tarjeta completa para Presupuesto › Tendencias. */
export function tarjetaComparacion(comp, mes) {
  if (!comp || !comp.meses.length) return '';
  // Primero lo que ya se gastó este mes (de mayor a menor) y después lo que suele gastarse y aún no.
  const conGasto = comp.filas.filter((f) => f.actual > 0).sort((a, b) => b.actual - a.actual);
  const sinGasto = comp.filas.filter((f) => !(f.actual > 0) && f.promedio > 0).sort((a, b) => b.promedio - a.promedio);
  const filas = [...conGasto, ...sinGasto].slice(0, 8);
  const maxV = Math.max(1, ...filas.map((f) => Math.max(f.actual, f.promedio)));
  const h = comp.hormiga;
  return `<section class="card comp35">
    <h2 class="h2">Este mes frente a tu promedio</h2>
    <p class="xs muted">${comp.enCurso ? `Del 1 al ${comp.dia} de ${esc(nombreMes(mes, { anio: false }).toLowerCase())}, frente a los mismos días` : `${esc(nombreMes(mes))} frente al promedio`} de ${comp.meses.length === 1 ? 'el mes anterior' : `los ${comp.meses.length} meses anteriores con gastos`}.</p>
    ${filas.map((f) => {
      const v = f.pct === null ? (f.actual > 0 ? '<span class="var-t sube">Nuevo</span>' : '') : tagVariacion(L.variacionCat(comp, f.cat.id)) || '<span class="var-t igual">≈</span>';
      return `<div class="comp-f"><div class="split sm"><span>${esc(f.cat.nombre)} ${v}</span><span class="muted num">${dinero0(f.actual)} <span class="xs">· prom. ${dinero0(f.promedio)}</span></span></div>
        <div class="comp-b" aria-hidden="true"><span class="a" style="width:${(f.actual / maxV * 100).toFixed(1)}%"></span><span class="p" style="left:${(f.promedio / maxV * 100).toFixed(1)}%"></span></div></div>`;
    }).join('')}
    <p class="xs muted"><span class="legend soft"></span> este mes · <span class="legend ref"></span> promedio</p>
    ${h.n ? `<div class="hormiga sm">${placa('otros', '#8A6D1F', 32)}<span class="row-m"><span class="row-t">Gastos hormiga: ${dinero0(h.total)} en ${h.n} ${h.n === 1 ? 'gasto' : 'gastos'}</span><span class="row-s">Pagos de menos de S/ ${h.limite}${comp.enCurso ? ' en lo que va del mes' : ''}. A este ritmo, unos ${dinero0(h.alAnio)} al año.</span></span></div>` : ''}
  </section>`;
}

/** P6 · Dinero sin asignar (presupuesto base cero). */
export function tarjetaSinAsignar(sa, { admin } = {}) {
  if (!sa) {
    return `<section class="card sa35">${placa('sueldo', '#2E7D6B', 36)}<div class="row-m"><span class="row-t">¿Cuánto queda sin asignar?</span><span class="row-s">Registra los ingresos del mes para ver si cada sol tiene un destino.</span></div><a class="btn sec mini" href="#/ingresos">Ingresos</a></section>`;
  }
  const neg = sa.libre < -0.004, cero = Math.abs(sa.libre) < 1;
  const anchoG = Math.min(100, sa.gastos / sa.ingreso * 100), anchoA = Math.min(100 - anchoG, sa.ahorro / sa.ingreso * 100);
  return `<section class="card sa35${neg ? ' neg' : ''}">
    <div class="split vc"><h2 class="h2">Dinero sin asignar</h2><b class="num big-s${neg ? ' bad-t' : cero ? ' ok-t' : ''}">${neg ? '−' + dinero0(-sa.libre) : dinero0(sa.libre)}</b></div>
    <div class="track tres" role="img" aria-label="Topes de gasto ${Math.round(anchoG)} %, ahorro planificado ${Math.round(anchoA)} %, sin asignar ${Math.max(0, Math.round(100 - anchoG - anchoA))} %"><span class="g" style="width:${anchoG}%"></span><span class="a" style="width:${anchoA}%"></span></div>
    <ul class="sa-l sm">
      <li><span>Ingresos</span><b class="num">${dinero0(sa.ingreso)}</b></li>
      <li><span><i class="g"></i>Topes de gasto</span><b class="num">− ${dinero0(sa.gastos)}</b></li>
      <li><span><i class="a"></i>Ahorro planificado</span><b class="num">− ${dinero0(sa.ahorro)}</b></li>
    </ul>
    <p class="xs ${neg ? 'bad-t' : 'muted'}">${neg ? `Los topes superan los ingresos por ${dinero0(-sa.libre)}. Baja algún tope para no gastar más de lo que entra.`
      : cero ? 'Cada sol del ingreso tiene un destino.' : 'Dale un destino: súmalo al ahorro (un tope en una categoría de Ahorro) o a la categoría que lo necesite. Lo que no se asigna suele gastarse sin notarlo.'}</p>
    ${admin && !cero ? '<a class="btn sec mini" href="#/presupuesto">Asignar en los topes</a>' : ''}
  </section>`;
}

/** P14 · Fondo de emergencia: invitación a configurarlo o su avance. `compacta` para Inicio. */
export function tarjetaFondo(f, { compacta = false } = {}) {
  if (!f.configurado) {
    if (compacta) return '';
    return `<section class="card fondo35 inv">${placa('seguro', '#2E7D6B', 40)}<div class="row-m"><span class="row-t">Fondo de emergencia</span>
      <span class="row-s">Se recomienda juntar 6 meses de gastos esenciales${f.esencial > 0 ? ` (para ustedes, unos ${dinero0(f.esencial * 6)})` : ''} para imprevistos: una enfermedad, una reparación o quedarse sin trabajo.</span></div>
      <button type="button" class="btn pri mini" data-a="fondo-config">Configurar</button></section>`;
  }
  const m = f.meses == null ? null : Math.floor(f.meses * 10) / 10;
  const tono = f.completo ? 'ok' : m != null && m >= 3 ? 'ok' : m != null && m >= 1 ? 'warn' : 'bad';
  const txtMeses = m == null ? 'Sin gasto esencial para comparar' : `${m.toFixed(1).replace(/\.0$/, '')} ${m === 1 ? 'mes' : 'meses'} cubiertos`;
  if (compacta) {
    return `<a class="card fondo35 mini" href="#/analisis">${placa('seguro', '#2E7D6B', 36)}<span class="row-m"><span class="row-t">Fondo de emergencia · ${esc(txtMeses)}</span>
      <span class="row-s">${dinero0(f.saldo)} de ${dinero0(f.meta)} (meta: ${f.metaMeses} meses)</span>
      <span class="track"><span class="fill ${tono}" style="width:${f.pct.toFixed(1)}%"></span></span></span>${icono('adelante', 18)}</a>`;
  }
  return `<section class="card fondo35">
    <div class="split vc"><h2 class="h2">Fondo de emergencia</h2><button type="button" class="link sm" data-a="fondo-config">Ajustar</button></div>
    <div class="hero-n"><span class="big num">${dinero0(f.saldo)}</span><span class="muted sm">de ${dinero0(f.meta)}</span></div>
    <div class="track" role="img" aria-label="${Math.round(f.pct)} % de la meta"><span class="fill ${tono}" style="width:${f.pct.toFixed(1)}%"></span></div>
    <p class="sm"><b>${esc(txtMeses)}</b> de ${f.metaMeses} · gasto esencial de ${dinero0(f.esencial)} al mes${f.base === 'topes' ? ' (según los topes de Necesidad)' : ''}.</p>
    <p class="xs muted">${f.completo ? '¡Meta cumplida! Mantén el fondo y úsalo solo para emergencias.' : `Te faltan ${dinero0(f.falta)}. Con ${dinero0(f.aporteSugerido)} al mes lo completas en un año.`} Los aportes se registran como gastos en «${esc(f.cat.nombre)}».</p>
    <div class="split gap"><a class="btn sec mini" href="#/nuevo?cat=${esc(f.cat.id)}">Registrar un aporte</a><button type="button" class="btn ghost mini" data-a="fondo-saldo">Actualizar el saldo</button></div>
  </section>`;
}

/** P14 · Hoja para configurar el fondo: categoría de los aportes, saldo actual y meta en meses. */
export function configurarFondo(c) {
  const S = c.S;
  const f = L.fondoEmergencia(S, mesActual());
  const cats = L.categorias(S);
  const deAhorro = cats.filter((x) => x.naturaleza === 'Ahorro');
  const actual = f.configurado ? f.cat.id : (deAhorro.find((x) => /emergencia|fondo/i.test(x.nombre)) || deAhorro[0])?.id || '';
  const crear = !cats.some((x) => /emergencia/i.test(x.nombre)) && c.admin;
  const opcion = (x) => `<option value="${esc(x.id)}" ${x.id === actual ? 'selected' : ''}>${esc(x.nombre)}${x.naturaleza === 'Ahorro' ? '' : ` · ${esc(x.grupo || '')}`}</option>`;
  c.preguntar({
    titulo: 'Fondo de emergencia',
    texto: 'Elige la categoría donde registran los aportes al fondo y cuánto tienen ya ahorrado para emergencias.',
    html: `<label class="campo-h"><span class="lbl">Categoría de los aportes</span>
        <select class="inp" name="cat">${crear ? '<option value="__nueva">Crear «Fondo de emergencia» (grupo Ahorro)</option>' : ''}
          ${deAhorro.length ? `<optgroup label="Ahorro">${deAhorro.map(opcion).join('')}</optgroup>` : ''}
          <optgroup label="Otras">${cats.filter((x) => x.naturaleza !== 'Ahorro').map(opcion).join('')}</optgroup></select></label>
      <label class="campo-h"><span class="lbl">Saldo que ya tienen hoy (S/)</span>
        <input class="inp num" name="saldo" inputmode="decimal" placeholder="0" value="${f.configurado ? esc(String(f.saldo)) : ''}"></label>
      <label class="campo-h"><span class="lbl">Meta</span><select class="inp" name="meta">
        ${[3, 4, 6, 9, 12].map((n) => `<option value="${n}" ${n === f.metaMeses ? 'selected' : ''}>${n} meses de gastos esenciales${n === 6 ? ' (recomendado)' : ''}</option>`).join('')}</select></label>
      <p class="xs muted">El saldo se cuenta desde hoy: después se suma cada aporte pagado en esa categoría. Si un día usan el fondo, toca «Actualizar el saldo».</p>`,
    botones: [{ l: 'Guardar', estilo: 'pri', fn: (c2, v) => {
      let catId = v.cat;
      if (catId === '__nueva') {
        const grupo = L.grupoDe(c2.S, 'Ahorro')?.nombre || L.grupos(c2.S)[0]?.nombre;
        catId = ops.guardarCategoria({ nombre: 'Fondo de emergencia', grupo, tipo: 'Fijo', naturaleza: 'Ahorro' });
      }
      ops.guardarFondo({ categoria_id: catId, saldo: parseMonto(v.saldo) || 0, metaMeses: Number(v.meta) || 6, desde: hoy() });
      c2.avisar('Fondo de emergencia guardado');
    } }]
  });
}

/** P14 · Actualizar el saldo (por ejemplo, después de usar el fondo). */
export function actualizarSaldoFondo(c) {
  const f = L.fondoEmergencia(c.S, mesActual());
  if (!f.configurado) { configurarFondo(c); return; }
  c.preguntar({
    titulo: 'Saldo del fondo',
    texto: `Hoy la app calcula ${fmt0(f.saldo)}. Escribe cuánto tienen realmente en el fondo; desde hoy se sumarán los aportes nuevos.`,
    html: `<label class="campo-h"><span class="lbl">Saldo actual (S/)</span><input class="inp num" name="saldo" inputmode="decimal" value="${esc(String(f.saldo))}"></label>`,
    botones: [{ l: 'Guardar', estilo: 'pri', fn: (c2, v) => {
      ops.guardarFondo({ categoria_id: f.cat.id, saldo: parseMonto(v.saldo) || 0, metaMeses: f.metaMeses, desde: hoy() });
      c2.avisar('Saldo actualizado');
    } }]
  });
}

export const accionesFondo = {
  'fondo-config'(c) { configurarFondo(c); },
  'fondo-saldo'(c) { actualizarSaldoFondo(c); }
};

