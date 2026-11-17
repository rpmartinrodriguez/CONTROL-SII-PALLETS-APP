# SII PALLETS — Migración desde la aplicación, sin cuentas extra y sin Blaze

## Bases de origen y destino
- Origen ControlCheque: controlcheque-19226.
- Origen Pagos: listapagos.
- Destino personal: sii-pallets-app.
- Repositorios: martinrodriguez-dotcom/ControlCheque y rpmartinrodriguez/CONTROL-SII-PALLETS-APP.

## Acceso
- La herramienta usa la misma sesión Firebase anónima que ya utiliza la aplicación. No requiere crear correo ni contraseña, ni configurar VITE_SII_MIGRATION_ADMIN_UID.
- El botón **MIGRACIÓN / RESPALDO** queda visible sobre la barra horizontal. Se puede abrir usando ?migracion=1.
- IMPORTANTE: Firebase Anonymous no autentica la identidad del propietario. Si las reglas Firestore permiten a cualquier usuario anónimo leer/escribir, esa persona también puede operar sobre estos datos. Restringir reglas de acceso y retirar/inhabilitar la herramienta tras la migración.

## Descarga de las dos bases
- Opción A: app original → MIGRACIÓN / RESPALDO → Descargar respaldo completo (ZIP).
- Opción B (preferida si el Netlify original no recibió el despliegue): app personal nueva → MIGRACIÓN / RESPALDO → Descargar respaldo completo (ZIP). Esta opción se conecta en solo lectura a las dos bases viejas con Firebase Auth anónima en el origen principal.
- El ZIP contiene dos JSON y un manifiesto con recuentos y hashes SHA256. Descargarlo y guardarlo de forma privada.
- Si se producen errores de permisos, revisar las reglas actuales de Firebase sin abrirlas públicamente.
- El navegador solo exporta las colecciones y subcolecciones conocidas del código; comprobar en Firebase Console la existencia de otras colecciones antes de declarar completitud.

## Restauración
1. En la NUEVA app, abrir MIGRACIÓN / RESPALDO (con Firebase nuevo sii-pallets-app).
2. Seleccionar ZIP y presionar Comparar con la base nueva.
3. Revisar faltantes, idénticos y conflictos. Con conflictos, no importar.
4. Confirmar la operación escribiendo IMPORTAR. Se crean hasta 1500 documentos por ejecución con transacciones que impiden sobrescribir datos ajenos.
5. Repetir comparación e importación si quedan documentos pendientes.
6. Verificar cero faltantes y cero conflictos; revisar saldos de Caja, Cobros, Pagos, bancos, Balance, Cartera y Pallets.

## Corte y limitaciones
- Antes del corte definitivo, suspender operaciones en las apps viejas y realizar un respaldo final actualizado.
- Documentos que cambiaron desde una importación anterior requieren conciliación, no reemplazo automático.
- No borrar los proyectos viejos hasta verificar todos los datos y reglas.
- El ZIP no copia usuarios Firebase Authentication, reglas, índices, archivos Storage ni datos de localStorage (incluyendo correlativos locales de Presupuestos PDF).
- Reglas seguras y autorización real deben configurarse antes de producción; la sesión anónima no diferencia administradores de visitantes.
- La copia usa operaciones comunes de Firestore sujetas a cuotas Spark. No requiere activar Blaze.
