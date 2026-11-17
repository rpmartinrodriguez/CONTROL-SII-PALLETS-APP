import { syncPush } from '../lib/push-core.mjs';

// Todos los días a las 09:00 de Argentina (12:00 UTC).
// Es un respaldo para los vencimientos de dos días antes y los cambios que
// no dispararon el aviso inmediato. Solo se ejecuta en producción.
export default async function handler() {
  try {
    const result=await syncPush();
    console.log('SII push scheduled:',result);
  }catch(error) {
    console.error('SII push scheduled error:',error.message||error);
    throw error;
  }
}
export const config = { schedule: '0 12 * * *' };
