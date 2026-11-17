import test from 'node:test';
import assert from 'node:assert/strict';
import { esperarServiceWorkerActivo } from './pushServiceWorker.js';

test('No espera cuando el worker Firebase ya está activo', async () => {
  const registration={active:{state:'activated'}};
  assert.equal(await esperarServiceWorkerActivo(registration),registration);
});

test('Espera al evento de activación antes de permitir la suscripción', async () => {
  const worker=new EventTarget();
  worker.state='installing';
  const registration=new EventTarget();
  registration.active=null;
  registration.installing=worker;
  registration.waiting=null;
  const result=esperarServiceWorkerActivo(registration,150);
  queueMicrotask(()=>{
    worker.state='activated';
    registration.active=worker;
    registration.installing=null;
    worker.dispatchEvent(new Event('statechange'));
  });
  assert.equal(await result,registration);
});

test('Explica el error cuando el worker nunca llega a activarse', async () => {
  const worker=new EventTarget();
  worker.state='installing';
  const registration=new EventTarget();
  registration.active=null;
  registration.installing=worker;
  registration.waiting=null;
  await assert.rejects(
    esperarServiceWorkerActivo(registration,20),
    /No se activó el servicio/
  );
});
