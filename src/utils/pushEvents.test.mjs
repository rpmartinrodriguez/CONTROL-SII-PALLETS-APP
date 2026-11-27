import test from 'node:test';
import assert from 'node:assert/strict';
import {eventForMovement,isRecentEventTime} from '../../netlify/lib/push-core.mjs';

const now=Date.parse('2026-11-17T15:00:00.000Z');
const reciente=new Date(now-30_000).toISOString();

test('solo genera notificación para un alta reciente de Cobros',()=>{
  const data={payee:'Cliente',number:'FC-123',amount:1200,createdAt:reciente};
  const event=eventForMovement('cobro','abc-1','create',data,now);
  assert.equal(event.category,'new_collect');
  assert.equal(event.title,'Nueva factura registrada');
  assert.match(event.body,/FC-123/);
  assert.equal(eventForMovement('cobro','abc-1','create',data,now)?.id,event.id);
  assert.equal(eventForMovement('cobro','abc-2','create',data,now)?.id===event.id,false);
  assert.equal(eventForMovement('cobro','abc-1','create',{...data,createdAt:'2021-01-01T00:00:00.000Z'},now),null);
});

test('distingue cancelación PARCIAL y total con historial real de pagos',()=>{
  const base={amount:1000,number:'FC-124',payee:'Cliente',paymentHistory:[{date:reciente,amount:400}]};
  const parcial=eventForMovement('cobro','abc','payment',{...base,paidAmount:400,status:'partial'},now);
  assert.equal(parcial.category,'partial_collect');
  assert.match(parcial.title,/PARCIAL/);
  const total=eventForMovement('cobro','abc','payment',{...base,paidAmount:1000,status:'paid'},now);
  assert.equal(total.category,'paid_collect');
  assert.equal(eventForMovement('cobro','abc','payment',{...base,paidAmount:0},now),null);
});

test('presupuesto nuevo y pagos avanzados no requieren escanear colecciones',()=>{
  const presupuesto=eventForMovement('presupuesto','0005-00000555','create',{
    guardadoEn:{toMillis:()=>now},totalCentavos:100000,cliente:{razonSocial:'Cliente'}
  },now);
  assert.equal(presupuesto.category,'new_quote');
  assert.equal(presupuesto.title,'Nueva cotización registrada');
  assert.match(presupuesto.body,/0005-00000555/);
  assert.equal(eventForMovement('presupuesto','0005-00000555','payment',{},now),null);
  const avanzado=eventForMovement('pago_avanzado','78','payment',{
    estado:'PAGADO',modificadoEn:reciente,importe:250,nombre:'Proveedor',nro:'REC-5'
  },now);
  assert.equal(avanzado.category,'paid_pay');
  assert.equal(eventForMovement('pago_avanzado','78','payment',{estado:'PENDIENTE',modificadoEn:reciente},now),null);
});

test('rechaza eventos sin fecha verificable y fechas futuras',()=>{
  assert.equal(isRecentEventTime('',now),false);
  assert.equal(isRecentEventTime('2022-01-01T00:00:00Z',now),false);
  assert.equal(isRecentEventTime(new Date(now+3600_000).toISOString(),now),false);
});
