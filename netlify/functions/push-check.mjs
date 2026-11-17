import { verifyAuthorized, jsonResponse, syncPush, isQuotaExceeded } from '../lib/push-core.mjs';

export default async function handler(request) {
  if(request.method!=='POST')return jsonResponse(405,{error:'Método no permitido'});
  try {
    if(request.headers.get('origin') && request.headers.get('origin')!==new URL(request.url).origin)return jsonResponse(403,{error:'Origen no autorizado'});
    await verifyAuthorized(request);
    const result=await syncPush();
    return jsonResponse(200,{ok:true,...result,eventos:result.cambiosDetectados});
  }catch(error){
    console.error('SII push-check:',error?.code||'',error?.message||String(error));
    if (isQuotaExceeded(error)) return jsonResponse(429, {
      code:'FIRESTORE_QUOTA',
      error:'No hay cuota suficiente en Firestore para revisar movimientos. Se intentará nuevamente cuando se restablezca.'
    });
    return jsonResponse(503,{error:error?.message||'Push no disponible'});
  }
}
