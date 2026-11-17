# SII PALLETS PRO — Push automático por dispositivo (sin lista manual de UID)

## Proyecto y alcance

Todas las notificaciones utilizan **exclusivamente** el Firebase personal `sii-pallets-app`.
La aplicación original y sus Firebase anteriores no se modifican.

## Funcionamiento universal

- El usuario abre **Notificaciones push** en la app y presiona **Activar notificaciones**.
- El navegador solicita permiso (en iPhone debe ser una PWA instalada en inicio).
- La app obtiene el token FCM de **ese equipo**.
- La función segura de Netlify verifica el ID token de Firebase de la sesión, y guarda o actualiza automáticamente en Firestore `sii_push_devices/{SHA256(token)}`:
  - Token FCM del dispositivo, UID Firebase actual, dispositivo/plataforma, navegador, fecha de alta y última actualización, estado habilitado.
- La lista de destinatarios se obtiene automáticamente de `sii_push_devices`, no de variables manuales.
- Si el usuario vuelve a abrir la app y previamente aceptó, la PWA renueva el registro automáticamente sin volver a pedir el permiso.
- Si toca **Desactivar en este equipo**, se desregistra y se elimina el token FCM local.
- Cada equipo puede activarse o desactivarse de manera independiente. **No se copia ningún UID**.

## Variables de Netlify (proyecto PERSONAL únicamente)

1. `VITE_SII_FCM_VAPID_PUBLIC` — clave pública Web Push de Firebase Cloud Messaging, en Build y Deploy Previews (luego Production).
2. `SII_FIREBASE_SERVICE_ACCOUNT_JSON` — JSON completo de credencial privada Firebase Admin SDK, solo **Functions** (nunca variable `VITE_`, nunca GitHub ni chat).
3. `SII_PUSH_AUTO_ENROLLMENT` — **universal**, valor exacto `true` para permitir el registro automático en los dispositivos. No poner UID ni teléfonos. Scope Functions, habilitar por contexto Deploy Previews primero, Production solo cuando los controles de acceso estén listos.

La vieja variable `SII_PUSH_ALLOWED_UIDS` **ya no se necesita y se puede eliminar de Netlify**. No se debe usar `SII_PUSH_AUTO_ENROLLMENT` como contraseña o mecanismo de identificación: es un interruptor del servidor.

## IMPORTANTE: proteger antes de activar para producción

**Firebase Authentication anónima NO identifica a empleados de SII PALLETS.** Cualquiera con acceso a la web puede crear una identidad anónima, presionar Activar push y solicitar recibir los datos financieros de los avisos. Las verificaciones de origen web y token de Firebase por sí solas no prueban que la persona esté autorizada.

Antes de activar `SII_PUSH_AUTO_ENROLLMENT=true` en **Production**:
- Restringir el acceso a la app a personal autorizado mediante un control de acceso real, o implementar roles/cuentas y reglas seguras en Firebase.
- Revisar reglas de Firestore para impedir acceso a movimientos a visitantes anónimos ajenos a la empresa.
- No tratar el interruptor universal como una autorización: si no existe acceso restringido a la app, no habilitarlo en producción.

En la vista previa se debe trabajar con datos de prueba o en un entorno restringido. La vista previa está conectada a la base personal: los registros financieros pueden ser reales.

## Configuración en Firebase

1. Consola Firebase `sii-pallets-app` → Configuración de proyecto → Cloud Messaging → Web Push certificates → Generate Key Pair. Copiar la **clave pública VAPID** a `VITE_SII_FCM_VAPID_PUBLIC`.
2. Configuración del proyecto → Cuentas de servicio → Firebase Admin SDK → Generar clave privada JSON (guardarla exclusivamente en el gestor seguro de Netlify).
3. Habilitar Cloud Messaging API (HTTP v1) si corresponde; verificar permisos IAM.
4. Tras modificar variables en Netlify, volver a desplegar.
5. En la app: abrir Notificaciones push → Activar notificaciones → autorizar el permiso del navegador.
6. Verificar en Firestore la colección `sii_push_devices`, que se crea automáticamente cuando se registra el primer dispositivo. No hay que crearla manualmente.

## Verificación

1. Abrir la app desde un equipo autorizado. Tocar Activar notificaciones.
2. Revisar que aparezca **Push activo en este equipo**. En Firebase, confirmar un documento nuevo en `sii_push_devices`.
3. Entrar desde otro equipo autorizado y repetir. Deben aparecer dos documentos (tokens) diferentes.
4. El modal ahora tiene únicamente **Activar notificaciones** y **Probar push**. Cuando la activación del Service Worker y el registro de Firebase terminen, muestra **✓ Notificaciones activadas**.
5. Pulsar **Probar push**: una función segura de Netlify envía una notificación FCM real, exclusivamente al token de ese dispositivo. Con la app abierta, el aviso aparece dentro de la interfaz; en segundo plano lo recibe el Service Worker.
6. Si aparece "Subscription failed - no active Service Worker", verificar que la versión de prueba actual esté desplegada y volver a abrir la app. La versión corregida espera a que el Service Worker específico de Firebase esté activo antes de pedir el token y muestra un error claro si no se activa.
7. Realizar un movimiento controlado solo en un entorno autorizado de pruebas; comprobar llegada de avisos sin crear cobros ficticios en producción.
8. La desactivación desde el dispositivo se gestiona mediante los permisos del sistema/navegador; el modal simplificado no incluye un control de baja del servidor. Para revocar un equipo debe desactivarse su documento en `sii_push_devices` desde un administrador autorizado.

## Automatización de avisos y advertencias

- Cobros, pagos tradicionales y Pagos Avanzados comparten `sii-pallets-app`, aunque sus documentos internos tienen distintas estructuras.
- Se detectan movimientos nuevos, pagos/cobros saldados o eliminados y vencimientos en dos días.
- Función programada `push-tick`: 12:00 UTC (09:00 de Argentina), en producción.
- Cloud Messaging y los navegadores no garantizan entrega inmediata. Un equipo puede no tener permiso, conexión o estar en modo restringido.
- Las funciones Netlify/FCM y las operaciones Firestore están sujetas a cuotas; no se promete costo cero en cualquier volumen.
- `SII_PUSH_AUTO_ENROLLMENT=false` (o ausente) detiene nuevos registros y excluye destinatarios en el motor push.
