import {firebaseAdmin,verifyAuthorized,jsonResponse,isQuotaExceeded} from '../lib/push-core.mjs';

// Bandeja de eventos ya emitidos por el sistema push existente. SOLO lectura.
// Exige una sesión autorizada y por lo menos un dispositivo push registrado
// con el mismo UID; no habilita escritura sobre movimientos ni cambia el emisor.
export default async function handler(request){
  if(request.method!=='GET')return jsonResponse(405,{error:'Método no permitido'});
  try{
    const origin=request.headers.get('origin');
    if(origin && origin!==new URL(request.url).origin)return jsonResponse(403,{error:'Origen no autorizado'});
    const uid=await verifyAuthorized(request);
    const {db}=firebaseAdmin();
    const devices=await db.collection('sii_push_devices').where('uid','==',uid).limit(15).get();
    if(!devices.docs.some(d=>d.data()?.enabled===true))return jsonResponse(403,{error:'Activá las notificaciones para consultar la bandeja.'});
    const snapshot=await db.collection('sii_push_delivered').orderBy('createdAt','desc').limit(40).get();
    const cutoff=Date.now()-30*24*60*60*1000;
    const items=snapshot.docs.filter(d=>d.data()?.status==='sent' && (d.data()?.sent||0)>0).map(doc=>{
      const data=doc.data();
      const originalId=String(data.id||'');
      const m=originalId.match(/^(?:mov|vence|eliminado):(cobro|pago|pago_avanzado):([^:]+):/);
      return {
        id:doc.id,
        titulo:String(data.title||'Aviso de SII PALLETS').slice(0,120),
        detalle:String(data.body||'').slice(0,450),
        categoria:String(data.category||'').slice(0,80),
        tipo:m?.[1]||'',
        movimientoId:m?.[2]||'',
        creadoEn:data.createdAt?.toMillis?.()||0
      };
    }).filter(item=>item.creadoEn>=cutoff);
    return jsonResponse(200,{items,consultadoEn:Date.now()});
  }catch(error){
    console.error('SII push-inbox:',error?.code||'',error?.message||error);
    if(isQuotaExceeded(error))return jsonResponse(429,{code:'FIRESTORE_QUOTA',error:'La cuota de Firestore se agotó temporalmente.'});
    return jsonResponse(403,{error:'No se pudo consultar la bandeja de notificaciones.'});
  }
}
