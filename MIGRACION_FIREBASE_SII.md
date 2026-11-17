# Migración de Firebase de SII PALLETS — Plan de corte seguro

**Estado:** configuración del nuevo Firebase aplicada SOLO a esta rama de pruebas; las bases originales y `main` no se han modificado. No se han exportado ni importado documentos todavía.
**Repositorio de destino:** `rpmartinrodriguez/CONTROL-SII-PALLETS-APP`.
**Rama de trabajo:** `feature/migracion-firebase-sii-20261116`.
**Proyectos de origen:** `controlcheque-19226`, `listapagos`.
**Proyecto destino:** `sii-pallets-app` (unifica documentos de ambas bases anteriores, conservando rutas e IDs).

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

1. No usar producción nueva para cargar movimientos de prueba: `main` sigue conectado a los Firebase de origen. La rama de pruebas está conectada únicamente al proyecto nuevo y vacío.
2. **COMPLETADO:** `firebaseConfig` web entregado por el usuario y aplicado únicamente en la rama de migración (`src/firebase.js`, `src/hooks/usePagosReales.js`, `public/pagos.html`). No se publican contraseñas, tokens privados ni archivos de cuentas de servicio.
3. Verificar que la base Cloud Firestore de destino esté creada y que Authentication > Sign-in method > Anonymous esté habilitado. En la rama de pruebas **Pagos ya inicia sesión anónima** antes de leer Firestore; revisar permisos y reglas. La autenticación anónima por sí sola **no impide acceso ajeno** a los datos comerciales: antes del corte a producción hay que definir una autorización real y reglas seguras.
4. Determinar si los tres proyectos tienen facturación habilitada, para elegir el método de migración: export/import oficial vía Cloud Storage si usan Blaze, o export/import controlado conservando tipos Firestore y rutas si usan Spark. No activar reglas abiertas para facilitar la copia. Si hay Blaze y acceso IAM, la vía oficial es exportar la base completa de cada uno de los dos proyectos antiguos y luego importar ambos conjuntos al destino (las rutas no se superponen). El import de Firestore conserva IDs y sobreescribe los IDs existentes; por eso no usar destino con datos reales antes de respaldarlo.

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

## Decisiones y comprobaciones previas solicitadas (16/11/2026)

- Consultar al usuario si tiene acceso administrativo a los dos Firebase de origen (`controlcheque-19226` y `listapagos`).
- Consultar si los proyectos de origen y destino usan **Spark** o **Blaze**; la exportación administrada oficial requiere **Blaze en origen y destino**.
- Revisar si existen otras colecciones fuera del inventario (exportar la base completa, no solo las colecciones visibles en la app).
- No instalar reglas `allow read, write: if true`, no publicar credenciales de Admin SDK ni claves privadas en GitHub o Netlify.
- En caso de importar usando Cloud Storage: preparar permisos IAM del proyecto destino sobre los buckets de exportación, revisar ubicaciones y configurar índices, Authentication y reglas por separado.
- Acordar periodo de corte sin escrituras en las aplicaciones antiguas, respaldo adicional y conciliación final de cantidades/saldos.
