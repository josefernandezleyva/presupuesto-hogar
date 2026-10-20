// Almacén de imágenes en el celular (IndexedDB). Si no está disponible, queda en memoria.

const DB = 'presupuesto-hogar';
const STORES = ['pendientes', 'cache', 'demo'];
const memoria = Object.fromEntries(STORES.map((s) => [s, new Map()]));
let abierta = null;

function abrir() {
  if (abierta) return abierta;
  abierta = new Promise((ok) => {
    try {
      const req = indexedDB.open(DB, 1);
      req.onupgradeneeded = () => STORES.forEach((s) => { if (!req.result.objectStoreNames.contains(s)) req.result.createObjectStore(s); });
      req.onsuccess = () => ok(req.result);
      req.onerror = () => ok(null);
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
