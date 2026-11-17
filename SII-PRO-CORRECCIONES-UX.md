# SII PALLETS PRO — correcciones de vista y productividad

**Repositorio personal:** rpmartinrodriguez/CONTROL-SII-PALLETS-APP.
**Firebase único:** sii-pallets-app. Bases originales sin modificaciones. PR de pruebas #4.

## Pruebas en dispositivos
1. Revisar Cobros en celulares de 320/375/430 px: nombres largos, facturas grandes, montos y botones táctiles no deben quedar cortados.
2. Tocar Imprimir desde Cobros, Calendario y Pagos Avanzados: comprobar vista previa interna, Imprimir, Compartir, Guardar PDF y Volver. Si iOS no abre el diálogo, usar Guardar PDF.
3. Abrir la app: por defecto queda Cobros. Con avisos sin leer debe aparecer flotante; al cerrarlo los visibles quedan marcados y no vuelven en el mismo dispositivo.
4. Campanita: cada aviso tiene ojo (abrir sección y marcar visto) y eliminar (descartar). Verificar tras recargar.
5. Cuadro azul: Cobros principal arriba, Pagos abajo y Diferencia, todos los importes legibles sin plazo de vencimiento; tocar cobros/pagos para navegar.
6. Presupuestos guardados: abrir listado agrupado por cliente, expandir cada cliente, copiar cotización, verificar nuevo número y fecha actual, cliente, cuenta, productos. Los precios copiados aparecen rojos hasta editarlos o confirmarlos.
7. Verificar que la recepción push ya operativa siga funcionando sin cambios.

## Persistencia y límites
- Leído/eliminado se guarda localmente por dispositivo y UID; no se sincroniza entre teléfonos distintos.
- Bandeja recupera los eventos enviados de sii_push_delivered de últimos 30 días, máximo 40 registros por consulta para reducir cuota Spark.
- Si el movimiento fue eliminado, su detalle permanece en el aviso pero no es posible volver a abrir el registro borrado.
- La impresión/compartir archivo usa el navegador; compartir depende del soporte Web Share API, y si no funciona se descarga el PDF.
- No se modifican registros financieros con estas correcciones de vista.
- Seguridad pendiente de endurecimiento: autenticación anónima no acredita autorización laboral; limitar el acceso a información financiera antes de exponerla a visitantes.
