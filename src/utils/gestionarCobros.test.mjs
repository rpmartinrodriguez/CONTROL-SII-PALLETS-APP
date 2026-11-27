import test from 'node:test';
import assert from 'node:assert/strict';
import {anularCobrosDeFactura,corregirMedioCobro,nombreMedioCobro} from './gestionarCobros.js';

const factura=()=>({
  id:'invoice-9',type:'collect',status:'paid',amount:1200,paidAmount:1200,
  paymentHistory:[
    {amount:500,method:'transfer',proof:'T1',date:'2026-11-20T12:00:00.000Z'},
    {amount:700,method:'cheque',proof:'CH2',date:'2026-11-21T12:00:00.000Z'}
  ],
  paymentDetails:{amount:700,method:'cheque',proof:'CH2',date:'2026-11-21T12:00:00.000Z'}
});

test('anular factura saldada restablece la deuda y deja historial de reversión',()=>{
  const original=factura();
  const snapshot=JSON.stringify(original);
  const change=anularCobrosDeFactura(original,'UID','2026-11-27T15:00:00.000Z');
  assert.equal(change.paidAmount,0);
  assert.equal(change.status,'pending');
  assert.deepEqual(change.paymentHistory,[]);
  assert.equal(change.paymentDetails,null);
  assert.equal(change.historialAnulacionesCobro[0].importeAnulado,1200);
  assert.equal(change.historialAnulacionesCobro[0].pagos.length,2);
  assert.equal(JSON.stringify(original),snapshot);
});

test('no se anulan pagos de una factura pendiente ni dos veces la misma factura',()=>{
  assert.throws(()=>anularCobrosDeFactura({...factura(),status:'partial'}),/cancelada/);
  assert.throws(()=>anularCobrosDeFactura({...factura(),status:'pending'}),/cancelada/);
});

test('editar medio y referencia no modifica importe, saldo ni estado y guarda auditoría',()=>{
  const original=factura(),snapshot=JSON.stringify(original);
  const change=corregirMedioCobro(original,0,original.paymentHistory[0],
    {method:'cash',proof:'Caja 1'},'UID','2026-11-27T15:00:00Z');
  assert.equal(change.paymentHistory[0].method,'cash');
  assert.equal(change.paymentHistory[0].proof,'Caja 1');
  assert.equal(change.paymentHistory[0].amount,500);
  assert.deepEqual(change.paymentDetails,original.paymentDetails);
  assert.equal(change.historialCorreccionesCobro[0].antes.method,'transfer');
  assert.equal(change.historialCorreccionesCobro[0].despues.method,'cash');
  assert.equal(JSON.stringify(original),snapshot);
  assert.equal(nombreMedioCobro('echeq'),'E-Cheq');
});

test('no cambia un cobro modificado desde otro dispositivo',()=>{
  const old=factura(), other={...old,paymentHistory:[{...old.paymentHistory[0],method:'cash'},old.paymentHistory[1]]};
  assert.throws(()=>corregirMedioCobro(other,0,old.paymentHistory[0],{method:'cheque',proof:''}),/otro equipo/);
  assert.throws(()=>corregirMedioCobro(old,4,old.paymentHistory[0],{method:'cash'}),/ya no existe/);
  assert.throws(()=>corregirMedioCobro(old,0,old.paymentHistory[0],{method:'other'}),/válido/);
});
