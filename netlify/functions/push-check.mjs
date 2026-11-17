import { verifyAuthorized, jsonResponse, syncPushEvent, isQuotaExceeded } from '../lib/push-core.mjs';

// El móvil informa únicamente el tipo y el ID del movimiento ya guardado.
// Los datos financieros se validan en Firebase Admin y no en la petición.
export default async function handler(request) {
  if(request.method!=='POST')return jsonResponse(405,{error:'Método no permitido'});
  try{
    if(request.headers.get('origin') && request.headers.get('origin')!==new URL(request.url).origin){
      return jsonResponse(403,{error:'Origen no autorizado'});
    }
    await verifyAuthorized(request);
    const length=Number(request.headers.get('content-length')||0);
    if(length>2048)return jsonResponse(413,{error:'Solicitud demasiado grande'});
    const input=await request.json().catch(()=>null);
    if(!input||typeof input!=='object')return jsonResponse(400,{error:'Debe indicarse el comprobante guardado.'});
    const result=await syncPushEvent(input);
    return jsonResponse(200,{ok:true,...result});
  }catch(error){
    console.error('SII push-check:',error?.code||'',error?.message||String(error));
    if(isQuotaExceeded(error))return jsonResponse(429,{
      code:'FIRESTORE_QUOTA',error:'Firestore alcanzó el límite temporal de operaciones.'
    });
    return jsonResponse(error?.status===400?400:503,{
      code:error?.status===400?'PUSH_BAD_EVENT':'PUSH_CHECK_UNAVAILABLE',
      error:error?.status===400?'Evento de notificación inválido.':error?.message||'Push no disponible'
    });
  }
}
