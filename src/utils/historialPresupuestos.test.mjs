import test from 'node:test';
import assert from 'node:assert/strict';
import {agruparPresupuestosPorCliente,separarPresupuestosPorEstado,estadoGestionPresupuesto,proximoNumeroDisponible,presupuestoCopia} from './historialPresupuestos.js';

test('agrupa cada presupuesto del mismo cliente y ordena por emisión',()=>{
 const g=agruparPresupuestosPorCliente([
  {id:'1',clienteId:'A',cliente:{razonSocial:'Manuchar'},fecha:'2026-11-01',numero:'0005-00000503'},
  {id:'2',clienteId:'A',cliente:{razonSocial:'Manuchar'},fecha:'2026-11-10',numero:'0005-00000506'},
  {id:'3',clienteId:'B',cliente:{razonSocial:'Otro'},fecha:'2026-11-02'}
 ]);
 assert.equal(g.length,2);
 assert.deepEqual(g.find(x=>x.nombre==='Manuchar').presupuestos.map(x=>x.id),['2','1']);
});
test('la copia mantiene valores pero asigna nuevo número y nuevos IDs',()=>{
 const origin={numero:'0005-00000506',fecha:'2026-11-10',cuenta:'2',cliente:{razonSocial:'Manuchar'},items:[{id:'viejo',descripcion:'Pallet',cantidad:20,precioUnitario:6500}]};
 const copy=presupuestoCopia(origin,'0005-00000507','2026-11-17',()=> 'nuevo');
 assert.equal(copy.numero,'0005-00000507');assert.equal(copy.fecha,'2026-11-17');
 assert.equal(copy.items[0].id,'nuevo');assert.equal(copy.items[0].precioUnitario,'6500');
 assert.equal(origin.items[0].id,'viejo');
});
test('numeración consulta historial guardado para evitar copiar con el mismo número',()=>{
 assert.equal(proximoNumeroDisponible([{numero:'0005-00000522'}],503,505),523);
});

test('presupuestos existentes sin estado aparecen como pendientes sin migración',()=>{
 const originales=[
  {numero:'0005-00000502',cliente:{razonSocial:'Cliente A'}},
  {numero:'0005-00000503',estadoGestion:'pendiente',cliente:{razonSocial:'Cliente A'}},
  {numero:'0005-00000504',estadoGestion:'realizado',notaGestion:'OC 144',cliente:{razonSocial:'Cliente B'}},
  {numero:'0005-00000505',estadoGestion:'otro',cliente:{razonSocial:'Cliente B'}}
 ];
 const copia=JSON.stringify(originales);
 const {pendientes,realizados}=separarPresupuestosPorEstado(originales);
 assert.deepEqual(pendientes.map(x=>x.numero),['0005-00000502','0005-00000503','0005-00000505']);
 assert.deepEqual(realizados.map(x=>x.numero),['0005-00000504']);
 assert.equal(estadoGestionPresupuesto(originales[0]),'pendiente');
 assert.equal(estadoGestionPresupuesto(originales[2]),'realizado');
 assert.equal(JSON.stringify(originales),copia);
 assert.equal(agruparPresupuestosPorCliente(realizados)[0].presupuestos[0].notaGestion,'OC 144');
});

test('la copia de un presupuesto realizado no hereda el estado ni la OC interna',()=>{
 const original={numero:'0005-00000504',estadoGestion:'realizado',notaGestion:'OC 302',
   cliente:{razonSocial:'Cliente B'},items:[{id:'i',descripcion:'Pallet',cantidad:1,precioUnitario:'1000'}]};
 const copia=presupuestoCopia(original,'0005-00000505','2026-11-25',()=> 'nuevo');
 assert.equal(copia.estadoGestion,undefined);
 assert.equal(copia.notaGestion,undefined);
 assert.equal(original.notaGestion,'OC 302');
});
