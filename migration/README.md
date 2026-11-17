# SII PALLETS — Migración de Firestore SIN Blaze

La herramienta funciona **desde una computadora**, fuera de la web de Netlify. 
No utiliza la función administrada de exportación de Google Cloud que requiere Blaze.
Copia **todos los documentos y subcolecciones** de las dos bases antiguas; respeta IDs, rutas, arrays, mapas, Timestamp, referencias y valores. 
No transfiere reglas, índices, usuarios Authentication ni metadatos internos createTime/updateTime.
NO borrar los proyectos anteriores hasta comprobar todo.

## Paso 1: preparar

1. Instalar Node.js 22 LTS en la computadora.
2. Descargar el repositorio privado o público, entrar a esta carpeta \`migration\`.
3. Ejecutar \`npm install\` aquí.
4. Crear las carpetas \`keys\` y \`backups\` (si no existen).
5. En Firebase Console de cada proyecto, entrar en Configuración del proyecto → Cuentas de servicio → **Generar nueva clave privada**. Guardar **LOCALMENTE** los archivos como:
   - \`keys/controlcheque-19226.json\` (Firebase antiguo de ControlCheque)
   - \`keys/listapagos.json\` (Firebase antiguo de Pagos)
   - \`keys/sii-pallets-app.json\` (Firebase nuevo)
   Requiere permisos administrativos en cada proyecto. Si la organización impide crear claves de servicio, no desactivar las políticas: buscar otra vía segura.
6. **Nunca pasar las claves en el chat, ni subirlas a GitHub/Netlify, ni mandarlas por WhatsApp**. El \`.gitignore\` protege las carpetas en Git, pero mantené los respaldos seguros y controlá manualmente los archivos antes de subir.
7. Confirmar que Cloud Firestore \`(default)\` está creado en el nuevo Firebase. Conservar la app original operativa y evitar movimientos en la nueva instalación.

## Paso 2: descargar todos los documentos

Desde la carpeta \`migration\` ejecutar en Terminal / PowerShell:

\`\`\`bash
node migrar.mjs export keys/controlcheque-19226.json
node migrar.mjs export keys/listapagos.json
\`\`\`

Genera por cada origen un JSON local dentro de \`backups/\`, y su archivo de comprobación SHA256, sin subir datos a internet ni GitHub. El programa recorre recursivamente colecciones y subcolecciones, incluso si falta el documento padre.

Guardar copias de ambos JSON y sus \`.sha256\` en un lugar seguro y separado. Si falla alguna lectura, **no** uses un archivo de respaldo parcial: la exportación solo se guarda al terminar.

## Paso 3: revisar las copias

\`\`\`bash
node migrar.mjs inspect backups/NOMBRE-EXACTO-DEL-PRIMER-BACKUP.json
node migrar.mjs inspect backups/NOMBRE-EXACTO-DEL-SEGUNDO-BACKUP.json
\`\`\`

Confirmar fechas, cantidades y colecciones, y contrastar con lo visible en ambas consolas Firebase. 
Si existen usuarios registrados con correo/contraseña, respaldar Authentication por separado; **no** se exportan con este script.

## Paso 4: importar sin riesgo de sobrescritura

Primero realizar simulación sin escribir:

\`\`\`bash
node migrar.mjs import backups/PRIMER-BACKUP.json keys/sii-pallets-app.json
node migrar.mjs import backups/SEGUNDO-BACKUP.json keys/sii-pallets-app.json
\`\`\`

Si el proyecto nuevo está vacío y los dos respaldos son correctos, realizar importaciones reales:

\`\`\`bash
node migrar.mjs import backups/PRIMER-BACKUP.json keys/sii-pallets-app.json --apply
node migrar.mjs import backups/SEGUNDO-BACKUP.json keys/sii-pallets-app.json --apply
\`\`\`

El script **nunca sobrescribe un documento existente**: usa create() y cancela al detectar una colisión. Por seguridad limita las escrituras a 4.000 por ejecución.

Si quedan documentos pendientes o se interrumpe, usar **el mismo respaldo** y **--apply --resume**; compara los documentos ya escritos y continúa solo cuando son idénticos.

\`\`\`bash
node migrar.mjs import backups/PRIMER-BACKUP.json keys/sii-pallets-app.json --apply --resume
\`\`\`

No se recomienda importar a una base que ya contenga movimientos nuevos. Si el programa encuentra un documento con mismo ID y distinto contenido, se detiene sin reemplazarlo.

## Paso 5: verificar cada documento

\`\`\`bash
node migrar.mjs verify backups/PRIMER-BACKUP.json keys/sii-pallets-app.json
node migrar.mjs verify backups/SEGUNDO-BACKUP.json keys/sii-pallets-app.json
\`\`\`

Ambos deben indicar **0 documentos ausentes/diferentes**. 
Luego revisar a mano total de pagos, cobros, balances, bancos, Caja y registros de Pallets, y configurar reglas e índices de Firestore, Authentication y permisos de seguridad.

## Paso 6: corte definitivo

Acordar un periodo sin escrituras en las apps viejas, hacer exportación final e importar/verificar esa copia antes del cambio definitivo. Como importaciones previas no sobrescriben, **para datos modificados tras el primer respaldo se requiere un procedimiento de reconciliación específico**; no usar --resume si hay diferencias.
Recién después de la conciliación y las verificaciones, publicar la rama de migración en \`main\` y cambiar la versión productiva de Netlify.
No se transfieren números de presupuesto guardados en localStorage de cada dispositivo.

## Cuota gratuita Spark

Cada documento exportado/importado/validado consume operaciones Firestore normales. La cuota estándar de Spark incluye hasta 50.000 lecturas y 20.000 escrituras por día por base gratuita. Si las bases son grandes, exportar/importar por etapas; **nunca hace falta activar Blaze solo por este script**. El destino debe ser la base Firestore \`(default)\`.

## Seguridad

- La exportación produce datos comerciales privados en formato JSON sin cifrado; guardarlos en carpeta protegida o respaldo cifrado.
- Las claves JSON otorgan acceso administrativo; eliminarlas de la computadora cuando finalice la migración.
- Las reglas de Firestore no se copian; nunca habilitar \`allow read, write: if true\`.
- La app actual utiliza Auth anónimo: antes de producción, restringir quién puede leer/escribir información financiera.
