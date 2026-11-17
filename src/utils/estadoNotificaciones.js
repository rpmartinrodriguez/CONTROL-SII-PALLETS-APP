const prefix='sii_inbox_leidas_v1';
const MAX_IDS=400;
export const llaveBandeja=uid=>prefix+':'+String(uid||'sin-sesion');
export function leerBandejaGuardada(uid,storage=typeof localStorage==='undefined'?null:localStorage){
  try{
    const data=JSON.parse(storage?.getItem(llaveBandeja(uid))||'{}');
    return {leidas:Array.isArray(data.leidas)?data.leidas.slice(-MAX_IDS):[],
      eliminadas:Array.isArray(data.eliminadas)?data.eliminadas.slice(-MAX_IDS):[]};
  }catch{return {leidas:[],eliminadas:[]};}
}
export function guardarBandeja(uid,state,storage=typeof localStorage==='undefined'?null:localStorage){
  const data={leidas:[...new Set(state.leidas||[])].slice(-MAX_IDS),
    eliminadas:[...new Set(state.eliminadas||[])].slice(-MAX_IDS)};
  try{storage?.setItem(llaveBandeja(uid),JSON.stringify(data));}catch{}
  return data;
}
export function pendientesVisibles(items,state){
  const deleted=new Set(state.eliminadas),seen=new Set(state.leidas);
  return (items||[]).filter(x=>x?.id&&!deleted.has(x.id)&&!seen.has(x.id));
}
export function tomarComoLeidas(state,ids){
  return {...state,leidas:[...new Set([...state.leidas,...ids.filter(Boolean)])].slice(-MAX_IDS)};
}
export function descartar(state,id){
  return {...state,eliminadas:[...new Set([...state.eliminadas,id])].slice(-MAX_IDS)};
}
