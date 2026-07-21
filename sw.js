var CACHE = "tnd-v3-20260721c";
// Dedicated persistent cache for the vendored Piper/ORT assets (DOC/todo_TTS_piper.md Phase 2).
// Versioned by VENDORED-CONTENT version, deliberately NOT by deploy — bump ~never (the files are
// frozen). This is what lets the ~20MB of wasm survive the activate purge below, which runs on
// EVERY deploy because CACHE bumps every deploy. Without a separate cache name, the purge (which
// deletes every cache !== CACHE) would wipe the wasm and force a re-download per device per deploy.
var PIPER_CACHE = "tnd-piper-v1";
var APP_SHELL = [
  "/",
  "/globals.js",
  "/error-report.js",
  "/compress.js",
  "/data.js",
  "/capability_bible.js",
  "/helpers.js",
  "/state.js",
  "/storage-adapter.js",
  "/memory.js",
  "/clock.js",
  "/tag_table.js",
  "/api.js",
  "/table-talk.js",
  "/campaign_generator.js",
  "/char-creation.js",
  "/game.js",
  "/ui-shell.js",
  "/ui-panels.js",
  "/ui-portrait.js",
  "/ui-files.js",
  "/ui-sheets.js",
  "/ui-browsers.js",
  "/ui-campaigns.js",
  "/ui-carmode.js",
  "/ui-modals.js",
  "/ui-boot.js",
  "/tts.js",
  "/stt.js",
  "/sound.js",
  "/vendor/html-to-image/html-to-image.js",
  "/manifest.json",
  "/icon.svg",
  "/icon-192.png",
  "/icon-512.png"
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
      // Spare PIPER_CACHE from the per-deploy purge (LOAD-BEARING — see the PIPER_CACHE comment
      // above). Without this exemption the purge deletes it right along with the old app-shell
      // cache on every deploy, and the dedicated cache name buys nothing.
      return Promise.all(keys.filter(function(k){return k!==CACHE && k!==PIPER_CACHE;}).map(function(k){return caches.delete(k);}));
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
  // Dev-utility satellite/doc pages are NOT part of the cached app shell — their commits don't bump
  // CACHE, so the cache-first path below would pin stale copies indefinitely (it did: the designer
  // all through the v0.2x work, then the todo-viewer on 07-06 — every update needed a manual cache
  // clear). Serve them network-first: always fetch fresh when online, cached copy only as fallback.
  // Covers ALL satellites (audit 07-16 #22): designer, todo-viewer, bible_study, piper_test,
  // test.html (anchored on the preceding "/" so e.g. "protest.html" can't match), the
  // npc-merge-studio, bug_tracker (#71), and everything under /DOC/. Tested against
  // e.request.url (the FULL URL), hence the path-fragment style.
  if(/blueprint-designer|todo-viewer|bible_study|piper_test|npc-merge-studio|bug_tracker|voice_picker|\/test\.html(?:$|[?#])|\/DOC\//.test(e.request.url)){
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
  // Vendored Piper/ORT assets (DOC/todo_TTS_piper.md Phase 2): cache-first against the dedicated
  // PIPER_CACHE, not the versioned CACHE — keeps the ~20MB of wasm off the per-deploy purge cycle.
  // Not part of APP_SHELL (never precached); first Piper use populates it, then it's permanent.
  if(e.request.url.indexOf("/vendor/piper/") !== -1){
    e.respondWith(
      caches.match(e.request).then(function(cached){
        if(cached) return cached;
        return fetch(e.request).then(function(response){
          if(response && response.status === 200 && response.type === "basic"){
            var clone = response.clone();
            caches.open(PIPER_CACHE).then(function(cache){
              cache.put(e.request, clone).then(function(){
                // GC superseded revs (piper-audit #15, v1.341): a cache MISS here means a NEW
                // ?tnd= rev of this file just landed — older entries for the SAME pathname with a
                // different query are dead weight forever (this cache is purge-exempt by design).
                // Drop them now. Safe: exactly one rev of each file is live per deploy, and a
                // still-running old tab already holds its module in memory.
                var fresh = new URL(e.request.url);
                cache.keys().then(function(reqs){
                  reqs.forEach(function(req){
                    var u = new URL(req.url);
                    if(u.pathname === fresh.pathname && u.search !== fresh.search) cache.delete(req);
                  });
                });
              });
            });
          }
          return response;
        });
      })
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
