import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

// Cada build publicado por Netlify recibe una versión distinta.
// La PWA consulta este archivo sin caché y actualiza su Service Worker.
function versionPwa(){
  const version=process.env.COMMIT_REF || process.env.DEPLOY_ID || String(Date.now());
  return {
    name:'sii-pwa-version',
    apply:'build',
    async closeBundle(){
      const dist=join(process.cwd(),'dist');
      const source=await readFile(join(process.cwd(),'public/sw.js'),'utf8');
      await Promise.all([
        writeFile(join(dist,'version.json'),JSON.stringify({version,generatedAt:new Date().toISOString()})),
        writeFile(join(dist,'sw.js'),source.replace('__SII_BUILD_VERSION__',JSON.stringify(version))),
        writeFile(join(dist,'auth-config.json'),JSON.stringify({
          loginRequired:process.env.VITE_SII_LOGIN_REQUIRED==='true',
          allowedEmails:String(process.env.VITE_SII_ALLOWED_EMAILS||'').split(',').map(v=>v.trim().toLowerCase()).filter(Boolean)
        }))
      ]);
    }
  };
}

export default defineConfig({
  plugins:[react(),versionPwa()]
});
