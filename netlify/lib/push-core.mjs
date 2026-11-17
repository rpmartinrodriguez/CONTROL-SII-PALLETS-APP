import { createHash } from 'node:crypto';
import { cert, getApp, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';

export const sha = s => createHash('sha256').update(String(s)).digest('hex');
const MAX_EVENTS = 150;
const money = n => new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS',maximumFractionDigits:0}).format(Number(n)||0);
const isPaid = s => ['PAGADO','PAID','CANCELADO','COBRADO','SALDADO'].includes(String(s||'').toUpperCase());
// Interruptor UNIVERSAL: se configura una sola vez, nunca por dispositivo.
// Se mantiene apagado hasta que el acceso a la aplicación esté restringido
// a personal autorizado. Firebase Anonymous NO demuestra esa autorización.
export const autoEnrollmentEnabled = () => process.env.SII_PUSH_AUTO_ENROLLMENT === 'true';
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
async function getData(db) {
  // Todos estos documentos pertenecen a sii-pallets-app. No se consulta otro proyecto.
  const [cobros,pagos,avanzados,presupuestos]=await Promise.all([
    db.collection('cobros_public_shared/main_list/items').get(),
    db.collection('cheques_public_shared/main_list/items').get(),
    db.doc('finanzas/cheques').get(),
    db.collection('historial_presupuestos_sii').get()
  ]);
  return {
    presupuestos:presupuestos.docs.map(d=>({
      key:'presupuesto:'+d.id,kind:'presupuesto',id:d.id,
      name:String(d.data()?.cliente?.razonSocial||'Sin cliente').slice(0,170),
      number:String(d.data()?.numero||d.id).slice(0,90),
      amount:(Number(d.data()?.totalCentavos)||0)/100,
      paidAmount:0,status:'EMITIDO',due:String(d.data()?.fecha||'').slice(0,10)
    })),
    cobros:cobros.docs.map(d=>normalize('cobro',d.id,d.data())),
    pagos:pagos.docs.map(d=>normalize('pago',d.id,d.data())),
    avanzados:Array.isArray(avanzados.data()?.data)
      ? avanzados.data().data.map((i,index)=>normalize('pago_avanzado',i.id??index,i)):[]
  };
}
function changed(current,prev) {
  if(current.kind==='presupuesto'){
    return prev?null:{
      category:'new_quote',title:'Nuevo presupuesto registrado',
      body:current.name+' · '+money(current.amount)+' · Presupuesto '+current.number
    };
  }
  const cobro=current.kind==='cobro';
  const ref=' · Ref. '+current.number;
  if(!prev) return {
    category:cobro?'new_collect':'new_pay',
    title:cobro?'Nuevo cobro registrado':'Nuevo pago registrado',
    body:current.name+' · '+money(current.amount)+ref
  };
  if(current.paidAmount>Number(prev.paidAmount||0) &&
     current.paidAmount>0 && current.paidAmount<current.amount &&
     !isPaid(current.status))return {
    category:cobro?'partial_collect':'partial_pay',
    title:cobro?'PARCIAL · Cobro registrado':'PARCIAL · Pago registrado',
    body:current.name+' · PARCIAL '+money(current.paidAmount-Number(prev.paidAmount||0))+
      ' · Saldo '+money(current.amount-current.paidAmount)+ref
  };
  if(!isPaid(prev.status)&&isPaid(current.status))return {
    category:cobro?'paid_collect':'paid_pay',
    title:cobro?'Cobro cancelado / saldado':'Pago cancelado / saldado',
    body:current.name+' · '+money(current.amount)+ref
  };
  return null;
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
  return snap.docs.map(d=>d.data()).filter(x=>Boolean(x.uid)&&typeof x.token==='string'&&x.token.length>20);
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
async function snapshotChanges(db,group,items) {
  const ref=db.doc('sii_push_snapshot/'+group);
  const current=Object.fromEntries(items.map(i=>[i.key,i]));
  if(JSON.stringify(current).length>850000)throw Error('Hay demasiados registros para el snapshot de '+group);
  return db.runTransaction(async tx=>{
    const snap=await tx.get(ref);
    const before=snap.data()?.items||{};
    const eventos=snap.exists ? items.flatMap(item=>{
      const event=changed(item,before[item.key]);
      return event?[{
        id:'mov:'+item.key+':'+event.category+':'+item.status+':'+sha(JSON.stringify(item)),
        ...event
      }]:[];
    }):[];
    // Detectar también anulación/eliminación, distinta de pago/saldo cancelado.
    if(snap.exists)for(const [key,prev] of Object.entries(before)){
      if(current[key])continue;
      if(prev.kind==='presupuesto')continue;
      const cobro=prev.kind==='cobro';
      eventos.push({
        id:'eliminado:'+key+':'+sha(JSON.stringify(prev)),
        category:cobro?'deleted_collect':'deleted_pay',
        title:cobro?'Cobro eliminado / anulado':'Pago eliminado / anulado',
        body:prev.name+' · '+money(prev.amount)+' · Ref. '+prev.number
      });
    }
    // El escaneo solo lee si no hay novedades. Anteriormente se escribían
    // tres documentos de snapshot en CADA comprobación, aun sin cambios.
    // En Spark eso consume cuota innecesariamente.
    if (!snap.exists || JSON.stringify(before) !== JSON.stringify(current)) {
      tx.set(ref,{items:current,updatedAt:FieldValue.serverTimestamp()});
    }
    return {baseline:!snap.exists,eventos};
  });
}
export async function syncPush() {
  const {db,messaging}=firebaseAdmin();
  const devices=await getSubscribers(db);
  // Sin equipos habilitados no consumimos eventos ni adelantamos los snapshots.
  // Así un fallo temporal de registro no descarta silenciosamente nuevos cobros.
  if(!devices.length)return {
    cambiosDetectados:0,avisosEnviados:0,gruposInicializados:0,
    dispositivos:0,sinDispositivos:true,verificado:argDate()
  };
  const datasets=await getData(db);
  let changes=0,sent=0,baselines=0;
  for(const [group,items] of Object.entries(datasets)) {
    const result=await snapshotChanges(db,group,items);
    if(result.baseline)baselines++;
    for(const event of result.eventos.slice(0,MAX_EVENTS)){
      changes++;sent+=await deliver(db,messaging,event,devices);
    }
  }
  const day=plusDays(argDate(),2);
  for(const item of Object.values(datasets).flat().filter(x=>x.kind!=='presupuesto'&&!isPaid(x.status)&&x.due===day).slice(0,MAX_EVENTS)){
    const cobro=item.kind==='cobro';
    const event={
      id:'vence:'+item.key+':'+day,
      category:cobro?'due_collect':'due_pay',
      title:cobro?'Cobro vence en 2 días':'Pago vence en 2 días',
      body:item.name+' · '+money(item.amount-item.paidAmount)+' · Ref. '+item.number+' · '+day
    };
    sent+=await deliver(db,messaging,event,devices);
  }
  return {cambiosDetectados:changes,avisosEnviados:sent,gruposInicializados:baselines,dispositivos:devices.length,verificado:argDate()};
}
