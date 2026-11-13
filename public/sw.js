/*
 * Service worker do Anki AI (GitHub Pages). Sem bibliotecas: cache em tempo de execução.
 * Os tokens __VERSAO_APP__ e __VERSAO_PESADA__ são trocados no build (vite.config.ts).
 *  - Pyodide e MathJax (cache "pesado"): cache primeiro; só são rebaixados se a versão deles mudar.
 *  - assets/ com hash do Vite: cache primeiro. Navegação e demais arquivos: rede primeiro, cache se estiver offline.
 *  - Outras origens (Gemini, Tavily): nunca passam por aqui.
 */
const CACHE_APP = 'anki-ai-app-__VERSAO_APP__';
const CACHE_PESADO = 'anki-ai-pesado-__VERSAO_PESADA__';
const INICIO = self.registration.scope; // ex.: https://artgpv.github.io/anki-ai/
const BASE = new URL(INICIO).pathname; // ex.: /anki-ai/

/** Guarda a página inicial e os arquivos que ela referencia, para a 1ª visita já funcionar offline depois. */
async function precarregar() {
  const cache = await caches.open(CACHE_APP);
  const res = await fetch(INICIO, { cache: 'reload' });
  if (!res.ok) return;
  const html = await res.clone().text();
  await cache.put(INICIO, res);
  const urls = [...html.matchAll(/(?:src|href)="([^"]+)"/g)]
    .map((m) => new URL(m[1], INICIO).href)
    .filter((u) => u.startsWith(INICIO));
  await Promise.all(urls.map((u) => cache.add(u).catch(() => {})));
}

self.addEventListener('install', (e) => {
  e.waitUntil(precarregar().catch(() => {}).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    (async () => {
      for (const nome of await caches.keys()) {
        const velhoApp = nome.startsWith('anki-ai-app-') && nome !== CACHE_APP;
        const velhoPesado = nome.startsWith('anki-ai-pesado-') && nome !== CACHE_PESADO;
        if (velhoApp || velhoPesado) await caches.delete(nome);
      }
      await self.clients.claim();
    })(),
  );
});

async function cachePrimeiro(req, nomeCache) {
  const cache = await caches.open(nomeCache);
  const guardado = await cache.match(req);
  if (guardado) return guardado;
  const res = await fetch(req);
  if (res.ok) cache.put(req, res.clone());
  return res;
}

async function redePrimeiro(req, chave) {
  const cache = await caches.open(CACHE_APP);
  try {
    const res = await fetch(req);
    if (res.ok) cache.put(chave ?? req, res.clone());
    return res;
  } catch {
    const guardado = (await cache.match(chave ?? req)) ?? (chave ? await cache.match(INICIO + 'index.html') : undefined);
    return guardado ?? Response.error();
  }
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || !url.pathname.startsWith(BASE)) return;
  const rel = url.pathname.slice(BASE.length);

  if (rel.startsWith('pyodide/') || rel.startsWith('mathjax/')) {
    e.respondWith(cachePrimeiro(req, CACHE_PESADO));
  } else if (req.mode === 'navigate') {
    e.respondWith(redePrimeiro(req, INICIO)); // o roteamento é por hash: toda navegação é a mesma página
  } else if (rel.startsWith('assets/')) {
    e.respondWith(cachePrimeiro(req, CACHE_APP));
  } else if (rel !== 'sw.js') {
    e.respondWith(redePrimeiro(req));
  }
});
