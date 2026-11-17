import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Proyecto Firebase personal de SII PALLETS (rama de migración).
// Todavía no contiene los datos migrados: no publicar en main hasta conciliar el respaldo.
const firebaseConfig = {
    apiKey: "AIzaSyDaM97K6kU48_RNtLIk7YRBeRp8dghmpFk",
    authDomain: "sii-pallets-app.firebaseapp.com",
    projectId: "sii-pallets-app",
    storageBucket: "sii-pallets-app.firebasestorage.app",
    messagingSenderId: "287028556134",
    appId: "1:287028556134:web:ba55d2bfead65e9ade18a7"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
