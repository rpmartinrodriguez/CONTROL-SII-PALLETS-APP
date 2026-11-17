import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {onAuthStateChanged} from 'firebase/auth';
import {getApp} from 'firebase/app';
import {getMessaging,isSupported,onMessage} from 'firebase/messaging';
import {auth} from '../firebase';
import {leerBandejaGuardada,guardarBandeja,pendientesVisibles,tomarComoLeidas,descartar} from '../utils/estadoNotificaciones';

export function useBandejaSii(){
  const [uid,setUid]=useState(auth.currentUser?.uid||'');
  const [items,setItems]=useState([]);
  const [estado,setEstado]=useState({leidas:[],eliminadas:[]});
  const [cargado,setCargado]=useState(false);
  const [inicioAbierto,setInicioAbierto]=useState(false);
  const [panelAbierto,setPanelAbierto]=useState(false);
  const revisadoEn=useRef(0);
  const iniciada=useRef(false);

  useEffect(()=>onAuthStateChanged(auth,user=>setUid(user?.uid||'')),[]);
  useEffect(()=>{
    setItems([]);setCargado(false);setInicioAbierto(false);setPanelAbierto(false);
    setEstado(leerBandejaGuardada(uid));
    revisadoEn.current=0;iniciada.current=false;
  },[uid]);

  const actualizar=useCallback(async(force=false)=>{
    if(!uid||!auth.currentUser||auth.currentUser.uid!==uid)return;
    if(!force && Date.now()-revisadoEn.current<60*1000)return;
    revisadoEn.current=Date.now();
    try{
      const res=await fetch('/.netlify/functions/push-inbox',{
        headers:{Authorization:'Bearer '+await auth.currentUser.getIdToken()}
      });
      if(!res.ok)return;
      const body=await res.json();
      if(!Array.isArray(body.items))return;
      setItems(body.items);
      setCargado(true);
    }catch(err){console.warn('Bandeja de avisos no disponible:',err?.message||String(err));}
  },[uid]);

  useEffect(()=>{
    if(!uid)return;
    void actualizar(true);
    const onFocus=()=>{if(document.visibilityState==='visible')void actualizar();};
    document.addEventListener('visibilitychange',onFocus);
    window.addEventListener('focus',onFocus);
    let stop=()=>{},alive=true;
    isSupported().then(supported=>{
      if(!supported||!alive)return;
      stop=onMessage(getMessaging(getApp()),()=>{
        // El backend terminó el envío; consultar el historial persistido.
        revisadoEn.current=0;void actualizar(true);
      });
    }).catch(()=>{});
    return ()=>{alive=false;stop();document.removeEventListener('visibilitychange',onFocus);window.removeEventListener('focus',onFocus);};
  },[uid,actualizar]);

  const pendientes=useMemo(()=>pendientesVisibles(items,estado),[items,estado]);
  useEffect(()=>{
    if(!cargado||iniciada.current)return;
    iniciada.current=true;
    if(pendientes.length>0)setInicioAbierto(true);
  },[cargado,pendientes]);

  const persist=useCallback(update=>{
    setEstado(old=>{
      const next=update(old);
      guardarBandeja(uid,next);
      return next;
    });
  },[uid]);
  const marcarLeida=useCallback(id=>persist(s=>tomarComoLeidas(s,[id])),[persist]);
  const eliminar=useCallback(id=>persist(s=>descartar(s,id)),[persist]);
  const cerrarInicio=useCallback(()=>{
    // El cuadro principal marca como vistos los avisos que presentó.
    const visible=pendientes.slice(0,6).map(x=>x.id);
    persist(s=>tomarComoLeidas(s,visible));
    setInicioAbierto(false);
  },[pendientes,persist]);
  return {
    items,pendientes,estado,cargado,inicioAbierto,panelAbierto,
    setInicioAbierto,setPanelAbierto,cerrarInicio,marcarLeida,eliminar,
    actualizar
  };
}
