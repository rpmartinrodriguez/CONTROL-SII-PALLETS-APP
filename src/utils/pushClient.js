// Cola liviana de avisos sobre movimientos efectivamente guardados.
// Solo viajan el tipo de comprobante, su ID y la acción. El servidor lee
// ese documento exacto en Firebase y valida si corresponde una notificación.
import { auth } from '../firebase';

const STORE='sii_push_outbox_v1';
const TIPOS=new Set(['cobro','pago','pago_avanzado','presupuesto']);
const ACCIONES=new Set(['create','payment']);
const MAX_EN_COLA=100;
let cola=[];
try{
  const saved=JSON.parse(localStorage.getItem(STORE)||'[]');
  if(Array.isArray(saved))cola=saved.filter(x=>TIPOS.has(x.kind)&&ACCIONES.has(x.action)&&
    typeof x.id==='string'&&/^[A-Za-z0-9_-]{1,110}$/.test(x.id)).slice(-MAX_EN_COLA);
}catch{/* Almacenamiento local opcional */}
let pendiente=null;
let ejecutando=false;
let pausaHasta=0;
let reintentos=0;

const guardar=()=>{
  try{localStorage.setItem(STORE,JSON.stringify(cola));}catch{/* No bloquear la app */}
};
function programar(ms=1500){
  if(pendiente)clearTimeout(pendiente);
  const espera=Math.max(ms,pausaHasta-Date.now());
  pendiente=setTimeout(()=>{pendiente=null;void enviarPendientes();},espera);
}
async function enviarPendientes(){
  if(ejecutando||!cola.length)return;
  if(Date.now()<pausaHasta){programar(pausaHasta-Date.now());return;}
  if(!auth.currentUser){programar(5000);return;}
  ejecutando=true;
  try{
    while(cola.length){
      const event=cola[0];
      const response=await fetch('/.netlify/functions/push-check',{
        method:'POST',
        headers:{'Content-Type':'application/json',Authorization:'Bearer '+await auth.currentUser.getIdToken()},
        body:JSON.stringify(event),
        cache:'no-store'
      });
      const result=await response.json().catch(()=>({}));
      if(response.ok){
        cola.shift();guardar();reintentos=0;
        if(result.evento==='sin_dispositivos')console.warn('Push SII: todavía no hay teléfonos registrados.');
        continue;
      }
      if(response.status===400){
        console.warn('Push SII: se descartó un evento inválido:',result.error||'HTTP 400');
        cola.shift();guardar();continue;
      }
      const quota=response.status===429||result.code==='FIRESTORE_QUOTA';
      pausaHasta=Date.now()+(quota?30*60*1000:Math.min(5*60*1000,15000*2**Math.min(4,reintentos++)));
      console.warn('Push SII pendiente · HTTP '+response.status+':',result.error||'Servicio no disponible');
      break;
    }
  }catch(error){
    pausaHasta=Date.now()+Math.min(5*60*1000,15000*2**Math.min(4,reintentos++));
    console.warn('Push SII diferido por conexión:',error?.message||String(error));
  }finally{
    ejecutando=false;
    if(cola.length)programar(Math.max(1500,pausaHasta-Date.now()));
  }
}
export function solicitarChequeoPush(evento){
  if(!evento||!TIPOS.has(evento.kind)||!ACCIONES.has(evento.action)||
    typeof evento.id!=='string'||!/^[A-Za-z0-9_-]{1,110}$/.test(evento.id))return false;
  const simple={kind:evento.kind,id:evento.id,action:evento.action};
  const key=e=>e.kind+':'+e.id+':'+e.action;
  if(!cola.some(e=>key(e)===key(simple))){
    cola.push(simple);
    cola=cola.slice(-MAX_EN_COLA);
    guardar();
  }
  programar();
  return true;
}
if(typeof window!=='undefined'){
  window.addEventListener('online',()=>{if(cola.length)programar(1000);});
  if(cola.length)programar(3000);
}
