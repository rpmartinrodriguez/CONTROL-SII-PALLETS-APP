import test from 'node:test';
import assert from 'node:assert/strict';
import {leerBandejaGuardada,guardarBandeja,pendientesVisibles,tomarComoLeidas,descartar,llaveBandeja} from './estadoNotificaciones.js';
test('la bandeja conserva leídos y eliminados por UID, no los repite en el inicio',()=>{
 const m=new Map();const store={getItem:k=>m.get(k),setItem:(k,v)=>m.set(k,v)};
 assert.notEqual(llaveBandeja('A'),llaveBandeja('B'));
 const s=guardarBandeja('A',descartar(tomarComoLeidas({leidas:[],eliminadas:[]},['uno']),'dos'),store);
 assert.deepEqual(pendientesVisibles([{id:'uno'},{id:'dos'},{id:'tres'}],s).map(x=>x.id),['tres']);
 assert.deepEqual(leerBandejaGuardada('A',store).leidas,['uno']);
 assert.deepEqual(leerBandejaGuardada('B',store).leidas,[]);
});
