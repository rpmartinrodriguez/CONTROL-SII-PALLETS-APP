import { firebaseAdmin, verifyAuthorized, jsonResponse, sha } from '../lib/push-core.mjs';
import { FieldValue } from 'firebase-admin/firestore';

export default async function handler(request) {
  if(request.method!=='POST')return jsonResponse(405,{error:'Método no permitido'});
  try {
    // No se permite registro desde otros orígenes.
    if(request.headers.get('origin')!==new URL(request.url).origin)return jsonResponse(403,{error:'Origen no autorizado'});
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
    if(before.exists&&before.data().uid!==uid)return jsonResponse(403,{error:'Este token pertenece a otra sesión'});
    await ref.set({uid,token:input.token,enabled:true,updatedAt:FieldValue.serverTimestamp()},{merge:true});
    return jsonResponse(200,{ok:true,registered:true});
  }catch(error){console.error('SII push-register:',error.message);return jsonResponse(403,{error:error.message||'Acceso no autorizado'});}
}
