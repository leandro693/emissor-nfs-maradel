// ============================================================
//  sw.js — Service Worker do PWA (Emissor NFS-e Maradel)
//  Estratégia: NETWORK-FIRST para arquivos do próprio app (HTML/CSS/JS/
//  ícones), com o cache servindo de reserva quando offline. Garante que o
//  cliente sempre receba a versão mais nova quando online — e ainda assim
//  consiga abrir o app sem internet. Requisições de outros domínios
//  (Supabase, CDNs) NÃO são interceptadas: passam direto pela rede.
//  Suba o número da versão para forçar a limpeza do cache antigo ao publicar.
// ============================================================
const VERSION = 'maradel-v1';
const SHELL = [
  './',
  './index.html',
  './styles.css',
  './js/app.js',
  './js/api.js',
  './js/ui.js',
  './js/client.js',
  './js/analyst.js',
  './js/supabaseClient.js',
  './manifest.webmanifest',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './assets/logo-horizontal-dark.png',
  './assets/logo-horizontal-white.png',
];

// Instala: pré-carrega o "esqueleto" do app no cache (best-effort).
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(VERSION)
      .then((c) => Promise.allSettled(SHELL.map((u) => c.add(u))))
      .then(() => self.skipWaiting())
  );
});

// Ativa: remove caches de versões anteriores e assume o controle das abas.
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Busca: só trata GET do mesmo domínio. Network-first com reserva no cache.
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // Supabase/CDN passam direto

  e.respondWith(
    fetch(req)
      .then((res) => {
        // Guarda uma cópia atualizada no cache para uso offline.
        const copy = res.clone();
        caches.open(VERSION).then((c) => c.put(req, copy)).catch(() => {});
        return res;
      })
      .catch(async () => {
        // Offline: tenta o cache; para navegações, cai no index.html.
        const cached = await caches.match(req);
        if (cached) return cached;
        if (req.mode === 'navigate') return caches.match('./index.html');
        return Response.error();
      })
  );
});
