import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

/** Repositório ArtGpv/anki-ai -> https://artgpv.github.io/anki-ai/ */
const BASE = '/anki-ai/';

function lerJson(caminho: string): Record<string, unknown> | null {
  try {
    return existsSync(caminho) ? JSON.parse(readFileSync(caminho, 'utf8')) : null;
  } catch {
    return null;
  }
}

/**
 * PWA sem dependências extras: manifest gerado a partir do `base`, tags no index.html e versões
 * do service worker (public/sw.js) trocadas no build. Só age em `vite build`.
 *  - versão do app: muda a cada build (cache do app é renovado);
 *  - versão pesada: Pyodide + MathJax; só muda quando essas versões mudam (evita rebaixar dezenas de MB).
 */
function pwa(): Plugin {
  let base = BASE;
  let raiz = process.cwd();
  let saida = 'dist';
  return {
    name: 'anki-ai-pwa',
    configResolved(c) {
      base = c.base;
      raiz = c.root;
      saida = c.build.outDir;
    },
    transformIndexHtml(_html, ctx) {
      if (ctx.server) return; // desenvolvimento: sem manifest nem service worker
      return [
        { tag: 'link', attrs: { rel: 'manifest', href: `${base}manifest.webmanifest` }, injectTo: 'head' },
        { tag: 'link', attrs: { rel: 'apple-touch-icon', href: `${base}icons/apple-touch-icon.png` }, injectTo: 'head' },
        { tag: 'meta', attrs: { name: 'theme-color', content: '#555555' }, injectTo: 'head' },
        { tag: 'meta', attrs: { name: 'apple-mobile-web-app-capable', content: 'yes' }, injectTo: 'head' },
        { tag: 'meta', attrs: { name: 'apple-mobile-web-app-title', content: 'Anki AI' }, injectTo: 'head' },
      ];
    },
    generateBundle() {
      const manifest = {
        name: 'Gerador de Cartões Anki',
        short_name: 'Anki AI',
        description: 'Gera cartões Anki (.apkg) com IA, direto no navegador.',
        lang: 'pt-BR',
        start_url: base,
        scope: base,
        display: 'standalone',
        background_color: '#474747',
        theme_color: '#555555',
        icons: [
          { src: `${base}icons/icon-192.png`, sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: `${base}icons/icon-512.png`, sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: `${base}icons/icon-maskable-512.png`, sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      };
      this.emitFile({ type: 'asset', fileName: 'manifest.webmanifest', source: JSON.stringify(manifest, null, 2) });
    },
    closeBundle() {
      const sw = resolve(raiz, saida, 'sw.js');
      if (!existsSync(sw)) return;
      const py = lerJson(resolve(raiz, 'public/pyodide/manifest.json'))?.versaoPyodide ?? 'x';
      const mj = lerJson(resolve(raiz, 'node_modules/mathjax/package.json'))?.version ?? 'x';
      const texto = readFileSync(sw, 'utf8')
        .replaceAll('__VERSAO_APP__', Date.now().toString(36))
        .replaceAll('__VERSAO_PESADA__', `py${py}-mj${mj}`);
      writeFileSync(sw, texto);
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), pwa()],
  base: BASE, // GitHub Pages (ArtGpv/anki-ai); em desenvolvimento o app abre em http://localhost:5173/anki-ai/
  optimizeDeps: { exclude: ['pyodide'] },
  worker: { format: 'es' },
  test: { environment: 'node' }, // Vitest (testes de persistência e do Pyodide)
});
