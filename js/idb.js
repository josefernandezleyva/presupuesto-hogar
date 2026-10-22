// Almacén en el celular (IndexedDB): imágenes y, desde la 1.5, la copia local de la hoja.
// Si no está disponible, queda en memoria (y la copia sigue en localStorage).

const DB = 'presupuesto-hogar';
const STORES = ['pendientes', 'cache', 'demo', 'copia'];
const memoria = Object.fromEntries(STORES.map((s) => [s, new Map()]));
let abierta = null;

function abrir() {
  if (abierta) return abierta;
  abierta = new Promise((ok) => {
    try {
      if (typeof indexedDB === 'undefined') { ok(null); return; }
      const req = indexedDB.open(DB, 2);
      req.onupgradeneeded = () => STORES.forEach((s) => { if (!req.result.objectStoreNames.contains(s)) req.result.createObjectStore(s); });
      req.onsuccess = () => ok(req.result);
      req.onerror = () => ok(null);
      req.onblocked = () => ok(null);
    } catch { ok(null); }
  });
  return abierta;
}

async function tx(store, modo, fn) {
  const db = await abrir();
  if (!db) return fn(null, memoria[store]);
  return new Promise((ok) => {
    try {
      const t = db.transaction(store, modo);
      const os = t.objectStore(store);
      const r = fn(os, null);
      t.oncomplete = () => ok(r && typeof r === 'object' && 'result' in r ? r.result : r);
      t.onerror = () => ok(null);
    } catch { ok(fn(null, memoria[store])); }
  });
}

export const leer = (store, k) => tx(store, 'readonly', (os, m) => (os ? os.get(k) : m.get(k)));
export const guardar = (store, k, v) => tx(store, 'readwrite', (os, m) => (os ? os.put(v, k) : m.set(k, v)));
export const borrar = (store, k) => tx(store, 'readwrite', (os, m) => (os ? os.delete(k) : m.delete(k)));
export const claves = (store) => tx(store, 'readonly', (os, m) => (os ? os.getAllKeys() : [...m.keys()]));

/** true si IndexedDB funciona en este navegador (no en modo privado antiguo ni sin almacenamiento). */
export const disponible = async () => !!(await abrir());

/** Escribe y confirma que la transacción terminó (false si falló). */
export async function guardarSeguro(store, k, v) {
  const db = await abrir();
  if (!db) return false;
  return new Promise((ok) => {
    try {
      const t = db.transaction(store, 'readwrite');
      t.objectStore(store).put(v, k);
      t.oncomplete = () => ok(true);
      t.onerror = () => ok(false);
      t.onabort = () => ok(false);
    } catch { ok(false); }
  });
}
