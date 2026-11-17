#!/usr/bin/env node
// SII PALLETS — Copia local de Firestore sin servicio export/import de Blaze.
// Esta herramienta NO usa keys en GitHub/Netlify. Lee el JSON de servicio solo localmente.
// Export e import conservan rutas, IDs y valores; NO conservan metadatos createTime/updateTime.
import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { initializeApp, cert, deleteApp } from 'firebase-admin/app';
import { getFirestore, Timestamp, GeoPoint, DocumentReference } from 'firebase-admin/firestore';

const ALLOWED_SOURCES = new Set(['controlcheque-19226', 'listapagos']);
const DESTINATION = 'sii-pallets-app';
const FORMAT = 'sii-firestore-local-v1';
const defaultWriteLimit = 4000;
const signature = (s) => createHash('sha256').update(s).digest('hex');
const panic = (message) => { throw new Error(message); };
const info = (...items) => console.log(...items);
const sorted = (obj) => Object.fromEntries(Object.entries(obj).sort(([a], [b]) => a.localeCompare(b)));

function encode(value) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || (Number.isInteger(value) && !Number.isSafeInteger(value))) {
      return { __siiType: 'number', value: String(value) };
    }
    return value;
  }
  if (value instanceof Timestamp) return { __siiType: 'timestamp', seconds: value.seconds, nanoseconds: value.nanoseconds };
  if (value instanceof GeoPoint) return { __siiType: 'geopoint', latitude: value.latitude, longitude: value.longitude };
  if (value instanceof DocumentReference) return { __siiType: 'reference', path: value.path };
  if (Buffer.isBuffer(value) || value instanceof Uint8Array) {
    return { __siiType: 'bytes', value: Buffer.from(value).toString('base64') };
  }
  if (value instanceof Date) return { __siiType: 'date', value: value.toISOString() };
  if (Array.isArray(value)) return { __siiType: 'array', value: value.map(encode) };
  if (typeof value === 'object' && Object.getPrototypeOf(value) !== null) {
    const name = value.constructor?.name;
    if (name && name !== 'Object') panic('Tipo Firestore no soportado: ' + name + '. No se generó respaldo parcial.');
  }
  if (typeof value === 'object') {
    return { __siiType: 'map', value: sorted(Object.fromEntries(Object.entries(value).map(([k, v]) => [k, encode(v)]))) };
  }
  panic('Tipo de dato no soportado durante la copia: ' + typeof value);
}
function decode(value, db) {
  if (value === null || typeof value !== 'object') return value;
  if (!value.__siiType) panic('Estructura tipada inválida en respaldo');
  switch (value.__siiType) {
    case 'number': return Number(value.value);
    case 'timestamp': return new Timestamp(value.seconds, value.nanoseconds);
    case 'geopoint': return new GeoPoint(value.latitude, value.longitude);
    case 'reference': return db.doc(value.path); // Mueve referencias internas al proyecto nuevo.
    case 'bytes': return Buffer.from(value.value, 'base64');
    case 'date': return new Date(value.value);
    case 'array': return value.value.map((x) => decode(x, db));
    case 'map': return Object.fromEntries(Object.entries(value.value).map(([k, v]) => [k, decode(v, db)]));
    default: return panic('Tipo desconocido en respaldo: ' + value.__siiType);
  }
}
function validPath(path) {
  const segs = String(path || '').split('/');
  return segs.length >= 2 && segs.length % 2 === 0 && segs.every((x) => x.length > 0);
}
function stats(docs) {
  const groups = {};
  for (const doc of docs) {
    const root = doc.path.split('/')[0];
    groups[root] = (groups[root] || 0) + 1;
  }
  return sorted(groups);
}
async function loadKey(path, projectId) {
  const data = JSON.parse(await readFile(resolve(path), 'utf8'));
  if (data.type !== 'service_account' || !data.private_key || !data.client_email) {
    panic('El archivo local no es un JSON de cuenta de servicio válido.');
  }
  if (data.project_id !== projectId) panic('La cuenta es para ' + data.project_id + ', pero se esperaba ' + projectId);
  return data;
}
async function openDb(keyPath, projectId) {
  const key = await loadKey(keyPath, projectId);
  const app = initializeApp({ credential: cert(key) }, 'migracion-' + projectId);
  return { app, db: getFirestore(app) };
}
async function walkCollection(ref, docs, project) {
  const refs = await ref.listDocuments();
  for (const document of refs) {
    const snap = await document.get();
    if (snap.exists) {
      docs.push({ path: document.path, data: encode(snap.data()) });
      if (docs.length % 100 === 0) info(project + ': ' + docs.length + ' documentos leídos');
    }
    // También recorre subcolecciones de documentos sin datos (padres virtuales).
    for (const child of await document.listCollections()) await walkCollection(child, docs, project);
  }
}
async function exportDatabase(keyPath) {
  const key = JSON.parse(await readFile(resolve(keyPath), 'utf8'));
  if (!ALLOWED_SOURCES.has(key.project_id)) panic('Origen no autorizado: ' + key.project_id);
  const { app, db } = await openDb(keyPath, key.project_id);
  try {
    const docs = [];
    for (const collection of await db.listCollections()) await walkCollection(collection, docs, key.project_id);
    docs.sort((a, b) => a.path.localeCompare(b.path));
    const bundle = { format: FORMAT, sourceProjectId: key.project_id, exportedAt: new Date().toISOString(), count: docs.length, byCollection: stats(docs), documents: docs };
    const dir = resolve('backups');
    await mkdir(dir, { recursive: true });
    const safeDate = new Date().toISOString().replace(/[:.]/g, '-');
    const filepath = join(dir, key.project_id + '-' + safeDate + '.json');
    const json = JSON.stringify(bundle, null, 2) + '\n';
    await writeFile(filepath, json, { flag: 'wx', mode: 0o600 });
    await writeFile(filepath + '.sha256', signature(json) + '  ' + basename(filepath) + '\n', { flag: 'wx', mode: 0o600 });
    info('RESPALDO TERMINADO:', filepath);
    info('DOCUMENTOS:', docs.length, 'POR COLECCIÓN:', bundle.byCollection);
    info('Guardar el JSON y su .sha256 en una ubicación privada. Nunca subirlos a GitHub.');
  } finally { await deleteApp(app); }
}
async function loadBackup(path) {
  const file = resolve(path);
  const raw = await readFile(file, 'utf8');
  try {
    const checksum = (await readFile(file + '.sha256', 'utf8')).split(/\s+/)[0];
    if (checksum !== signature(raw)) panic('El hash SHA256 no coincide: respaldo alterado o dañado');
  } catch (err) {
    if (err.code === 'ENOENT') info('AVISO: falta archivo SHA256 del respaldo; revisá su origen antes de usarlo.');
    else throw err;
  }
  const b = JSON.parse(raw);
  if (b.format !== FORMAT || !ALLOWED_SOURCES.has(b.sourceProjectId) || !Array.isArray(b.documents)) panic('Formato/origen de respaldo incorrecto');
  if (b.count !== b.documents.length) panic('No coincide la cantidad de documentos');
  const unique = new Set();
  for (const d of b.documents) {
    if (!validPath(d.path) || unique.has(d.path)) panic('Ruta o ID repetido/no válido: ' + d.path);
    unique.add(d.path);
  }
  return b;
}
const sameValue = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const batches = (array, size) => Array.from({ length: Math.ceil(array.length / size) }, (_, i) => array.slice(i * size, (i + 1) * size));
async function inspect(path) {
  const b = await loadBackup(path);
  info('BACKUP VALIDADO:', b.sourceProjectId, b.exportedAt, b.count, 'documentos');
  info('COLECCIONES:', b.byCollection);
}
async function restore(path, keyPath, options) {
  const b = await loadBackup(path);
  const apply = options.includes('--apply');
  const resume = options.includes('--resume');
  const limitIndex = options.indexOf('--limit');
  const limit = limitIndex >= 0 ? Number(options[limitIndex + 1]) : defaultWriteLimit;
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 5000) panic('Usar --limit entre 1 y 5000');
  await loadKey(keyPath, DESTINATION);
  info('ORIGEN:', b.sourceProjectId, '→ DESTINO:', DESTINATION, 'DOCUMENTOS:', b.count);
  info('COLECCIONES:', b.byCollection);
  if (!apply) {
    info('SIMULACIÓN: no se escribió ningún documento.');
    info('Para importar: node migrar.mjs import ' + path + ' ' + keyPath + ' --apply');
    return;
  }
  const { app, db } = await openDb(keyPath, DESTINATION);
  try {
    const toCreate = [];
    let alreadyCopied = 0;
    for (const group of batches(b.documents, 100)) {
      const refs = group.map((x) => db.doc(x.path));
      const snapshots = await db.getAll(...refs);
      for (let i = 0; i < group.length; i++) {
        const d = group[i];
        if (!snapshots[i].exists) { toCreate.push(d); continue; }
        if (!resume) panic('YA EXISTE ' + d.path + '. Cancelado sin sobrescribir. Para reanudar una importación parcial usá --resume.');
        if (!sameValue(encode(snapshots[i].data()), d.data)) {
          panic('DIFERENCIA en ' + d.path + '. No se sobrescribirá ningún dato existente.');
        }
        alreadyCopied++;
      }
    }
    let done = 0;
    for (const group of batches(toCreate.slice(0, limit), 200)) {
      const batch = db.batch();
      for (const d of group) batch.create(db.doc(d.path), decode(d.data, db));
      await batch.commit();
      done += group.length;
      info('Importados en esta ejecución:', done, 'de', toCreate.length, '| previamente iguales:', alreadyCopied);
    }
    info('IMPORTACIÓN FINALIZADA para este pase:', done, 'nuevos; faltan:', Math.max(0, toCreate.length - done));
    if (toCreate.length > done) info('Continuar con el mismo comando agregando --resume (máximo ' + limit + ' documentos por ejecución).');
    else info('Ejecutar verify para confirmar todos los valores contra el respaldo.');
  } finally { await deleteApp(app); }
}
async function verify(path, keyPath) {
  const b = await loadBackup(path);
  const { app, db } = await openDb(keyPath, DESTINATION);
  try {
    let count = 0;
    const differences = [];
    for (const group of batches(b.documents, 100)) {
      const snaps = await db.getAll(...group.map((x) => db.doc(x.path)));
      for (let i = 0; i < group.length; i++) {
        const doc = group[i], snap = snaps[i];
        if (!snap.exists || !sameValue(encode(snap.data()), doc.data)) differences.push(doc.path);
        count++;
      }
      if (count % 500 === 0) info('Comparados:', count);
    }
    info('VERIFICACIÓN: ', count, 'registros; diferentes/ausentes:', differences.length);
    if (differences.length) {
      info('Primeras diferencias:', differences.slice(0, 30));
      process.exitCode = 2;
    } else info('TODOS LOS DOCUMENTOS DEL RESPALDO COINCIDEN en el Firebase nuevo.');
  } finally { await deleteApp(app); }
}
async function main() {
  const [action, arg1, arg2, ...opts] = process.argv.slice(2);
  if (action === 'export' && arg1 && !arg2) return exportDatabase(arg1);
  if (action === 'inspect' && arg1 && !arg2) return inspect(arg1);
  if (action === 'import' && arg1 && arg2) return restore(arg1, arg2, opts);
  if (action === 'verify' && arg1 && arg2) return verify(arg1, arg2);
  info('Uso:\n  node migrar.mjs export keys/ORIGEN.json\n  node migrar.mjs inspect backups/COPIA.json\n  node migrar.mjs import backups/COPIA.json keys/DESTINO.json [--apply] [--resume] [--limit 4000]\n  node migrar.mjs verify backups/COPIA.json keys/DESTINO.json');
  process.exitCode = 1;
}
main().catch((err) => { console.error('MIGRACIÓN DETENIDA:', err?.message || err); process.exitCode = 1; });
