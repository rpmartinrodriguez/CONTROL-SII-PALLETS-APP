/**
 * Espera la activación real del Service Worker usado por FCM.
 * register() puede devolver registration antes de que exista un worker activo.
 * NO usa navigator.serviceWorker.ready: ese ready podría pertenecer al
 * Service Worker de la PWA, que tiene un scope distinto.
 */
export function esperarServiceWorkerActivo(registration, timeoutMs = 16000) {
  if (registration.active?.state === 'activated') return Promise.resolve(registration);
  return new Promise((resolve, reject) => {
    let finished = false;
    const observed = new Set();
    let timer;
    const cleanup = () => {
      clearTimeout(timer);
      registration.removeEventListener?.('updatefound', revisar);
      for (const worker of observed) worker.removeEventListener?.('statechange', revisar);
    };
    const finish = (error) => {
      if (finished) return;
      finished = true;
      cleanup();
      if (error) reject(error);
      else resolve(registration);
    };
    function revisar() {
      if (registration.active?.state === 'activated') return finish();
      for (const worker of [registration.installing, registration.waiting, registration.active]) {
        if (worker && !observed.has(worker)) {
          observed.add(worker);
          worker.addEventListener?.('statechange', revisar);
        }
      }
    }
    timer = setTimeout(() => finish(new Error(
      'No se activó el servicio de notificaciones. Cerrá y volvé a abrir la app e intentá nuevamente.'
    )), timeoutMs);
    registration.addEventListener?.('updatefound', revisar);
    revisar();
  });
}
