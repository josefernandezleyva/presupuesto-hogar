// 3.0 · Iconos «Línea casera»: trazo redondeado de 1.75 px en una cuadrícula de 24 px, un acento de relleno
// suave (clase "a", al 22 %) y, en las categorías, un solo detalle con humor ligero. Los estados de dinero
// (vencido, excedido) son sobrios. Sin texto dentro de los iconos; se leen a 16 px y en claro u oscuro.
//
// La hoja no guarda un ícono por categoría (no se cambia su estructura): se elige por palabras del nombre
// de la categoría y, si no hay coincidencia, por las de su grupo; si tampoco, «otros».

import { norm } from './util.js';

const C = (cx, cy, r, a = false) => `<circle cx="${cx}" cy="${cy}" r="${r}"${a ? ' class="a"' : ''}/>`;
const P = (d, a = false) => `<path d="${d}"${a ? ' class="a"' : ''}/>`;
const R = (x, y, w, h, rx = 2, a = false) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}"${a ? ' class="a"' : ''}/>`;

export const SET = {
  /* ---------------------------------------------------------- Categorías --- */
  // Bolsa de papel con una baguette asomando.
  super: P('M5 10h14l-1.1 9.3a2 2 0 0 1-2 1.7H8.1a2 2 0 0 1-2-1.7z', true) + P('M9 10V8.5a3 3 0 0 1 3-3') + P('M11.5 10l5.6-6.6a1.5 1.5 0 0 1 2.3 1.9L15.3 10', true) + P('M15.6 6.2l.9.8M14.2 7.9l.9.8'),
  // Plato con cubiertos y vapor.
  resto: C(12, 15, 5.2, true) + C(12, 15, 2.4) + P('M10.6 3.6c-.9 1 .9 2 0 3.2M13.6 3.6c-.9 1 .9 2 0 3.2') + P('M3.5 10v10M2.4 10v3.2a1.1 1.1 0 0 0 2.2 0V10M20.5 20v-10c-1.3.6-2 2-2 4h2'),
  // Caja para llevar con rayo de apuro.
  delivery: P('M6 8h12l-1 12H7z', true) + P('M8 8l1-3.5h6L16 8') + P('M4 12l-1.8 2.5h2.2L2.6 17'),
  // Casa con la llave colgando de la puerta.
  casa: P('M4 11l8-6.5 8 6.5') + P('M6 9.5V20h12V9.5') + C(12, 13.6, 1.7, true) + P('M12 15.3V18M12 16.8h1.3'),
  // Foco con un rayo en el filamento.
  luz: P('M12 3a6 6 0 0 0-3.6 10.8c.6.5 1 1.2 1 2V17h5.2v-1.2c0-.8.4-1.5 1-2A6 6 0 0 0 12 3z', true) + P('M9.6 20h4.8') + P('M12.8 7l-1.9 3h2.4l-1.9 3'),
  // Gota con brillo.
  agua: P('M12 3.5s6 6.4 6 10.5a6 6 0 0 1-12 0c0-4.1 6-10.5 6-10.5z', true) + P('M9.3 14.2a2.7 2.7 0 0 0 2.2 2.6'),
  // Llama.
  gas: P('M12 3c1 3 5 5 5 10a5 5 0 0 1-10 0c0-2.5 1.5-4 2.5-5 .3 1.5 1 2.5 2 3 .5-3-.5-5.5.5-8z', true),
  // Router «pensando»: el último arco de la señal queda corto.
  internet: R(4, 13, 16, 6, 2, true) + P('M8 16h.01M11 16h.01') + P('M8.4 9.6a5.5 5.5 0 0 1 7.2 0M10.4 11.6a2.6 2.6 0 0 1 3.2 0') + P('M6.2 7.4a8.6 8.6 0 0 1 4.3-1.9'),
  // Auto de perfil con nube de movimiento.
  auto: P('M4 16v-3l2-4.5h8.5l3.8 4.5h1.7a1 1 0 0 1 1 1V16') + P('M9 16h6') + C(6.8, 16.3, 2, true) + C(17.2, 16.3, 2, true) + P('M1.5 11h1.8M1 13.6h1.5'),
  // Surtidor con la manguera en forma de pregunta.
  gasolina: R(4, 4, 9, 16, 1.5) + R(6.3, 6.6, 4.4, 3.4, 0.8, true) + P('M13 9h1.6c1.6 0 2.4 1 2.4 2.4 0 1.3-1.3 1.8-1.3 3.1V17a1.6 1.6 0 0 0 3.2 0V10l-2-2'),
  // Cápsula en dos tonos y una cruz.
  salud: P('M8.6 15.4l6.9-6.9a3.4 3.4 0 0 0-4.8-4.8L3.8 10.6a3.4 3.4 0 0 0 4.8 4.8z') + P('M3.8 10.6l3.4-3.4 4.8 4.8-3.4 3.4a3.4 3.4 0 0 1-4.8-4.8z', true) + P('M18 14.5v5.5M15.3 17.2h5.4'),
  // Mochila con bolsillo.
  educ: P('M6 9.5a6 6 0 0 1 12 0V19a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2z') + P('M9.5 5.2V4a2.5 2.5 0 0 1 5 0v1.2') + R(8.6, 13.4, 6.8, 4.4, 1.2, true) + P('M8.6 15.4h6.8'),
  // Calcetín grande y calcetín pequeño.
  hijos: P('M5 3h5v8l2.6 2.6a2.4 2.4 0 0 1-3.4 3.4L5 13z') + P('M14 9h3.6v5l1.9 1.9a1.8 1.8 0 0 1-2.5 2.5L14 15.4z', true) + P('M5 6h5M14 11h3.6'),
  // Huella con hueso.
  mascota: P('M12 12.6c-3 0-5 3.2-4.5 5.2.5 1.8 2.5 1.4 4.5 1.4s4 .4 4.5-1.4c.5-2-1.5-5.2-4.5-5.2z', true) + C(6.6, 10, 1.6) + C(9.8, 6.8, 1.6) + C(14.2, 6.8, 1.6) + C(17.4, 10, 1.6),
  // Pantalla con «play» y la pila de suscripciones.
  stream: R(3, 4, 18, 12, 2) + P('M10.4 7.4v5.2l4.3-2.6z', true) + P('M7 19h10M9.5 21.4h5'),
  // Entrada de cine troquelada.
  ocio: P('M3.5 8h17v2.6a1.9 1.9 0 0 0 0 3.8V17h-17v-2.6a1.9 1.9 0 0 0 0-3.8z', true) + P('M14.5 8.5v1.4M14.5 11.7v.8M14.5 14.3v2'),
  // Copa con burbuja (grupo de ocio y disfrute).
  copa: P('M7 3.5h10c0 4.6-2 7.8-5 7.8S7 8.1 7 3.5z', true) + P('M12 11.3V20M8.5 20.5h7') + C(13.4, 6.5, 0.6),
  // Camiseta con etiqueta de precio.
  ropa: P('M8 4l-4 3 2 3.5 2-1V20h8V9.5l2 1L20 7l-4-3c-.6 1.4-2 2.4-4 2.4S8.6 5.4 8 4z', true) + P('M14.6 13.4l2.2 2.2') + C(17.3, 16.1, 0.7),
  // Frasco con dosificador y chispa.
  cuidado: P('M8 10h8v9a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2z', true) + P('M10 10V7.2h4V10M12 7.2V4h3.2') + P('M18.6 13l.6 1.4 1.4.6-1.4.6-.6 1.4-.6-1.4-1.4-.6 1.4-.6z'),
  // Maleta con etiqueta al viento.
  viaje: R(5, 7.5, 14, 12, 2, true) + P('M9 7.5V5.2h6v2.3') + P('M9 11v5M15 11v5') + P('M15 7.5l2.6-2.8 1.6 1.2'),
  // Caja de regalo con el lazo algo desordenado.
  regalo: R(4.5, 11, 15, 9, 1.2, true) + R(3.5, 8, 17, 3, 1) + P('M12 8v12') + P('M12 8c-1.4-3.2-5-3.3-4.6-.9.2 1 1.9 1 4.6.9zM12 8c1.6-2.6 4.6-3 4.8-.9.1 1.3-2.1 1.3-4.8.9'),
  // Refrigeradora con un calendario pegado de imán (cuotas).
  electro: R(6, 3, 12, 18, 2) + P('M6 10h12M9 6v2M9 13v3') + R(12.4, 13, 3.6, 3.6, 0.6, true) + P('M12.4 14.2h3.6'),
  // Paraguas sobre la casa.
  seguro: P('M3 12a9 9 0 0 1 18 0z', true) + P('M12 3v1M12 12v6.2a2 2 0 0 1-4 0'),
  // Tarjeta con flecha que vuelve.
  deuda: R(3, 6, 18, 12, 2) + R(3, 9, 18, 3, 0, true) + P('M14.3 15.6a2 2 0 1 0 1.9-2.4M16.2 13.2l-.4 1.2 1.2.3'),
  // Frasco de ahorro con la tapa torcida.
  ahorro: P('M7 9h10v10a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2z') + P('M6.4 6.3l10.4-1.4.4 2.6-10.4 1.4z') + R(9.4, 13, 5.2, 5, 1.4, true) + P('M9.4 15.5h5.2'),
  // Documento con porcentaje.
  impuesto: P('M7 3h7l4 4v14H7z', true) + P('M14 3v4h4') + P('M10 16l4.5-5') + C(10.4, 11.6, 0.9) + C(14, 15.6, 0.9),
  // Olla con vapor (grupo Alimentación).
  olla: P('M4 11h16v6a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3z', true) + P('M2.5 11h19M10 11V9.5h4V11') + P('M9 4c-.8 1 .8 2 0 3M12.5 4c-.8 1 .8 2 0 3M16 4c-.8 1 .8 2 0 3'),
  // Caja de «lo demás» con tres puntos.
  otros: P('M4 9h16v10a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z', true) + P('M4 9l2-4h12l2 4') + P('M9 14.5h.01M12 14.5h.01M15 14.5h.01'),

  /* ---------------------------------------------- Ingresos, ahorro y metas --- */
  sueldo: R(3, 7, 18, 12, 2) + P('M3 8.5l9 6 9-6') + C(17, 6, 3, true) + P('M17 4.8v2.4'),
  extra: C(11, 13, 7, true) + P('M11 10v6M8 13h6') + P('M19 2.5l.6 1.4 1.4.6-1.4.6-.6 1.4-.6-1.4-1.4-.6 1.4-.6z'),
  reembolso: C(13, 13, 7, true) + P('M3 8a9.5 9.5 0 0 1 6-4.5M3 8V4.2M3 8h3.8') + P('M10.5 13h5M12.5 11l-2 2 2 2'),
  meta: P('M3 20c3-5.5 6-8 9-8s6 2.5 9 8z', true) + P('M12 12V3.5l5 2-5 2'),
  porDia: C(12, 12, 4.5, true) + P('M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4') + P('M12 10.2v3.6'),
  regla: C(12, 12, 8.5) + P('M12 3.5V12l7.4 4.2') + P('M13.5 4.4A8.5 8.5 0 0 1 20.4 10.6L13.5 12z', true),
  compromisos: R(3.5, 5, 17, 15, 2) + P('M3.5 10h17M8 3v4M16 3v4') + C(8, 15, 1, true) + C(12, 15, 1, true) + C(16, 15, 1, true),
  mesNuevo: R(3.5, 5, 17, 15, 2) + P('M3.5 10h17M8 3v4M16 3v4') + P('M12 18v-3.2c0-1.4 1-2.4 2.6-2.4 0 1.6-1 2.4-2.6 2.4M12 15.6c0-1.2-.9-2-2.2-2 0 1.3.9 2 2.2 2', true),

  /* ------------------------------------------------- Estados y alertas --- */
  pagado: C(12, 12, 9, true) + C(12, 12, 9) + P('M7.8 12.2l2.9 2.9 5.5-6'),
  porPagar: C(11, 12, 8.5) + C(18.2, 18.2, 3.6, true) + P('M18.2 16.6v1.8l1.1.8'),
  vencido: P('M11 3.5a8.5 8.5 0 1 0 8.5 8.5', false) + P('M19.5 9.4V8.8M18.4 6.2l-.4-.4M15.9 4.1l-.6-.3') + P('M11 7.5V12l3.2 2.4'),
  aviso: P('M3.5 17a8.5 8.5 0 0 1 17 0', true) + P('M3.5 17a8.5 8.5 0 0 1 17 0M12 17l4.6-4.6') + C(12, 17, 1.2),
  excedido: P('M3.5 17a8.5 8.5 0 0 1 17 0', true) + P('M3.5 17a8.5 8.5 0 0 1 17 0M12 17l7.6-2.2') + C(12, 17, 1.2) + P('M21 6.5v3M21 11.6v.01'),
  duplicado: R(3, 6, 12, 14, 2, true) + R(9, 3, 12, 14, 2) + P('M12.5 9h5M12.5 11.5h5'),
  // 3.2 · Recibo anulado (para «Gastos anulados»).
  anulado: P('M6 3.5h12v17l-2-1.4-2 1.4-2-1.4-2 1.4-2-1.4-2 1.4z', true) + P('M9.5 9.5l5 5M14.5 9.5l-5 5'),
  cerrado: R(5, 10.5, 14, 10, 2, true) + P('M8 10.5V7.5a4 4 0 0 1 8 0v3') + P('M9 15h6M9 17.5h3.5'),
  sinConexion: P('M7 18h9.5a4 4 0 0 0 .7-7.9A6 6 0 0 0 6 9.5a4.3 4.3 0 0 0 1 8.5z', true) + P('M4 4l16 16'),
  nubeOk: P('M7 18h9.5a4 4 0 0 0 .7-7.9A6 6 0 0 0 6 9.5a4.3 4.3 0 0 0 1 8.5z', true) + P('M9.5 13.6l1.8 1.8 3.4-3.6'),
  reparto: P('M11 4.1a8 8 0 0 0 0 15.8z', true) + P('M13 4.1a8 8 0 0 1 0 15.8z') + P('M11 4.1v15.8M13 4.1v15.8'),
  saldo: P('M3.5 8h13l-3-3M20.5 16h-13l3 3') + C(12, 12, 2.4, true),
  alDia: C(8.5, 12, 5.5, true) + C(15.5, 12, 5.5) + P('M13.2 12.2l1.6 1.6 3-3.2'),
  hogarTodos: P('M3.5 10.5L12 4l8.5 6.5') + C(9, 15, 3, true) + C(15, 15, 3),
  campana: P('M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z', true) + P('M10 20a2 2 0 0 0 4 0'),
  llave: C(8, 12, 4, true) + P('M12 12h8.5M17 12v3M20 12v2.4')
};

