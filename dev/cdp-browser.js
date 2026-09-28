// cdp-browser.js — a zero-dependency, Playwright-shaped browser driver over the Chrome DevTools Protocol.
// DEV TOOL, node-only (Node 22: global WebSocket + fetch). No npm install, by the project's design.
//
// WHY (#472, 2026-09-27): the three blueprint browser tests — and the two sabotage batteries whose
// clauses they prove — required the `playwright` npm module, which neither CI nor the owner's machine
// has. The tests crashed with MODULE_NOT_FOUND under every mutation, every browser clause reported
// MISATTRIBUTED, and CI went red on each sw.js version bump while guarding nothing. This module
// implements ONLY the subset of Playwright's API those tests use, on a system Chrome, so their
// statements (and the assertion names the batteries' mustFail strings key on) run unchanged.
//
// Playwright behaviours mirrored on purpose, because the tests rely on them:
//   • a fulfilled CROSS-ORIGIN request gets Access-Control-Allow-Origin/-Credentials added, and a CORS
//     preflight is answered 204 without reaching the route handler (the game's catalog read goes to the
//     production host from an http://catalog.test page);
//   • a dialog with no listener: beforeunload is accepted (so reload/goto proceed), every other one dismissed;
//   • every page stays visible — each gets its own window (see Page._create);
//   • a locator action on several matches throws (strict mode).
// Anything outside the subset throws "not supported" rather than half-working.
//
// Chrome: CHROME_PATH, then the platform's usual install paths / PATH names (locateChrome). A sabotage battery
// that finds none skips its browser clauses OUT LOUD through dev/battery-verdict.js (reportSkip + SKIP_EXIT),
// which both runners print as a skip — never as a pass.
"use strict";
const fs = require("fs"), path = require("path"), os = require("os"), cp = require("child_process");

const DEBUG = !!process.env.TND_CDP_DEBUG;   // TND_CDP_DEBUG=1 traces requests, replies, page console and dialogs to stderr
const TIMEOUT = 30000;         // Playwright's library default for actions, waits and navigation
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ── Chrome discovery ────────────────────────────────────────────────────────────────────────────
function locateChrome() {
  const env = process.env.CHROME_PATH;
  if (env) return fs.existsSync(env) ? { path: env, why: "CHROME_PATH" } : { path: null, why: "CHROME_PATH=" + env + " does not exist" };
  const tried = [];
  if (process.platform === "win32") {
    [process.env.PROGRAMFILES, process.env["PROGRAMFILES(X86)"], process.env.LOCALAPPDATA, "C:/Program Files"].filter(Boolean).forEach(b => {
      tried.push(path.join(b, "Google", "Chrome", "Application", "chrome.exe"), path.join(b, "Chromium", "Application", "chrome.exe"));
    });
  } else if (process.platform === "darwin") {
    tried.push("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "/Applications/Chromium.app/Contents/MacOS/Chromium");
  } else {
    const dirs = (process.env.PATH || "").split(path.delimiter).filter(Boolean);
    ["google-chrome-stable", "google-chrome", "chromium", "chromium-browser"].forEach(n => dirs.forEach(d => tried.push(path.join(d, n))));
  }
  for (const p of tried) { try { if (fs.statSync(p).isFile()) return { path: p, why: "found" }; } catch (e) { /* not there */ } }
  return { path: null, why: "no Chrome/Chromium in the usual places or on PATH; set CHROME_PATH" };
}

class BrowserUnavailable extends Error {}

// ── The protocol connection (one browser socket, flattened page sessions) ────────────────────────
class Connection {
  constructor(ws) {
    this.ws = ws; this.seq = 0; this.pending = new Map(); this.listeners = new Map(); this.closed = false;
    ws.onmessage = ev => this._receive(JSON.parse(typeof ev.data === "string" ? ev.data : Buffer.from(ev.data).toString("utf8")));
    ws.onclose = () => { this.closed = true; for (const p of this.pending.values()) p.reject(new Error(p.method + ": browser connection closed")); this.pending.clear(); };
  }
  static open(url) {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(url);
      ws.onopen = () => resolve(new Connection(ws));
      ws.onerror = e => reject(new Error("DevTools socket failed: " + (e && e.message || "connection error")));
    });
  }
  send(method, params, sessionId) {
    if (this.closed) return Promise.reject(new Error(method + ": browser connection closed"));
    const id = ++this.seq, msg = { id: id, method: method, params: params || {} };
    if (sessionId) msg.sessionId = sessionId;
    return new Promise((resolve, reject) => { this.pending.set(id, { resolve: resolve, reject: reject, method: method }); this.ws.send(JSON.stringify(msg)); });
  }
  on(sessionId, method, fn) {
    const key = (sessionId || "") + "|" + method;
    if (!this.listeners.has(key)) this.listeners.set(key, []);
    this.listeners.get(key).push(fn);
    return () => { const l = this.listeners.get(key) || []; const i = l.indexOf(fn); if (i >= 0) l.splice(i, 1); };
  }
  _receive(m) {
    if (m.id) {
      const p = this.pending.get(m.id); if (!p) return; this.pending.delete(m.id);
      if (m.error) p.reject(new Error(p.method + ": " + m.error.message + (m.error.data ? " — " + m.error.data : "")));
      else p.resolve(m.result);
      return;
    }
    (this.listeners.get((m.sessionId || "") + "|" + m.method) || []).slice().forEach(fn => fn(m.params || {}));
  }
}

