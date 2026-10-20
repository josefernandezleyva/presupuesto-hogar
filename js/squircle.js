// Esquinas continuas («squircle»), como las de iOS.
// Safari todavía no dibuja `corner-shape`, así que se recorta cada superficie con un
// trazado de curvatura continua (suavizado 60 %, el de iOS) y su borde se dibuja con
// el mismo trazado, para que no se corte en las esquinas.

const SELECTOR = '.card, .tema, .logo, .mini-c, .alert, .tc-row, .hm, .empty-sq';
const SUAVIZADO = 0.6;
const rad = (g) => (g * Math.PI) / 180;

function parametros(r, presupuesto) {
  let s = SUAVIZADO;
  let p = (1 + s) * r;
  const maxS = presupuesto / r - 1;
  s = Math.max(0, Math.min(s, maxS));
  p = Math.min(p, presupuesto);
  const arco = 90 * (1 - s);
  const tramoArco = Math.sin(rad(arco / 2)) * r * Math.SQRT2;
  const alfa = (90 - arco) / 2;
  const p3p4 = r * Math.tan(rad(alfa / 2));
  const beta = 45 * s;
  const c = p3p4 * Math.cos(rad(beta));
  const d = c * Math.tan(rad(beta));
  const b = (p - tramoArco - c - d) / 3;
  const a = 2 * b;
  return { a, b, c, d, p, tramoArco, r };
}

/** Trazado SVG de un rectángulo w×h con esquinas continuas de radio nominal r. */
export function trazado(w, h, r) {
  const f = (n) => Math.round(n * 100) / 100;
  r = Math.max(0, Math.min(r, Math.min(w, h) / 2));
  if (r < 0.5) return `M0 0H${f(w)}V${f(h)}H0Z`;
  const { a, b, c, d, p, tramoArco: t } = parametros(r, Math.min(w, h) / 2);
  return [
    `M${f(w - p)} 0`,
    `c${f(a)} 0 ${f(a + b)} 0 ${f(a + b + c)} ${f(d)}`,
    `a${f(r)} ${f(r)} 0 0 1 ${f(t)} ${f(t)}`,
    `c${f(d)} ${f(c)} ${f(d)} ${f(b + c)} ${f(d)} ${f(a + b + c)}`,
    `L${f(w)} ${f(h - p)}`,
    `c0 ${f(a)} 0 ${f(a + b)} ${f(-d)} ${f(a + b + c)}`,
    `a${f(r)} ${f(r)} 0 0 1 ${f(-t)} ${f(t)}`,
    `c${f(-c)} ${f(d)} ${f(-(b + c))} ${f(d)} ${f(-(a + b + c))} ${f(d)}`,
    `L${f(p)} ${f(h)}`,
    `c${f(-a)} 0 ${f(-(a + b))} 0 ${f(-(a + b + c))} ${f(-d)}`,
    `a${f(r)} ${f(r)} 0 0 1 ${f(-t)} ${f(-t)}`,
    `c${f(-d)} ${f(-c)} ${f(-d)} ${f(-(b + c))} ${f(-d)} ${f(-(a + b + c))}`,
    `L0 ${f(p)}`,
    `c0 ${f(-a)} 0 ${f(-(a + b))} ${f(d)} ${f(-(a + b + c))}`,
    `a${f(r)} ${f(r)} 0 0 1 ${f(t)} ${f(-t)}`,
    `c${f(c)} ${f(-d)} ${f(b + c)} ${f(-d)} ${f(a + b + c)} ${f(-d)}`,
    'Z'
  ].join('');
}

const observador = typeof ResizeObserver !== 'undefined' ? new ResizeObserver((es) => es.forEach((e) => dibujar(e.target))) : null;

function dibujar(el) {
  if (document.documentElement.dataset.esquinas !== 'squircle') return;
  const w = el.offsetWidth, h = el.offsetHeight;
  if (!w || !h) return;
  const cs = getComputedStyle(el);
  // El radio nominal es el que define el CSS (con formas concéntricas o sin ellas).
  const r = parseFloat(el.dataset.sqR || cs.getPropertyValue('--sq-r')) || parseFloat(cs.borderTopLeftRadius) || 0;
  if (!el.dataset.sqR) el.dataset.sqR = String(r);
  const clave = `${w}x${h}x${r}`;
  if (el.dataset.sq === clave) return;
  el.dataset.sq = clave;
  const d = trazado(w, h, r);
  el.style.clipPath = `path('${d}')`;
  const bw = parseFloat(cs.borderTopWidth) || 0;
  const color = el.dataset.sqColor || cs.borderTopColor;
  if (!el.dataset.sqColor) el.dataset.sqColor = color;
  if (bw > 0 && color && !/rgba\(.*,\s*0\)$/.test(color) && color !== 'transparent') {
    // El borde se dibuja con el mismo trazado (el doble de ancho: la mitad queda fuera del recorte).
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}' viewBox='0 0 ${w} ${h}'><path d='${d}' fill='none' stroke='${color}' stroke-width='${bw * 2}'/></svg>`;
    el.style.setProperty('--sq-borde', `url("data:image/svg+xml,${encodeURIComponent(svg)}")`);
    el.classList.add('sq-borde');
  }
}

/** Aplica las esquinas continuas a las superficies dentro de `raiz` (después de cada dibujo). */
export function aplicarSquircle(raiz) {
  if (document.documentElement.dataset.esquinas !== 'squircle') return;
  raiz.querySelectorAll(SELECTOR).forEach((el) => {
    dibujar(el);
    observador?.observe(el);
  });
}
