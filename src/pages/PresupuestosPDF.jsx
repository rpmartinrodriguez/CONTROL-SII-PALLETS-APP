import React, {useEffect,useMemo,useState,useRef} from 'react';
import { addDoc, collection, doc, onSnapshot, runTransaction, serverTimestamp, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { coincideCliente, normalizarBusqueda, ultimoPrecioCliente } from '../utils/clientesPresupuesto';
import { agruparPresupuestosPorCliente, proximoNumeroDisponible, presupuestoCopia } from '../utils/historialPresupuestos';
import { LOGO_PRESUPUESTO } from '../assets/logoPresupuesto';
import {
  EMISOR,ITEM_VACIO,COTIZACION_INICIO,numeroCotizacion,fechaHoyLocal,
  fechaAR,calcularPresupuesto,validarPresupuesto,pesosPDF
} from '../utils/presupuestosSii';
import {generarPdfPresupuesto,descargarPdf} from '../utils/generarPdfPresupuesto';

const SERIE_KEY='sii_presupuesto_pdf_correlativo_v1';
const getSequence=()=>{
  try{
    const n=Number(localStorage.getItem(SERIE_KEY));
    return Number.isSafeInteger(n)&&n>=COTIZACION_INICIO?n:COTIZACION_INICIO;
  }catch{return COTIZACION_INICIO;}
};
const initial=()=>({
  numero:numeroCotizacion(getSequence()),fecha:fechaHoyLocal(),cuenta:'1',
  cliente:{razonSocial:'',cuit:'',domicilio:'',condicionIVA:'Responsable Inscripto',telefono:'',email:''},
  items:[ITEM_VACIO()],nota:''
});
const input='block w-full border border-slate-200 rounded-xl px-3 py-2.5 bg-white text-sm text-slate-900 outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400';
const label='block text-xs font-bold text-slate-600 mb-1';
const peso = n => pesosPDF(n);
const userNotice='La numeración es automática y se consulta en la base compartida. Si otro equipo usa el número antes de guardar, se asigna el siguiente disponible.';
export default function PresupuestosPDF() {
  const [quote,setQuote]=useState(initial);
  const envioEnCurso=useRef(false);
  const [editandoNumero,setEditandoNumero]=useState('');
  const [guardadoVersion,setGuardadoVersion]=useState('');
  const [numeroAutomatico,setNumeroAutomatico]=useState(true);
  const [historialCargado,setHistorialCargado]=useState(false);
  const [busy,setBusy]=useState('');
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');
  const [showPreview,setShowPreview]=useState(true);
  const [clientes,setClientes]=useState([]);
  const [historial,setHistorial]=useState([]);
  const [clienteId,setClienteId]=useState('');
  const [sugerencias,setSugerencias]=useState(false);
  const [showClientes,setShowClientes]=useState(false);
  const [guardandoCliente,setGuardandoCliente]=useState(false);
  const [historialError,setHistorialError]=useState('');
  const [mostrarGuardados,setMostrarGuardados]=useState(false);
  const [clienteGuardadoAbierto,setClienteGuardadoAbierto]=useState('');
  const [preciosParaRevisar,setPreciosParaRevisar]=useState([]);
  useEffect(()=>{
    const unsubClientes=onSnapshot(collection(db,'clientes_presupuestos_sii'),snap=>{
      setClientes(snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>String(a.razonSocial||'').localeCompare(String(b.razonSocial||''))));
    },err=>setHistorialError('No se pudieron cargar clientes: '+err.message));
    const unsubHistorial=onSnapshot(collection(db,'historial_presupuestos_sii'),snap=>{
      setHistorial(snap.docs.map(d=>({id:d.id,...d.data()})));
      setHistorialCargado(true);
    },err=>setHistorialError('No se pudo cargar el historial: '+err.message));
    return ()=>{unsubClientes();unsubHistorial();};
  },[]);
  // El número sugerido procede del historial compartido, no del contador del equipo.
  // No se altera si el usuario decidió introducir manualmente otro número.
  useEffect(()=>{
    if(!historialCargado || !numeroAutomatico || busy || editandoNumero || guardadoVersion)return;
    const disponible=numeroCotizacion(proximoNumeroDisponible(historial,COTIZACION_INICIO,getSequence()));
    setQuote(q=>q.numero===disponible?q:{...q,numero:disponible});
  },[historial,historialCargado,numeroAutomatico,busy,editandoNumero,guardadoVersion]);
  const presupuestosCliente=useMemo(()=>{
    const nombre=normalizarBusqueda(quote.cliente.razonSocial);
    if(!nombre)return [];
    return historial.filter(p=>(clienteId&&p.clienteId===clienteId)||
      (quote.cliente.cuit&&p.cliente?.cuit&&normalizarBusqueda(p.cliente.cuit)===normalizarBusqueda(quote.cliente.cuit))||
      normalizarBusqueda(p.cliente?.razonSocial)===nombre)
      .sort((a,b)=>String(b.fecha||'').localeCompare(String(a.fecha||''))||String(b.numero||'').localeCompare(String(a.numero||'')));
  },[historial,clienteId,quote.cliente.razonSocial,quote.cliente.cuit]);
  const gruposGuardados=useMemo(()=>agruparPresupuestosPorCliente(historial),[historial]);
  const sugerirNumero=()=>numeroCotizacion(proximoNumeroDisponible(historial,
    Number(quote.numero?.split('-')[1])+1||COTIZACION_INICIO,getSequence()));
  const copiarGuardado=original=>{
    if(envioEnCurso.current)return;
    const numero=sugerirNumero();
    const copia=presupuestoCopia(original,numero,fechaHoyLocal(),()=>ITEM_VACIO().id);
    if(!copia.items.length)copia.items=[ITEM_VACIO()];
    setNumeroAutomatico(true);
    setEditandoNumero('');setGuardadoVersion('');
    setQuote(copia);
    setClienteId(original.clienteId||clientes.find(c=>
      normalizarBusqueda(c.razonSocial)===normalizarBusqueda(original.cliente?.razonSocial))?.id||'');
    setPreciosParaRevisar(copia.items.map(x=>x.id));
    setMostrarGuardados(false);setError('');
    setNotice('Presupuesto '+original.numero+' copiado como '+numero+'. Revisá los precios marcados en rojo antes de emitir el nuevo PDF.');
    requestAnimationFrame(()=>document.getElementById('sii-presupuesto-editor')?.scrollIntoView({behavior:'smooth',block:'start'}));
  };
  const sugeridos=useMemo(()=>clientes.filter(c=>coincideCliente(c,quote.cliente.razonSocial)).slice(0,7),[clientes,quote.cliente.razonSocial]);
  const preciosPrevios=useMemo(()=>Object.fromEntries(quote.items.map(item=>[
    item.id,ultimoPrecioCliente(historial,clienteId,item,quote.cliente.razonSocial)
  ])),[historial,clienteId,quote.items,quote.cliente.razonSocial]);
  const totals=useMemo(()=>{
    try{return {data:calcularPresupuesto(quote),error:''};}
    catch(e){return {data:null,error:e.message};}
  },[quote]);
  const setCustomer=(key,value)=>{
    if(key==='razonSocial')setClienteId('');
    setQuote(q=>({...q,cliente:{...q.cliente,[key]:value}}));
  };
  const seleccionarCliente=cliente=>{
    setClienteId(cliente.id);
    setQuote(q=>({...q,cliente:{
      razonSocial:cliente.razonSocial||'',cuit:cliente.cuit||'',domicilio:cliente.domicilio||'',
      condicionIVA:cliente.condicionIVA||'Responsable Inscripto',
      telefono:cliente.telefono||'',email:cliente.email||''
    }}));
    setSugerencias(false);
    setNotice('Datos de '+cliente.razonSocial+' autocompletados.');
  };
  const guardarCliente=async()=>{
    const cliente={...quote.cliente,razonSocial:quote.cliente.razonSocial.trim()};
    if(!cliente.razonSocial){setError('Ingresá un nombre o razón social antes de guardar.');return;}
    setGuardandoCliente(true);setError('');
    try{
      const existente=clienteId ? clientes.find(c=>c.id===clienteId)
        : clientes.find(c=>(cliente.cuit&&normalizarBusqueda(c.cuit)===normalizarBusqueda(cliente.cuit))||
          normalizarBusqueda(c.razonSocial)===normalizarBusqueda(cliente.razonSocial));
      if(existente){
        await updateDoc(doc(db,'clientes_presupuestos_sii',existente.id),{...cliente,actualizadoEn:serverTimestamp()});
        setClienteId(existente.id);
      }else{
        const referencia=await addDoc(collection(db,'clientes_presupuestos_sii'),{...cliente,creadoEn:serverTimestamp()});
        setClienteId(referencia.id);
      }
      setNotice('Cliente guardado en la base de SII PALLETS.');
      setSugerencias(false);
    }catch(err){setError('No se pudo guardar el cliente: '+err.message);}
    finally{setGuardandoCliente(false);}
  };
  const guardarHistorial=async (presupuesto,total)=>{
    const referencia=doc(db,'historial_presupuestos_sii',presupuesto.numero);
    const original={
      nota:String(presupuesto.nota||'').slice(0,100),
      numero:presupuesto.numero,fecha:presupuesto.fecha,cuenta:presupuesto.cuenta,
      clienteId:clienteId||null,cliente:{...presupuesto.cliente},
      items:presupuesto.items.map(({id,codigo,descripcion,cantidad,bultos,precioUnitario})=>({id,codigo,descripcion,cantidad,bultos,precioUnitario})),
      totalCentavos:total.totalCentavos
    };
    await runTransaction(db,async transaccion=>{
      const previo=await transaccion.get(referencia);
      if(previo.exists()){
        const anterior=previo.data();
        if(editandoNumero===presupuesto.numero){
          transaccion.update(referencia,{...original,actualizadoEn:serverTimestamp()});
        }else if(JSON.stringify({...anterior,guardadoEn:undefined,actualizadoEn:undefined,nota:anterior.nota||''})!==JSON.stringify({...original,guardadoEn:undefined,actualizadoEn:undefined})){
          const error=new Error('Número de presupuesto ocupado');
          error.code='PRESUPUESTO_OCUPADO';
          throw error;
        }
      }else transaccion.set(referencia,{...original,guardadoEn:serverTimestamp()});
    });
  };
  const editarGuardado=p=>{
    if(envioEnCurso.current)return;
    const editable={...p,cliente:{...initial().cliente,...p.cliente},items:(p.items||[]).map(i=>({...i,id:i.id||ITEM_VACIO().id})),nota:p.nota||''};
    if(!editable.items.length)editable.items=[ITEM_VACIO()];
    setEditandoNumero(p.numero);
    setNumeroAutomatico(false);setGuardadoVersion('');
    setQuote(editable);setClienteId(p.clienteId||'');
    setPreciosParaRevisar([]);setError('');setNotice('Editando '+p.numero+'. La próxima emisión actualizará este mismo presupuesto.');
    requestAnimationFrame(()=>document.getElementById('sii-presupuesto-editor')?.scrollIntoView({behavior:'smooth',block:'start'}));
  };
  const borrarGuardado=async p=>{
    if(envioEnCurso.current)return;
    if(!window.confirm('¿Eliminar el presupuesto '+p.numero+' de '+(p.cliente?.razonSocial||'este cliente')+'? Esta acción no se puede deshacer.'))return;
    envioEnCurso.current=true;setBusy('delete');setError('');
    try{
      await deleteDoc(doc(db,'historial_presupuestos_sii',p.numero));
      if(editandoNumero===p.numero){setEditandoNumero('');setGuardadoVersion('');setNumeroAutomatico(true);setQuote(initial());}
      setNotice('Presupuesto '+p.numero+' eliminado del historial.');
    }catch(err){setError('No se pudo borrar: '+err.message);}
    finally{envioEnCurso.current=false;setBusy('');}
  };
  const resumenCliente=lista=>lista.length>0&&<div className="space-y-2">
    {lista.map(p=><div key={p.numero} className="rounded-xl border border-slate-200 bg-white p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div className="min-w-0">
        <strong className="text-sm text-slate-900">{p.numero}</strong>
        <p className="text-xs text-slate-500">{fechaAR(p.fecha)} · {p.cuenta==='2'?'Cuenta 2':'Cuenta 1'} · {peso(Number(p.totalCentavos)||0)}</p>
        <div className="flex flex-wrap gap-1 mt-2">{(p.items||[]).map((i,j)=><span key={i.id||j} className="text-xs text-blue-900 bg-blue-50 rounded-md px-2 py-1">{i.cantidad} × {i.descripcion||'Artículo'}</span>)}</div>
        {p.nota&&<p className="text-xs text-slate-500 mt-1">Nota: {p.nota}</p>}
      </div>
      <div className="flex flex-wrap gap-2 shrink-0">
        <button type="button" disabled={!!busy} onClick={()=>copiarGuardado(p)} className="px-3 py-2 rounded-lg bg-blue-700 text-white text-xs font-bold">Copiar</button>
        <button type="button" disabled={!!busy} onClick={()=>editarGuardado(p)} className="px-3 py-2 rounded-lg bg-slate-800 text-white text-xs font-bold">Editar</button>
        <button type="button" disabled={!!busy} onClick={()=>borrarGuardado(p)} className="px-3 py-2 rounded-lg bg-rose-50 text-rose-700 border border-rose-200 text-xs font-bold">Borrar</button>
      </div>
    </div>)}
  </div>;
  const updateLine=(id,key,value)=>{
    if(key==='precioUnitario')setPreciosParaRevisar(old=>old.filter(x=>x!==id));
    setQuote(q=>({...q,items:q.items.map(i=>i.id===id?{...i,[key]:value}:i)}));
  };
  const addLine=()=>setQuote(q=>({...q,items:[...q.items,ITEM_VACIO()]}));
  const deleteLine=id=>setQuote(q=>({...q,items:q.items.length>1?q.items.filter(i=>i.id!==id):[ITEM_VACIO()]}));
  const recordNumber=()=> {
    const match=quote.numero.match(/^0005-(\d{8})$/);
    if(!match)return;
    const next=Number(match[1])+1;
    if(next>getSequence()) {
      try {localStorage.setItem(SERIE_KEY,String(next));}catch{/* Storage opcional */}
    }
  };
  const newQuote=()=>{
    if(envioEnCurso.current)return;
    const n=proximoNumeroDisponible(historial,Number(quote.numero?.split('-')[1]) + 1 || COTIZACION_INICIO,getSequence());
    try {localStorage.setItem(SERIE_KEY,String(n));}catch{/* Storage opcional */}
    setClienteId('');setSugerencias(false);setPreciosParaRevisar([]);
    setNumeroAutomatico(true);setEditandoNumero('');setGuardadoVersion('');
    setQuote({...initial(),numero:numeroCotizacion(n)});
    setError('');setNotice('Nuevo presupuesto listo.');
  };
  const run=async(action)=>{
    if(envioEnCurso.current)return;
    envioEnCurso.current=true;
    setError('');setNotice('');
    setBusy(action);
    try {
      validarPresupuesto(quote);
      if(String(quote.nota||'').length>100)throw Error('La nota admite como máximo 100 caracteres.');
      let presupuesto={...quote};
      const fingerprint=JSON.stringify(presupuesto);
      // Reemitir el mismo contenido no crea un nuevo documento: se reutiliza el existente.
      const existente=historial.find(p=>p.numero===presupuesto.numero);
      const mismoContenido=existente&&JSON.stringify({
        fecha:existente.fecha,cuenta:existente.cuenta,cliente:existente.cliente,
        items:existente.items,nota:existente.nota||''
      })===JSON.stringify({
        fecha:presupuesto.fecha,cuenta:presupuesto.cuenta,cliente:presupuesto.cliente,
        items:presupuesto.items,nota:presupuesto.nota||''
      });
      if(guardadoVersion===fingerprint||mismoContenido) {
        const pdf=await generarPdfPresupuesto(presupuesto);
        if(action==='download'){descargarPdf(pdf.blob,pdf.filename);setNotice('PDF descargado nuevamente, sin duplicar el presupuesto.');}
        else if(navigator.share){
          const file=new File([pdf.blob],pdf.filename,{type:'application/pdf'});
          if(!navigator.canShare||navigator.canShare({files:[file]})){
            try{await navigator.share({title:'Presupuesto SII PALLETS',files:[file]});}
            catch(err){if(err?.name!=='AbortError')throw err;}
          }else descargarPdf(pdf.blob,pdf.filename);
        }else descargarPdf(pdf.blob,pdf.filename);
        return;
      }
      let resultado;
      // Transacción por número de documento: protege también ante dos equipos
      // que emiten en el mismo instante. Reintenta ante conflictos de numeración.
      for(let intento=0;intento<25;intento++){
        const calculado=calcularPresupuesto(presupuesto);
        try {
          await guardarHistorial(presupuesto,calculado);
          resultado=await generarPdfPresupuesto(presupuesto);
          break;
        }catch(err){
          if(err.code!=='PRESUPUESTO_OCUPADO'||!numeroAutomatico||editandoNumero)throw err;
          const siguiente=proximoNumeroDisponible(historial,Number(presupuesto.numero.split('-')[1])+1,getSequence());
          presupuesto={...presupuesto,numero:numeroCotizacion(siguiente)};
        }
      }
      if(!resultado)throw new Error('No se pudo asignar un número libre. Volvé a intentar.');
      setQuote(q=>({...q,numero:presupuesto.numero}));
      setGuardadoVersion(JSON.stringify(presupuesto));
      setEditandoNumero(presupuesto.numero);
      setNumeroAutomatico(false);
      const secuencia=Number(presupuesto.numero.split('-')[1])+1;
      if(Number.isSafeInteger(secuencia)&&secuencia>getSequence()){
        try{localStorage.setItem(SERIE_KEY,String(secuencia));}catch{/* almacenamiento opcional */}
      }
      const {blob,filename}=resultado;
      if(action==='download'){
        descargarPdf(blob,filename);
        setNotice('PDF generado y registrado como '+presupuesto.numero+'.');
      }else if(action==='share'){
        const file=new File([blob],filename,{type:'application/pdf'});
        if(navigator.share && (!navigator.canShare || navigator.canShare({files:[file]}))){
          try{
            await navigator.share({title:'Presupuesto SII PALLETS',text:'Adjunto presupuesto comercial.',files:[file]});
            setNotice('Se abrió la opción de compartir el presupuesto '+presupuesto.numero+'.');
          }catch(err){
            if(err?.name==='AbortError'){setNotice('Compartir cancelado. El presupuesto '+presupuesto.numero+' quedó registrado.');}
            else throw err;
          }
        }else{
          descargarPdf(blob,filename);
          setNotice('PDF '+presupuesto.numero+' descargado. Adjuntalo desde WhatsApp o tu correo.');
        }
      }
    }catch(err){setError(err?.message||'No se pudo generar el presupuesto.');}
    finally{envioEnCurso.current=false;setBusy('');}
  };

  return <div className="animate-fade-in mx-auto max-w-[1700px] space-y-4">
    <div className="flex items-center justify-between flex-wrap gap-2">
      <div>
        <h2 className="text-2xl sm:text-3xl font-black text-slate-800">Presupuestos</h2>
        <p className="text-sm text-slate-500 mt-1">Generá presupuestos en PDF con el formato comercial de SII PALLETS.</p>
      </div>
      <div className="flex flex-wrap gap-2 w-full sm:w-auto">
        <button type="button" onClick={()=>setMostrarGuardados(v=>!v)} aria-expanded={mostrarGuardados}
          className={'sii-pro-button-secondary flex-1 sm:flex-none '+(mostrarGuardados?'!bg-blue-50 !border-blue-300':'')}>
          {mostrarGuardados?'Ocultar presupuestos':'Presupuestos guardados'} <span className="ml-1 text-xs opacity-70">({historial.length})</span>
        </button>
        <button type="button" onClick={newQuote} className="sii-pro-button-primary flex-1 sm:flex-none">+ Nuevo presupuesto</button>
      </div>
    </div>
    {mostrarGuardados && <section className="bg-white border border-slate-200 rounded-3xl shadow-sm p-4 sm:p-6 space-y-4">
      <div>
        <h3 className="text-lg font-black text-slate-900">Presupuestos por cliente</h3>
        <p className="text-xs text-slate-500 mt-1">Elegí un cliente y copiá el presupuesto que quieras volver a cotizar.</p>
      </div>
      {gruposGuardados.length===0?<p className="text-sm text-slate-500 p-4 bg-slate-50 rounded-xl">Todavía no hay presupuestos guardados en esta base.</p>:
      <div className="grid gap-2">
        {gruposGuardados.map(grupo=><div key={grupo.clave} className="border border-slate-200 rounded-2xl overflow-hidden">
          <button type="button" aria-expanded={clienteGuardadoAbierto===grupo.clave}
            onClick={()=>setClienteGuardadoAbierto(v=>v===grupo.clave?'':grupo.clave)}
            className="w-full flex items-center justify-between gap-3 p-4 bg-slate-50 hover:bg-blue-50 text-left">
            <div className="min-w-0"><strong className="block text-sm sm:text-base text-slate-900 break-words">{grupo.nombre}</strong>
              <p className="text-xs text-slate-500">{grupo.presupuestos.length} presupuesto(s)</p></div>
            <span className="text-blue-700 font-black text-xl shrink-0">{clienteGuardadoAbierto===grupo.clave?'−':'+'}</span>
          </button>
          {clienteGuardadoAbierto===grupo.clave&&<div className="divide-y divide-slate-100">
            {grupo.presupuestos.map(p=><div key={p.id||p.numero} className="flex flex-col sm:flex-row gap-3 sm:items-center justify-between p-3 sm:p-4 bg-white">
              <div className="min-w-0">
                <strong className="block text-sm text-slate-800">{p.numero||'Sin número'}</strong>
                <span className="block text-xs text-slate-500 mt-1">{fechaAR(p.fecha)} · {p.items?.length||0} ítem(s) · {p.cuenta==='2'?'Cuenta 2':'Cuenta 1'}</span>
                <div className="mt-2 flex flex-wrap gap-1.5" aria-label="Artículos presupuestados">
                  {(p.items||[]).length>0 ? p.items.map((item,index)=>
                    <span key={item.id||index} className="inline-flex max-w-full items-start gap-1.5 rounded-lg border border-blue-100 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-slate-700">
                      <span className="shrink-0 text-blue-700">{item.cantidad||1} ×</span>
                      <span className="break-words">{item.descripcion||'Artículo sin descripción'}</span>
                    </span>
                  ) : <span className="text-xs text-slate-400">Sin artículos registrados</span>}
                </div>
                <strong className="block text-sm text-blue-800 mt-2">{peso(Number(p.totalCentavos)||0)}</strong>
              </div>
              <div className="flex flex-wrap gap-2 shrink-0"><button type="button" disabled={!!busy} onClick={()=>copiarGuardado(p)} className="sii-pro-button-primary">Copiar</button><button type="button" disabled={!!busy} onClick={()=>editarGuardado(p)} className="sii-pro-button-secondary">Editar</button><button type="button" disabled={!!busy} onClick={()=>borrarGuardado(p)} className="rounded-xl px-3 py-2 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold">Borrar</button></div>
            </div>)}
          </div>}
        </div>)}
      </div>}
    </section>}
    <div id="sii-presupuesto-editor" className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-4 items-start">
      <section className="space-y-4 min-w-0">
        <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between gap-3"><h3 className="font-extrabold text-slate-800">1. Datos del presupuesto</h3><span className="text-[11px] text-slate-500">Datos del emisor fijos</span></div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label><span className={label}>N° de presupuesto</span><input className={input} value={quote.numero} onChange={e=>{setNumeroAutomatico(false);setQuote(q=>({...q,numero:e.target.value}));}} placeholder="0005-00000502" maxLength={13}/></label>
            <label><span className={label}>Fecha de emisión</span><input className={input} type="date" value={quote.fecha} onChange={e=>setQuote(q=>({...q,fecha:e.target.value}))}/></label>
          </div>
          <p className="text-[11px] text-slate-500">{userNotice}</p>
          <div className="pt-3 border-t border-slate-100">
            <p className="font-bold text-sm text-slate-800 mb-3">Cuenta aplicable</p>
            <div className="grid grid-cols-2 gap-2">
              {[{id:'1',label:'Cuenta 1',detail:'Con IVA 21 %'},{id:'2',label:'Cuenta 2',detail:'Sin IVA'}].map(option=>
                <label key={option.id} className={'flex items-start gap-2 rounded-xl border-2 p-3 cursor-pointer '+(quote.cuenta===option.id?'border-blue-600 bg-blue-50':'border-slate-200 bg-white')}>
                  <input type="radio" name="presupuesto-cuenta" className="mt-1 accent-blue-700" checked={quote.cuenta===option.id} onChange={()=>setQuote(q=>({...q,cuenta:option.id}))}/>
                  <span><strong className="block text-sm text-slate-800">{option.label}</strong><span className="text-xs text-slate-500">{option.detail}</span></span>
                </label>)}
            </div>
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-sm space-y-3">
          <h3 className="font-extrabold text-slate-800">2. Datos del cliente</h3>
          <div className="flex flex-wrap justify-between gap-2 items-center">
            <span className="text-xs text-slate-500">{clientes.length} clientes registrados</span>
            <button type="button" onClick={()=>setShowClientes(v=>!v)} className="rounded-xl bg-slate-900 px-3 py-2 text-white text-xs font-bold">{showClientes?'Ocultar clientes':'Ver cartera de clientes'}</button>
          </div>
          {showClientes&&<div className="max-h-52 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-2">
            {clientes.length?clientes.map(c=><button type="button" key={c.id} onClick={()=>{seleccionarCliente(c);setShowClientes(false);}}
              className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-3 text-left hover:border-blue-400">
              <strong className="block text-sm text-slate-900 break-words">{c.razonSocial}</strong>
              <span className="text-xs text-slate-500">{c.cuit||c.telefono||'Sin CUIT'}</span>
            </button>):<p className="text-xs text-slate-500">Todavía no guardaste clientes.</p>}
          </div>}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2 relative">
              <label className={label} htmlFor="busqueda-cliente-presupuesto">Razón social / Nombre *</label>
              <input id="busqueda-cliente-presupuesto" autoComplete="off" className={input} value={quote.cliente.razonSocial}
                onFocus={()=>setSugerencias(true)} onChange={e=>{setCustomer('razonSocial',e.target.value);setSugerencias(true);}}
                placeholder="Escribí Manuchar, CUIT o nombre…"/>
              {sugerencias&&quote.cliente.razonSocial.trim()&&sugeridos.length>0&&
                <div className="absolute z-20 left-0 right-0 top-full mt-1 max-h-60 overflow-auto rounded-2xl border border-blue-200 bg-white shadow-2xl">
                  {sugeridos.map(c=><button key={c.id} type="button" onClick={()=>seleccionarCliente(c)}
                    className="block w-full text-left px-4 py-3 border-b border-slate-100 hover:bg-blue-50">
                    <strong className="block text-sm text-slate-900">{c.razonSocial}</strong>
                    <small className="text-slate-500">{c.cuit||c.telefono||'Cliente registrado'}</small>
                  </button>)}
                </div>}
            </div>
            <label><span className={label}>CUIT / DNI</span><input className={input} value={quote.cliente.cuit} onChange={e=>setCustomer('cuit',e.target.value)} placeholder="Número de identificación"/></label>
            <label><span className={label}>Condición frente al IVA</span><select className={input} value={quote.cliente.condicionIVA} onChange={e=>setCustomer('condicionIVA',e.target.value)}>
              {['Responsable Inscripto','Monotributista','Consumidor Final','Exento','No especificado'].map(t=><option key={t} value={t}>{t}</option>)}
            </select></label>
            <label className="sm:col-span-2"><span className={label}>Domicilio</span><input className={input} value={quote.cliente.domicilio} onChange={e=>setCustomer('domicilio',e.target.value)} placeholder="Calle, número, localidad"/></label>
            <label><span className={label}>Teléfono (opcional)</span><input className={input} inputMode="tel" value={quote.cliente.telefono} onChange={e=>setCustomer('telefono',e.target.value)}/></label>
            <label><span className={label}>Correo (opcional)</span><input className={input} type="email" value={quote.cliente.email} onChange={e=>setCustomer('email',e.target.value)} placeholder="cliente@empresa.com"/></label>
          </div>
          {presupuestosCliente.length>0&&<div className="rounded-xl border border-blue-200 bg-blue-50/50 p-3 space-y-2"><strong className="text-sm text-blue-900">Presupuestos anteriores ({presupuestosCliente.length})</strong>{resumenCliente(presupuestosCliente)}</div>}
          <button type="button" disabled={guardandoCliente} onClick={guardarCliente}
            className="rounded-xl bg-blue-700 hover:bg-blue-800 text-white px-4 py-3 text-sm font-bold disabled:opacity-50">
            {guardandoCliente?'Guardando…':clienteId?'Actualizar ficha del cliente':'Guardar cliente en la base'}
          </button>
          {historialError&&<p role="alert" className="text-xs text-amber-800 bg-amber-50 rounded-xl p-3">{historialError}</p>}
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between gap-2"><h3 className="font-extrabold text-slate-800">3. Productos e ítems</h3><button type="button" onClick={addLine} disabled={quote.items.length>=100} className="rounded-xl bg-blue-700 hover:bg-blue-800 disabled:opacity-40 text-white text-xs font-bold px-3 py-2">+ Agregar ítem</button></div>
          <p className="text-xs text-slate-500">Ingresá el precio unitario antes de IVA. La cantidad y el precio determinan el subtotal del renglón.</p>
          <div className="space-y-3">
            {quote.items.map((row,index)=><div key={row.id} className="border border-slate-200 rounded-xl p-3 space-y-3 bg-slate-50">
              <div className="flex justify-between items-center"><p className="text-xs font-bold text-slate-700">Ítem {index+1}</p><button type="button" className="text-xs font-bold text-rose-600 hover:underline" onClick={()=>deleteLine(row.id)}>Quitar</button></div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <label><span className={label}>Código</span><input className={input} placeholder={String(index+1).padStart(4,'0')} value={row.codigo} onChange={e=>updateLine(row.id,'codigo',e.target.value)}/></label>
                <label className="sm:col-span-2"><span className={label}>Descripción *</span><input className={input} placeholder="Pallet de madera..." value={row.descripcion} onChange={e=>updateLine(row.id,'descripcion',e.target.value)}/></label>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <label><span className={label}>Unidades *</span><input className={input} type="number" inputMode="decimal" min=".001" step="any" value={row.cantidad} onChange={e=>updateLine(row.id,'cantidad',e.target.value)}/></label>
                <label><span className={label}>Bultos</span><input className={input} type="number" inputMode="decimal" min="0" step="any" value={row.bultos} onChange={e=>updateLine(row.id,'bultos',e.target.value)}/></label>
                <label className="col-span-2">
                  <span className={label}>Precio unitario ($) * {preciosParaRevisar.includes(row.id)&&<strong className="text-rose-700">· REVISAR PRECIO COPIADO</strong>}</span>
                  <input className={input+(preciosParaRevisar.includes(row.id)?' sii-presupuesto-precio-alerta':'')} type="number" inputMode="decimal" min="0" step="0.01" placeholder="0,00" value={row.precioUnitario} onChange={e=>updateLine(row.id,'precioUnitario',e.target.value)}/>
                  {preciosParaRevisar.includes(row.id)&&<button type="button" onClick={()=>setPreciosParaRevisar(v=>v.filter(id=>id!==row.id))}
                    className="text-xs text-rose-800 font-bold mt-2 underline underline-offset-2">Revisé el precio: mantenerlo</button>}
                </label>
              </div>
              {preciosPrevios[row.id]&&<div className="flex flex-col sm:flex-row sm:items-center gap-2 justify-between bg-blue-50 border border-blue-200 rounded-xl px-3 py-3">
                <div className="min-w-0">
                  <span className="text-[11px] font-bold uppercase tracking-wide text-blue-800">Último precio a este cliente</span>
                  <p className="text-sm font-black text-slate-900">{peso(Math.round(preciosPrevios[row.id].precioUnitario*100))} / unidad</p>
                  <p className="text-xs text-slate-600">Presupuesto {preciosPrevios[row.id].numero} · {fechaAR(preciosPrevios[row.id].fecha)} · {preciosPrevios[row.id].descripcion}</p>
                </div>
                <button type="button" className="bg-white border border-blue-300 text-blue-800 rounded-lg px-3 py-2 text-xs font-bold whitespace-nowrap"
                  onClick={()=>updateLine(row.id,'precioUnitario',String(preciosPrevios[row.id].precioUnitario))}>Usar como referencia</button>
              </div>}
              <div className="text-right text-sm font-bold text-slate-800">Subtotal: {totals.data?.lineas.find(x=>x.id===row.id) ? peso(totals.data.lineas.find(x=>x.id===row.id).subtotalCentavos) : '—'}</div>
            </div>)}
          </div>
          <label className="block border-t border-slate-100 pt-3"><span className={label}>Nota del presupuesto (opcional)</span>
            <textarea className={input} maxLength={100} rows={2} placeholder="Observación para incluir en el presupuesto" value={quote.nota||''} onChange={e=>setQuote(q=>({...q,nota:e.target.value.slice(0,100)}))}/>
            <span className="text-xs text-slate-500">{(quote.nota||'').length}/100 caracteres</span>
          </label>
          {presupuestosCliente.length>0&&<div className="rounded-xl bg-slate-50 border border-slate-200 p-3 space-y-2"><strong className="text-sm text-slate-900">Presupuestos anteriores de este cliente</strong>{resumenCliente(presupuestosCliente)}</div>}
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-sm">
          <div className="flex justify-between gap-3 text-sm mb-2"><span>Subtotal</span><strong>{totals.data?peso(totals.data.subtotalCentavos):'—'}</strong></div>
          {quote.cuenta==='1'&&<div className="flex justify-between gap-3 text-sm mb-2"><span>IVA 21 %</span><strong>{totals.data?peso(totals.data.ivaCentavos):'—'}</strong></div>}
          <div className="flex items-center justify-between gap-3 border-t pt-3"><span className="font-bold text-slate-900">TOTAL</span><strong className="text-2xl text-blue-800">{totals.data?peso(totals.data.totalCentavos):'—'}</strong></div>
          {error&&<p role="alert" className="text-xs mt-3 rounded-lg bg-rose-50 text-rose-700 p-2">{error}</p>}
          {notice&&<p role="status" className="text-xs mt-3 rounded-lg bg-emerald-50 text-emerald-800 p-2">{notice}</p>}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-4">
            <button type="button" onClick={()=>run('download')} disabled={!!busy} className="rounded-xl px-4 py-3 bg-blue-800 hover:bg-blue-900 disabled:opacity-40 text-white font-bold text-sm">{busy==='download'?'Generando…':'Descargar PDF'}</button>
            <button type="button" onClick={()=>run('share')} disabled={!!busy} className="rounded-xl px-4 py-3 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-40 text-white font-bold text-sm">{busy==='share'?'Preparando…':'Compartir PDF'}</button>
          </div>
          <p className="text-[11px] text-slate-500 mt-3">En celulares compatibles, «Compartir PDF» abre el menú del dispositivo para elegir WhatsApp, correo u otra app. Si no admite adjuntar archivos, descargá el PDF y adjuntalo manualmente.</p>
        </div>
      </section>

      <section className="min-w-0 bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden xl:sticky xl:top-3">
        <div className="flex justify-between items-center gap-2 px-4 py-3 border-b">
          <h3 className="font-bold text-slate-800">Vista previa del presupuesto</h3>
          <button type="button" onClick={()=>setShowPreview(v=>!v)} className="text-xs font-bold text-blue-800">{showPreview?'Ocultar':'Mostrar'}</button>
        </div>
        {showPreview&&<div className="overflow-x-auto p-2 bg-slate-100">
          <div className="bg-white mx-auto shadow-sm border border-slate-600 text-slate-800" style={{width:'100%',maxWidth:530,aspectRatio:'210 / 297'}}>
            <div className="text-center border-b border-slate-700 font-bold text-[10px] py-1">ORIGINAL</div>
            <div className="grid grid-cols-2 border-b border-slate-700">
              <div className="border-r border-slate-700 p-2">
                <div className="flex items-center gap-2 mb-3">
                  <img src={LOGO_PRESUPUESTO} className="h-[72px] w-[72px] object-contain" alt="Logo actual de SII PALLETS"/>
                  <span className="text-[10px] font-black text-center flex-1 leading-4">SOLUCIONES INDUSTRIALES<br/>INTEGRALES EN PALLETS</span>
                </div>
                <div className="text-[10px] leading-[1.45]">
                  <div><strong>Razón Social:</strong> {EMISOR.razonSocial}</div>
                  <div><strong>Domicilio Comercial:</strong> {EMISOR.domicilio}</div>
                  <div>{EMISOR.localidad}</div>
                  <div><strong>Condición frente al IVA:</strong> {EMISOR.iva}</div>
                  <div><strong>Tel.:</strong> {EMISOR.telefono}</div>
                </div>
              </div>
              <div className="p-2">
                <h3 className="text-center text-base font-black mt-1 mb-4">PRESUPUESTO</h3>
                <div className="text-[10px] leading-5">
                  <p><strong>Compr. Nro.:</strong> {quote.numero}</p>
                  <p><strong>Fecha de Emisión:</strong> {fechaAR(quote.fecha)}</p>
                  <p><strong>CUIT:</strong> {EMISOR.cuit}</p>
                  <p><strong>Ingresos Brutos:</strong> {EMISOR.ingresosBrutos}</p>
                  <p><strong>Fecha de Inicio de Actividades:</strong> {EMISOR.inicioActividades}</p>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 border-b border-slate-700 p-2 text-[10px] gap-2">
              <div><strong>Sr(es):</strong> {quote.cliente.razonSocial||'____________________'}<p><strong>CUIT:</strong> {quote.cliente.cuit||'—'}</p></div>
              <div><strong>Domicilio:</strong> {quote.cliente.domicilio||'—'}<p><strong>Condición frente al IVA:</strong> {quote.cliente.condicionIVA}</p></div>
            </div>
            <table className="w-full table-fixed border-collapse text-[9px]">
              <colgroup><col style={{width:'7%'}}/><col style={{width:'40%'}}/><col style={{width:'9%'}}/><col style={{width:'9%'}}/><col style={{width:'9%'}}/><col style={{width:'13%'}}/><col style={{width:'13%'}}/></colgroup>
              <thead><tr className="bg-slate-200 border-b border-slate-700">{['Ítem','Descripción','Alíc. %','Cantidad','Bultos','Precio Unit.','Subtotal'].map(x=><th key={x} className="border-r border-slate-500 px-1 py-2 text-left">{x}</th>)}</tr></thead>
              <tbody>{(totals.data?.lineas||quote.items).map((item,i)=><tr key={item.id||i} className="border-b border-slate-100">
                <td className="align-top p-1 border-r border-slate-100 break-all">{item.codigo||String(i+1).padStart(4,'0')}</td>
                <td className="align-top p-1 border-r border-slate-100 break-words">{item.descripcion||'—'}</td>
                <td className="align-top p-1 border-r border-slate-100 text-center">{quote.cuenta==='1'?'21,00':'—'}</td>
                <td className="align-top p-1 border-r border-slate-100 text-center">{item.cantidad}</td>
                <td className="align-top p-1 border-r border-slate-100 text-center">{item.bultos}</td>
                <td className="align-top p-1 border-r border-slate-100 text-right">{Number.isFinite(item.precioCentavos)?peso(item.precioCentavos):'—'}</td>
                <td className="align-top p-1 text-right">{Number.isFinite(item.subtotalCentavos)?peso(item.subtotalCentavos):'—'}</td>
              </tr>)}</tbody>
            </table>
            <div className="mt-auto"/>
            {quote.nota&&<p className="px-3 pt-3 text-[10px] break-words"><strong>Nota:</strong> {quote.nota}</p>}
            <div className="p-3 text-[11px] mt-12 border-t border-slate-500">
              <div className="flex justify-between"><span>SUBTOTAL</span><strong>{totals.data?peso(totals.data.subtotalCentavos):'—'}</strong></div>
              {quote.cuenta==='1'&&<div className="flex justify-between mt-1"><span>IVA 21 %</span><strong>{totals.data?peso(totals.data.ivaCentavos):'—'}</strong></div>}
              <div className="flex justify-between font-black text-base mt-2 border-t pt-2"><span>TOTAL ($)</span><span>{totals.data?peso(totals.data.totalCentavos):'—'}</span></div>
            </div>
          </div>
        </div>}
        <p className="text-[11px] text-slate-500 px-4 pb-4 pt-1">Vista orientativa. El PDF descargado se genera en A4 y divide automáticamente los productos entre páginas cuando es necesario.</p>
      </section>
    </div>
  </div>;
}
