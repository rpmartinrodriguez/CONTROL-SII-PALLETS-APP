/* Push SII PALLETS: worker dedicado, separado del service worker PWA. */
importScripts('https://www.gstatic.com/firebasejs/10.8.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.1/firebase-messaging-compat.js');
firebase.initializeApp({
  apiKey:'AIzaSyDaM97K6kU48_RNtLIk7YRBeRp8dghmpFk',
  authDomain:'sii-pallets-app.firebaseapp.com',
  projectId:'sii-pallets-app',
  storageBucket:'sii-pallets-app.firebasestorage.app',
  messagingSenderId:'287028556134',
  appId:'1:287028556134:web:ba55d2bfead65e9ade18a7'
});
firebase.messaging().onBackgroundMessage(payload=>{
  const title=payload.data?.title||'SII PALLETS';
  const body=payload.data?.body||'Hay un movimiento nuevo.';
  self.registration.showNotification(title,{
    body,icon:'/logo.png',badge:'/logo.png',
    data:{url:payload.data?.url||'/'},tag:'sii-'+(payload.data?.eventId||payload.data?.category||'movimiento')
  });
});
self.addEventListener('notificationclick',event=>{
  event.notification.close();
  event.waitUntil(clients.matchAll({type:'window',includeUncontrolled:true}).then(list=>{
    const first=list.find(item=>new URL(item.url).origin===self.location.origin);
    if(first)return first.focus();
    return clients.openWindow('/');
  }));
});
