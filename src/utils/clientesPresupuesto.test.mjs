import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizarBusqueda, coincideCliente, ultimoPrecioCliente } from './clientesPresupuesto.js';

test('el buscador de clientes ignora tildes y permite localizar por CUIT', () => {
  assert.equal(normalizarBusqueda('  MANÚCHAR  '), 'manuchar');
  assert.equal(coincideCliente({razonSocial:'Manúchar S.A.', cuit:'30-12345678-9'}, 'MANUCHAR'), true);
  assert.equal(coincideCliente({razonSocial:'Manuchar S.A.', cuit:'30-12345678-9'}, '12345678'), true);
});

test('recupera el último precio de un cliente y producto sin mezclar otros clientes', () => {
  const historial = [
    {id:'a',clienteId:'A',fecha:'2026-11-01',numero:'0005-00000050',items:[{codigo:'P-01',descripcion:'Pallet 100x120',precioUnitario:5200}]},
    {id:'b',clienteId:'B',fecha:'2026-11-15',numero:'0005-00000052',items:[{codigo:'P-01',descripcion:'Pallet 100x120',precioUnitario:7500}]},
    {id:'c',clienteId:'A',fecha:'2026-11-14',numero:'0005-00000053',items:[{codigo:'P-01',descripcion:'Pallet 100x120',precioUnitario:6300}]}
  ];
  assert.equal(ultimoPrecioCliente(historial,'A',{codigo:'P-01',descripcion:'Pallet 100x120'}).precioUnitario,6300);
  assert.equal(ultimoPrecioCliente(historial,'B',{codigo:'P-01',descripcion:'Pallet 100x120'}).precioUnitario,7500);
});

test('no sugiere un precio si no existe el producto para el cliente', () => {
  assert.equal(ultimoPrecioCliente([{clienteId:'A',items:[{codigo:'XX',precioUnitario:1}]}],'A',{codigo:'YY',descripcion:'Otro'}),null);
});
