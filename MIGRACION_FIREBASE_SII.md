# Migración de Firebase de SII PALLETS — Plan de corte seguro

**Estado:** preparación, sin modificar bases de origen ni la configuración Firebase de `main`.
**Repositorio de destino:** `rpmartinrodriguez/CONTROL-SII-PALLETS-APP`.
**Rama de trabajo:** `feature/migracion-firebase-sii-20261116`.
**Proyectos de origen:** `controlcheque-19226`, `listapagos`.
**Proyecto destino:** pendiente de conocer `firebaseConfig` del usuario. Propuesta: los dos orígenes dentro de un único proyecto nuevo, con nombres de rutas sin cambios.

## Inventario mínimo detectado en código

Origen principal `controlcheque-19226`:
- `cheques_public_shared/main_list/items/{id}`
- `cobros_public_shared/main_list/items/{id}`
- `cartera_public_shared/main_list/items/{id}`
- `gastos_public_shared/main_list/items/{id}` (aunque menú oculto)
- `caja_public_shared/main_list/items/{id}`
- `bancos_sii/main_list/items/{id}`
- `costos_madres_sii/main_list/items/{id}`
- `pallets_templates_sii/main_list/items/{id}`
- `presupuestos_sii/main_list/items/{id}`
- `config_sii/general`
- `config_sii/iva_YYYY-MM` (un documento por mes creado desde Facturación).

Origen de Pagos `listapagos`:
- `finanzas/cheques` (documento cuya propiedad `data` contiene array de pagos).
- `finanzas/bancos` (documento cuya propiedad `data` contiene el objeto de bancos).

Este inventario identifica solo rutas usadas explícitamente por la versión actual del código. **El respaldo debe cubrir la totalidad de las bases, incluyendo cualquier otra colección, documento o subcolección existente.**

## Preparación

1. No usar la web nueva para cargar movimientos de prueba. Actualmente todavía apunta a Firebase de origen.
2. Obtener del usuario exclusivamente configuración de aplicación Web (`firebaseConfig`: `apiKey`, `authDomain`, `projectId`, `storageBucket`, `messagingSenderId`, `appId`). **Nunca solicitar credenciales de cuenta de servicio, private keys, tokens ni passwords.**
3. Verificar que la base Cloud Firestore de destino esté creada y que Authentication > Sign-in method > Anonymous esté habilitado (App.jsx usa `signInAnonymously`). Revisar permisos y reglas. La pantalla independiente de Pagos no usa actualmente Firebase Auth; habrá que adaptarla para que cumpla las reglas del proyecto nuevo.
4. Determinar si los tres proyectos tienen facturación habilitada, para elegir el método de migración: export/import oficial vía Cloud Storage si usan Blaze, o export/import controlado conservando tipos Firestore y rutas si usan Spark. No activar reglas abiertas para facilitar la copia.

## Respaldo

- Mantener copia externa de cada base antes de la importación.
- Exportar todos los documentos y subcolecciones, IDs y tipos (Timestamp, GeoPoint, referencias, etc.) con sus rutas originales.
- Conservar copia de reglas de Firestore e índices, que no se transfieren automáticamente mediante el export/import de datos.
- Si existen usuarios de Authentication no anónimos, migrarlos por separado; Firestore no exporta cuentas Authentication.
- Comprobar número de documentos por colección y totales de Cobros, Caja, Pagos y saldos de bancos. Guardar resumen de verificación.

## Importación a base unificada

- Ejecutar primero la migración en entorno de prueba, nunca directamente en el sitio de producción.
- Importar colecciones/documentos del origen principal con sus mismas rutas e IDs.
- Importar `finanzas/cheques` y `finanzas/bancos` del segundo origen conservando su estructura.
- Detener escrituras de prueba y evitar sobrescrituras del destino antes de validar.
- La copia de prueba de Pagos tiene desactivada la creación automática de datos por defecto si `finanzas` está vacía.
- Actualizar solo en la rama de migración la config principal (`src/firebase.js`), la del lector de Pagos (`src/hooks/usePagosReales.js`) y la del iframe (`public/pagos.html`).
- Comparar registros, IDs, totales, reglas de acceso, periodos de IVA y estados reales, incluido balance sábado-viernes. No cortar hasta lograr conciliación.

## Corte a producción

- Acordar ventana sin carga de movimientos en origen y realizar respaldo final de cualquier dato nuevo.
- Validar la actualización final en base destino y revisar los enlaces de Netlify personal.
- Publicar versión nueva; conservar origen y respaldos sin borrar hasta estabilizar.
- Presupuestos PDF tiene correlativo **local en cada dispositivo** (localStorage), no almacenado en Firestore; tratarlo como función aparte y no asumir que migrar Firestore trasladará ese número.
