import React, { useEffect, useState } from 'react';
import { auth } from '../firebase';
import { getApp } from 'firebase/app';
import { getMessaging, getToken, isSupported, onMessage, deleteToken } from 'firebase/messaging';

const PUBLIC_VAPID = import.meta.env.VITE_SII_FCM_VAPID_PUBLIC || '';
const baseBtn = 'px-4 py-3 rounded-xl font-black text-sm disabled:opacity-50';
async function autorizacion() {
  const usuario = auth.currentUser;
  if (!usuario) throw Error('La sesión anónima todavía no está lista.');
  return usuario.getIdToken();
}
async function guardarDispositivo(token, action) {
  const idToken = await autorizacion();
  const response = await fetch('/.netlify/functions/push-register', {
    method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+idToken},
    body:JSON.stringify({action,token})
  });
  const data = await response.json().catch(()=>({error:'Respuesta inesperada'}));
  if (!response.ok) throw Error(data.error||'No se pudo registrar este dispositivo');
  return data;
}
export default function PushControl({cerrar}) {
  const [estado,setEstado]=useState(''), [error,setError]=useState(''), [cargando,setCargando]=useState(false);
  const [habilitado,setHabilitado]=useState(false);
  const [uid,setUid]=useState(auth.currentUser?.uid||'');
  useEffect(()=>{
    const u=auth.onAuthStateChanged(user=>setUid(user?.uid||''));
    return ()=>u();
  },[]);
  useEffect(()=>{
    let cancelado=false,unsubscribe=()=>{};
    (async()=>{
      if(!await isSupported())return;
      unsubscribe=onMessage(getMessaging(getApp()),mensaje=>{
        if(cancelado)return;
        setEstado((mensaje.data?.title||'SII PALLETS')+': '+(mensaje.data?.body||'Movimiento actualizado'));
      });
    })().catch(()=>{});
    return ()=>{cancelado=true;unsubscribe();};
  },[]);
  const activar=async()=>{
    setCargando(true);setError('');setEstado('');
    try {
      if(!PUBLIC_VAPID)throw Error('Falta VITE_SII_FCM_VAPID_PUBLIC en Netlify.');
      if(!('serviceWorker' in navigator)||!await isSupported())throw Error('Este navegador no admite notificaciones Firebase Web Push.');
      if(Notification.permission!=='granted'){
        const permiso=await Notification.requestPermission();
        if(permiso!=='granted')throw Error('El dispositivo no concedió permiso para notificaciones.');
      }
      const service=await navigator.serviceWorker.register('/firebase-messaging-sw.js',{scope:'/firebase-push-scope'});
      const token=await getToken(getMessaging(getApp()),{vapidKey:PUBLIC_VAPID,serviceWorkerRegistration:service});
      if(!token)throw Error('No se obtuvo un token push. Verificá los certificados Web Push de Firebase.');
      await guardarDispositivo(token,'register');
      setHabilitado(true);
      setEstado('Dispositivo registrado. Recibirás avisos cuando el servidor esté configurado.');
    }catch(e){setError(e.message||String(e));}
    finally{setCargando(false);}
  };
  const enviarPrueba=async()=>{
    setCargando(true);setError('');
    try{
      const response=await fetch('/.netlify/functions/push-check',{
        method:'POST',headers:{Authorization:'Bearer '+await autorizacion()}
      });
      const data=await response.json().catch(()=>({}));
      if(!response.ok)throw Error(data.error||'No se pudo comprobar la notificación');
      setEstado('Revisión de movimientos solicitada: '+(data.eventos||0)+' avisos nuevos.');
    }catch(e){setError(e.message||String(e));}
    finally{setCargando(false);}
  };
  return (
    <div className="fixed inset-0 bg-slate-950/55 z-[70] flex items-start sm:items-center justify-center p-3 overflow-auto">
      <section className="w-full max-w-md bg-white p-5 sm:p-7 rounded-3xl shadow-2xl my-auto space-y-4 text-slate-900" role="dialog" aria-modal="true" aria-label="Notificaciones push SII PALLETS">
        <div className="flex justify-between items-center gap-3">
          <div><p className="text-[11px] font-extrabold tracking-[.15em] text-blue-700">SII PALLETS PRO</p>
            <h2 className="text-xl font-black mt-1">Notificaciones push</h2></div>
          <button type="button" onClick={cerrar} aria-label="Cerrar" className="p-2 rounded-xl bg-slate-100">✕</button>
        </div>
        <p className="text-sm text-slate-600">Alertas por nuevos pagos y cobros, movimientos cancelados y vencimientos dos días antes, incluyendo importe, nombre y fecha. Se activan por dispositivo.</p>
        <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 text-xs">
          <span className="block font-bold text-slate-700">Identificador de sesión (UID)</span>
          <code className="block break-all my-1 text-[11px]">{uid||'Conectando…'}</code>
          <button className="underline font-bold text-blue-800" onClick={()=>navigator.clipboard?.writeText(uid)}>Copiar UID para autorizar este dispositivo en Netlify</button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <button type="button" disabled={cargando||!uid} onClick={activar} className={baseBtn+' bg-blue-700 text-white'}>{cargando?'Procesando…':habilitado?'Push registrado':'Activar notificaciones'}</button>
          <button type="button" disabled={cargando||!uid} onClick={enviarPrueba} className={baseBtn+' bg-slate-100 text-slate-900'}>Revisar movimientos</button>
        </div>
        <p className="text-xs text-slate-500">Para iPhone: instalá la PWA en la pantalla de inicio y abrila desde allí. Requiere HTTPS, permisos de notificaciones y configuración de Firebase Cloud Messaging.</p>
        {estado&&<p className="rounded-xl bg-emerald-50 text-emerald-900 p-3 text-sm" role="status">{estado}</p>}
        {error&&<p className="rounded-xl bg-red-50 text-red-900 p-3 text-sm" role="alert">{error}</p>}
      </section>
    </div>
  );
}
