// Service worker mínimo — solo existe para que el navegador permita "Instalar app".
// No cachea datos de Firestore (esos van directo a la red / caché offline propia de Firestore).
// Usa "network-first" para el HTML principal, así los usuarios siempre reciben
// la última versión (V141, V142...) sin que quede una vieja pegada en caché.

const CACHE_NAME = 'inventario-shell-v0.5';
const SHELL_FILES = [
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_FILES)).catch(()=>{})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = event.request.url;

  // Nunca interceptar llamadas a Firebase/Firestore/Google — esas siempre van directo a la red.
  if (url.includes('firestore.googleapis.com') || url.includes('googleapis.com') || url.includes('gstatic.com')) {
    return;
  }

  // Para el HTML principal: intenta la red primero (para tener siempre la última versión).
  // Si no hay internet, usa lo último que quedó guardado.
  // "cache: no-store" es clave: sin esto, el fetch de "network-first" igual puede recibir
  // una respuesta guardada por la caché HTTP normal del navegador (según los headers
  // Cache-Control del servidor), y el usuario seguiría viendo una versión vieja aunque el
  // service worker sí esté intentando ir a la red.
  if (event.request.mode === 'navigate' || url.endsWith('.html')) {
    event.respondWith(
      fetch(event.request, { cache: 'no-store' })
        .then((res) => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          return res;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Íconos y manifest: caché primero (casi nunca cambian).
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});