// ── Browser / context ─────────────────────────────────────────────────────────────────────────
async function launch(opts) {
  opts = opts || {};
  let exe = opts.executablePath && fs.existsSync(opts.executablePath) ? opts.executablePath : null;
  if (!exe) { const c = locateChrome(); if (!c.path) throw new BrowserUnavailable("cdp-browser: " + c.why); exe = c.path; }
  if (opts.headless === false) throw new Error("cdp-browser: only headless is supported");
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "tnd-cdp-"));
  const args = ["--headless=new", "--remote-debugging-port=0", "--user-data-dir=" + profile, "--no-first-run", "--no-default-browser-check",
    "--disable-background-networking", "--disable-component-update", "--disable-sync", "--disable-extensions", "--mute-audio",
    "--disable-renderer-backgrounding", "--disable-backgrounding-occluded-windows", "--disable-background-timer-throttling"];
  // A hosted Linux CI runner may refuse Chrome's sandbox (AppArmor user namespaces); the pages here are local fixtures
  // behind a request interceptor that aborts every foreign host, so dropping it there costs nothing.
  if (process.platform === "linux" && (process.env.CI || (process.getuid && process.getuid() === 0))) args.push("--no-sandbox", "--disable-dev-shm-usage");
  args.push("about:blank");
  const child = cp.spawn(exe, args, { stdio: ["ignore", "ignore", "pipe"], windowsHide: true });
  let stderr = ""; child.stderr.on("data", d => { if (stderr.length < 4000) stderr += d; });
  let exited = null; child.on("exit", code => { exited = code; });
  try {
    const portFile = path.join(profile, "DevToolsActivePort");
    for (let i = 0; !fs.existsSync(portFile); i++) {
      if (exited !== null) throw new BrowserUnavailable("cdp-browser: Chrome exited (" + exited + ") before DevTools came up: " + stderr.trim().slice(0, 600));
      if (i > 300) throw new BrowserUnavailable("cdp-browser: Chrome did not open DevTools within 30s: " + stderr.trim().slice(0, 600));
      await sleep(100);
    }
    let port = "";
    for (let i = 0; !port; i++) { port = fs.readFileSync(portFile, "utf8").split(/\r?\n/)[0].trim(); if (!port) { if (i > 50) throw new Error("cdp-browser: empty DevToolsActivePort"); await sleep(50); } }
    const version = await (await fetch("http://127.0.0.1:" + port + "/json/version")).json();
    return new Browser(child, profile, await Connection.open(version.webSocketDebuggerUrl));
  } catch (e) {
    // A launch that fails half-way must not leave a Chrome process or its temp profile behind (one per failed run, forever).
    if (exited === null) child.kill();
    for (let i = 0; i < 10; i++) { try { fs.rmSync(profile, { recursive: true, force: true }); break; } catch (e2) { await sleep(200); } }
    throw e;
  }
}

