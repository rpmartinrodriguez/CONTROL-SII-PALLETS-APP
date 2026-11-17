import { firebaseAdmin, verifyAuthorized, jsonResponse, sha, isQuotaExceeded } from '../lib/push-core.mjs';
import { Timestamp } from 'firebase-admin/firestore';

// Prueba de push REAL: se envía únicamente al token registrado para el UID
// que realizó la solicitud, nunca a todos los dispositivos de la empresa.
export default async function handler(request) {
  if (request.method !== 'POST') return jsonResponse(405, { error: 'Método no permitido.' });

  try {
    const origin = request.headers.get('origin');
    if (origin && origin !== new URL(request.url).origin) {
      return jsonResponse(403, { error: 'Origen no autorizado.' });
    }
    const uid = await verifyAuthorized(request);
    const body = await request.json();
    const token = body?.token;
    if (typeof token !== 'string' || token.length < 30 || token.length > 5000) {
      return jsonResponse(400, { error: 'Token push inválido.' });
    }

    const { db, messaging } = firebaseAdmin();
    const ref = db.doc('sii_push_devices/' + sha(token).slice(0, 40));
    // Se valida propiedad y se limita la frecuencia con una transacción.
    await db.runTransaction(async tx => {
      const snap = await tx.get(ref);
      const record = snap.data();
      if (!record?.enabled || record.uid !== uid || record.token !== token) {
        throw new Error('Este dispositivo no está registrado para recibir push.');
      }
      const last = record.lastTestAt?.toMillis?.() || 0;
      if (Date.now() - last < 20000) {
        throw new Error('Esperá 20 segundos antes de repetir la prueba.');
      }
      tx.update(ref, { lastTestAt: Timestamp.fromMillis(Date.now()) });
    });

    await messaging.send({
      token,
      data: {
        title: 'SII PALLETS · Prueba push',
        body: 'Las notificaciones de este dispositivo están funcionando.',
        category: 'test',
        eventId: sha('test:' + uid + ':' + Date.now()).slice(0, 20),
        url: '/'
      },
      webpush: { headers: { Urgency: 'high' } }
    });

    return jsonResponse(200, { ok: true, accepted: true });
  } catch (err) {
    console.error('SII push test:', err?.code || '', err?.message || String(err));
    if (isQuotaExceeded(err)) return jsonResponse(429, {
      code: 'FIRESTORE_QUOTA',
      error: 'Firebase alcanzó un límite temporal de operaciones. No se pudo probar el envío push. Revisá Firestore → Uso.'
    });
    return jsonResponse(400, { error: err?.message || 'No se pudo realizar la prueba.' });
  }
}