// Palabras (sin tildes, en minúsculas) → ícono. Se revisan en este orden; la primera que aparece gana.
const REGLAS = [
  [/hipotec|alquiler|renta|vivienda|departament|casa|mantenimiento|condomin/, 'casa'],
  [/energ|luz|electric/, 'luz'],
  [/agua|sedapal/, 'agua'],
  [/\bgas\b|balon|glp/, 'gas'],
  [/internet|telef|celular|wifi|cable|movistar|claro|entel/, 'internet'],
  [/delivery|pedido|rappi|para llevar/, 'delivery'],
  [/restaur|almuerzo|cena|cafe|salida a comer|comida fuera|menu/, 'resto'],
  [/supermerc|mercado|comida|abarrote|despensa|bodega|alimento|panader|verdur/, 'super'],
  [/gasolin|combust|grifo|petrol/, 'gasolina'],
  [/taxi|movilidad|transporte|uber|bus|pasaje|peaje|estaciona|auto|carro/, 'auto'],
  [/mascot|perro|gato|veterin/, 'mascota'],
  [/hijo|bebe|nino|nina|panal|guarder|nido|crianza|juguet/, 'hijos'],
  [/educ|colegio|escuela|univers|curso|pension|util|libro|academ/, 'educ'],
  [/salud|farmac|medic|clinic|doctor|dent|optic|terapia/, 'salud'],
  [/seguro|poliza|soat/, 'seguro'],
  [/stream|netflix|spotify|suscrip|disney|youtube|hbo|prime|apple/, 'stream'],
  [/viaj|vacacion|hotel|vuelo|turismo/, 'viaje'],
  [/regalo|cumple|navidad|celebr|fiesta/, 'regalo'],
  [/divers|ocio|cine|entreten|juego|salida|hobby|deporte|gimnas/, 'ocio'],
  [/vestim|ropa|zapat|calzad|moda/, 'ropa'],
  [/cuidado|belleza|peluq|cosmet|higiene|aseo|personal/, 'cuidado'],
  [/electrod|refri|lavadora|mueble|tecnolog|laptop|televis|equip|compra/, 'electro'],
  [/tarjeta|deuda|prestamo|credito|banco|interes|comision|cuota/, 'deuda'],
  [/ahorro|inversion|fondo|emergencia/, 'ahorro'],
  [/impuest|sunat|arbitrio|predial|tribut/, 'impuesto'],
  // Nombres de grupo frecuentes.
  [/alimentaci/, 'olla'],
  [/servicio/, 'luz'],
  [/ocio|disfrute/, 'copa'],
  [/familia/, 'hijos']
];

const elegidos = new Map();
/** Ícono de una categoría (o grupo) a partir de su nombre y, si no, del de su grupo. */
export function iconoDe(nombre, grupo = '') {
  const k = nombre + '|' + grupo;
  if (elegidos.has(k)) return elegidos.get(k);
  const buscar = (t) => { const n = norm(t || ''); const r = REGLAS.find(([re]) => re.test(n)); return r ? r[1] : null; };
  const v = buscar(nombre) || buscar(grupo) || 'otros';
  elegidos.set(k, v);
  return v;
}

/** SVG de un ícono del set. */
export function svg(nombre, size = 20, extra = '') {
  return `<svg class="ic lc" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true" ${extra}>${SET[nombre] || SET.otros}</svg>`;
}
