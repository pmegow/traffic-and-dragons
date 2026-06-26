var CACHE = "tnd-v3-20260626l";
var APP_SHELL = [
  "/",
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

// CACHE-FIRST, network fallback. Serves the app shell from cache (≈zero
// bandwidth) between deploys — the fix for blowing past Netlify's bandwidth
// cap, which the old network-first strategy caused by re-downloading every
// file on every load.
//
// Why this is safe now (it wasn't, pre-v1.28): the CACHE constant is bumped on
// EVERY deploy (hard rule). A bump changes sw.js itself, and browsers fetch the
// SW script fresh on each navigation by default (updateViaCache "imports"), so
// the new SW is always detected → install precaches the new shell → activate
// deletes the old cache → skipWaiting/clients.claim flip it on the next load.
// Each deploy therefore costs one fresh shell download per device, then nothing.
// The "Clear cache & reload" button remains the manual escape hatch.
//
// Only same-origin GETs are cached; cross-origin API calls (Anthropic, fal,
// Fly) and non-GET requests pass straight through, untouched.
self.addEventListener("fetch", function(e){
  if(e.request.method !== "GET") return;
  if(e.request.url.indexOf(self.location.origin) !== 0) return;
  e.respondWith(
    caches.match(e.request).then(function(cached){
      if(cached) return cached;
      return fetch(e.request).then(function(response){
        if(response && response.status === 200 && response.type === "basic"){
          var clone = response.clone();
          caches.open(CACHE).then(function(cache){ cache.put(e.request, clone); });
        }
        return response;
      });
    })
  );
});
