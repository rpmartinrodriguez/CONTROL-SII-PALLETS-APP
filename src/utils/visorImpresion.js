/* Visor de informes seguro para escritorio y PWA móvil.
 * Safari iOS puede bloquear .print() dentro de un iframe: en móvil usamos
 * una vista previa DOM y exportamos un PDF para la hoja nativa de compartir.
 */
const clean=s=>String(s||'Reporte_SII').replace(/[^a-zA-Z0-9_.-]+/g,'_').slice(0,90);
export function abrirVisorImpresion({titulo,contenido,css,nombreArchivo}){
  if(typeof document==='undefined')return;
  document.getElementById('sii-visor-impresion')?.querySelector('[data-close]')?.click();
  const mobile=window.matchMedia?.('(max-width:767px)').matches || /iPhone|iPad|iPod/i.test(navigator.userAgent);
  const overlay=document.createElement('section');
  overlay.id='sii-visor-impresion';
  overlay.setAttribute('role','dialog');
  overlay.setAttribute('aria-modal','true');
  overlay.setAttribute('aria-label','Imprimir o compartir informe');
  overlay.className='sii-print-overlay';
  const header=document.createElement('header');
  header.className='sii-print-toolbar';
  const label=document.createElement('div');
  label.className='sii-print-heading';
  const title=document.createElement('strong');
  title.textContent=titulo||'Informe SII PALLETS';
  const desc=document.createElement('small');
  desc.textContent='Vista previa · Imprimir, compartir o volver sin salir de la aplicación.';
  label.append(title,desc);
  header.appendChild(label);
  const actions=document.createElement('div');
  actions.className='sii-print-actions';
  const makeButton=(text,action,extra='')=>{
    const b=document.createElement('button');
    b.type='button';b.textContent=text;b.className='sii-print-btn '+extra;
    b.addEventListener('click',action);actions.appendChild(b);
    return b;
  };
  const previousFocus=document.activeElement;
  const previousOverflow=document.body.style.overflow;
  let closed=false;
  const close=()=>{
    if(closed)return;
    closed=true;
    window.removeEventListener('keydown',escape);
    document.body.style.overflow=previousOverflow;
    overlay.remove();
    previousFocus?.focus?.();
  };
  const escape=e=>{if(e.key==='Escape')close();};
  const filename=clean(nombreArchivo)+'.pdf';
  const srcdoc='<!doctype html><html lang="es"><head><meta charset="utf-8"/>'+
    '<meta name="viewport" content="width=device-width,initial-scale=1"/><style>'+
    (css||'')+' @media print{@page{size:A4;margin:12mm}body{padding:0!important}}</style></head>'+
    '<body><div class="report-container">'+(contenido||'')+'</div></body></html>';
  const iframe=document.createElement('iframe');
  iframe.className='sii-print-frame';
  iframe.title='Vista previa del informe';
  iframe.setAttribute('sandbox','allow-same-origin allow-modals');
  iframe.srcdoc=srcdoc;
  // En iOS un iframe srcdoc puede quedar en blanco. La vista previa móvil
  // es DOM normal, con scroll independiente y un botón Volver siempre visible.
  const mobilePreview=document.createElement('div');
  mobilePreview.className='sii-print-mobile-preview';
  const sheet=document.createElement('div');
  sheet.className='sii-print-mobile-sheet report-container';
  sheet.innerHTML=contenido||'';
  mobilePreview.appendChild(sheet);

  const status=document.createElement('p');
  status.className='sii-print-status';
  status.setAttribute('role','status');
  status.style.cssText='font-size:12px;font-weight:700;color:#17447f;padding:0 12px;background:#fff;';
  const notify=text=>{status.textContent=text;};
  async function pdfBlob(){
    const module=await import('html2pdf.js');
    const html2pdf=module.default||module;
    const element=document.createElement('div');
    // html2canvas omite elementos situados fuera del área visible en iOS.
    // Usamos una capa blanca bajo el visor, presente en el documento.
    element.style.cssText='position:absolute;top:0;left:0;width:794px;background:white;z-index:9998;pointer-events:none;padding:12px;';
    element.innerHTML='<style>'+(css||'')+'</style><div class="report-container">'+(contenido||'')+'</div>';
    document.body.appendChild(element);
    try{
      return await html2pdf().set({
        margin:10,filename,
        image:{type:'jpeg',quality:.96},
        html2canvas:{scale:mobile?1.15:1.7,windowWidth:mobile?1080:undefined,useCORS:true,logging:false},
        jsPDF:{unit:'mm',format:'a4',orientation:'portrait'}
      }).from(element).outputPdf('blob');
    }finally{element.remove();}
  }
  function downloadBlob(blob){
    const url=URL.createObjectURL(blob),a=document.createElement('a');
    a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),30000);
  }
  async function shareOrSave(blob,printIntent){
    const file=new File([blob],filename,{type:'application/pdf'});
    if(navigator.share && (!navigator.canShare||navigator.canShare({files:[file]}))){
      try{
        await navigator.share({title:titulo||'Informe SII PALLETS',files:[file]});
        notify(printIntent?'Desde la hoja del dispositivo podés elegir Imprimir.':'Se abrió el menú de compartir.');
        return;
      }catch(err){
        if(err?.name==='AbortError'){notify('Operación cancelada. Podés volver o guardar el PDF.');return;}
        // Si Safari rechaza la acción nativa, descargar en vez de bloquear.
        console.warn('Compartir PDF no disponible:',err?.message||String(err));
      }
    }
    downloadBlob(blob);
    notify(printIntent?'PDF guardado: abrilo en Archivos para imprimirlo.':'PDF descargado: podés adjuntarlo a WhatsApp o correo.');
  }
  let busy=false;
  async function operate(action){
    if(busy||closed)return;
    busy=true;
    const buttons=[...actions.querySelectorAll('button')].filter(x=>!x.hasAttribute('data-close'));
    buttons.forEach(b=>{b.disabled=true;});
    notify('Preparando el documento…');
    try{
      const blob=await pdfBlob();
      if(closed)return;
      if(action==='save'){downloadBlob(blob);notify('PDF guardado. Podés volver a Cobros.');}
      else await shareOrSave(blob,action==='print');
    }catch(err){
      if(!closed)notify('No se pudo preparar el PDF: '+(err?.message||String(err))+'. Probá nuevamente o usá la vista de escritorio.');
    }finally{busy=false;buttons.forEach(b=>{b.disabled=false;});}
  }
  const back=makeButton('← Volver a la app',close,'sii-print-back');
  back.setAttribute('data-close','true');
  makeButton('Imprimir',()=>{
    if(mobile){void operate('print');return;}
    try{iframe.contentWindow?.focus();iframe.contentWindow?.print();}
    catch{notify('No se pudo abrir Imprimir. Usá Guardar PDF.');}
  },'sii-print-primary');
  makeButton('Compartir',()=>{void operate('share');});
  makeButton('Guardar PDF',()=>{void operate('save');});
  header.appendChild(actions);
  overlay.append(header,status,iframe,mobilePreview);
  document.body.style.overflow='hidden';
  document.body.appendChild(overlay);
  window.addEventListener('keydown',escape);
  back.focus();
}
