// Retained mutation proof for service-worker runtime cache lifetimes.
var sabotage = require("./sabotage.js");

process.exit(sabotage.prove({
  file: "sw.js",
  command: ["node", ["dev/tests-250-browser-io.js"]],
  cases: [
    {
      label: "runtime cache lifetime detached from FetchEvent",
      mustFail: "network-first runtime cache writes are held by FetchEvent.waitUntil",
      find: "event.waitUntil(Promise.resolve(promise).catch(function(e){",
      replace: "Promise.resolve(Promise.resolve(promise).catch(function(e){"
    },
    {
      label: "network-first cache.put detached from held promise",
      mustFail: "network-first runtime cache writes are held by FetchEvent.waitUntil",
      find: "          holdRuntimeIo(e,caches.open(CACHE).then(function(cache){\n            return cleanRedirect(clone).then(function(c){return cache.put(e.request,c);});\n          }),\"network-first cache write for \"+e.request.url);",
      replace: "          holdRuntimeIo(e,caches.open(CACHE).then(function(cache){\n            return cleanRedirect(clone).then(function(c){cache.put(e.request,c);return true;});\n          }),\"network-first cache write for \"+e.request.url);"
    },
    {
      label: "cache-first cache.put detached from held promise",
      mustFail: "cache-first runtime writes stay held until cache.put settles",
      find: "          holdRuntimeIo(e,caches.open(CACHE).then(function(cache){\n            return cleanRedirect(clone).then(function(c){return cache.put(e.request,c);});\n          }),\"runtime cache write for \"+e.request.url);",
      replace: "          holdRuntimeIo(e,caches.open(CACHE).then(function(cache){\n            return cleanRedirect(clone).then(function(c){cache.put(e.request,c);return true;});\n          }),\"runtime cache write for \"+e.request.url);"
    },
    {
      label: "Piper superseded-revision deletion detached",
      mustFail: "Piper cache write and superseded-revision GC share one held lifetime",
      find: "                  return Promise.all(deletes);",
      replace: "                  Promise.all(deletes);return [];"
    }
  ]
}));
