import React, { useEffect, useState } from 'react';
import {
  IconBox, IconBriefcase, IconDownload, IconFileText,
  IconFolder, IconLayers, IconTrendingUp, IconWallet, IconX
} from './Icons';

const principales = [
  { id: 'pay', nombre: 'Pagos', Icono: IconWallet },
  { id: 'collect', nombre: 'Cobros', Icono: IconBriefcase },
  { id: 'balance', nombre: 'Balance', Icono: IconTrendingUp },
  { id: 'cashbox', nombre: 'Caja', Icono: IconBox }
];
const otros = [
  { id: 'billing', nombre: 'Facturación', Icono: IconFileText },
  { id: 'quotesPDF', nombre: 'Cotizaciones', Icono: IconFileText },
  { id: 'wallet', nombre: 'Cartera', Icono: IconFolder },
  { id: 'pallets', nombre: 'Pallets', Icono: IconLayers },
  { id: 'migration', nombre: 'Migración / respaldo', Icono: IconDownload }
];

export default function NavegacionMovil({ modo, cambiarModo }) {
  const [abierto, setAbierto] = useState(false);
  useEffect(() => { setAbierto(false); }, [modo]);
  useEffect(() => {
    if (!abierto) return undefined;
    const cerrar = event => { if (event.key === 'Escape') setAbierto(false); };
    window.addEventListener('keydown', cerrar);
    return () => window.removeEventListener('keydown', cerrar);
  }, [abierto]);
  const elegir = id => {
    setAbierto(false);
    cambiarModo(id);
  };
  const estaEnOtros = otros.some(p => p.id === modo);
  return (
    <nav aria-label="Navegación principal móvil" className="sii-mobile-dock md:hidden">
      {abierto && (
        <>
          <button className="sii-mobile-backdrop" aria-label="Cerrar menú de secciones" onClick={() => setAbierto(false)} />
          <div className="sii-mobile-more" role="dialog" aria-label="Más secciones">
            <div className="flex items-center justify-between gap-2 mb-3">
              <span className="font-black text-slate-900 text-base">Secciones de SII PALLETS</span>
              <button aria-label="Cerrar menú" className="rounded-full p-2 bg-slate-100" onClick={() => setAbierto(false)}>
                <IconX className="w-5 h-5"/>
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {otros.map(({ id, nombre, Icono }) => (
                <button key={id} onClick={() => elegir(id)} aria-current={modo === id ? 'page' : undefined}
                  className={'sii-mobile-more-item ' + (modo === id ? 'sii-mobile-more-item-active' : '')}>
                  <Icono className="w-5 h-5"/><span>{nombre}</span>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
      <div className="sii-mobile-tabs">
        {principales.map(({ id, nombre, Icono }) => (
          <button key={id} type="button" onClick={() => elegir(id)}
            className={'sii-mobile-tab ' + (modo === id ? 'sii-mobile-tab-active' : '')}
            aria-current={modo === id ? 'page' : undefined} aria-label={'Abrir ' + nombre}>
            <Icono className="w-5 h-5"/>
            <span>{nombre}</span>
          </button>
        ))}
        <button type="button" onClick={() => setAbierto(valor => !valor)} aria-expanded={abierto}
          aria-label="Mostrar más secciones"
          className={'sii-mobile-tab ' + (abierto || estaEnOtros ? 'sii-mobile-tab-active' : '')}>
          <IconLayers className="w-5 h-5"/><span>Más</span>
        </button>
      </div>
    </nav>
  );
}
