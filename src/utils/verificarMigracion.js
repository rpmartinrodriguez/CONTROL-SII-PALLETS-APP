// Auditoría SOLO LECTURA de la migración SII.
// Compara datos actuales de los dos Firebase originales con el Firebase personal.
// El SDK web solo puede recorrer las rutas conocidas por la app, no colecciones desconocidas.
import { collection, documentId, getDocs, limit, orderBy, query, startAfter } from 'firebase/firestore';
import { abrirRespaldo, COLECCIONES_INCLUIDAS, crearRespaldo, inspeccionarDestino } from './migracionFirestore';

const RUTAS = [...COLECCIONES_INCLUIDAS.principal, ...COLECCIONES_INCLUIDAS.pagos];
const PUBLICAR_MAX_DETALLES = 25;

export async function verificarMigracionEnVivo(dbDestino, conectarOrigenes, informar = () => {}) {
  if (typeof conectarOrigenes !== 'function') throw new Error('Falta conexión de lectura con los Firebase anteriores.');
  informar('Conectando con las dos bases anteriores...');
  const origenes = await conectarOrigenes();
  informar('Leyendo datos actuales de ControlCheque y Pagos Avanzados...');
  const { bytes } = await crearRespaldo(origenes.principalDb, origenes.pagosDb, informar);
  // No crea archivos en disco ni escribe en ninguno de los proyectos.
  const archivoVirtual = {
    name: 'comparacion-en-vivo.zip',
    size: bytes.byteLength,
    arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
  };
  const respaldo = await abrirRespaldo(archivoVirtual);
  const esperados = new Set(respaldo.documentos.map(x => x.ruta));

  informar('Comparando ID y campos con Firebase personal (solo lectura)...');
  const comparacion = await inspeccionarDestino(dbDestino, respaldo, informar);

  // La comparación normal detecta ausentes/diferentes; también revisamos documentos
  // adicionales en el destino que no pertenecen a ninguno de los orígenes.
  let revisadosDestino = 0;
  const adicionales = [];
  for (const ruta of RUTAS) {
    let anterior = null;
    while (true) {
      const filtros = [orderBy(documentId()), limit(200)];
      if (anterior) filtros.push(startAfter(anterior));
      const pagina = await getDocs(query(collection(dbDestino, ruta), ...filtros));
      for (const snap of pagina.docs) {
        revisadosDestino++;
        if (!esperados.has(snap.ref.path)) adicionales.push(snap.ref.path);
      }
      informar('Revisando registros adicionales en la nueva base: ' + revisadosDestino);
      if (pagina.size < 200) break;
      anterior = pagina.docs[pagina.docs.length - 1];
    }
  }
  const resumenOrigenes = respaldo.manifest.componentes.map(componente => ({
    proyecto: componente.proyecto,
    cantidad: componente.cantidad,
    colecciones: componente.colecciones
  }));
  const faltantes = comparacion.faltantes.map(x => x.ruta);
  const diferencias = comparacion.conflictos;
  return {
    comprobadoEn: new Date().toISOString(),
    rutasAnalizadas: RUTAS.length,
    totalOrigen: comparacion.total,
    totalDestino: revisadosDestino,
    iguales: comparacion.iguales.length,
    faltantes: faltantes.length,
    diferentes: diferencias.length,
    adicionales: adicionales.length,
    ejemplos: {
      faltantes: faltantes.slice(0, PUBLICAR_MAX_DETALLES),
      diferentes: diferencias.slice(0, PUBLICAR_MAX_DETALLES),
      adicionales: adicionales.slice(0, PUBLICAR_MAX_DETALLES)
    },
    origenes: resumenOrigenes,
    identicos: faltantes.length === 0 && diferencias.length === 0 && adicionales.length === 0,
    alcance: 'Solo colecciones/rutas conocidas por la versión actual de SII PALLETS. No compara reglas, usuarios Auth, Storage ni localStorage.'
  };
}
