// Acceso temporal SOLO LECTURA a las bases de origen para exportar datos
// desde la nueva aplicación si Netlify original no muestra el menú.
// Firebase Web config no es clave privada. No se ejecutan escrituras en los orígenes.
import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const configControlCheque = {
  apiKey: "AIzaSyAuEXUQT99SdJ1YZMhQOU-C0DGjQ1aIWXY",
  authDomain: "controlcheque-19226.firebaseapp.com",
  projectId: "controlcheque-19226",
  storageBucket: "controlcheque-19226.firebasestorage.app",
  messagingSenderId: "659933757076",
  appId: "1:659933757076:web:28d285726e6cb9560fbe81"
};
const configPagos = {
  apiKey: "AIzaSyDPOTn7fe_XSjrzSl1iOwZyump1KBLOVH4",
  authDomain: "listapagos.firebaseapp.com",
  projectId: "listapagos",
  storageBucket: "listapagos.firebasestorage.app",
  messagingSenderId: "618616599468",
  appId: "1:618616599468:web:633f250cf658bed8920009"
};
function appOriginal(nombre, opciones) {
  return getApps().some(app => app.name === nombre) ? getApp(nombre) : initializeApp(opciones, nombre);
}

export async function conectarBasesOriginales() {
  const origen = appOriginal('sii-backup-principal-original', configControlCheque);
  const pagos = appOriginal('sii-backup-pagos-original', configPagos);
  // Misma autenticación anónima usada por la aplicación anterior.
  const sesionOriginal = getAuth(origen);
  if (!sesionOriginal.currentUser) await signInAnonymously(sesionOriginal);
  return { principalDb: getFirestore(origen), pagosDb: getFirestore(pagos) };
}
