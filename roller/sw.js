// sw.js — the dice simulator's offline worker (its scope: the folder it is served from).
//
// Cache-first: every app file is stored on install, in a cache named for this version, so the app
// opens and rolls with no network (owner 2026-10-24: a web app on the Traffic and Dragons site, and
// on a phone's Home Screen). A new release is a new sw.js — the list below changes with every
// version — so the browser installs it beside the old one; it takes over at once and drops the old
// cache, and the open page keeps its files until it is next loaded.
//
// The list is written by dev/write-sw.js from dev/app-files.js, never by hand; test/app.test.js
// fails when it is stale.

// <app-files> written by dev/write-sw.js
const VERSION = '0.30.0';
const FILES = [
  'audio/bank/clicks-v1.json',
  'audio/bank/clicks-v1.mp3',
  'audio/engine.js',
  'audio/index.js',
  'audio/plan.js',
  'demo/demo.js',
  'demo/dice-picker.js',
  'demo/drawer.js',
  'demo/preset-store.js',
  'embed/global.js',
  'embed/overlay.js',
  'fonts/README.md',
  'fonts/grenze-gotisch/GrenzeGotisch-wght.ttf',
  'fonts/grenze-gotisch/OFL.txt',
  'icons/apple-touch-icon.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
  'index.html',
  'input/pinch.js',
  'input/press-gesture.js',
  'manifest.webmanifest',
  'render/die-mesh.js',
  'render/exit-shader.js',
  'render/exit-table.js',
  'render/exits.js',
  'render/finish-table.js',
  'render/finishes.js',
  'render/framing.js',
  'render/index.js',
  'render/lights.js',
  'render/numeral-fonts.js',
  'render/particles.js',
  'render/patterns.js',
  'render/presets.js',
  'render/surface-looks.js',
  'render/view-defaults.js',
  'render/view.js',
  'src/body.js',
  'src/collide.js',
  'src/dice.js',
  'src/geometry.js',
  'src/index.js',
  'src/materials.js',
  'src/math.js',
  'src/notation.js',
  'src/rng.js',
  'src/roll.js',
  'src/track.js',
  'src/version.js',
  'src/world.js',
  'vendor/three/LICENSE',
  'vendor/three/README.md',
  'vendor/three/addons/environments/RoomEnvironment.js',
  'vendor/three/three.core.js',
  'vendor/three/three.module.js',
];
// </app-files>

const CACHE = 'dice-sim-' + VERSION;

// A host may answer a file through a redirect — Cloudflare Pages sends index.html to the folder's own
// address (308). A browser refuses a redirected response as the answer to opening a page, so storing
// one broke every visit after the first (2026-10-24, on the live site). A redirected response is
// stored as a clean copy, without the redirect.
const clean = async (response) => (response.redirected
  ? new Response(await response.blob(), { status: response.status, statusText: response.statusText, headers: response.headers })
  : response);

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await Promise.all(FILES.map(async (f) => {
      // 'reload' goes past the HTTP cache, so a new version never stores an older copy of a file.
      const response = await fetch(new Request(f, { cache: 'reload' }));
      if (!response.ok) throw new Error('sw: ' + f + ' answered ' + response.status);
      await cache.put(f, await clean(response));
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) if (key.startsWith('dice-sim-') && key !== CACHE) await caches.delete(key);
    await self.clients.claim();
  })());
});

// The app's own address (the folder, or index.html in it): opening it is answered with the stored page.
const HOME = [new URL('./', self.location).pathname, new URL('index.html', self.location).pathname];

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const hit = (await cache.match(request, { ignoreSearch: true }))
      || (HOME.includes(url.pathname) ? await cache.match('index.html') : undefined);
    return hit || fetch(request);
  })());
});