class Browser {
  constructor(child, profile, conn) {
    this.child = child; this.profile = profile; this.conn = conn; this.pages = []; this.downloadDir = null;
    conn.on("", "Browser.downloadWillBegin", p => {
      const page = this.pages.find(pg => pg.targetId === p.frameId) || this.pages[this.pages.length - 1];
      if (page) page._download(new Download(this, p));
    });
    conn.on("", "Browser.downloadProgress", p => { const d = Download.live.get(p.guid); if (d) d._progress(p); });
  }
  async newContext(opts) { return new Context(this, opts || {}); }   // the default browser context: one per launch, as the tests use it
  async _downloads() {
    if (this.downloadDir) return;
    this.downloadDir = fs.mkdtempSync(path.join(os.tmpdir(), "tnd-cdp-dl-"));
    await this.conn.send("Browser.setDownloadBehavior", { behavior: "allowAndName", downloadPath: this.downloadDir, eventsEnabled: true });
  }
  async close() {
    try { await Promise.race([this.conn.send("Browser.close"), sleep(3000)]); } catch (e) { /* already gone */ }
    for (let i = 0; i < 30 && this.child.exitCode === null; i++) await sleep(100);
    if (this.child.exitCode === null) this.child.kill();
    for (const dir of [this.profile, this.downloadDir].filter(Boolean)) {
      for (let i = 0; i < 10; i++) { try { fs.rmSync(dir, { recursive: true, force: true }); break; } catch (e) { await sleep(200); } }
    }
  }
}

class Context {
  constructor(browser, opts) {
    if (opts.serviceWorkers && opts.serviceWorkers !== "block" && opts.serviceWorkers !== "allow") throw new Error("cdp-browser: serviceWorkers must be block|allow");
    this.browser = browser; this.opts = opts; this.routes = []; this.initScripts = []; this.pages = [];
    // serviceWorkers:'block' — no page may register one (http://catalog.test is not a secure context, so there is
    // nothing to register anyway; this keeps the promise if a test ever serves from localhost).
    if (opts.serviceWorkers === "block") this.initScripts.push("if(navigator.serviceWorker)navigator.serviceWorker.register=function(){return Promise.reject(new DOMException('service workers are blocked in this test context','SecurityError'));};");
  }
  async route(pattern, handler) { checkPattern(pattern); this.routes.unshift({ handler: handler }); for (const p of this.pages) await p._interceptRequests(); }
  async addInitScript(fn, arg) { const src = scriptOf(fn, arg); this.initScripts.push(src); for (const p of this.pages) await p._send("Page.addScriptToEvaluateOnNewDocument", { source: src }); }
  async newPage() { const p = await Page._create(this); this.pages.push(p); this.browser.pages.push(p); return p; }
}

function checkPattern(pattern) { if (pattern !== "**/*") throw new Error("cdp-browser: only the '**/*' route pattern is supported (got " + JSON.stringify(pattern) + ")"); }
function scriptOf(fn, arg) { return typeof fn === "function" ? "(" + fn + ")(" + (arg === undefined ? "" : JSON.stringify(arg)) + ")" : String(fn); }

