/* Visor interno de reportes: Imprimir, Compartir, Guardar y Volver. */
const clean=s=>String(s||'Reporte_SII').replace(/[^a-zA-Z0-9_.-]+/g,'_').slice(0,90);
export function abrirVisorImpresion({titulo,contenido,css,nombreArchivo}){
  if(typeof document==='undefined')return;
  document.getElementById('sii-visor-impresion')?.remove();
  const overlay=document.createElement('section');
  overlay.id='sii-visor-impresion';overlay.setAttribute('role','dialog');
  overlay.setAttribute('aria-modal','true');
  overlay.setAttribute('aria-label','Imprimir o compartir informe');
  overlay.className='sii-print-overlay';
  const header=document.createElement('header');header.className='sii-print-toolbar';
  const label=document.createElement('div');label.className='sii-print-heading';
  const title=document.createElement('strong');title.textContent=titulo||'Informe SII PALLETS';
  const desc=document.createElement('small');desc.textContent='Podés imprimir, compartir o volver a la app sin salir.';
  label.append(title,desc);header.appendChild(label);
  const actions=document.createElement('div');actions.className='sii-print-actions';
  const makeButton=(text,action,extra='')=>{
    const b=document.createElement('button');b.type='button';b.textContent=text;
    b.className='sii-print-btn '+extra;b.addEventListener('click',action);actions.appendChild(b);return b;
  };
  const previousFocus=document.activeElement;
  const oldOverflow=document.body.style.overflow;
  const close=()=>{window.removeEventListener('keydown',escape);document.body.style.overflow=oldOverflow;overlay.remove();previousFocus?.focus?.();};
  const escape=e=>{if(e.key==='Escape')close();};
  const filename=clean(nombreArchivo)+'.pdf';
  const contentHTML='<!doctype html><html lang="es"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><style>'+
    (css||'')+' @media print{@page{size:A4;margin:12mm}body{padding:0!important}}'+
    '</style></head><body><div class="report-container">'+(contenido||'')+'</div></body></html>';
  const iframe=document.createElement('iframe');
  iframe.className='sii-print-frame';iframe.title='Vista previa del informe';
  iframe.setAttribute('sandbox','allow-same-origin allow-modals');iframe.srcdoc=contentHTML;

  async function pdfBlob(){
    const html2pdfModule=await import('html2pdf.js');
    const html2pdf=html2pdfModule.default||html2pdfModule;
    const box=document.createElement('div');
    box.style.cssText='position:fixed;left:-200vw;top:0;width:794px;background:white;padding:12px;';
    box.innerHTML='<style>'+(css||'')+'</style><div class="report-container">'+contenido+'</div>';
    document.body.appendChild(box);
    try{
      return await html2pdf().set({
        margin:10,filename,image:{type:'jpeg',quality:.96},
        html2canvas:{scale:1.7,useCORS:true,logging:false},
        jsPDF:{unit:'mm',format:'a4',orientation:'portrait'}
      }).from(box).outputPdf('blob');
    }finally{box.remove();}
  }
  function downloadBlob(blob){
    const url=URL.createObjectURL(blob),a=document.createElement('a');
    a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),30000);
  }
  const save=async()=>{try{downloadBlob(await pdfBlob());}catch(e){alert('No se pudo guardar el PDF: '+(e?.message||e));}};
  makeButton('← Volver',close,'sii-print-back');
  makeButton('Imprimir',()=>{try{iframe.contentWindow?.focus();iframe.contentWindow?.print();}catch{
    alert('No se pudo abrir Imprimir. Probá Guardar PDF para imprimir desde el archivo.');
  }},'sii-print-primary');
  makeButton('Compartir',async()=>{
    try{
      const blob=await pdfBlob(),file=new File([blob],filename,{type:'application/pdf'});
      if(navigator.share&&(!navigator.canShare||navigator.canShare({files:[file]}))){
        await navigator.share({title:titulo||'Informe SII PALLETS',files:[file]});
      } else {
        downloadBlob(blob);
        alert('El dispositivo no admite compartir archivos directamente. Se descargó el PDF para adjuntarlo.');
      }
    }catch(e){if(e?.name!=='AbortError')alert('No se pudo compartir: '+(e?.message||e));}
  });
  makeButton('Guardar PDF',save);
  header.appendChild(actions);overlay.append(header,iframe);
  document.body.style.overflow='hidden';document.body.appendChild(overlay);
  window.addEventListener('keydown',escape);
  actions.firstChild?.focus();
}
