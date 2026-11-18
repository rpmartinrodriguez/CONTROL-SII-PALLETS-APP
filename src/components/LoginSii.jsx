import React, {useState} from 'react';
import {browserLocalPersistence, setPersistence, signInWithEmailAndPassword} from 'firebase/auth';
import {auth} from '../firebase';

const errores={
  'auth/invalid-credential':'Correo o contraseña incorrectos.',
  'auth/wrong-password':'Correo o contraseña incorrectos.',
  'auth/user-not-found':'El usuario todavía no fue creado en Firebase Authentication.',
  'auth/operation-not-allowed':'Hay que habilitar Email/Password en Firebase Authentication.',
  'auth/too-many-requests':'Demasiados intentos. Probá más tarde.',
  'auth/network-request-failed':'No hay conexión con Firebase. Revisá Internet.'
};
export default function LoginSii(){
  const [email,setEmail]=useState('');
  const [password,setPassword]=useState('');
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const enviar=async event=>{
    event.preventDefault();
    if(busy)return;
    setBusy(true);setError('');
    try{
      await setPersistence(auth,browserLocalPersistence);
      await signInWithEmailAndPassword(auth,email.trim(),password);
      setPassword('');
    }catch(err){setError(errores[err?.code]||'No se pudo iniciar sesión. '+String(err?.code||''));}
    finally{setBusy(false);}
  };
  return <main className="min-h-[100dvh] flex items-center justify-center bg-slate-100 p-4">
    <section className="bg-white w-full max-w-md rounded-3xl shadow-xl border border-slate-200 p-6 sm:p-8 space-y-5" aria-label="Acceso SII PALLETS">
      <div className="flex items-center gap-4">
        <img src="/app-icon.svg" alt="SII PALLETS" className="h-16 w-16 rounded-2xl border border-slate-100 object-contain"/>
        <div><h1 className="text-2xl font-black text-slate-900">SII PALLETS</h1>
          <p className="text-sm font-semibold text-slate-500">Acceso al sistema de gestión</p></div>
      </div>
      <form onSubmit={enviar} className="space-y-4">
        <label className="block text-sm font-bold text-slate-700">Correo electrónico
          <input type="email" autoComplete="username" required value={email} onChange={e=>setEmail(e.target.value)}
            placeholder="usuario@empresa.com" className="mt-2 block w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500"/>
        </label>
        <label className="block text-sm font-bold text-slate-700">Contraseña
          <input type="password" autoComplete="current-password" required value={password} onChange={e=>setPassword(e.target.value)}
            className="mt-2 block w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500"/>
        </label>
        {error&&<p role="alert" className="rounded-xl bg-rose-50 text-rose-700 p-3 text-sm">{error}</p>}
        <button type="submit" disabled={busy} className="w-full rounded-xl bg-blue-800 hover:bg-blue-900 disabled:opacity-50 py-3.5 text-white font-extrabold">
          {busy?'Ingresando…':'Ingresar'}
        </button>
      </form>
      <p className="text-xs text-slate-500">Tu sesión permanece iniciada en este dispositivo hasta que cierres sesión o se revoque el acceso. Las notificaciones se habilitan por dispositivo.</p>
    </section>
  </main>;
}
