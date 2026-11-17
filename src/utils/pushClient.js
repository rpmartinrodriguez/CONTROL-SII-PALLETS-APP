// Solicita la comparación de movimientos después de una escritura confirmada.
// No confía en valores del navegador: el servidor relee sii-pallets-app.
import { auth } from '../firebase';
export async function solicitarChequeoPush() {
  try {
    if(!auth.currentUser)return false;
    const response=await fetch('/.netlify/functions/push-check',{
      method:'POST',
      headers:{Authorization:'Bearer '+await auth.currentUser.getIdToken()}
    });
    return response.ok;
  }catch(error){
    console.warn('Aviso push diferido: ',error?.message||String(error));
    return false;
  }
}
