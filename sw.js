// Prism — Service Worker minimal
// Version : incrémentez ce numéro à chaque déploiement pour forcer le rechargement
const CACHE_NAME = "prism-v2";

// Fichiers à mettre en cache au premier chargement
const PRECACHE = [
  "./",
  "./index.html",
];

// Installation : mise en cache des ressources de base
self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(PRECACHE))
  );
  self.skipWaiting();
});

// Activation : suppression des anciens caches
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch : network-first avec fallback cache
self.addEventListener("fetch", event => {
  // On ignore les requêtes non-GET et les API externes (OpenFoodFacts etc.)
  if (event.request.method !== "GET") return;
  if (!event.request.url.startsWith(self.location.origin)) return;

  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Mettre en cache la réponse fraîche
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
