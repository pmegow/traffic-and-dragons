var CACHE = "tnd-v3-20260710k";
var APP_SHELL = [
  "/",
  "/globals.js",
  "/compress.js",
  "/data.js",
  "/capability_bible.js",
  "/helpers.js",
  "/state.js",
  "/storage-adapter.js",
  "/memory.js",
  "/tag_table.js",
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
  // Dev-utility satellite pages are NOT part of the cached app shell — their commits don't bump
  // CACHE, so the cache-first path below would pin stale copies indefinitely (it did: the designer
  // all through the v0.2x work, then the todo-viewer on 07-06 — every update needed a manual cache
  // clear). Serve them network-first: always fetch fresh when online, cached copy only as fallback.
  if(/blueprint-designer|todo-viewer/.test(e.request.url)){
    e.respondWith(
      fetch(e.request).then(function(response){
        // OK response: cache a clone (restores offline support) and serve it fresh.
        if(response && response.ok && response.type === "basic"){
          var clone = response.clone();
          caches.open(CACHE).then(function(cache){ cache.put(e.request, clone); });
          return response;
        }
        // Non-OK (502/404/…): prefer a good cached copy over showing the error; else return the error.
        return caches.match(e.request).then(function(cached){ return cached || response; });
      }).catch(function(){ return caches.match(e.request); }) // offline / network reject → cache
    );
    return;
  }
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
