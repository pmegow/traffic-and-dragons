// s8-chrome.js — the 684_v1353 corpus's two town records (library 0.12.0, saved from CHROME) compared with what library
// 0.14.0 draws in headless Chrome, fingerprinted under scheme 1 as 0.12.0 (the game's atlasSettle rule) — is the
// "redrawn" verdict Node's alone (#698) or Chrome's too?
const fs = require("fs"), path = require("path"), ROOT = path.resolve(process.argv[2]);
const { chromium } = require(path.join(ROOT, "dev", "cdp-browser.js"));
const corpus = JSON.parse(fs.readFileSync(path.join(ROOT, "dev", "corpus_spotcheck_684_v1353.json"), "utf8")).final.zones;
const html = "<!doctype html><html><head><meta charset='utf-8'></head><body><script src='/tndmaps.js'></script><script src='/helpers.js'></script></body></html>";
(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const ctx = await browser.newContext({ viewport: { width: 800, height: 600 }, serviceWorkers: "block" });
    await ctx.route("**/*", async r => {
      const u = new URL(r.request().url()); if (u.hostname !== "fp.test") return r.abort();
      if (u.pathname === "/" || u.pathname === "/index.html") return r.fulfill({ status: 200, contentType: "text/html", body: html });
      const f = path.resolve(ROOT, "." + decodeURIComponent(u.pathname)); if (!f.startsWith(ROOT + path.sep)) return r.abort();
      try { return r.fulfill({ status: 200, contentType: "application/javascript", body: fs.readFileSync(f) }); } catch (e) { return r.fulfill({ status: 404, body: "" }); }
    });
    const page = await ctx.newPage(); const errors = []; page.on("pageerror", e => errors.push(e.message));
    await page.goto("http://fp.test/index.html"); await page.waitForFunction(() => typeof TnDMaps === "object" && TnDMaps.VERSION);
    const res = await page.evaluate(z => {
      function fp(doc, asLib, scheme, asParams) { var gen = doc ? doc.generator : null, sch = scheme || 2; var s = JSON.stringify(doc, function (k, v) { if (this === doc && (k === "stats" || k.charAt(0) === "_" || (sch >= 2 && k === "params"))) return undefined; if (this === doc && k === "params" && asParams) return asParams; return (asLib != null && gen && this === gen && k === "version") ? asLib : v; }); return (TnDMaps.hash32(s) >>> 0).toString(16) + "-" + s.length.toString(36); }
      var seed = Object.keys(z).filter(function (k) { return !z[k].parent; })[0], reg = TnDMaps.generate("region", z[seed].params), out = { lib: TnDMaps.VERSION, ua: navigator.userAgent.slice(0, 60) };
      out[seed] = { rec: z[seed].fp, s1recipe: fp(reg, "0.12.0", 1, z[seed].params), s2: fp(reg) };
      Object.keys(z).forEach(function (k) { var r = z[k]; if (r.kind !== "town") return; var d = TnDMaps.generate("town", TnDMaps.town.fromRegion(reg, r.via)); out[k] = { name: r.name, rec: r.fp, s1today: fp(d, "0.12.0", 1), s2: fp(d) }; });
      return out;
    }, corpus);
    console.log("Chrome: " + JSON.stringify(res, null, 1)); if (errors.length) console.log("page errors: " + errors.join(" | "));
  } finally { await browser.close(); }
  /* Node, the same */
  global.window = global; require(path.join(ROOT, "tndmaps.js")); const T = global.TnDMaps;
  function fpN(doc, asLib, scheme, asParams) { var gen = doc ? doc.generator : null, sch = scheme || 2; var s = JSON.stringify(doc, function (k, v) { if (this === doc && (k === "stats" || k.charAt(0) === "_" || (sch >= 2 && k === "params"))) return undefined; if (this === doc && k === "params" && asParams) return asParams; return (asLib != null && gen && this === gen && k === "version") ? asLib : v; }); return (T.hash32(s) >>> 0).toString(16) + "-" + s.length.toString(36); }
  const seed = Object.keys(corpus).filter(k => !corpus[k].parent)[0], reg = T.generate("region", corpus[seed].params), outN = { lib: T.VERSION };
  outN[seed] = { rec: corpus[seed].fp, s1recipe: fpN(reg, "0.12.0", 1, corpus[seed].params), s2: fpN(reg) };
  Object.keys(corpus).forEach(k => { const r = corpus[k]; if (r.kind !== "town") return; const d = T.generate("town", T.town.fromRegion(reg, r.via)); outN[k] = { name: r.name, rec: r.fp, s1today: fpN(d, "0.12.0", 1), s2: fpN(d) }; });
  console.log("Node: " + JSON.stringify(outN, null, 1));
})().catch(e => { console.error("s8 failed: " + (e.stack || e)); process.exit(1); });
