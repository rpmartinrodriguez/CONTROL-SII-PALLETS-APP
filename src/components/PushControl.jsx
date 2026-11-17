import React, { useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { getApp } from 'firebase/app';
import { deleteToken, getMessaging, getToken, isSupported } from 'firebase/messaging';
import { auth } from '../firebase';

const PUBLIC_VAPID = import.meta.env.VITE_SII_FCM_VAPID_PUBLIC || '';
const DEVICE_OPT_IN_KEY = 'sii_pallets_push_opt_in_v2';
const baseBtn = 'px-4 py-3 rounded-xl font-black text-sm disabled:opacity-50';

async function registrarEnServidor(token, accion) {
  if (!auth.currentUser) throw new Error('La sesión Firebase todavía no está lista.');
  const idToken = await auth.currentUser.getIdToken();
  const response = await fetch('/.netlify/functions/push-register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + idToken },
    body: JSON.stringify({ action: accion, token, deviceName: navigator.userAgentData?.platform || navigator.platform || 'Equipo web', userAgent: navigator.userAgent })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'No se pudo registrar el dispositivo.');
  return data;
}

async function tokenDeEsteDispositivo() {
  if (!PUBLIC_VAPID) throw new Error('Falta configurar VITE_SII_FCM_VAPID_PUBLIC en Netlify.');
  if (!('serviceWorker' in navigator) || !(await isSupported())) {
    throw new Error('Este navegador no admite Firebase Web Push.');
  }
  const worker = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
    scope: '/firebase-push-scope'
  });
  const token = await getToken(getMessaging(getApp()), {
    vapidKey: PUBLIC_VAPID,
    serviceWorkerRegistration: worker
  });
  if (!token) throw new Error('No fue posible obtener el token del dispositivo.');
  return token;
}

