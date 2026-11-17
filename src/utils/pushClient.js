// Agrupa los cambios confirmados de la app para evitar recorrer todos los
// documentos Firestore después de cada clic. Los importes nunca viajan aquí:
// Netlify relee exclusivamente sii-pallets-app.
import { auth } from '../firebase';

let pendiente = null;
let ejecutando = false;
let repetir = false;
let sinCuotaHasta = 0;

async function comprobarCambios() {
  pendiente = null;
  if (Date.now() < sinCuotaHasta || !auth.currentUser) return;
  if (ejecutando) {
    repetir = true;
    return;
  }
  ejecutando = true;
  try {
    const response = await fetch('/.netlify/functions/push-check', {
      method:'POST',
      headers: { Authorization:'Bearer ' + await auth.currentUser.getIdToken() }
    });
    const result=await response.json().catch(()=>({}));
    if (response.status === 429 && result.code!=='PUSH_TEST_COOLDOWN') {
      // No seguir agotando la base cuando Firestore informa cuota superada.
      sinCuotaHasta = Date.now() + 30 * 60 * 1000;
      console.warn('Push temporalmente pausado por cuota de Firestore:',result.error||'HTTP 429');
    } else if (!response.ok) {
      console.warn('SII push-check falló: HTTP '+response.status+' · '+(result.error||'Función Netlify no disponible'));
    } else if (result.sinDispositivos) {
      console.warn('SII push-check: no hay dispositivos activos para recibir avisos.');
    }
  } catch (error) {
    console.warn('Aviso push diferido:', error?.message || String(error));
  } finally {
    ejecutando = false;
    if (repetir && Date.now() >= sinCuotaHasta) {
      repetir = false;
      solicitarChequeoPush();
    } else repetir = false;
  }
}

export function solicitarChequeoPush() {
  if (!auth.currentUser || Date.now() < sinCuotaHasta) return false;
  if (pendiente) clearTimeout(pendiente);
  // Tres movimientos seguidos => una consulta, no tres.
  pendiente = setTimeout(() => { void comprobarCambios(); }, 3000);
  return true;
}
