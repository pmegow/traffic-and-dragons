var CACHE = "tnd-v3-20260620e";
var APP_SHELL = [
  "/dnd_game_1_0.html",
  "/globals.js",
  "/data.js",
  "/helpers.js",
  "/state.js",
  "/storage-adapter.js",
  "/memory.js",
  "/api.js",
  "/char-creation.js",
  "/game.js",
  "/ui.js",
  "/tts.js",
  "/stt.js",
  "/manifest.json",
  "/icon.svg"
];

self.addEventListener("install", function(e){
  e.waitUntil(
    caches.open(CACHE).then(function(cache){
      return cache.addAll(APP_SHELL);
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", function(e){
  e.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(keys.filter(function(k){return k!==CACHE;}).map(function(k){return caches.delete(k);}));
    })
  );
  self.clients.claim();
});

// NETWORK-FIRST, cache fallback. The old cache-first strategy pinned every
// installed browser to whatever was cached until the CACHE constant changed —
// deploys were invisible without "Clear cache & reload". The game needs the
// network for every turn anyway; the cache exists only so the shell still
// opens offline.
self.addEventListener("fetch", function(e){
  // Only handle same-origin requests — let API calls through untouched
  if(e.request.url.indexOf(self.location.origin) !== 0) return;
  e.respondWith(
    fetch(e.request).then(function(response){
      if(response && response.status === 200 && response.type === "basic"){
        var clone = response.clone();
        caches.open(CACHE).then(function(cache){ cache.put(e.request, clone); });
      }
      return response;
    }).catch(function(){
      return caches.match(e.request);
    })
  );
});
