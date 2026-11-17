import { firebaseAdmin, verifyAuthorized, jsonResponse, sha, isQuotaExceeded } from '../lib/push-core.mjs';
import { FieldValue } from 'firebase-admin/firestore';

export default async function handler(request) {
  if(request.method!=='POST')return jsonResponse(405,{error:'Método no permitido'});
  try {
    // No se permite registro desde otros orígenes.
    if(request.headers.get('origin') && request.headers.get('origin')!==new URL(request.url).origin)return jsonResponse(403,{error:'Origen no autorizado'});
    const uid=await verifyAuthorized(request);
    const input=await request.json();
    if(!input||typeof input.token!=='string'||input.token.length<30||input.token.length>5000)return jsonResponse(400,{error:'Token de dispositivo inválido'});
    if(!['register','unregister'].includes(input.action))return jsonResponse(400,{error:'Acción inválida'});
    const db=firebaseAdmin().db;
    const ref=db.doc('sii_push_devices/'+sha(input.token).slice(0,40));
    if(input.action==='unregister'){
      const before=await ref.get();
      if(before.exists&&before.data().uid!==uid)return jsonResponse(403,{error:'Otro dispositivo registrado'});
      await ref.delete();
      return jsonResponse(200,{ok:true,registered:false});
    }
    const before=await ref.get();
    // Si este token ya está registrado y habilitado, no gastamos una escritura
    // en cada apertura del modal. El UID puede actualizarse si cambió la sesión.
    if(before.exists && before.data()?.uid===uid &&
       before.data()?.token===input.token && before.data()?.enabled===true){
      return jsonResponse(200,{ok:true,registered:true,alreadyRegistered:true});
    }
    const deviceName=String(input.deviceName||'Dispositivo web').slice(0,80);
    const userAgent=String(input.userAgent||'').slice(0,180);
    const record={
      uid,token:input.token,enabled:true,deviceName,userAgent,
      origin:new URL(request.url).origin,
      updatedAt:FieldValue.serverTimestamp()
    };
    if(!before.exists)record.createdAt=FieldValue.serverTimestamp();
    await ref.set(record,{merge:true});
    return jsonResponse(200,{ok:true,registered:true,deviceName});
  }catch(error){
    console.error('SII push-register:',error.code||'',error.message||String(error));
    if(isQuotaExceeded(error)){
      return jsonResponse(429,{
        error:'Firebase agotó temporalmente una cuota de operaciones. Este equipo todavía NO quedó registrado. Revisá Firestore → Uso y reintentá después de que se restablezca.',
        code:'FIRESTORE_QUOTA'
      });
    }
    return jsonResponse(403,{error:error?.message||'No se pudo registrar el equipo'});
  }
}
