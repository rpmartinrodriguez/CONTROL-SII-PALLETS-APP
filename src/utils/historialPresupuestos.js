import {normalizarBusqueda} from './clientesPresupuesto.js';

export function agruparPresupuestosPorCliente(historial=[]){
  const map=new Map();
  for(const presupuesto of historial){
    const nombre=String(presupuesto?.cliente?.razonSocial||'Cliente sin identificar').trim();
    const clave=presupuesto.clienteId?'id:'+presupuesto.clienteId:'nombre:'+normalizarBusqueda(nombre);
    if(!map.has(clave))map.set(clave,{clave,nombre,clienteId:presupuesto.clienteId||'',presupuestos:[]});
    map.get(clave).presupuestos.push(presupuesto);
  }
  return [...map.values()].map(g=>({
    ...g,presupuestos:g.presupuestos.slice().sort((a,b)=>
      String(b.fecha||'').localeCompare(String(a.fecha||'')) ||
      String(b.numero||'').localeCompare(String(a.numero||''))
    )
  })).sort((a,b)=>a.nombre.localeCompare(b.nombre,'es-AR'));
}
export function proximoNumeroDisponible(historial=[],actual=502,local=502){
  let max=Math.max(Number(actual)||0,Number(local)||0);
  for(const presupuesto of historial){
    const m=String(presupuesto.numero||'').match(/^0005-(\d{8})$/);
    if(m)max=Math.max(max,Number(m[1])+1);
  }
  return Math.max(502,max);
}
export function presupuestoCopia(original,nuevoNumero,nuevaFecha,crearId){
  return {
    numero:nuevoNumero,fecha:nuevaFecha,cuenta:original.cuenta||'1',
    cliente:{razonSocial:'',cuit:'',domicilio:'',condicionIVA:'Responsable Inscripto',telefono:'',email:'',...original.cliente},
    items:(original.items||[]).map(item=>({
      id:crearId(),codigo:item.codigo||'',descripcion:item.descripcion||'',
      cantidad:String(item.cantidad??'1'),bultos:String(item.bultos??'0'),
      precioUnitario:String(item.precioUnitario??'')
    }))
  };
}
