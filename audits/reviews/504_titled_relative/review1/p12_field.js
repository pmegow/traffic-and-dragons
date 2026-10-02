// p12 — READ-ONLY field census over the owner's newest save per campaign: how exposed are real names to the findings?
//  (1) surnames the core tokenizer splits, and records that end in something other than the family name;
//  (2) how often real GM tags name an established person by a SHORT form (surname-only, given-name-only);
//  (3) companion tags addressed by a short form of the companion's name.
require("./base.js");
var fs = require("fs"), path = require("path"), CAMP = "C:/Projects/traffic-and-dragons/Campaigns";
function newest(dir) { var d = path.join(dir, "saves"); if (!fs.existsSync(d)) return null; var a = fs.readdirSync(d).filter(function (f) { return /\.tnd$/.test(f); }).map(function (f) { return { f: path.join(d, f), t: fs.statSync(path.join(d, f)).mtimeMs }; }).sort(function (x, y) { return y.t - x.t; }); return a.length ? a[0].f : null; }
var tot = { keys: 0, twoPlus: 0, splitSurname: 0, surTags: 0, givenTags: 0, compShort: 0, compFull: 0 };
fs.readdirSync(CAMP).forEach(function (c) {
  var f = newest(path.join(CAMP, c)); if (!f) return; var save; try { save = JSON.parse(fs.readFileSync(f, "utf8")); } catch (e) { return; }
  var ws; try { ws = quiet(function () { return inflateWorldStateSnapshot(save.worldState); }).r; } catch (e2) { ws = save.worldState; }
  worldState = ws; memory = save.memory; if (!memory || !memory.npcs) return;
  var keys = Object.keys(memory.npcs), odd = [], twoPlus = 0;
  keys.forEach(function (k) {
    var plain = k.replace(/\(.*?\)/g, " ").trim(), words = plain.split(/\s+/);
    if (npcCoreTokens(k).length >= 2) twoPlus++;
    if (words.length >= 2 && /['\u2019\-]|[^\x00-\x7f]/.test(plain)) odd.push(k);
  });
  var log = (save.sessionLog || []).map(function (m) { return String(m.content || ""); }).join("\n");
  var tr = (worldState.transcript || []).map(function (e) { return String((e && (e.raw || e.c || e.text || e.content)) || ""); }).join("\n");
  var text = log + "\n" + tr, re = /\[(NPC|NPC_PRONOUN|NPC_NOTE|SAY|NPC_DEATH_REPORTED|SCENE_REF|PARTY_MEMBER):([^|\]]+)[|\]]/g, m, sur = {}, giv = {};
  while ((m = re.exec(text))) {
    var nm = (m[1] === "SCENE_REF") ? null : m[2].trim(); if (!nm || memory.npcs[nm] || npcAliasOwner(nm)) continue;
    var cn = quiet(function () { return npcConsolidation(nm); }).r; if (!cn || !cn.key) continue;
    var ic = npcCoreTokens(nm), kc = npcCoreTokens(cn.key); if (ic.length !== 1 || kc.length < 2) continue;
    if (kc[kc.length - 1] === ic[0]) sur[nm + " -> " + cn.key] = (sur[nm + " -> " + cn.key] || 0) + 1; else if (kc[0] === ic[0]) giv[nm + " -> " + cn.key] = (giv[nm + " -> " + cn.key] || 0) + 1;
  }
  var party = (worldState.npcs || []).filter(function (n) { return n && n.partyMember; }).map(function (n) { return n.name; }), cs = 0, cf = 0, shortForms = {};
  re = /\[COMPANION_[A-Z_]+:([^|\]]+)[|\]]/g;
  while ((m = re.exec(text))) { var cnm = m[1].trim(); if (party.indexOf(cnm) >= 0) cf++; else { cs++; shortForms[cnm] = (shortForms[cnm] || 0) + 1; } }
  var sN = Object.keys(sur).reduce(function (a, k) { return a + sur[k]; }, 0), gN = Object.keys(giv).reduce(function (a, k) { return a + giv[k]; }, 0);
  tot.keys += keys.length; tot.twoPlus += twoPlus; tot.splitSurname += odd.length; tot.surTags += sN; tot.givenTags += gN; tot.compShort += cs; tot.compFull += cf;
  console.log("\n" + c + " (" + path.basename(f) + "): " + keys.length + " npc keys, " + twoPlus + " with two or more name words");
  console.log("   keys with an apostrophe, hyphen or non-ASCII letter (title question can never fire on these): " + (odd.length ? JSON.stringify(odd) : "none"));
  console.log("   tags that reached a person by SURNAME only (" + sN + "): " + JSON.stringify(sur));
  console.log("   tags that reached a person by GIVEN NAME only (" + gN + "): " + JSON.stringify(giv).slice(0, 700));
  console.log("   party: " + JSON.stringify(party) + " | COMPANION_* tags by the full name: " + cf + ", by another form: " + cs + " " + JSON.stringify(shortForms));
});
console.log("\nTOTAL " + JSON.stringify(tot));
