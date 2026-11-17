# SII PALLETS — Migración desde la aplicación (ZIP, sin Blaze)

## Proyectos
- Original principal: controlcheque-19226.
- Original Pagos Avanzados: listapagos.
- Firebase nuevo personal: sii-pallets-app.
- Repo original: martinrodriguez-dotcom/ControlCheque.
- Repo personal: rpmartinrodriguez/CONTROL-SII-PALLETS-APP.

## Configuración de acceso administrativo (OBLIGATORIA)
1. Abrir Firebase Console, proyecto controlcheque-19226 → Authentication → Sign-in method: activar Email/Password.
2. En Authentication → Users crear usuario administrador por correo y contraseña y copiar su UID.
3. En Netlify ORIGINAL configurar variable de entorno VITE_SII_MIGRATION_ADMIN_UID con ese UID. Publicar de nuevo.
4. Repetir los pasos para el proyecto nuevo sii-pallets-app y su Netlify PERSONAL. Los UID son diferentes aunque el correo sea idéntico.
5. En la pestaña MIGRACIÓN iniciar sesión con ese usuario. La sesión es temporal y aislada del login anónimo de la app.
6. Las reglas Firestore deben permitir las lecturas y escrituras del operador autorizado. Nunca usar reglas públicas (allow read, write: if true). La restricción por UID en el cliente es solo de interfaz; la seguridad verdadera exige reglas Firestore.

## Respaldo original
1. Abrir app ORIGINAL → menú MIGRACIÓN → iniciar sesión → Descargar respaldo completo (ZIP).
2. Se exportan todas las rutas conocidas usadas por ControlCheque y finanzas/* del proyecto listapagos.
3. ZIP: manifiesto, dos archivos JSON con documentos de origen y sumas SHA256; guardar PRIVADO y fuera de GitHub.
4. Si alguna consulta falla, no se genera un ZIP parcial.

## Importación personal
1. Confirmar que la app nueva apunta a sii-pallets-app (en rama de migración). No cargar movimientos reales antes del corte.
2. NUEVA → MIGRACIÓN → iniciar sesión → seleccionar ZIP → Comparar con la base nueva (no escribe).
3. Examinar documentos ausentes, idénticos y en conflicto. Con conflictos, se bloquea la importación y no se sobreescribe.
4. Confirmar, escribir IMPORTAR y pulsar Restaurar documentos faltantes. Importa hasta 1500 por ejecución; repetir con el mismo archivo para continuar.
5. El proceso vuelve a leer los documentos y comprobar los valores, IDs y rutas.
6. Comparar totales de Pagos, Caja, Cobros, Balance, bancos, Cartera, Facturación, Pallets y Presupuestos.

## Corte seguro
- Mantener bases originales sin borrar. Antes del cambio final, suspender altas/modificaciones, descargar ZIP final y verificarlo.
- Si un documento ya importado fue modificado después del primer ZIP, la herramienta detecta diferencia y se detiene, requiere conciliación específica.
- No pasar a producción sin contar documentos, comparar saldos y revisar reglas de acceso.

## Limitaciones
- El navegador no descubre colecciones desconocidas: verificar visualmente en Firebase Console que las rutas usadas por la app cubren los datos relevantes.
- Authentication, Storage, reglas, índices, metadatos Firestore de creación/edición, localStorage y número local de Presupuestos PDF se respaldan aparte.
- Se preservan los ID, rutas y valores Firestore con los tipos conocidos. No se borran datos ni se sobrescriben documentos distintos.
- Las operaciones consumen cuotas gratuitas ordinarias de Spark; no requiere Blaze.
