import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";

const live = process.argv.includes("--live");
assert.ok(live || process.argv.includes("--dry-run"), "Choose --live or --dry-run explicitly");
const serverRoot = process.env.TND_PROBE_SERVER_ROOT || "/app";
const requireServer = createRequire(resolve(serverRoot, "package.json"));
const Database = requireServer("better-sqlite3");
// A reviewed source override runs in this process only; the deployed module stays untouched.
const sourceArg = process.argv.find(arg => arg.startsWith("--cache-source-base64="));
const cacheSource = sourceArg ? Buffer.from(sourceArg.slice("--cache-source-base64=".length), "base64") : readFileSync(resolve(serverRoot, "gemini-cache.js"));
const moduleUrl = sourceArg ? "data:text/javascript;base64," + cacheSource.toString("base64") : pathToFileURL(resolve(serverRoot, "gemini-cache.js"));
const { createGeminiCache, migrateGeminiCache, CACHE_LAYOUT } = await import(moduleUrl);
const model = "gemini-3.7-flash";
const key = live ? process.env.GEMINI_API_KEY : "dry-run-key";
assert.ok(key, "Gemini key must already exist in the executing environment");
if (live) assert.equal(process.env.GEMINI_EXPLICIT_CACHE, "0", "Production cache flag must stay off");
const base = "https://generativelanguage.googleapis.com/v1beta";
const db = new Database(":memory:");
db.exec("CREATE TABLE users(id TEXT PRIMARY KEY)");
db.prepare("INSERT INTO users(id) VALUES(?)").run("isolated_probe_334");
migrateGeminiCache(db);
const owned = new Set();
const counts = { count: 0, create: 0, generate: 0, delete: 0, inspect: 0 };
const receipt = { mode: live ? "live" : "dry-run", model, source: sourceArg ? "in-memory override" : "server checkout", sourceSha256: createHash("sha256").update(cacheSource).digest("hex"), started: new Date().toISOString(), productionFlag: process.env.GEMINI_EXPLICIT_CACHE || "absent", calls: [], generations: [], cleanup: [] };
function report(value) { console.log(JSON.stringify(value)); }
function safe(value) { return String(value).split(key).join("[REDACTED]"); }
async function fakeFetch(url, opts) {
  const body = opts.body ? JSON.parse(opts.body) : null;
  if (url.endsWith(":countTokens")) {
    const contents = body.generateContentRequest ? body.generateContentRequest.contents : body.contents;
    if (!Array.isArray(contents) || !contents.length) return Response.json({ error: { message: "* CountTokensRequest.generate_content_request.contents: contents is not specified" } }, { status: 400 });
    return Response.json({ totalTokens: 6500 });
  }
  if (url.endsWith("/cachedContents")) return Response.json({ name: "cachedContents/isolated_probe_334", expireTime: new Date(Date.now() + 3600000).toISOString(), usageMetadata: { totalTokenCount: 6500 } });
  if (url.endsWith(":generateContent")) {
    const engineState = JSON.parse(body.contents.at(-1).parts[0].text).engineState;
    const state = JSON.parse(engineState);
    return Response.json({ candidates: [{ content: { parts: [{ text: JSON.stringify({ marker: "RIVET-334", room: state.room, turn: state.turn }) }] }, finishReason: "STOP" }], usageMetadata: { promptTokenCount: 6550, cachedContentTokenCount: 6500, candidatesTokenCount: 25, totalTokenCount: 6575 } });
  }
  return opts.method === "DELETE" ? Response.json({}) : Response.json({ error: { message: "not found" } }, { status: 404 });
}
async function guardedFetch(url, opts) {
  assert.ok(url.startsWith(base + "/"), "Only the official Gemini endpoint is allowed");
  const path = url.slice(base.length);
  let kind;
  if (opts.method === "POST" && path === "/models/" + model + ":countTokens") kind = "count";
  else if (opts.method === "POST" && path === "/cachedContents") kind = "create";
  else if (opts.method === "POST" && path === "/models/" + model + ":generateContent") kind = "generate";
  else if ((opts.method === "DELETE" || opts.method === "GET") && owned.has(path.slice(1))) kind = opts.method === "DELETE" ? "delete" : "inspect";
  else throw Error("Unapproved probe request: " + opts.method + " " + path);
  const limit = kind === "generate" ? 2 : 1;
  assert.ok(counts[kind] < limit, "Probe request budget exceeded: " + kind);
  if (kind === "count") assert.deepEqual(JSON.parse(opts.body), { contents: [{ parts: [{ text: stable + CACHE_LAYOUT }] }] }, "Only stable cache text may enter token admission");
  counts[kind]++;
  const start = Date.now();
  let response;
  try { response = await (live ? fetch : fakeFetch)(url, opts); }
  catch (e) { receipt.calls.push({ kind, transportError: safe(e.message), elapsedMs: Date.now() - start }); throw e; }
  const body = await response.clone().json().catch(() => null);
  const call = { kind, httpStatus: response.status, elapsedMs: Date.now() - start };
  if (!response.ok) call.error = safe(body?.error?.message || "Non-JSON provider error");
  if (kind === "count") call.tokens = body?.totalTokens;
  if (kind === "create" && response.ok && /^cachedContents\/[A-Za-z0-9_-]+$/.test(body?.name || "")) {
    owned.add(body.name);
    call.name = body.name;
    call.expires = body.expireTime;
    call.tokens = body.usageMetadata?.totalTokenCount;
  }
  receipt.calls.push(call);
  report({ stage: kind, ...call });
  return response;
}

