// Conexión SOLO LECTURA a los documentos 'finanzas' del Firebase personal unificado.
// La autenticación y el Firestore son los mismos que usa la app principal.
import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';

export function usePagosReales(active = true) {
    const [state, setState] = useState({
        items: [], bancos: {}, loading: true, ready: false, error: '', bankError: ''
    });

    useEffect(() => {
        if (!active) return undefined;
        let live = true;
        const unsubCheques = onSnapshot(doc(db, 'finanzas', 'cheques'), snap => {
            if (!live) return;
            if (!snap.exists() || !Array.isArray(snap.data()?.data)) {
                setState(prev => ({...prev, items:[], loading:false, ready:false,
                    error:'La colección de Pagos no existe o no tiene el formato esperado; se omitieron cálculos.'}));
                return;
            }
            setState(prev => ({...prev, items:snap.data().data, loading:false, ready:true, error:''}));
        }, err => {
            if (!live) return;
            setState(prev => ({...prev, items:[], loading:false, ready:false,
                error:'No se pudieron leer los compromisos de Pagos: '+(err?.message||String(err))}));
        });
        const unsubBancos = onSnapshot(doc(db, 'finanzas', 'bancos'), snap => {
            if (!live) return;
            const data = snap.exists() ? snap.data()?.data : null;
            setState(prev => ({...prev, bancos:data && typeof data === 'object' ? data : {},bankError:''}));
        }, err => {
            if (live) setState(prev => ({...prev, bancos:{},bankError:'Sin información bancaria: '+(err?.message||String(err))}));
        });
        return () => {
            live=false;unsubCheques();unsubBancos();
        };
    }, [active]);

    return state;
}
