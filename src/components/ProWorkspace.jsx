import React, { useMemo, useState } from 'react';
import CentroNotificaciones from './CentroNotificaciones';
import {
  IconBriefcase, IconBox, IconDownload, IconFileText,
  IconFolder, IconLayers, IconSearch, IconTrendingUp, IconWallet
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
const out = list => list.filter(item=>item.status !== 'paid');
export default function ProWorkspace({mode,onNavigate,onOpenNotification,collectItems,payItems,pagosAvanzados,searchTerm,setSearchTerm}) {
  const [pushAbierto,setPushAbierto] = useState(false);
  const seleccionado = modules.find(x=>x.id===mode)||modules[0];
  const resumen = useMemo(()=>{
    const cobros = out(collectItems);
    const pagAvanzados=pagosAvanzados?.ready && Array.isArray(pagosAvanzados.items)
      ? pagosAvanzados.items.filter(i=>String(i.estado||'').toUpperCase()!=='PAGADO') : [];
    const cobrosPendientes=cobros.reduce((total,i)=>total+Math.max(0,Number(i.amount||0)-Number(i.paidAmount||0)),0);
    const pagosPendientes=pagAvanzados.reduce((total,i)=>total+Math.max(0,Number(i.importe||0)),0);
    const diferencia=cobrosPendientes-pagosPendientes;
    return {cobrosPendientes,pagosPendientes,diferencia};
  },[collectItems,pagosAvanzados]);
  return <>
    <aside className="sii-pro-sidebar hidden md:flex" aria-label="Secciones de la aplicación">
      <div className="sii-pro-brand">
        <img src="/app-icon.svg" alt="Logo SII PALLETS" className="w-12 h-12 rounded-2xl object-contain bg-white p-1"/>
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
        <img src="/app-icon.svg" alt="" className="md:hidden rounded-xl bg-white p-1 h-10 w-10 object-contain"/>
        <div className="min-w-0"><span className="sii-pro-eyebrow">SII PALLETS / SISTEMA OPERATIVO</span><p className="text-sm font-black tracking-wide text-slate-900 md:text-base truncate">Panel de operaciones</p></div>
      </div>
      <div className="flex items-center gap-2">
        <span className="sii-pro-connection"><span className="sii-pro-live"/> En línea</span>
        <CentroNotificaciones onOpen={onOpenNotification}/>
        <button onClick={()=>setPushAbierto(v=>!v)} className="sii-pro-action">Notificaciones <span className="hidden sm:inline">push</span></button>
      </div>
    </div>
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
      <div className="sii-finance-board">
        <button type="button" className="sii-finance-collect" onClick={()=>onNavigate('collect')} aria-label={'Ver Cobros. Pendiente '+pesos(resumen.cobrosPendientes)}>
          <span className="sii-finance-label">COBROS PENDIENTES <span aria-hidden="true">↗</span></span>
          <strong className="sii-finance-primary-value">{pesos(resumen.cobrosPendientes)}</strong>
          <span className="sii-finance-sub">Total a cobrar · sin límite de vencimiento</span>
        </button>
        <div className="sii-finance-secondary">
          <button type="button" className="sii-finance-small" onClick={()=>onNavigate('pay')}>
            <span className="sii-finance-label">PAGOS PENDIENTES <span aria-hidden="true">↗</span></span>
            <strong className="sii-finance-value">{pesos(resumen.pagosPendientes)}</strong>
            <span className="sii-finance-sub">Abrir Pagos Avanzados</span>
          </button>
          <div className="sii-finance-small sii-finance-difference">
            <span className="sii-finance-label">DIFERENCIA ESTIMADA</span>
            <strong className={'sii-finance-value '+(resumen.diferencia>=0?'sii-finance-positive':'sii-finance-negative')}>{pesos(resumen.diferencia)}</strong>
            <span className="sii-finance-sub">Cobros menos pagos pendientes</span>
          </div>
        </div>
        <p className="sii-finance-footnote">Proyección orientativa de obligaciones registradas, no representa el saldo de Caja ni la liquidez disponible.</p>
      </div>
    </div>
    {(mode==='collect'||mode==='wallet'||mode==='expenses')&&
      <label className="sii-pro-search"><IconSearch className="w-5 h-5 text-blue-600 shrink-0"/>
        <input aria-label="Buscar comprobantes" type="search" placeholder="Buscar por cliente, número o comprobante…"
          value={searchTerm} onChange={e=>setSearchTerm(e.target.value)}/><span className="hidden sm:inline text-xs text-slate-400">Buscar</span>
      </label>}
  </>;
}