// ── Page ────────────────────────────────────────────────────────────────────────────────────────
class Page {
  static async _create(ctx) {
    const conn = ctx.browser.conn;
    // Each page gets its OWN window, so every page stays visible like Playwright's headless shell. A background TAB is
    // document-hidden under --headless=new and runs no animation frames, and Blink queues a <dialog>'s close event there:
    // the designer's Publish dialog never closed once the test opened a second page (measured 2026-09-27).
    const t = await conn.send("Target.createTarget", { url: "about:blank", newWindow: true });
    const a = await conn.send("Target.attachToTarget", { targetId: t.targetId, flatten: true });
    const page = new Page(ctx, t.targetId, a.sessionId);
    await page._init();
    return page;
  }
  constructor(ctx, targetId, sessionId) {
    this.ctx = ctx; this.conn = ctx.browser.conn; this.targetId = targetId; this.sessionId = sessionId;
    this.routes = []; this.listeners = { pageerror: [], dialog: [], download: [] }; this.intercepting = false;
  }
  _send(method, params) { return this.conn.send(method, params, this.sessionId); }
  _on(method, fn) { return this.conn.on(this.sessionId, method, fn); }
  async _init() {
    this._on("Runtime.exceptionThrown", p => {
      const d = p.exceptionDetails || {}, ex = d.exception || {};
      const text = String(ex.description || ex.value || d.text || "page error").split("\n")[0].replace(/^Uncaught (\(in promise\) )?/, "");
      this._emit("pageerror", new Error(text.replace(/^[A-Za-z]*Error: /, "")));
    });
    // Mirror Playwright: with no listener a beforeunload is ACCEPTED (so reload/goto proceed) and every other dialog dismissed.
    this._on("Page.javascriptDialogOpening", p => { const d = new Dialog(this, p); if (!this._emit("dialog", d)) (p.type === "beforeunload" ? d.accept() : d.dismiss()).catch(() => {}); });
    this._on("Fetch.requestPaused", p => this._request(p));
    if (DEBUG) {
      this._on("Runtime.consoleAPICalled", p => console.error("[cdp " + this.targetId.slice(0, 6) + "] console." + p.type + ": " + (p.args || []).map(a => a.value !== undefined ? JSON.stringify(a.value) : a.description || a.type).join(" ").slice(0, 300)));
      this._on("Page.javascriptDialogOpening", p => console.error("[cdp " + this.targetId.slice(0, 6) + "] dialog " + p.type + ": " + p.message));
    }
    await this._send("Page.enable"); await this._send("Runtime.enable");
    const v = this.ctx.opts.viewport; if (v) await this.setViewportSize(v);
    for (const src of this.ctx.initScripts) await this._send("Page.addScriptToEvaluateOnNewDocument", { source: src });
    await this._interceptRequests();
  }
  async _interceptRequests() {
    if (this.intercepting || (!this.routes.length && !this.ctx.routes.length)) return;
    this.intercepting = true;
    await this._send("Fetch.enable", { patterns: [{ urlPattern: "*", requestStage: "Request" }] });
  }
  _request(p) {
    const route = new Route(this, p), headers = lowerKeys(p.request.headers || {});
    if (DEBUG) console.error("[cdp " + this.targetId.slice(0, 6) + "] → " + p.request.method + " " + p.request.url.slice(0, 160) + (p.request.hasPostData ? " (body " + (p.request.postData != null ? "inline" : p.request.postDataEntries ? "entries" : "NOT INCLUDED") + ")" : ""));
    // Mirror Playwright: a CORS preflight never reaches the handler; it is answered as permitted.
    if (p.request.method === "OPTIONS" && headers["access-control-request-method"]) {
      const h = [{ name: "Access-Control-Allow-Origin", value: headers.origin || "*" }, { name: "Access-Control-Allow-Methods", value: headers["access-control-request-method"] },
        { name: "Access-Control-Allow-Credentials", value: "true" }];
      if (headers["access-control-request-headers"]) h.push({ name: "Access-Control-Allow-Headers", value: headers["access-control-request-headers"] });
      route._settle("Fetch.fulfillRequest", { requestId: p.requestId, responseCode: 204, responseHeaders: h, body: "" }).catch(e => console.error("[cdp-browser] preflight reply failed: " + e.message));
      return;
    }
    const r = this.routes[0] || this.ctx.routes[0];
    if (!r) { route.continue().catch(e => console.error("[cdp-browser] continue failed: " + e.message)); return; }
    Promise.resolve().then(() => r.handler(route)).catch(e => { console.error("[cdp-browser] route handler threw: " + (e && e.stack || e)); route.abort().catch(() => {}); });
  }
  _emit(name, value) { const l = this.listeners[name]; if (!l.length) return false; l.slice().forEach(e => { if (e.once) l.splice(l.indexOf(e), 1); e.fn(value); }); return true; }
  _download(d) { if (!this._emit("download", d)) console.warn("[cdp-browser] download with no listener: " + d.suggestedFilename()); }
  on(name, fn) { this._listen(name, fn, false); return this; }
  once(name, fn) { this._listen(name, fn, true); return this; }
  _listen(name, fn, once) { if (!this.listeners[name]) throw new Error("cdp-browser: event '" + name + "' is not supported"); if (name === "download") this.ctx.browser._downloads().catch(e => console.error(e)); this.listeners[name].push({ fn: fn, once: once }); }
  async waitForEvent(name, opts) {
    if (name === "download") await this.ctx.browser._downloads();
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("waitForEvent('" + name + "') timed out after " + ((opts && opts.timeout) || TIMEOUT) + "ms")), (opts && opts.timeout) || TIMEOUT);
      this._listen(name, v => { clearTimeout(timer); resolve(v); }, true);
    });
  }
  async route(pattern, handler) { checkPattern(pattern); this.routes.unshift({ handler: handler }); await this._interceptRequests(); }
  async addInitScript(fn, arg) { await this._send("Page.addScriptToEvaluateOnNewDocument", { source: scriptOf(fn, arg) }); }
  async _navigated(start, what) {
    let off, timer;
    const loaded = new Promise((resolve, reject) => { off = this._on("Page.loadEventFired", resolve); timer = setTimeout(() => reject(new Error(what + " timed out after " + TIMEOUT + "ms")), TIMEOUT); });
    try { const r = await start(); if (r && r.errorText) throw new Error(what + " failed: " + r.errorText); await loaded; }
    finally { off(); clearTimeout(timer); }
  }
  async goto(url) { await this._navigated(() => this._send("Page.navigate", { url: url }), "goto(" + url + ")"); }
  async reload() { await this._navigated(() => this._send("Page.reload", {}), "reload()"); }
  async bringToFront() { await this._send("Page.bringToFront"); }
  async setViewportSize(v) { await this._send("Emulation.setDeviceMetricsOverride", { width: v.width, height: v.height, deviceScaleFactor: 1, mobile: false }); }
  async screenshot(opts) {
    opts = opts || {};
    const params = { format: "png" };
    if (opts.fullPage) { const m = await this._send("Page.getLayoutMetrics"); const s = m.cssContentSize || m.contentSize; params.captureBeyondViewport = true; params.clip = { x: 0, y: 0, width: Math.ceil(s.width), height: Math.ceil(s.height), scale: 1 }; }
    const r = await this._send("Page.captureScreenshot", params), buf = Buffer.from(r.data, "base64");
    if (opts.path) { fs.mkdirSync(path.dirname(opts.path), { recursive: true }); fs.writeFileSync(opts.path, buf); }
    return buf;
  }
  async _eval(expression, userGesture) {
    const r = await this._send("Runtime.evaluate", { expression: expression, awaitPromise: true, returnByValue: true, userGesture: !!userGesture });
    if (r.exceptionDetails) { const ex = r.exceptionDetails.exception || {}; throw new Error("page threw: " + String(ex.description || ex.value || r.exceptionDetails.text).split("\n")[0]); }
    return r.result.value;
  }
  async evaluate(fn, arg) { return this._eval(typeof fn === "function" ? "(" + fn + ")(" + (arg === undefined ? "" : JSON.stringify(arg)) + ")" : String(fn)); }
  async waitForFunction(fn, arg, opts) {
    const t = (opts && opts.timeout) || TIMEOUT, until = Date.now() + t;
    const expr = typeof fn === "function" ? "(" + fn + ")(" + (arg === undefined ? "" : JSON.stringify(arg)) + ")" : String(fn);
    for (;;) {
      let v; try { v = await this._eval(expr); } catch (e) { v = false; if (Date.now() > until) throw e; }
      if (v) return v;
      if (Date.now() > until) throw new Error("waitForFunction timed out after " + t + "ms: " + expr.slice(0, 160));
      await sleep(30);
    }
  }
  async waitForSelector(selector, opts) {
    const state = (opts && opts.state) || "visible", t = (opts && opts.timeout) || TIMEOUT, until = Date.now() + t;
    const q = JSON.stringify({ kind: "css", sel: selector, nth: null });
    const probe = "(function(){var els=(" + RESOLVE + ")(" + q + ");var v=els.filter(" + VISIBLE + ");return " +
      ({ attached: "els.length>0", visible: "v.length>0", hidden: "v.length===0", detached: "els.length===0" })[state] + ";})()";
    if (!/^(attached|visible|hidden|detached)$/.test(state)) throw new Error("cdp-browser: waitForSelector state " + state + " is not supported");
    for (;;) {
      if (await this._eval(probe)) return state === "visible" || state === "attached" ? this.locator(selector) : null;
      if (Date.now() > until) throw new Error("waitForSelector('" + selector + "', " + state + ") timed out after " + t + "ms");
      await sleep(30);
    }
  }
  async waitForTimeout(ms) { await sleep(ms); }
  locator(selector) { return new Locator(this, { kind: "css", sel: selector, nth: null }); }
  getByRole(role, opts) {
    if (role !== "button") throw new Error("cdp-browser: getByRole supports 'button' only");
    const name = opts && opts.name;
    return new Locator(this, { kind: "role", role: role, name: name instanceof RegExp ? { source: name.source, flags: name.flags } : name == null ? null : String(name), nth: null });
  }
}

