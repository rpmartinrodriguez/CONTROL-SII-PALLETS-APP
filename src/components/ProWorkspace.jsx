import React, { useMemo, useState } from 'react';
import {
  IconBank, IconBell, IconBriefcase, IconBox, IconDownload, IconFileText,
  IconFolder, IconLayers, IconSearch, IconTrendingUp, IconWallet, IconX
} from './Icons';
import PushControl from './PushControl';

const modules = [
  {id:'pay',title:'Pagos',hint:'Compromisos y vencimientos',Icon:IconWallet},
  {id:'collect',title:'Cobros',hint:'Facturas por cobrar',Icon:IconBriefcase},
  {id:'balance',title:'Balance',hint:'Tu posición financiera',Icon:IconTrendingUp},
  {id:'cashbox',title:'Caja',hint:'Ingresos y egresos',Icon:IconBox},
  {id:'billing',title:'Facturación',hint:'Comprobantes e IVA',Icon:IconFileText},
  {id:'quotesPDF',title:'Presupuestos',hint:'Clientes y cotizaciones',Icon:IconFileText},
  {id:'wallet',title:'Cartera',hint:'Cheques y seguimiento',Icon:IconFolder},
  {id:'pallets',title:'Pallets',hint:'Costos y producción',Icon:IconLayers},
  {id:'migration',title:'Respaldo',hint:'Auditoría y migración',Icon:IconDownload}
];
const pesos = number => new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS',maximumFractionDigits:0}).format(Number(number)||0);
const number = value => new Intl.NumberFormat('es-AR').format(Number(value)||0);
const out = list => list.filter(item=>item.status !== 'paid');
export default function ProWorkspace({mode,onNavigate,collectItems,payItems,pagosAvanzados,alerts,searchTerm,setSearchTerm}) {
  const [alertasAbiertas,setAlertasAbiertas] = useState(false);
  const [pushAbierto,setPushAbierto] = useState(false);
  const seleccionado = modules.find(x=>x.id===mode)||modules[0];
  const resumen = useMemo(()=>{
    const cobros = out(collectItems);
    const pagos = out(payItems);
    const pagAvanzados=pagosAvanzados?.ready && Array.isArray(pagosAvanzados.items)
      ? pagosAvanzados.items.filter(i=>String(i.estado||'').toUpperCase()!=='PAGADO') : [];
    const cobrosPendientes=cobros.reduce((total,i)=>total+Math.max(0,Number(i.amount||0)-Number(i.paidAmount||0)),0);
    const pagosPendientes=pagAvanzados.reduce((total,i)=>total+Math.max(0,Number(i.importe||0)),0);
    const hoy=new Date();hoy.setHours(0,0,0,0);
    const hasta=new Date(hoy);hasta.setDate(hasta.getDate()+2);
    const hastaKey=[hasta.getFullYear(),String(hasta.getMonth()+1).padStart(2,'0'),String(hasta.getDate()).padStart(2,'0')].join('-');
    const inminentes=[...cobros,...pagos].filter(item=>item.dueDate&&item.dueDate<=hastaKey).length+
      pagAvanzados.filter(item=>item.fecha&&item.fecha<=hastaKey).length;
    return {cobrosPendientes,pagosPendientes,inminentes,totalMovimientos:collectItems.length+payItems.length};
  },[collectItems,payItems,pagosAvanzados]);
  return <>
    <aside className="sii-pro-sidebar hidden md:flex" aria-label="Secciones de la aplicación">
      <div className="sii-pro-brand">
        <img src="/logo.png" alt="Logo SII PALLETS" className="w-12 h-12 rounded-2xl object-contain bg-white p-1"/>
        <div className="min-w-0">
          <strong className="text-base block tracking-wide">SII PALLETS</strong>
          <small className="text-[10px] uppercase tracking-[.24em] text-slate-400">Control inteligente</small>
        </div>
      </div>
      <p className="sii-pro-nav-label">MENÚ PRINCIPAL</p>
      <div className="sii-pro-navigation">
        {modules.map(({id,title,hint,Icon})=><button key={id} type="button"
          onClick={()=>onNavigate(id)} className={'sii-pro-navitem '+(mode===id?'sii-pro-navitem-active':'')}
          aria-current={mode===id?'page':undefined} title={hint}>
          <Icon className="w-5 h-5 shrink-0"/><span className="truncate">{title}</span>
          {mode===id&&<span className="sii-pro-navdot" aria-hidden="true"/>}
        </button>)}
      </div>
      <div className="sii-pro-sidefoot"><span className="sii-pro-live"/> FIREBASE EN LÍNEA <small className="block mt-1 text-slate-400">Cuenta personal · SII PRO</small></div>
    </aside>
    <div className="sii-pro-topline">
      <div className="flex items-center gap-3 min-w-0">
        <img src="/logo.png" alt="" className="md:hidden rounded-xl bg-white p-1 h-10 w-10 object-contain"/>
        <div className="min-w-0"><span className="sii-pro-eyebrow">SII PALLETS / SISTEMA OPERATIVO</span><p className="text-sm font-black tracking-wide text-slate-900 md:text-base truncate">Panel de operaciones</p></div>
      </div>
      <div className="flex items-center gap-2">
        <span className="sii-pro-connection"><span className="sii-pro-live"/> En línea</span>
        <button aria-label="Abrir centro de notificaciones" className="sii-pro-iconbtn" onClick={()=>setAlertasAbiertas(v=>!v)}><IconBell className="w-5 h-5"/>{alerts.length>0&&<span className="sii-pro-count">{alerts.length}</span>}</button>
        <button onClick={()=>setPushAbierto(v=>!v)} className="sii-pro-action">Notificaciones <span className="hidden sm:inline">push</span></button>
      </div>
    </div>
    {alertasAbiertas&&<div className="sii-pro-overlay-panel">
      <div className="flex justify-between items-center mb-3"><strong className="text-slate-900">Próximos vencimientos</strong><button aria-label="Cerrar alertas" onClick={()=>setAlertasAbiertas(false)}><IconX className="w-5 h-5"/></button></div>
      {alerts.length===0?<p className="text-slate-500 text-sm">No tenés alertas próximas.</p>:
      <div className="max-h-72 overflow-y-auto space-y-2">{alerts.slice(0,30).map((a,i)=><div key={String(a.id)+'-'+i} className="p-3 bg-slate-50 rounded-xl border border-slate-100">
        <div className="flex justify-between gap-2"><span className="font-bold text-slate-900 text-xs">{a.type==='collect'?'Por cobrar':'Por pagar'}</span><span className="text-xs text-blue-700">{a.dueDate}</span></div>
        <p className="text-sm text-slate-800 mt-1 font-semibold break-words">{a.payee||a.number||'Movimiento'}</p><p className="text-xs text-slate-500">{pesos(Number(a.amount||0)-Number(a.paidAmount||0))}</p>
      </div>)}</div>}
      <p className="mt-2 text-xs text-slate-500">Los avisos push se configuran por dispositivo.</p>
    </div>}
    {pushAbierto&&<PushControl cerrar={()=>setPushAbierto(false)}/>}
    <div className="sii-pro-hero">
      <div className="sii-pro-heroheader">
        <div className="min-w-0">
          <span className="sii-pro-eyebrow-light">SII / OPERACIONES</span>
          <h1 className="sii-pro-title">{seleccionado.title}</h1>
          <p className="text-sm text-slate-300 mt-2">{seleccionado.hint}. Toda tu operación, más clara y rápida.</p>
        </div>
        <span className="sii-pro-herotag"><span className="sii-pro-live"/> Datos en tiempo real</span>
      </div>
      <div className="sii-pro-metrics">
        <div className="sii-pro-metric"><span className="sii-pro-metric-label">Cobros pendientes</span><strong>{pesos(resumen.cobrosPendientes)}</strong><span className="sii-pro-metric-hint">Facturas por cobrar</span></div>
        <div className="sii-pro-metric"><span className="sii-pro-metric-label">Pagos Avanzados pendientes</span><strong>{pesos(resumen.pagosPendientes)}</strong><span className="sii-pro-metric-hint">Fuente financiera · cheques</span></div>
        <div className="sii-pro-metric"><span className="sii-pro-metric-label">Vencimientos cercanos</span><strong>{number(resumen.inminentes)}</strong><span className="sii-pro-metric-hint">Hasta 2 días · todas las fuentes</span></div>
      </div>
    </div>
    {(mode==='collect'||mode==='wallet'||mode==='expenses')&&
      <label className="sii-pro-search"><IconSearch className="w-5 h-5 text-blue-600 shrink-0"/>
        <input aria-label="Buscar comprobantes" type="search" placeholder="Buscar por cliente, número o comprobante…"
          value={searchTerm} onChange={e=>setSearchTerm(e.target.value)}/><span className="hidden sm:inline text-xs text-slate-400">Buscar</span>
      </label>}
  </>;
}
