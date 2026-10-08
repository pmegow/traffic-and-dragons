// REVIEW PROBE p22: the Designer's "apply this review fix" step on a blueprint that carries the word in one text field.
// The real page in headless Chrome (the tree's dev/cdp-browser.js, temporary profile, requests answered from the tree or
// aborted). The model call is replaced IN THE PAGE by a canned one-item patch to the premise; nothing reaches a network.
// argv: <tree>
const fs = require("fs"), path = require("path");
const root = path.resolve(process.argv[2]);
const { chromium } = require(path.join(root, "dev", "cdp-browser.js"));
(async () => {
  let browser;
  try { browser = await chromium.launch({ headless: true }); } catch (e) { console.log("tree " + path.basename(root) + ": no browser available (" + e.message.slice(0, 120) + ")"); return; }
  try {
    const context = await browser.newContext({ viewport: { width: 1100, height: 900 }, serviceWorkers: "block" });
    await context.route("**/*", async route => {
      const url = new URL(route.request().url());
      if (url.hostname !== "designer.test") return route.abort();
      const file = path.resolve(root, "." + decodeURIComponent(url.pathname));
      if (!file.startsWith(root + path.sep)) return route.abort();
      try { return route.fulfill({ status: 200, contentType: file.endsWith(".html") ? "text/html" : file.endsWith(".js") ? "application/javascript" : file.endsWith(".css") ? "text/css" : "application/json", body: fs.readFileSync(file) }); }
      catch (e) { return route.fulfill({ status: 404, contentType: "text/plain", body: "missing" }); }
    });
    const page = await context.newPage(); const errors = []; page.on("pageerror", e => errors.push(e.message));
    await page.goto("http://designer.test/blueprint-designer.html"); await page.waitForFunction(() => !!window.__bpdTest);
    const src = JSON.parse(fs.readFileSync(path.join(root, "samples", "modeltestcampaign.blueprint"), "utf8"));
    console.log("tree: " + path.basename(root));
    for (const c of [["the sample as shipped", b => b], ["the same file, one NPC's role is the one word 'Constructor'", b => { b.npcs[0].role = "Constructor"; return b; }]]) {
      const bp = c[1](JSON.parse(JSON.stringify(src)));
      const r = await page.evaluate(async b => {
        __bpdTest.load(b);
        var live = __bpdTest.getBp(); live.review = { findings: [{ sev: "LOW", section: "premise", issue: "The premise is wordy.", fixes: ["Tighten the premise to one sentence."], _sel: 0 }], sections: 1, failedSections: 0 };
        window.llmReady = function () { return true; };
        var calls = 0; window.callGM = async function () { calls++; return JSON.stringify({ patches: [{ section: "premise", item: "A caravan, a debt of blood, a road north." }], note: "tightened the premise" }); };
        var before = live.premise, out = await applyFinding(0), now = __bpdTest.getBp();
        return { modelCalls: calls, returned: out === undefined ? null : String(out), status: document.getElementById("statusline").textContent, premiseChanged: now.premise !== before, findingStatus: now.review.findings[0].status || "", findingErr: now.review.findings[0]._err || "" };
      }, bp);
      console.log("--- " + c[0] + "\n    model calls spent: " + r.modelCalls + " | premise changed: " + r.premiseChanged + " | finding status: " + JSON.stringify(r.findingStatus) + "\n    status line: " + JSON.stringify(r.status).slice(0, 300));
    }
    console.log("page errors: " + JSON.stringify(errors));
  } finally { await browser.close(); }
})().catch(e => { console.log("probe failed: " + (e && e.stack || e)); process.exit(1); });