function lowerKeys(h) { const o = {}; Object.keys(h).forEach(k => { o[k.toLowerCase()] = h[k]; }); return o; }

// Page-side helpers, serialised into each probe. VISIBLE is Playwright's rule: a non-empty box and not visibility:hidden.
const VISIBLE = "function(el){if(!el||!el.isConnected)return false;var s=getComputedStyle(el);if(s.visibility==='hidden'||s.visibility==='collapse')return false;var r=el.getBoundingClientRect();return r.width>0&&r.height>0;}";
const RESOLVE = "function(q){var els;if(q.kind==='css'){els=Array.prototype.slice.call(document.querySelectorAll(q.sel));}else{" +
  "var vis=" + VISIBLE + ";els=Array.prototype.slice.call(document.querySelectorAll('button,[role=button],input[type=button],input[type=submit],input[type=reset]')).filter(vis).filter(function(el){" +
  "if(q.name==null)return true;var n=(el.getAttribute('aria-label')||el.textContent||el.value||el.title||'').replace(/\\s+/g,' ').trim();" +
  "return typeof q.name==='string'?n.indexOf(q.name)>=0:new RegExp(q.name.source,q.name.flags).test(n);});}" +
  "return q.nth==null?els:q.nth<0?els.slice(q.nth).slice(0,1):els.slice(q.nth,q.nth+1);}";

