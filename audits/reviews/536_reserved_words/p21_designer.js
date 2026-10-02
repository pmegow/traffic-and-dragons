// REVIEW PROBE p21: the real Blueprint Designer page of a tree, in headless Chrome through the tree's own dev/cdp-browser.js
// (temporary profile, every request answered from the tree's files or aborted; nothing is written into the tree; Save is NOT
// clicked, so nothing is downloaded: its gate is evaluated in the page instead). argv: <tree>
const fs = require("fs"), path = require("path");
const root = path.resolve(process.argv[2]);
const { chromium } = require(path.join(root, "dev", "cdp-browser.js"));
(async () => {
  let browser;
  try { browser = await chromium.launch({ headless: true }); } catch (e) { console.log("tree " + path.basename(root) + ": no browser available (" + e.message.slice(0, 120) + ")"); return; }
  try {
    const context = await browser.newContext({ viewport: { width: 1100, height: 900 }, serviceWorkers: "block" });
    const errors = [];
    await context.route("**/*", async route => {
      const url = new URL(route.request().url());
      if (url.hostname !== "designer.test") return route.abort();
      const file = path.resolve(root, "." + decodeURIComponent(url.pathname));
      if (!file.startsWith(root + path.sep)) return route.abort();
      try { const data = fs.readFileSync(file); return route.fulfill({ status: 200, contentType: file.endsWith(".html") ? "text/html" : file.endsWith(".js") ? "application/javascript" : file.endsWith(".css") ? "text/css" : file.endsWith(".json") || file.endsWith(".blueprint") ? "application/json" : "application/octet-stream", body: data }); }
      catch (e) { return route.fulfill({ status: 404, contentType: "text/plain", body: "missing" }); }
    });
    const page = await context.newPage(); page.on("pageerror", e => errors.push(e.message));
    await page.goto("http://designer.test/blueprint-designer.html"); await page.waitForFunction(() => !!window.__bpdTest);
    const src = JSON.parse(fs.readFileSync(path.join(root, "samples", "modeltestcampaign.blueprint"), "utf8"));
    const cases = [
      ["the sample as shipped", b => b],
      ["an NPC whose role is the one word 'Constructor'", b => { b.npcs[0].role = "Constructor"; return b; }],
      ["starting place named 'constructor'", b => { b.startingLocation = "constructor"; b.locations[0].name = "constructor"; return b; }]
    ];
    console.log("tree: " + path.basename(root) + " | designer " + await page.evaluate(() => document.getElementById("ver").textContent));
    for (const c of cases) {
      const bp = c[1](JSON.parse(JSON.stringify(src)));
      const r = await page.evaluate(b => {
        localStorage.removeItem("bpd_draft_v1");   // so the wait below sees THIS case's autosave, not the previous one
        __bpdTest.load(b);
        const afterLoad = document.getElementById("statusline").textContent;
        const err = designerValidate(), snap = fileOut(), editionError = BlueprintEdition.problem(snap);   // the Save button's own gate: only editionError stops it
        markDirty();                                                                                          // any edit: status + the debounced draft autosave
        return { afterLoad: afterLoad, validate: err, saveBlockedBy: editionError || null, saveStatusWouldBe: err ? "Saved <file> — not publish-ready: " + err : "Saved <file> — publish-ready", publishBlocked: !!err };
      }, bp);
      await page.waitForFunction(() => { try { return !!JSON.parse(localStorage.getItem("bpd_draft_v1") || "null"); } catch (e) { return false; } });
      const draft = await page.evaluate(() => { const d = JSON.parse(localStorage.getItem("bpd_draft_v1")); return { saved: !!(d && d.bp), role: d.bp.npcs[0].role, start: d.bp.startingLocation, dirty: d.dirty }; });
      console.log("--- " + c[0] + "\n    after Load, the status line: " + JSON.stringify(r.afterLoad).slice(0, 230) + "\n    designerValidate(): " + JSON.stringify(r.validate).slice(0, 200) + "\n    Save: blocked by " + JSON.stringify(r.saveBlockedBy) + " | its status would read " + JSON.stringify(r.saveStatusWouldBe).slice(0, 150) + "\n    Save to My Library / Publish refused: " + r.publishBlocked + " | draft autosaved after an edit: " + JSON.stringify(draft));
    }
    console.log("page errors: " + JSON.stringify(errors));
  } finally { await browser.close(); }
})().catch(e => { console.log("probe failed: " + (e && e.stack || e)); process.exit(1); });
