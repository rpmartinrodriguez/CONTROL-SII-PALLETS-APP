// Gestión de cobros de facturas. Funciones puras: permiten probar cambios
// sin modificar la factura hasta que finalice la transacción Firestore.
export const MEDIOS_COBRO = Object.freeze([
  {id:'transfer',nombre:'Transferencia'},
  {id:'cheque',nombre:'Cheque'},
  {id:'echeq',nombre:'E-Cheq'},
  {id:'cash',nombre:'Efectivo'}
]);

export const nombreMedioCobro = id =>
  MEDIOS_COBRO.find(m=>m.id===id)?.nombre || String(id||'Sin medio');

export function anularCobrosDeFactura(factura,usuario='',fecha=new Date().toISOString()){
  if(!factura || factura.status!=='paid'){
    throw Error('La factura no está cancelada. Solo se pueden anular cobros de facturas saldadas.');
  }
  const pagos=Array.isArray(factura.paymentHistory)?factura.paymentHistory:[];
  const abonado=Number(factura.paidAmount)||Number(factura.amount)||0;
  if(abonado<=0)throw Error('La factura no tiene importe cobrado para anular.');
  const anteriores=Array.isArray(factura.historialAnulacionesCobro)?factura.historialAnulacionesCobro:[];
  return {
    paidAmount:0,
    status:'pending',
    paymentHistory:[],
    paymentDetails:null,
    historialAnulacionesCobro:[...anteriores,{
      fecha,usuario,importeAnulado:abonado,pagos:pagos.map(p=>({...p}))
    }],
    cobrosActualizadosEn:fecha
  };
}

export function corregirMedioCobro(factura,indice,anterior,nuevo,usuario='',fecha=new Date().toISOString()){
  if(!factura)throw Error('No se encontró la factura.');
  const pagos=Array.isArray(factura.paymentHistory)?factura.paymentHistory:[];
  if(!Number.isSafeInteger(indice)||indice<0||indice>=pagos.length){
    throw Error('El cobro ya no existe. Actualizá el historial.');
  }
  const registrado=pagos[indice];
  if(registrado.date!==anterior.date || Number(registrado.amount)!==Number(anterior.amount) ||
    registrado.method!==anterior.method || String(registrado.proof||'')!==String(anterior.proof||'')){
    throw Error('Este cobro cambió desde otro equipo. Volvé a abrir el historial.');
  }
  if(!MEDIOS_COBRO.some(m=>m.id===nuevo.method))throw Error('Seleccioná un medio de cobro válido.');
  const proof=String(nuevo.proof||'').trim().slice(0,180);
  const updated={...registrado,method:nuevo.method,proof};
  const historial=pagos.map((p,i)=>i===indice?updated:p);
  const cambios=Array.isArray(factura.historialCorreccionesCobro)?factura.historialCorreccionesCobro:[];
  const last=historial[historial.length-1];
  return {
    paymentHistory:historial,
    paymentDetails:last||null,
    historialCorreccionesCobro:[...cambios,{
      fecha,usuario,indice,fechaCobro:registrado.date,importe:registrado.amount,
      antes:{method:registrado.method,proof:registrado.proof||''},
      despues:{method:updated.method,proof:updated.proof}
    }],
    cobrosActualizadosEn:fecha
  };
}
