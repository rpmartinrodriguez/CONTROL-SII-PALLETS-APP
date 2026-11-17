import React, { useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { getApp } from 'firebase/app';
import { getMessaging, getToken, isSupported } from 'firebase/messaging';
import { auth } from '../firebase';
import { esperarServiceWorkerActivo } from '../utils/pushServiceWorker';

const VAPID_PUBLICA = import.meta.env.VITE_SII_FCM_VAPID_PUBLIC || '';
const OPT_IN = 'sii_pallets_push_opt_in_v2';

async function tokenDeEsteEquipo() {
  if (!VAPID_PUBLICA) throw new Error('Falta configurar la clave pública VAPID en Netlify.');
  if (!('serviceWorker' in navigator) || !(await isSupported())) {
    throw new Error('Este navegador no admite Firebase Web Push.');
  }

  // Registrar no significa que esté activo. Esperamos específicamente
  // al SW de Firebase, no al Service Worker general de la PWA.
  const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
    scope: '/firebase-push-scope',
    updateViaCache: 'none'
  });
  await esperarServiceWorkerActivo(registration);

  const token = await getToken(getMessaging(getApp()), {
    vapidKey: VAPID_PUBLICA,
    serviceWorkerRegistration: registration
  });
  if (!token) throw new Error('Firebase no entregó el token de notificaciones.');
  return token;
}

async function llamarPush(path, payload) {
  const usuario = auth.currentUser;
  if (!usuario) throw new Error('La sesión Firebase todavía no está lista.');
  const response = await fetch('/.netlify/functions/' + path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + await usuario.getIdToken()
    },
    body: JSON.stringify(payload)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Error en el servicio de notificaciones.');
  return data;
}

async function registrar(token) {
  return llamarPush('push-register', {
    action: 'register', token,
    deviceName: navigator.userAgentData?.platform || navigator.platform || 'Equipo web',
    userAgent: navigator.userAgent
  });
}

export default function PushControl({ cerrar }) {
  const [sesion, setSesion] = useState(Boolean(auth.currentUser));
  const [activado, setActivado] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [estado, setEstado] = useState('');
  const [error, setError] = useState('');

  useEffect(() => onAuthStateChanged(auth, user => setSesion(Boolean(user))), []);

  useEffect(() => {
    if (!sesion || typeof Notification === 'undefined') return undefined;
    if (localStorage.getItem(OPT_IN) !== 'yes' || Notification.permission !== 'granted') return undefined;
    let cancelado = false;
    (async () => {
      try {
        const token = await tokenDeEsteEquipo();
        await registrar(token);
        if (!cancelado) setActivado(true);
      } catch (err) {
        if (!cancelado) setError(err?.message || String(err));
      }
    })();
    return () => { cancelado = true; };
  }, [sesion]);

  const activar = async () => {
    if (ocupado || activado) return;
    setError(''); setEstado('');
    if (!sesion) return setError('Esperá a que inicie la sesión de Firebase.');
    if (typeof Notification === 'undefined' || !('serviceWorker' in navigator)) {
      return setError('Este dispositivo no admite notificaciones Web Push.');
    }
    if (!VAPID_PUBLICA) return setError('Falta la clave VAPID pública en Netlify.');

    setOcupado(true);
    try {
      // El permiso se solicita directamente desde el botón, para Safari/iPhone.
      const permiso = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
      if (permiso !== 'granted') throw new Error('Tenés que permitir las notificaciones en el dispositivo.');
      const token = await tokenDeEsteEquipo();
      await registrar(token);
      localStorage.setItem(OPT_IN, 'yes');
      setActivado(true);
      setEstado('Notificaciones activadas.');
    } catch (err) {
      setError(err?.message || String(err));
    } finally {
      setOcupado(false);
    }
  };

  const probar = async () => {
    if (!activado || ocupado) return;
    setError(''); setEstado(''); setOcupado(true);
    try {
      const token = await tokenDeEsteEquipo();
      const result = await llamarPush('push-test', { token });
      setEstado(result.ok ? 'Prueba enviada a este dispositivo. Si tenés la app abierta, revisá el aviso dentro de la pantalla.' : 'No se pudo enviar la prueba.');
    } catch (err) {
      setError(err?.message || String(err));
    } finally {
      setOcupado(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/60 z-[70] flex items-center justify-center p-3">
      <section role="dialog" aria-modal="true" aria-label="Notificaciones push"
        className="w-full max-w-sm rounded-3xl bg-white p-5 sm:p-6 shadow-2xl text-slate-900 space-y-4">
        <div className="flex justify-between items-center gap-3">
          <h2 className="text-xl font-black">Notificaciones push</h2>
          <button type="button" onClick={cerrar} aria-label="Cerrar" className="p-2 rounded-xl bg-slate-100">✕</button>
        </div>
        <p className="text-sm text-slate-500">Recibí avisos de cobros, pagos y vencimientos.</p>

        {activado ? (
          <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 font-extrabold text-emerald-800 text-center" role="status">
            ✓ Notificaciones activadas
          </div>
        ) : (
          <button type="button" disabled={!sesion || ocupado} onClick={activar}
            className="w-full min-h-12 rounded-xl bg-blue-700 hover:bg-blue-800 text-white font-extrabold disabled:opacity-50">
            {ocupado ? 'Activando…' : 'Activar notificaciones'}
          </button>
        )}
        <button type="button" disabled={!activado || ocupado} onClick={probar}
          className="w-full min-h-12 rounded-xl border border-blue-200 bg-blue-50 text-blue-800 font-extrabold disabled:opacity-50">
          {ocupado && activado ? 'Enviando…' : 'Probar push'}
        </button>
        {estado && <p className="text-sm text-emerald-800 bg-emerald-50 rounded-xl p-3" role="status">{estado}</p>}
        {error && <p className="text-sm text-red-800 bg-red-50 rounded-xl p-3" role="alert">{error}</p>}
      </section>
    </div>
  );
}
