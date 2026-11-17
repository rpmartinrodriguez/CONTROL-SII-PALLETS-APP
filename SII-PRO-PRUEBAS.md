# SII PALLETS PRO — primera versión de prueba (mobile UX + auditoría)

**Solo repo personal:** rpmartinrodriguez/CONTROL-SII-PALLETS-APP.
**Firebase de la nueva app:** sii-pallets-app.
**No modificar:** repositorio ni bases originales.

## Cambios incluidos
- Dock inferior fijo móvil con accesos a Pagos, Cobros, Balance y Caja, más un menú de secciones restantes.
- Soporte para áreas seguras de iPhone, botones táctiles amplios, menú accesible, Escape para cerrar y contraste mejorado.
- Menú horizontal original solo en escritorio; búsqueda de cabecera solo en Cobros/Cartera/Gastos.
- División de módulos por carga dinámica (`React.lazy` y `Suspense`): Facturación, Presupuestos, Caja, Balance, Cobros/Cartera, Pallets y Migración.
- Modo Pagos adaptado para dejar espacio a la navegación inferior.
- Botón de auditoría en MIGRACIÓN / RESPALDO para comparar las dos bases originales **actuales** con el Firestore personal, por ruta e ID.
- El informe reporta número de registros del origen, destino, idénticos, faltantes, diferentes y adicionales; la auditoría no escribe datos.

## Comprobaciones antes de publicar
1. Ejecutar `npm run build` / pipeline GitHub Actions.
2. Abrir Deploy Preview en iPhone y Android; confirmar que el dock no tapa tablas, iframes ni formularios.
3. Revisar cada módulo: Pagos, Cobros, Balance, Caja, Facturación, Presupuestos, Cartera, Pallets.
4. No registrar movimientos reales durante la prueba; revisar funcionalidades sin guardar en producción.
5. MIGRACIÓN / RESPALDO → Verificar igualdad de ambas bases ahora. Esperar que termine: si hay **0 faltantes, 0 diferentes, 0 adicionales**, las rutas verificadas coinciden **en ese momento**.
6. Además, comparar manualmente saldos de Caja, Pagos, Cobros y bancos; el código no certifica saldos calculados ni colecciones desconocidas.
7. Revisar consola Firebase para detectar colecciones que el SDK web no permite enumerar.
8. Finalizada la migración, retirar el acceso público a la herramienta y definir reglas de acceso autorizadas.

## Alcance y precauciones
- Esta fase es de UX y performance básica; no cambia los cálculos financieros ni los datos de Firestore.
- El acceso Firebase anónimo **no es control de administrador**. Si las reglas aceptan cualquier anónimo, los datos financieros podrían estar expuestos. Debe corregirse antes del uso público definitivo.
- La auditoría contra origen puede consumir lecturas de la cuota gratuita Spark. No se ejecuta automáticamente ni en segundo plano.
- La aprobación del build no sustituye pruebas reales en dispositivos.
- El ZIP y la auditoría solo cubren rutas conocidas; índices, Storage, Authentication y `localStorage` no se transfieren.
