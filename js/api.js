// Comunicación con el Apps Script publicado (o con el servidor de ejemplo).

import { manejarDemo } from './demo.js';

export async function llamar(meta, cuerpo) {
  if (meta.demo) return manejarDemo(cuerpo);
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 30000);
  let r;
  try {
    // text/plain evita la verificación previa (CORS) que Apps Script no responde.
    r = await fetch(meta.url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ ...cuerpo, token: meta.token }),
      signal: ctrl.signal,
      redirect: 'follow'
    });
  } catch (e) {
    throw new Error(e.name === 'AbortError' ? 'tiempo_agotado' : 'sin_conexion');
  } finally {
    clearTimeout(t);
  }
  if (!r.ok) throw new Error('http_' + r.status);
  try {
    return await r.json();
  } catch {
    throw new Error('respuesta_invalida');
  }
}

export const MENSAJES = {
  codigo_invalido: 'El código del hogar no coincide. Revísalo en la hoja: menú Presupuesto.',
  hoja_no_inicializada: 'Falta inicializar la hoja: menú Presupuesto > Inicializar.',
  respuesta_invalida: 'La dirección no responde como la app. Usa la URL de la aplicación web que termina en /exec.',
  sin_conexion: 'Sin conexión. Tus cambios se guardan en el celular y se suben al volver la conexión.',
  tiempo_agotado: 'Google tardó demasiado en responder. Intenta de nuevo.',
  ocupado: 'La hoja está ocupada con otra sincronización. Intenta en unos segundos.',
  almacenamiento: 'El celular no tiene espacio para guardar los datos de la app.'
};
export const mensajeError = (e) => MENSAJES[e] || (String(e).startsWith('http_') ? 'Google respondió con un error (' + e + '). Revisa que la aplicación web esté publicada para "Cualquier usuario".' : 'No se pudo sincronizar: ' + e);