class Locator {
  constructor(page, q) { this.page = page; this.q = q; }
  _desc() { return (this.q.kind === "css" ? "locator('" + this.q.sel + "')" : "getByRole('" + this.q.role + "', " + JSON.stringify(this.q.name) + ")") + (this.q.nth == null ? "" : ".nth(" + this.q.nth + ")"); }
  nth(i) { return new Locator(this.page, Object.assign({}, this.q, { nth: i })); }
  first() { return this.nth(0); }
  last() { return this.nth(-1); }
  _expr(body) { return "(function(){var els=(" + RESOLVE + ")(" + JSON.stringify(this.q) + "),vis=" + VISIBLE + ";" + body + "})()"; }
  async count() { return this.page._eval(this._expr("return els.length;")); }
  async allTextContents() { return this.page._eval(this._expr("return els.map(function(e){return e.textContent;});")); }
  async isHidden() { return this.page._eval(this._expr("return !(els.length===1?vis(els[0]):els.some(vis));")); }
  async isVisible() { return !(await this.isHidden()); }
  // One element, waited for (attached; plus visible and enabled for actions) — strict like Playwright: more than one match throws.
  async _one(body, needs, userGesture) {
    const until = Date.now() + TIMEOUT;
    const probe = this._expr("if(els.length>1)return {strict:els.length};var el=els[0];if(!el)return {wait:'attached'};" +
      (needs.visible ? "if(!vis(el))return {wait:'visible'};" : "") + (needs.enabled ? "if(el.disabled)return {wait:'enabled'};" : "") + "return {ok:(function(el){" + body + "})(el)};");
    let last = "attached";
    for (;;) {
      const r = await this.page._eval(probe, userGesture);
      if (r && r.strict) throw new Error(this._desc() + ": strict mode violation — resolved to " + r.strict + " elements");
      if (r && "ok" in r) return r.ok;
      last = r && r.wait || last;
      if (Date.now() > until) throw new Error(this._desc() + ": timed out after " + TIMEOUT + "ms waiting for the element to be " + last);
      await sleep(30);
    }
  }
  click() { return this._one("el.click();return true;", { visible: true, enabled: true }, true); }
  fill(value) {
    return this._one("el.focus();if(el.isContentEditable)el.textContent=" + JSON.stringify(String(value)) + ";else el.value=" + JSON.stringify(String(value)) +
      ";el.dispatchEvent(new InputEvent('input',{bubbles:true,composed:true,inputType:'insertText',data:" + JSON.stringify(String(value)) + "}));return true;", { visible: true, enabled: true }, true);
  }
  // Single <select> only: pick the option by value, else by label; a disabled or missing option throws, like Playwright's wait-then-fail.
  async selectOption(value) {
    const v = JSON.stringify(String(value));
    const r = await this._one("if(el.tagName!=='SELECT')return {err:'not a <select>'};var o=Array.prototype.filter.call(el.options,function(o){return o.value===" + v + ";})[0]||Array.prototype.filter.call(el.options,function(o){return o.textContent.trim()===" + v + ";})[0];" +
      "if(!o)return {err:'no option '+" + v + "};if(o.disabled)return {err:'option '+" + v + "+' is disabled'};el.value=o.value;" +
      "el.dispatchEvent(new Event('input',{bubbles:true,composed:true}));el.dispatchEvent(new Event('change',{bubbles:true}));return {ok:[o.value]};", { visible: true, enabled: true }, true);
    if (r.err) throw new Error(this._desc() + ".selectOption(" + v + "): " + r.err);
    return r.ok;
  }
  isDisabled() { return this._one("var c=el.closest&&el.parentElement&&el.parentElement.closest('select,optgroup,fieldset');return !!(el.disabled||(c&&c.disabled)||el.getAttribute('aria-disabled')==='true');", {}); }
  innerText() { return this._one("return el.innerText;", {}); }
  textContent() { return this._one("return el.textContent;", {}); }
  inputValue() { return this._one("return el.value;", {}); }
  getAttribute(name) { return this._one("return el.getAttribute(" + JSON.stringify(name) + ");", {}); }
  boundingBox() { return this._one("var r=el.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height};", {}); }
  async setInputFiles(files) {
    await this._one("return true;", {});
    const r = await this.page._send("Runtime.evaluate", { expression: this._expr("return els[0];"), returnByValue: false });
    if (!r.result || !r.result.objectId) throw new Error(this._desc() + ": no element for setInputFiles");
    await this.page._send("DOM.setFileInputFiles", { objectId: r.result.objectId, files: [].concat(files).map(f => path.resolve(f)) });
  }
}

