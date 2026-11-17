import React, { useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { getApp } from 'firebase/app';
import { getMessaging, getToken, isSupported } from 'firebase/messaging';
import { auth } from '../firebase';
import { esperarServiceWorkerActivo } from '../utils/pushServiceWorker';

const VAPID_PUBLICA = import.meta.env.VITE_SII_FCM_VAPID_PUBLIC || '';
const OPT_IN = 'sii_pallets_push_opt_in_v2';
const CONFIRMADO_EN = 'sii_pallets_push_confirmado_en_v1';
const CACHE_MS = 12 * 60 * 60 * 1000;
const mensajeError = error => /registration failed|push service error|push service unavailable/i.test(String(error?.message||error))
  ? 'El navegador no pudo conectarse al servicio push del dispositivo (no es un error del registro de SII PALLETS en Firebase). Verificá conexión, actualizá Chrome y Servicios de Google Play en Android, desactivá VPN o ahorro de datos, y volvé a intentar. En iPhone, abrí la app instalada desde la pantalla de inicio, no desde una pestaña de Safari. Detalle técnico: '+String(error?.message||error)
  : /resource.exhausted|quota exceeded|firestore_quota/i.test(String(error?.message||''))
  ? 'Firebase agotó su cuota temporal de operaciones. Este equipo todavía no quedó registrado. Revisá Firestore → Uso y reintentá después del restablecimiento de cuota.'
  : String(error?.message||error);

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

  let token;
  try {
    token = await getToken(getMessaging(getApp()), {
      vapidKey: VAPID_PUBLICA,
      serviceWorkerRegistration: registration
    });
  } catch (error) {
    // El proveedor push del navegador (Chrome/FCM/APNs) puede fallar antes de
    // que Firebase entregue un token; no registrar estados falsos como activos.
    if (/registration failed|push service error/i.test(String(error?.message||error))) {
      const wrapped=new Error('No se pudo registrar el servicio push del navegador: '+String(error?.message||error));
      wrapped.code='BROWSER_PUSH_SERVICE';
      throw wrapped;
    }
    throw error;
  }
  if (!token) throw new Error('Firebase no entregó el token de notificaciones.');
  return token;
}

async function llamarPush(path, payload) {
  const usuario = auth.currentUser;
  if (!usuario) throw new Error('La sesión Firebase todavía no está lista.');
  let response;
  try {
    response = await fetch('/.netlify/functions/' + path, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + await usuario.getIdToken()
      },
      body: JSON.stringify(payload),
      cache: 'no-store'
    });
  } catch (err) {
    throw new Error('No se pudo conectar con Netlify. Revisá la conexión del equipo y que la app esté publicada. Detalle: '+(err?.message||'error de red'));
  }
  const raw = await response.text().catch(()=> '');
  let data = {};
  try { data = JSON.parse(raw) || {}; } catch { /* Netlify puede responder HTML ante una falla de función */ }
  const invalidJSON=!response.headers.get('content-type')?.includes('application/json');
  if (!response.ok || invalidJSON || data?.ok === false) {
    const requestId=response.headers.get('x-nf-request-id');
    const detalle=typeof data.error==='string'&&data.error ? data.error :
      invalidJSON ? 'Netlify no devolvió JSON. Posible función no publicada, error de runtime o redirección incorrecta.' :
      response.status===404 ? 'La función '+path+' no está disponible en el despliegue de Netlify.' :
      response.status===401||response.status===403 ? 'El servidor rechazó la sesión o la configuración de push está deshabilitada.' :
      response.status===429 ? 'Se alcanzó una cuota o límite temporal del servicio.' :
      response.status>=500 ? 'La función de Netlify falló al ejecutarse. Revisá Functions → Logs en Netlify.' :
      'El servidor devolvió una respuesta inesperada.';
    const error = new Error('HTTP '+response.status+' · '+detalle+
      (requestId?' · Netlify ID: '+requestId:''));
    error.code = data.code || String(response.status);
    throw error;
  }
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
    // Evitar una lectura/escritura en Firestore cada vez que se abre el modal.
    // El estado se guarda SOLO después de un registro exitoso del servidor.
    const confirmado = Number(localStorage.getItem(CONFIRMADO_EN)||0);
    if (confirmado > 0 && Date.now()-confirmado < CACHE_MS) {
      setActivado(true);
      return undefined;
    }
    let cancelado = false;
    (async () => {
      try {
        const token = await tokenDeEsteEquipo();
        await registrar(token);
        if (!cancelado) {
          localStorage.setItem(CONFIRMADO_EN,String(Date.now()));
          setActivado(true);
        }
      } catch (err) {
        if (!cancelado) {
          setActivado(false);
          setError(mensajeError(err));
        }
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
      localStorage.setItem(CONFIRMADO_EN, String(Date.now()));
      setActivado(true);
      setEstado('Notificaciones activadas.');
    } catch (err) {
      setError(mensajeError(err));
    } finally {
      setOcupado(false);
    }
  };

  const probar = async () => {
    if (!activado || ocupado) return;
    setError(''); setEstado(''); setOcupado(true);
    try {
      const token = await tokenDeEsteEquipo();
      // Verificar el registro antes de probar; un estado guardado localmente
      // no asegura que Firebase todavía reconozca el dispositivo.
      await registrar(token);
      localStorage.setItem(CONFIRMADO_EN,String(Date.now()));
      const result = await llamarPush('push-test', { token });
      setEstado(result.ok ? 'Firebase aceptó la prueba para este equipo. Revisá las notificaciones del teléfono.' : 'El servidor no confirmó el envío.');
    } catch (err) {
      const msg=mensajeError(err);
      if(/no está registrado|PUSH_DISABLED|inscripción automática|FCM_SEND_FAILED|HTTP 403|HTTP 409/i.test(msg)){
        setActivado(false);
        localStorage.removeItem(CONFIRMADO_EN);
      }
      setError(msg);
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
        <p className="text-sm text-slate-500">Recibí avisos de cobros, pagos, presupuestos y vencimientos.</p>

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
        {error && <div className="text-sm text-red-800 bg-red-50 rounded-xl p-3 space-y-2" role="alert">
          <p className="break-words">{error}</p>
          <button type="button" className="text-xs underline font-bold" onClick={()=>navigator.clipboard?.writeText(error)}>Copiar diagnóstico</button>
        </div>}
      </section>
    </div>
  );
}
