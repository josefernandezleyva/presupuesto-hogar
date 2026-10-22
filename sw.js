// Service worker: guarda la app en el celular para que abra sin conexión.
// Al publicar una versión nueva, cambia VERSION para que los celulares la descarguen.

const VERSION = 'pp-1.5.0';
const ARCHIVOS = [
  './', './index.html', './manifest.webmanifest', './css/app.css',
  './js/main.js', './js/store.js', './js/api.js', './js/demo.js', './js/logic.js', './js/ops.js',
  './js/util.js', './js/ui.js', './js/tema.js', './js/squircle.js', './js/idb.js', './js/evidencia.js', './js/charts.js', './js/ejemplo.js',
  './js/pantallas/comun.js', './js/pantallas/inicio.js', './js/pantallas/gastos.js', './js/pantallas/registro.js',
  './js/pantallas/cierre.js', './js/pantallas/analisis.js', './js/pantallas/mas.js', './js/pantallas/maestros.js',
  './js/pantallas/plan.js', './js/pantallas/conectar.js', './js/pantallas/reporte.js',
  './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(ARCHIVOS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return; // la API de Google va directo
  // Red primero (para recibir actualizaciones), con la copia guardada si no hay conexión.
  e.respondWith(
    fetch(e.request).then((r) => {
      if (r.ok) { const copia = r.clone(); caches.open(VERSION).then((c) => c.put(e.request, copia)); }
      return r;
    }).catch(() => caches.match(e.request, { ignoreSearch: true }).then((r) => r || caches.match('./index.html')))
  );
});
