// Service Worker de la PWA SII PALLETS, separado del worker FCM.
// La versión se inserta en el build de Netlify para detectar cada actualización.
const BUILD_VERSION = __SII_BUILD_VERSION__;
self.addEventListener('install', event => {
  event.waitUntil(self.skipWaiting());
});
self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim());
});
// Sin caché de documentos ni de Firebase: la app usa las últimas versiones
// publicadas por Netlify y mantiene Firestore en tiempo real.