const reference = Array.from({ length: 360 }, (_, i) => "Catalog entry " + (i + 1) + ": a copper dial, a glass lens, and a wooden bracket are stored in a numbered drawer.").join("\n");
const stable = "You are an isolated transport-check assistant using invented data, not a live game. Answer each request with JSON only: marker, room, turn. The marker is always RIVET-334. Read room and turn only from the current engineState JSON string supplied under ENGINE STATE DELIVERY. Never use a previous value. The following catalog is static reference padding; do not repeat it.\n" + reference;
const states = [{ room: "Blue Workshop", turn: 1 }, { room: "Amber Observatory", turn: 2 }];
let firstName = null;
try {
  for (const state of states) {
    const parsed = { systemInstruction: { parts: [{ text: stable + JSON.stringify(state) }] }, contents: [{ role: "user", parts: [{ text: "Report the current marker, room, and turn as JSON." }] }], generationConfig: { maxOutputTokens: 1024, temperature: 0, responseMimeType: "application/json" } };
    const rawBody = JSON.stringify(parsed);
    // Reconstructing the manager checks handle reuse through its database, not an object memo.
    const cache = createGeminiCache({ db, enabled: true, fetchImpl: guardedFetch, logger: { warn: message => { receipt.warning = safe(message); report({ warning: safe(message) }); } } });
    const prepared = await cache.prepare({ userId: "isolated_probe_334", model, key, kind: "turn", header: "v1:" + stable.length, parsed, rawBody });
    assert.equal(prepared.status, "cached", "Cache preparation must succeed; no uncached paid fallback in this probe");
    if (firstName) assert.equal(prepared.name, firstName, "Second request must reuse the first cache");
    else firstName = prepared.name;
    const response = await guardedFetch(base + "/models/" + model + ":generateContent", { method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": key }, body: prepared.body, signal: AbortSignal.timeout(45000) });
    assert.ok(response.ok, "Generation rejected with HTTP " + response.status);
    const body = await response.json();
    const text = (body.candidates?.[0]?.content?.parts || []).filter(part => !part.thought && typeof part.text === "string").map(part => part.text).join("").trim();
    const generation = { turn: state.turn, text, usage: body.usageMetadata || {}, finishReason: body.candidates?.[0]?.finishReason };
    receipt.generations.push(generation);
    report({ stage: "generation-receipt", ...generation });
    assert.ok(body.usageMetadata?.cachedContentTokenCount > 0, "Provider must report cached tokens");
    assert.deepEqual(JSON.parse(text), { marker: "RIVET-334", ...state }, "Current state must replace the previous state while cached rules stay stable");
  }
  assert.equal(counts.create, 1);
  assert.equal(counts.count, 1);
  assert.equal(counts.generate, 2);
  receipt.result = "PASS";
} catch (e) {
  receipt.result = "FAIL";
  receipt.error = safe(e.message);
  process.exitCode = 1;
} finally {
  for (const name of owned) {
    let deletionAccepted = false;
    try {
      const result = await guardedFetch(base + "/" + name, { method: "DELETE", headers: { "x-goog-api-key": key }, signal: AbortSignal.timeout(10000) });
      assert.ok(result.ok || result.status === 404, "Test-cache cleanup failed: " + result.status);
      deletionAccepted = true;
      const check = await guardedFetch(base + "/" + name, { method: "GET", headers: { "x-goog-api-key": key }, signal: AbortSignal.timeout(10000) });
      assert.equal(check.status, 404, "Removed test cache must no longer exist");
      receipt.cleanup.push({ name, removed: true, absenceVerified: true, verifiedHttpStatus: check.status });
    } catch (e) { receipt.cleanup.push({ name, removed: deletionAccepted, absenceVerified: false, error: safe(e.message) }); receipt.result = "FAIL"; process.exitCode = 1; }
  }
  receipt.exposure = db.prepare("SELECT action,tokens,token_seconds,status FROM gemini_cache_events ORDER BY id").all();
  receipt.counts = counts;
  receipt.finished = new Date().toISOString();
  db.close();
  report({ finalReceipt: receipt });
}
