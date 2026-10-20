// Datos de ejemplo: un hogar de dos personas con seis meses de historia.

import * as st from './store.js';
import * as ops from './ops.js';
import * as L from './logic.js';
import { mesActual, sumarMeses, hoy, r2, diasEnMes } from './util.js';

function azar(semilla) {
  let a = semilla >>> 0;
  return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

export function crearEjemplo() {
  const rnd = azar(7);
  const entre = (a, b) => r2(a + rnd() * (b - a));
  const actual = mesActual();
  const inicio = sumarMeses(actual, -5);
  const diaHoy = Number(hoy().slice(8, 10));

  st.lote(() => {
    const lucia = ops.crearHogar({ nombres: ['Lucía', 'Jorge'], pcts: [60, 40], mes: inicio });
    const S = st.foto();
    const jorge = L.personas(S).find((p) => p.nombre === 'Jorge').id;
    const cat = Object.fromEntries(L.categorias(S).map((c) => [c.nombre, c.id]));
    const topes = { 'Energía eléctrica': 220, Agua: 90, Gas: 60, 'Internet y telefonía': 180, Comida: 1400, 'Taxi y movilidad': 450, Salud: 200, Streaming: 70, 'Diversión': 300, Vestimenta: 400, 'Otros gastos': 130 };
    ops.guardarTopes(inicio, Object.fromEntries(Object.entries(topes).map(([n, t]) => [cat[n], t])));

    const gasto = (mes, dia, monto, nombreCat, pagador, nota = '', moneda = 'PEN', pcts = null) => {
      const d = Math.min(dia, diasEnMes(mes));
      if (mes === actual && d > diaHoy) return;
      ops.guardarGasto({ monto, moneda, categoria_id: cat[nombreCat], pagado_por: pagador, fecha: `${mes}-${String(d).padStart(2, '0')}`, nota, tipo: '', pcts, modalidad: 'Unico' });
    };

    for (let k = 0; k < 6; k++) {
      const mes = sumarMeses(inicio, k);
      ops.guardarTipoCambio(mes, [3.71, 3.73, 3.75, 3.74, 3.76, 3.75][k]);
      ops.guardarIngreso(lucia, mes, 3600);
      ops.guardarIngreso(jorge, mes, 2400);
      gasto(mes, 6, entre(185, 215), 'Energía eléctrica', lucia, 'Recibo de luz');
      gasto(mes, 8, entre(72, 88), 'Agua', lucia, 'Recibo de agua');
      gasto(mes, 9, entre(48, 58), 'Gas', jorge, 'Balón de gas');
      gasto(mes, 3, 179.9, 'Internet y telefonía', jorge, 'Internet y cable');
      for (let s = 0; s < 4; s++) gasto(mes, 2 + s * 7, entre(200, 330), 'Comida', s % 2 ? jorge : lucia, s === 0 ? 'Mercado' : 'Supermercado');
      gasto(mes, 15, entre(60, 140), 'Comida', jorge, 'Delivery');
      for (let s = 0; s < 3; s++) gasto(mes, 4 + s * 9, entre(80, 150), 'Taxi y movilidad', s === 1 ? jorge : lucia, 'Taxis');
      gasto(mes, 12, entre(90, 180), 'Diversión', lucia, 'Cine y cena');
      gasto(mes, 26, entre(70, 190), 'Diversión', jorge, 'Salida');
      if (k % 2 === 1) gasto(mes, 18, entre(150, 520), 'Vestimenta', lucia, 'Ropa', 'PEN', { [lucia]: 100 });
      if (k === 2) gasto(mes, 21, 180, 'Salud', jorge, 'Consulta médica');
      gasto(mes, 20, entre(15, 40), 'Otros gastos', lucia, 'Compra en Amazon', 'USD');
    }

    // Un recurrente y una compra en cuotas.
    ops.guardarGasto({ monto: 44.9, moneda: 'PEN', categoria_id: cat.Streaming, pagado_por: lucia, fecha: `${inicio}-05`, nota: 'Netflix', tipo: '', pcts: null, modalidad: 'Recurrente', duracion: 0 });
    ops.guardarGasto({ monto: 900, moneda: 'PEN', categoria_id: cat['Otros gastos'], pagado_por: lucia, fecha: `${sumarMeses(actual, -1)}-14`, nota: 'Laptop', tipo: 'Fijo', pcts: null, modalidad: 'Cuotas', nroCuotas: 6, mesInicio: sumarMeses(actual, -1) });

    // Confirma lo programado del mes pasado y del actual hasta hoy.
    L.gastosMes(st.foto(), sumarMeses(actual, -1), [L.ESTADO.PROG]).forEach((g) => ops.confirmarGasto(g.id));
    // La cuota de la laptop de este mes queda pendiente, para ver el aviso en el cierre.
    L.gastosMes(st.foto(), actual, [L.ESTADO.PROG]).filter((g) => g.fecha <= hoy() && g.nota !== 'Laptop').forEach((g) => ops.confirmarGasto(g.id));

    // Pagos entre personas y meses cerrados.
    for (let k = 0; k < 4; k++) {
      const mes = sumarMeses(inicio, k);
      const filas = L.saldosMes(st.foto(), mes);
      const t = L.transferencias(filas)[0];
      if (t) ops.registrarLiquidacion({ mes, de: t.de, a: t.a, monto: r2(k === 3 ? t.monto * 0.5 : t.monto), fecha: `${mes}-28` });
      ops.cerrarMes(mes);
    }
  });
}
