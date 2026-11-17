import test from 'node:test';
import assert from 'node:assert/strict';
import {agruparPresupuestosPorCliente,proximoNumeroDisponible,presupuestoCopia} from './historialPresupuestos.js';

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
