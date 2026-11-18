import { createHash } from 'node:crypto';
import { cert, getApp, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';

export const sha = s => createHash('sha256').update(String(s)).digest('hex');
const MAX_EVENTS = 150;
const money = n => new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS',maximumFractionDigits:0}).format(Number(n)||0);
const isPaid = s => ['PAGADO','PAID','CANCELADO','COBRADO','SALDADO'].includes(String(s||'').toUpperCase());
// Las notificaciones permanecen desligadas del login hasta completar
// la activación coordinada de Firebase Authentication y Firestore Rules.
export const autoEnrollmentEnabled = () => process.env.SII_PUSH_AUTO_ENROLLMENT === 'true';
export const loginRequired = () => process.env.SII_LOGIN_REQUIRED==='true' ||
  process.env.VITE_SII_LOGIN_REQUIRED==='true';
export const allowedEmails = () => String(process.env.SII_ALLOWED_EMAILS ||
  process.env.VITE_SII_ALLOWED_EMAILS ||'').split(',').map(x=>x.trim().toLowerCase()).filter(Boolean);
export const isQuotaExceeded = error =>
  Number(error?.code) === 8 ||
  String(error?.code || '').toLowerCase() === 'resource-exhausted' ||
  /resource.exhausted|quota exceeded|cuota excedida|quota exhausted/i.test(String(error?.message || error?.details || ''));


export function firebaseAdmin() {
  const raw=process.env.SII_FIREBASE_SERVICE_ACCOUNT_JSON;
  if(!raw) throw Error('Falta SII_FIREBASE_SERVICE_ACCOUNT_JSON en Netlify');
  const key=JSON.parse(raw);
  if(key.project_id!=='sii-pallets-app') throw Error('Credencial de un proyecto distinto del Firebase nuevo');
  const app=getApps().length ? getApp() : initializeApp({credential:cert(key)});
  return {db:getFirestore(app),messaging:getMessaging(app),auth:getAuth(app)};
}
export async function verifyAuthorized(request) {
  if (!autoEnrollmentEnabled()) throw Error('La inscripción automática de push está desactivada en el servidor.');
  const token=(request.headers.get('authorization')||'').replace(/^Bearer /,'');
  if(!token) throw Error('Falta la sesión de Firebase');
  // Verificamos el ID token en el servidor y asociamos el dispositivo a su UID.
  // El token NO autoriza a un usuario ajeno: ese control debe existir en la app.
  const user=await firebaseAdmin().auth.verifyIdToken(token,true);
  if(!user.uid) throw Error('Sesión Firebase sin UID');
  // Habilitar este control junto con el login, la lista permitida y las reglas
  // de Firestore. El código del navegador nunca puede ser la barrera de acceso.
  if(loginRequired()){
    const emails=allowedEmails();
    if(!emails.length || user.firebase?.sign_in_provider!=='password' ||
       !emails.includes(String(user.email||'').toLowerCase())){
      const error=new Error('No tenés permiso para recibir notificaciones SII PALLETS.');
      error.status=403;
      throw error;
    }
  }
  return user.uid;
}
export const jsonResponse=(status,data)=>new Response(JSON.stringify(data),{
  status,headers:{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}
});
const normalize=(kind,id,obj)=>({
  key:kind+':'+id,kind,id:String(id),
  name:String(obj?.payee||obj?.nombre||'Sin nombre').slice(0,170),
  number:String(obj?.number||obj?.nro||'-').slice(0,90),
  amount:Number(obj?.amount??obj?.importe??0)||0,
  paidAmount:Number(obj?.paidAmount||0)||0,
  status:String(obj?.status||obj?.estado||'PENDIENTE').toUpperCase(),
  due:String(obj?.dueDate||obj?.fecha||obj?.date||'').slice(0,10)
});
// Un evento identifica un comprobante; los datos provienen exclusivamente de Firestore.
// No se acepta desde el navegador el cliente, el importe ni el texto de la notificación.
const EVENT_PATHS={
  cobro:'cobros_public_shared/main_list/items',
  pago:'cheques_public_shared/main_list/items',
  presupuesto:'historial_presupuestos_sii'
};
// Permite reintentar avisos que quedaron en la cola durante un corte o cuota agotada.
const RECENT_WINDOW_MS=48*60*60*1000;
export const isRecentEventTime=(value,now=Date.now())=>{
  const millis=typeof value?.toMillis==='function'?value.toMillis():
    typeof value==='string'||typeof value==='number'?new Date(value).getTime():NaN;
  return Number.isFinite(millis) && millis<=now+120000 && now-millis<=RECENT_WINDOW_MS;
};
export function eventForMovement(kind,id,action,record,now=Date.now()){
  if(!record||!['create','payment'].includes(action))return null;
  const number=String(record.number||record.nro||id).slice(0,90);
  const name=String(record.payee||record.nombre||record.cliente?.razonSocial||'Sin nombre').slice(0,170);
  const amount=kind==='presupuesto'?(Number(record.totalCentavos)||0)/100:
    Number(record.amount??record.importe??0)||0;
  const ref=' · Ref. '+number;
  const cobro=kind==='cobro';
  if(action==='create'){
    const created=kind==='presupuesto'?record.guardadoEn:
      kind==='pago_avanzado'?record.creadoEn:record.createdAt;
    if(!isRecentEventTime(created,now))return null;
    return {
      id:'mov:'+kind+':'+id+':new:'+sha(String(created?.toMillis?.()??created)),
      category:kind==='presupuesto'?'new_quote':cobro?'new_collect':'new_pay',
      title:kind==='presupuesto'?'Nuevo presupuesto registrado':cobro?'Nuevo cobro registrado':'Nuevo pago registrado',
      body:name+' · '+money(amount)+(kind==='presupuesto'?' · Presupuesto '+number:ref)
    };
  }
  if(kind==='presupuesto')return null;
  if(kind==='pago_avanzado'){
    if(!['PAGADO','PAID'].includes(String(record.estado||'').toUpperCase())||
       !isRecentEventTime(record.modificadoEn,now))return null;
    return {
      id:'mov:pago_avanzado:'+id+':paid:'+sha(String(record.modificadoEn)),
      category:'paid_pay',title:'Pago cancelado / saldado',body:name+' · '+money(amount)+ref
    };
  }
  const history=Array.isArray(record.paymentHistory)?record.paymentHistory:[];
  const last=history[history.length-1];
  if(!last||!isRecentEventTime(last.date,now))return null;
  const payment=Number(last.amount)||0;
  const paid=Number(record.paidAmount)||0;
  if(payment<=0||paid<=0||amount<=0)return null;
  const settled=paid>=amount||isPaid(record.status||record.estado);
  const partial=!settled&&paid<amount;
  return {
    id:'mov:'+kind+':'+id+':'+(partial?'partial':'paid')+':'+sha(history.length+':'+String(last.date)+':'+payment),
    category:partial?(cobro?'partial_collect':'partial_pay'):(cobro?'paid_collect':'paid_pay'),
    title:partial?(cobro?'PARCIAL · Cobro registrado':'PARCIAL · Pago registrado'):
      (cobro?'Cobro cancelado / saldado':'Pago cancelado / saldado'),
    body:partial?name+' · PARCIAL '+money(payment)+' · Saldo '+money(amount-paid)+ref:
      name+' · '+money(payment)+ref
  };
}
function argDate() {
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Argentina/Buenos_Aires',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
  const p=Object.fromEntries(parts.map(x=>[x.type,x.value]));
  return p.year+'-'+p.month+'-'+p.day;
}
function plusDays(date,days) {
  const [y,m,d]=date.split('-').map(Number);
  return new Date(Date.UTC(y,m-1,d+days)).toISOString().slice(0,10);
}
async function getSubscribers(db) {
  if(!autoEnrollmentEnabled()) return [];
  const snap=await db.collection('sii_push_devices').where('enabled','==',true).get();
  return snap.docs.map(d=>d.data()).filter(x=>
    Boolean(x.uid)&&typeof x.token==='string'&&x.token.length>20&&
    (!loginRequired() || (x.authProvider==='password' &&
      allowedEmails().includes(String(x.userEmail||'').toLowerCase()))));
}
async function deliver(db,messaging,event,devices) {
  if(!devices.length)return 0;
  const ref=db.doc('sii_push_delivered/'+sha(event.id).slice(0,40));
  try {await ref.create({...event,status:'sending',createdAt:FieldValue.serverTimestamp()});}
  catch(error){if(error.code===6||error.code==='already-exists')return 0;throw error;}
  const tokens=[...new Set(devices.map(x=>x.token))];
  let sent=0;
  const errores=[];
  try{
    for(let i=0;i<tokens.length;i+=500) {
      const group=tokens.slice(i,i+500);
      const out=await messaging.sendEachForMulticast({
        tokens:group,
        data:{title:event.title,body:event.body,url:'/',category:event.category,eventId:sha(event.id).slice(0,20)}
      });
      sent+=out.successCount;
      for(let j=0;j<out.responses.length;j++){
        const error=out.responses[j].error;
        if(error) errores.push(String(error.code||error.message||'FCM_ERROR').slice(0,90));
        if(error&&['messaging/registration-token-not-registered','messaging/invalid-registration-token'].includes(error.code)) {
          await db.doc('sii_push_devices/'+sha(group[j]).slice(0,40)).set({enabled:false},{merge:true});
        }
      }
    }
    // FCM puede responder HTTP 200 aunque TODOS los tokens fallen.
    // En ese caso el evento NO debe figurar como entregado.
    await ref.update({
      status:sent>0?'sent':'error',
      sent,
      ...(errores.length?{error:errores.slice(0,4).join(', ').slice(0,300)}:{}),
      finishedAt:FieldValue.serverTimestamp()
    });
    return sent;
  }catch(error){
    await ref.update({status:'error',error:String(error.message||error).slice(0,300)});
    throw error;
  }
}
// Un comprobante = una lectura Firestore, sin barrer colecciones enteras.
export async function syncPushEvent(input){
  const kind=String(input?.kind||'');
  const id=String(input?.id||'');
  const action=String(input?.action||'');
  if(!['cobro','pago','pago_avanzado','presupuesto'].includes(kind)||
     !/^[A-Za-z0-9_-]{1,110}$/.test(id)||
     !['create','payment'].includes(action)||
     (kind==='presupuesto'&&action!=='create')){
    const error=new Error('Evento push inválido.');error.status=400;throw error;
  }
  const {db,messaging}=firebaseAdmin();
  const ref=kind==='pago_avanzado'?db.doc('finanzas/cheques'):
    db.doc(EVENT_PATHS[kind]+'/'+id);
  const docSnap=await ref.get();
  if(!docSnap.exists)return {evento:'no_encontrado',avisosEnviados:0,lecturasComprobantes:1};
  const record=kind==='pago_avanzado'?
    (Array.isArray(docSnap.data()?.data)?docSnap.data().data.find(x=>String(x.id)===id):null):
    docSnap.data();
  const event=eventForMovement(kind,id,action,record);
  if(!event)return {evento:'sin_cambios_notificables',avisosEnviados:0,lecturasComprobantes:1};
  const devices=await getSubscribers(db);
  if(!devices.length)return {evento:'sin_dispositivos',avisosEnviados:0,lecturasComprobantes:1};
  const sent=await deliver(db,messaging,event,devices);
  return {evento:event.category,avisosEnviados:sent,dispositivos:devices.length,lecturasComprobantes:1};
}

// Revisión diaria SOLO de comprobantes con vencimiento exacto dentro de dos días.
// Se consulta el documento agregado de Pagos Avanzados una única vez.
export async function syncPush(){
  const {db,messaging}=firebaseAdmin();
  const devices=await getSubscribers(db);
  if(!devices.length)return {cambiosDetectados:0,avisosEnviados:0,dispositivos:0,verificado:argDate()};
  const day=plusDays(argDate(),2);
  const cobros=db.collection(EVENT_PATHS.cobro);
  const pagos=db.collection(EVENT_PATHS.pago);
  const queries=[];
  for(const [kind,col] of [['cobro',cobros],['pago',pagos]]){
    for(const field of ['dueDate','date','fecha']){
      queries.push(col.where(field,'==',day).get().then(snapshot=>
        snapshot.docs.map(d=>normalize(kind,d.id,d.data()))));
    }
  }
  const advanced= db.doc('finanzas/cheques').get();
  const [results,advanceSnap]=await Promise.all([Promise.all(queries),advanced]);
  const byId=new Map(results.flat().map(item=>[item.key,item]));
  for(const [i,obj] of (Array.isArray(advanceSnap.data()?.data)?advanceSnap.data().data:[]).entries()){
    const item=normalize('pago_avanzado',obj.id??i,obj);
    if(item.due===day)byId.set(item.key,item);
  }
  let sent=0,changes=0;
  for(const item of byId.values()){
    if(isPaid(item.status)||item.due!==day)continue;
    const cobro=item.kind==='cobro';
    const event={
      id:'vence:'+item.key+':'+day,
      category:cobro?'due_collect':'due_pay',
      title:cobro?'Cobro vence en 2 días':'Pago vence en 2 días',
      body:item.name+' · '+money(item.amount-item.paidAmount)+' · Ref. '+item.number+' · '+day
    };
    changes++;
    sent+=await deliver(db,messaging,event,devices);
  }
  return {cambiosDetectados:changes,avisosEnviados:sent,dispositivos:devices.length,verificado:argDate(),revisados:byId.size};
}
