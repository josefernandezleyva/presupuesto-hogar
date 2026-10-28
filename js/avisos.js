// 2.0 · Avisos push en el iPhone: activar, revisar y desactivar la suscripción de este celular.
// En iPhone funcionan con iOS 16.4 o posterior y solo con la app abierta desde su ícono de inicio.

import * as st from './store.js';
import { llamar } from './api.js';

const esIos = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
export const enInicio = () => window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true;

/** Qué permite este celular, para explicar en Ajustes qué falta. */
export function soporte() {
  const api = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  const https = location.protocol === 'https:' || location.hostname === 'localhost';
  let motivo = '';
  if (st.getMeta().demo) motivo = 'demo';
  else if (!https) motivo = 'https';
  else if (esIos() && !enInicio()) motivo = 'inicio';
  else if (!api) motivo = 'navegador';
  else if (Notification.permission === 'denied') motivo = 'bloqueado';
  return { ok: !motivo, motivo, ios: esIos() };
}

export const MOTIVOS = {
  demo: 'Los avisos necesitan una hoja real; el modo de ejemplo no los envía.',
  https: 'Los avisos necesitan la app publicada en https (GitHub Pages).',
  inicio: 'Abre la app desde su ícono en la pantalla de inicio. En Safari, los avisos no están disponibles.',
  navegador: 'Este navegador no permite avisos. En iPhone se necesita iOS 16.4 o posterior.',
  bloqueado: 'Los avisos están bloqueados. Actívalos en Ajustes del iPhone › Notificaciones › Presupuesto.'
};

function claveBytes(b64u) {
  const s = b64u.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (b64u.length % 4)) % 4);
  return Uint8Array.from(atob(s), (ch) => ch.charCodeAt(0));
}

const conPlazo = (promesa, ms) => Promise.race([promesa, new Promise((_, no) => setTimeout(() => no(new Error('tiempo_agotado')), ms))]);

/** El service worker de la app (lo registra si todavía no está). */
async function registro() {
  const reg = await navigator.serviceWorker.getRegistration();
  if (reg) return reg;
  await navigator.serviceWorker.register('./sw.js');
  return conPlazo(navigator.serviceWorker.ready, 10000);
}

/** Suscripción actual de este celular (o null). */
export async function suscripcion() {
  if (!soporte().ok && soporte().motivo !== 'bloqueado') return null;
  try {
    const reg = await conPlazo(navigator.serviceWorker.getRegistration(), 3000);
    return reg ? await conPlazo(reg.pushManager.getSubscription(), 3000) : null;
  } catch { return null; }
}

function equipo() {
  const ua = navigator.userAgent;
  return /iPhone/.test(ua) ? 'iPhone' : /iPad/.test(ua) ? 'iPad' : /Android/.test(ua) ? 'Android' : 'Computadora';
}

async function enviar(sub) {
  const meta = st.getMeta();
  const r = await llamar(meta, { action: 'pushSuscribir', persona_id: meta.personaId, sub: sub.toJSON(), origen: location.origin, equipo: equipo() });
  if (!r?.ok) throw new Error(r?.error || 'respuesta_invalida');
  st.setMeta({ avisos: true, avisosEndpoint: sub.endpoint, avisosPersona: meta.personaId, avisosRevisado: Date.now() });
  return r;
}

/** Pide el permiso (debe llamarse desde un toque), se suscribe y registra este celular en la hoja. */
export async function activar() {
  const s = soporte();
  if (!s.ok) throw new Error(s.motivo);
  const permiso = await Notification.requestPermission();
  if (permiso !== 'granted') throw new Error('bloqueado');
  const meta = st.getMeta();
  const clave = await llamar(meta, { action: 'pushClave' });
  if (!clave?.ok) throw new Error(clave?.error || 'accion_desconocida');
  const reg = await registro();
  let sub = await reg.pushManager.getSubscription();
  // Si la hoja cambió de clave (Code.gs nuevo en otra hoja), la suscripción vieja ya no sirve.
  if (sub && meta.avisosClave && meta.avisosClave !== clave.publicKey) { await sub.unsubscribe().catch(() => {}); sub = null; }
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: claveBytes(clave.publicKey) });
  st.setMeta({ avisosClave: clave.publicKey });
  await enviar(sub);
  await llamar(st.getMeta(), { action: 'pushProbar', persona_id: meta.personaId }).catch(() => null);
  return true;
}

export async function desactivar() {
  const sub = await suscripcion();
  const meta = st.getMeta();
  if (sub) {
    await llamar(meta, { action: 'pushQuitar', endpoint: sub.endpoint }).catch(() => null);
    await sub.unsubscribe().catch(() => {});
  }
  st.setMeta({ avisos: false, avisosEndpoint: '' });
}

/**
 * Al abrir la app: si los avisos están activos, comprueba que la suscripción siga viva y que la hoja la
 * conozca para la persona de este celular (una vez al día, o si cambió algo).
 */
export async function revisar() {
  const meta = st.getMeta();
  if (!meta.avisos || meta.demo || !meta.url) return 'apagado';
  const sub = await suscripcion();
  if (!sub) { st.setMeta({ avisos: false, avisosEndpoint: '' }); return 'perdida'; }
  const cambio = sub.endpoint !== meta.avisosEndpoint || meta.avisosPersona !== meta.personaId;
  if (cambio || Date.now() - (meta.avisosRevisado || 0) > 24 * 3600 * 1000) await enviar(sub).catch(() => null);
  return 'activo';
}

/** Globo con el número en el ícono de la app, y los avisos ya vistos se retiran de la pantalla. */
export async function limpiarGlobo() {
  try { await navigator.clearAppBadge?.(); } catch { /* sin globo */ }
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    (await reg?.getNotifications?.() || []).forEach((n) => n.close());
  } catch { /* nada */ }
}