class Route {
  constructor(page, p) { this.page = page; this.p = p; this.done = false; }
  request() {
    const r = this.p.request;
    const body = () => r.postData != null ? r.postData : r.postDataEntries ? Buffer.concat(r.postDataEntries.map(e => Buffer.from(e.bytes || "", "base64"))).toString("utf8") : null;
    return { url: () => r.url, method: () => r.method, headers: () => lowerKeys(r.headers || {}), postData: body, postDataJSON: () => { const b = body(); return b == null ? null : JSON.parse(b); } };
  }
  // A request the page already abandoned (navigation, closed fetch) can no longer be answered — Playwright treats that as benign.
  async _settle(method, params) {
    if (this.done) throw new Error("cdp-browser: route already handled: " + this.p.request.url);
    this.done = true;
    if (DEBUG) console.error("[cdp " + this.page.targetId.slice(0, 6) + "] ← " + (params.responseCode || params.errorReason || "continue") + " " + this.p.request.url.slice(0, 120));
    try { await this.page._send(method, params); }
    catch (e) { if (!/Invalid InterceptionId|Invalid state|No such request|closed/i.test(e.message)) throw e; }
  }
  fulfill(opts) {
    opts = opts || {};
    const h = Object.assign({}, opts.headers || {});
    if (opts.contentType) h["Content-Type"] = opts.contentType;
    // Mirror Playwright: a fulfilled cross-origin request is allowed through CORS.
    const origin = lowerKeys(this.p.request.headers || {}).origin;
    if (origin && origin !== new URL(this.p.request.url).origin && !Object.keys(h).some(k => k.toLowerCase() === "access-control-allow-origin")) {
      h["Access-Control-Allow-Origin"] = origin; h["Access-Control-Allow-Credentials"] = "true";
    }
    const body = opts.body == null ? Buffer.alloc(0) : Buffer.isBuffer(opts.body) ? opts.body : Buffer.from(String(opts.body));
    return this._settle("Fetch.fulfillRequest", { requestId: this.p.requestId, responseCode: opts.status || 200,
      responseHeaders: Object.keys(h).map(k => ({ name: k, value: String(h[k]) })), body: body.toString("base64") });
  }
  abort(reason) { return this._settle("Fetch.failRequest", { requestId: this.p.requestId, errorReason: reason || "Failed" }); }
  continue() { return this._settle("Fetch.continueRequest", { requestId: this.p.requestId }); }
}