export default function PushControl({ cerrar }) {
  const [sesion, setSesion] = useState(Boolean(auth.currentUser));
  const [habilitado, setHabilitado] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState('');

  useEffect(() => onAuthStateChanged(auth, user => setSesion(Boolean(user))), []);

  // Si el usuario ya optó por recibir push, renovar el registro en el servidor
  // después de recuperar la sesión; no volver a solicitar permisos automáticamente.
  useEffect(() => {
    if (!sesion || typeof Notification === 'undefined') return undefined;
    if (localStorage.getItem(DEVICE_OPT_IN_KEY) !== 'yes' || Notification.permission !== 'granted') return undefined;
    let cancelado = false;
    (async () => {
      try {
        const token = await tokenDeEsteDispositivo();
        await registrarEnServidor(token, 'register');
        if (!cancelado) setHabilitado(true);
      } catch (err) {
        if (!cancelado) setError('No se pudo renovar el registro push: ' + (err.message || String(err)));
      }
    })();
    return () => { cancelado = true; };
  }, [sesion]);

  const activar = async () => {
    setError(''); setMensaje('');
    if (!sesion) { setError('Esperá a que inicie la sesión Firebase.'); return; }
    if (!('Notification' in window) || !('serviceWorker' in navigator)) {
      setError('Este navegador no admite notificaciones push.'); return;
    }
    if (!PUBLIC_VAPID) { setError('Falta configurar la clave pública Web Push en Netlify.'); return; }

    setOcupado(true);
    try {
      // Safari/iOS exige que el permiso se solicite a partir de una acción del usuario.
      const permiso = Notification.permission === 'granted'
        ? 'granted' : await Notification.requestPermission();
      if (permiso !== 'granted') throw new Error('El dispositivo no autorizó las notificaciones.');
      const token = await tokenDeEsteDispositivo();
      await registrarEnServidor(token, 'register');
      localStorage.setItem(DEVICE_OPT_IN_KEY, 'yes');
      setHabilitado(true);
      setMensaje('Notificaciones activadas. Este dispositivo se registró automáticamente en SII PALLETS.');
    } catch (err) {
      setError(err.message || String(err));
    } finally { setOcupado(false); }
  };

  const desactivar = async () => {
    setError(''); setMensaje(''); setOcupado(true);
    try {
      const token = await tokenDeEsteDispositivo();
      await registrarEnServidor(token, 'unregister');
      await deleteToken(getMessaging(getApp()));
      localStorage.removeItem(DEVICE_OPT_IN_KEY);
      setHabilitado(false);
      setMensaje('Notificaciones desactivadas en este dispositivo.');
    } catch (err) {
      setError(err.message || String(err));
    } finally { setOcupado(false); }
  };

  const comprobar = async () => {
    setError(''); setMensaje(''); setOcupado(true);
    try {
      if (!auth.currentUser) throw new Error('Esperá a que inicie Firebase.');
      const response = await fetch('/.netlify/functions/push-check', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + await auth.currentUser.getIdToken() }
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'No se pudo revisar el estado.');
      setMensaje('Movimientos revisados. Nuevos avisos detectados: ' + (data.eventos || 0) +
        '. Dispositivos registrados: ' + (data.dispositivos || 0) + '.');
    } catch (err) {
      setError(err.message || String(err));
    } finally { setOcupado(false); }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/55 z-[70] flex items-start sm:items-center justify-center p-3 overflow-auto">
      <section className="w-full max-w-md bg-white p-5 sm:p-7 rounded-3xl shadow-2xl my-auto space-y-4 text-slate-900"
        role="dialog" aria-modal="true" aria-label="Notificaciones push SII PALLETS">
        <div className="flex justify-between items-start gap-3">
          <div>
            <p className="text-[11px] font-extrabold tracking-[.15em] text-blue-700">SII PALLETS PRO</p>
            <h2 className="text-xl font-black mt-1">Notificaciones push</h2>
          </div>
          <button type="button" onClick={cerrar} aria-label="Cerrar"
            className="p-2 rounded-xl bg-slate-100">✕</button>
        </div>
        <p className="text-sm text-slate-600">
          Cada teléfono o computadora se registra automáticamente al activar las notificaciones.
          Recibirás avisos sobre cobros, pagos, cancelaciones y vencimientos próximos.
        </p>
        <div className={'rounded-xl p-3 text-sm border ' +
          (habilitado ? 'bg-emerald-50 border-emerald-200 text-emerald-800' :
            'bg-slate-50 border-slate-200 text-slate-700')}>
          <strong>{habilitado ? '✓ Push activo en este equipo' : 'Push pendiente de activación'}</strong>
          <p className="text-xs mt-1">No necesitás copiar UID ni configurar una variable por dispositivo.</p>
        </div>
        <button type="button" disabled={ocupado || !sesion} onClick={habilitado ? desactivar : activar}
          className={baseBtn + ' w-full ' + (habilitado ? 'bg-slate-100 text-slate-900' : 'bg-blue-700 text-white')}>
          {ocupado ? 'Procesando…' : habilitado ? 'Desactivar en este equipo' : 'Activar notificaciones'}
        </button>
        <button type="button" disabled={ocupado || !sesion} onClick={comprobar}
          className={baseBtn + ' w-full border border-slate-200 bg-white text-slate-800'}>
          Revisar movimientos y avisos
        </button>
        <p className="text-xs text-slate-500">
          En iPhone, instalá esta PWA en la pantalla de inicio y abrila desde ese ícono.
          El dispositivo debe aceptar el permiso push. El acceso a la app debe estar
          restringido al personal autorizado para proteger los datos financieros.
        </p>
        {mensaje && <p className="rounded-xl bg-emerald-50 text-emerald-900 p-3 text-sm" role="status">{mensaje}</p>}
        {error && <p className="rounded-xl bg-red-50 text-red-900 p-3 text-sm" role="alert">{error}</p>}
      </section>
    </div>
  );
}
