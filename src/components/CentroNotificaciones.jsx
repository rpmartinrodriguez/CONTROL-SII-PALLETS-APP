import React from 'react';
import {createPortal} from 'react-dom';
import {IconBell,IconEye,IconTrash,IconX} from './Icons';
import {useBandejaSii} from '../hooks/useBandejaSii';

const when=ms=>ms?new Date(ms).toLocaleString('es-AR',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}):'';
export default function CentroNotificaciones({onOpen}){
  const inbox=useBandejaSii();
  const unread=inbox.pendientes;
  const abrir=item=>{
    inbox.marcarLeida(item.id);
    inbox.setInicioAbierto(false);
    inbox.setPanelAbierto(false);
    onOpen?.(item);
  };
  const rows=(rows,compact=false)=>rows.length?(
    <div className={compact ? "space-y-2" : "space-y-2 max-h-[min(62dvh,580px)] overflow-y-auto overscroll-contain pr-1"}>
      {rows.map(item=><article key={item.id} className="rounded-2xl bg-white border border-slate-200 p-3 sm:p-4 shadow-sm">
        <div className="flex gap-3 items-start">
          <span className="mt-1 shrink-0 h-9 w-9 rounded-xl bg-blue-50 flex items-center justify-center text-blue-700"><IconBell className="w-4 h-4"/></span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2 justify-between">
              <strong className="text-sm text-slate-900 break-words">{item.categoria?.startsWith('partial_')&&<span className="inline-block mr-2 rounded-md bg-amber-100 text-amber-900 border border-amber-300 px-2 py-0.5 text-xs font-black tracking-wide">PARCIAL</span>}{item.categoria?.startsWith('partial_')?item.titulo.replace(/^PARCIAL\\s*[·-]\\s*/,''):item.titulo}</strong>
              <time className="text-[10px] font-semibold text-slate-500">{when(item.creadoEn)}</time>
            </div>
            <p className="mt-1 text-xs sm:text-sm leading-relaxed text-slate-600 break-words">{item.detalle}</p>
            <div className="flex flex-wrap items-center justify-end gap-2 mt-3">
              <button type="button" onClick={()=>abrir(item)} aria-label={'Ver '+item.titulo}
                className="sii-notif-btn sii-notif-view"><IconEye className="w-4 h-4"/><span>Ver</span></button>
              <button type="button" onClick={()=>inbox.eliminar(item.id)} aria-label={'Eliminar '+item.titulo}
                className="sii-notif-btn sii-notif-delete"><IconTrash className="w-4 h-4"/><span>Eliminar</span></button>
            </div>
          </div>
        </div>
      </article>)}
    </div>
  ):<p className="text-sm text-slate-500 p-4 text-center">No tenés notificaciones pendientes de leer.</p>;

  return <>
    <button type="button" aria-label={'Abrir notificaciones. '+unread.length+' sin leer'}
      className="sii-pro-iconbtn" onClick={()=>{inbox.setPanelAbierto(v=>!v);inbox.setInicioAbierto(false);void inbox.actualizar(true);}}>
      <IconBell className="w-5 h-5"/>
      {unread.length>0&&<span className="sii-pro-count">{Math.min(unread.length,99)}</span>}
    </button>

    {inbox.panelAbierto&&<div className="sii-pro-overlay-panel sii-inbox-panel">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div><strong className="text-slate-900">Centro de notificaciones</strong><p className="text-xs text-slate-500">{unread.length} sin leer</p></div>
        <button type="button" onClick={()=>inbox.setPanelAbierto(false)} aria-label="Cerrar notificaciones" className="sii-pro-close"><IconX className="w-5 h-5"/></button>
      </div>
      {rows(unread)}
      <p className="text-[11px] text-slate-500 mt-3">El ojo abre la sección relacionada y marca como vista. La X de eliminar descarta el aviso de este dispositivo.</p>
    </div>}

    {inbox.inicioAbierto && unread.length>0&&createPortal(
      <div className="fixed inset-0 z-[75] bg-slate-950/65 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6">
        <section role="dialog" aria-modal="true" aria-label="Notificaciones pendientes al ingresar"
          className="bg-slate-50 w-full max-w-xl max-h-[92dvh] overflow-hidden flex flex-col rounded-3xl shadow-2xl border border-slate-200">
          <header className="flex items-start justify-between gap-3 p-4 sm:p-5 border-b border-slate-200 bg-white">
            <div className="min-w-0">
              <p className="text-xs font-extrabold uppercase tracking-wider text-blue-700">SII PALLETS · Resumen</p>
              <h2 className="text-xl font-black text-slate-900 mt-1">Tus últimas notificaciones</h2>
              <p className="text-xs text-slate-500 mt-1">Solo avisos que aún no viste · {unread.length} pendientes</p>
            </div>
            <button type="button" className="sii-pro-close shrink-0" aria-label="Cerrar resumen" onClick={inbox.cerrarInicio}><IconX className="w-5 h-5"/></button>
          </header>
          <div className="min-h-0 overflow-y-auto p-3 sm:p-5">
            {rows(unread.slice(0,6),true)}
            {unread.length>6&&<p className="text-xs text-slate-500 mt-3">Tenés {unread.length-6} avisos adicionales en la campanita.</p>}
          </div>
          <footer className="p-3 sm:p-4 border-t bg-white">
            <button type="button" onClick={inbox.cerrarInicio} className="w-full sii-pro-button-primary">
              Continuar a Cobros
            </button>
          </footer>
        </section>
      </div>, document.body)}
  </>;
}