class Dialog {
  constructor(page, p) { this.page = page; this.p = p; this.handled = false; }
  type() { return this.p.type; }
  message() { return this.p.message; }
  defaultValue() { return this.p.defaultPrompt || ""; }
  async accept(text) { if (this.handled) return; this.handled = true; await this.page._send("Page.handleJavaScriptDialog", text == null ? { accept: true } : { accept: true, promptText: String(text) }); }
  async dismiss() { if (this.handled) return; this.handled = true; await this.page._send("Page.handleJavaScriptDialog", { accept: false }); }
}

class Download {
  constructor(browser, p) { this.browser = browser; this.p = p; this.state = "inProgress"; this.waiters = []; Download.live.set(p.guid, this); }
  suggestedFilename() { return this.p.suggestedFilename; }
  url() { return this.p.url; }
  _progress(p) { if (p.state === "inProgress") return; this.state = p.state; Download.live.delete(this.p.guid); this.waiters.splice(0).forEach(w => w()); }
  async path() {
    if (this.state === "inProgress") await new Promise((resolve, reject) => { const t = setTimeout(() => reject(new Error("download did not finish within " + TIMEOUT + "ms")), TIMEOUT); this.waiters.push(() => { clearTimeout(t); resolve(); }); });
    if (this.state !== "completed") throw new Error("download " + this.state + ": " + this.p.suggestedFilename);
    return path.join(this.browser.downloadDir, this.p.guid);
  }
}
Download.live = new Map();

module.exports = { chromium: { launch: launch }, locateChrome: locateChrome, BrowserUnavailable: BrowserUnavailable };

// node dev/cdp-browser.js --check — prove this machine's Chrome is found AND launches AND evaluates a page. Both CI
// workflows run it before their sabotage steps: on a runner a missing or broken Chrome fails that step by name
// instead of skipping the browser guards on every push. (A contributor's machine may skip them, loudly.)
if (require.main === module) {
  (async () => {
    if (process.argv[2] !== "--check") { console.error("usage: node dev/cdp-browser.js --check"); process.exit(2); }
    const c = locateChrome();
    if (!c.path) throw new Error(c.why);
    const browser = await launch({ executablePath: c.path });
    try {
      const v = await browser.conn.send("Browser.getVersion");
      const page = await (await browser.newContext({})).newPage();
      const two = await page.evaluate(() => 1 + 1);
      if (two !== 2) throw new Error("page evaluation returned " + JSON.stringify(two));
      console.log("cdp-browser --check: OK — " + v.product + " at " + c.path);
    } finally { await browser.close(); }
  })().catch(e => { console.error("cdp-browser --check: FAILED — " + (e && e.message || e)); process.exit(1); });
}
