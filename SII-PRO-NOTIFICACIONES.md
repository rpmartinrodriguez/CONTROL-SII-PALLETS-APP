# SII PALLETS PRO — notificaciones Push y configuración

## Todo en el único Firebase PERSONAL
Proyecto: `sii-pallets-app`. **No hay dos Firebase activos** para esta versión.
- Cobros: `cobros_public_shared/main_list/items/{id}`.
- Pagos tradicionales: `cheques_public_shared/main_list/items/{id}`.
- Pagos Avanzados: `finanzas/cheques` (un documento con array `data`).
- Bancos: `finanzas/bancos`.
- Clientes y presupuestos PDF: `clientes_presupuestos_sii` e `historial_presupuestos_sii`.

## Avisos implementados
- Nuevo cobro registrado.
- Nuevo pago registrado (tradicional o Pagos Avanzados).
- Cobro marcado como pagado/saldado.
- Pago marcado como pagado/saldado.
- Cobro o pago con fecha de vencimiento EXACTAMENTE dos días después de la fecha argentina. Se muestra nombre, número y saldo pendiente.
- No envía avisos por los datos históricos durante la inicialización del seguimiento.
- Se detectan cambios al registrar movimientos desde la nueva app; revisión programada diaria para eventos omitidos/vencimientos. Si no se configuraron claves y dispositivos, no se envía nada.

## Activación segura en Netlify personal (NO en el repositorio original)
1. En Firebase Console del proyecto `sii-pallets-app` → Configuración → Cloud Messaging → Web Push certificates, generar una clave Web Push y copiar **solo la clave pública**.
2. En Netlify personal → Environment variables, crear `VITE_SII_FCM_VAPID_PUBLIC` con esa clave pública. Es normal que el navegador la reciba.
3. En Firebase Console del MISMO proyecto → Cuentas de servicio, generar un archivo JSON de cuenta de servicio. **Es secreto**, NO subirlo a GitHub ni enviarlo por chat.
4. Guardar todo el contenido JSON únicamente en la variable **privada de servidor** de Netlify `SII_FIREBASE_SERVICE_ACCOUNT_JSON`. Debe tener `project_id: sii-pallets-app`.
5. Abrir la app nueva → Notificaciones push → copiar el UID de la sesión anónima de ese dispositivo. Crear variable de Netlify `SII_PUSH_ALLOWED_UIDS` con ese UID. Para varios dispositivos, separarlos con comas.
6. Desplegar después de configurar las variables de entorno. No pasar `SII_FIREBASE_SERVICE_ACCOUNT_JSON` a ninguna variable VITE_ ni al código frontend.
7. Abrir la app desde HTTPS; en iPhone instalar la PWA desde Compartir → Agregar a inicio. Tocar **Activar notificaciones** y aceptar el permiso. Repetir por cada dispositivo autorizado.
8. Pulsar **Revisar movimientos** una vez al activar: inicializa la referencia de datos existentes sin mandar miles de avisos históricos.
9. Crear un movimiento controlado o cambiar su estado y comprobar recepción. Los avisos dependen de que el dispositivo y las credenciales estén autorizados y del soporte Web Push de su navegador.
10. La función programada `push-tick` corre `0 12 * * *` en UTC (09:00 Argentina) desde el deploy de PRODUCCIÓN. Las vistas previas de Netlify NO ejecutan tareas programadas automáticamente.

## Seguridad y costos
- No hay nueva cuenta de usuario o contraseña en el frontend: se usa Firebase Anonymous, pero `SII_PUSH_ALLOWED_UIDS` en servidor evita registrar dispositivos no autorizados.
- **Anonymous no restringe por sí solo quién puede escribir movimientos a Firestore.** Revisar reglas de seguridad antes de publicar cambios: los UID del usuario autorizado deben tener permisos explícitos.
- Cloud Messaging requiere Web Push/VAPID, service worker y HTTPS. El envío automático de notificaciones requiere el Admin SDK de servidor y su credencial privada.
- Las funciones programadas de Netlify se ofrecen en todos los planes, sujetas a sus límites. Las lecturas y escrituras de Firestore continúan sujetas a cuotas Spark.
- El servidor lee las rutas mencionadas y guarda estados auxiliares en `sii_push_snapshot`, `sii_push_devices` y `sii_push_delivered`; nunca consulta Firebase original.
- Para evitar duplicados, cada aviso se registra por un ID lógico. El primer escaneo establece referencias de comparación y no envía avisos masivos sobre los documentos migrados.

## Límites técnicos
- El cambio en el frontend dispara una comprobación del servidor al guardar, pero no garantiza entrega instantánea si el dispositivo está sin red, sin permiso, o el proveedor Push retrasa la recepción.
- Las operaciones de fuera de la nueva app solo se observan durante la verificación programada; no hay trigger de Firestore Cloud Functions.
- Documentos masivos pueden agotar la cuota gratuita de Firestore o el límite temporal de Netlify; revisar consumos según volumen real.
- Las notificaciones de datos son un complemento; el sistema de cobros/pagos y la vista de vencimientos siguen siendo la fuente operativa principal.
