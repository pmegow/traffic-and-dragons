// REVIEW PROBE p17: the smaller forms that pass the strip because a handler splits or normalises further than "pieces
// between pipes and commas". Each line: the word, then the same reply with a one-letter-off control. argv: <tree>
var L = require("./lib.js");
console.log("tree: " + L.TREE);
function pair(label, mk, read, mode, before) {
  ["constructor", "construqtor"].forEach(function (w) {
    L.world(mode || "plain"); if (before) before();
    var text = mk(w), r, thrown = ""; try { r = run(text); } catch (e) { thrown = e.message; r = { muts: [], warns: [], r: {} }; }
    var p = L.poison(), extra = read ? read() : "";
    console.log((w === "constructor" ? "--- " + label + "\n    word   : " : "    control: ") + text.replace(/^x /, "") + "\n             summary " + JSON.stringify(r.muts).slice(0, 210) + (((r.r && r.r.errors) || []).length ? " | handler errors " + JSON.stringify(r.r.errors).slice(0, 150) : "") + " | console lines " + r.warns.filter(function (x) { return /^W /.test(x); }).length + (extra ? " | " + extra : "") + (p.length ? " | wrote on built-ins: " + p.join(", ").slice(0, 120) : "") + (thrown ? " | THROWN " + thrown : ""));
  });
}
function cap(w) { return w.charAt(0).toUpperCase() + w.slice(1); }
pair("capability name with a parenthetical: SPELL_DEF (capBaseName strips it and lower-cases)", function (w) { return "x [SPELL_DEF:" + cap(w) + " (ritual)|range=30 ft|effect=raises a wall]"; }, function () { return "overlay keys " + JSON.stringify(Object.keys(worldState.capabilityBible || {})); });
pair("capability name with a parenthetical: ABILITY_GAINED, then the scene manifest", function (w) { return "x [ABILITY_GAINED:" + cap(w) + " (lesser)|You raise a wall of stone.]"; }, function () { var m = buildSceneManifest(); return "manifest caps " + JSON.stringify(m.caps.map(function (c) { return c.name; })) + " | capabilityLookup -> " + typeof capabilityLookup(worldState.character.abilities[worldState.character.abilities.length - 1].nm); });
pair("PARTY_SPLIT to 'word (the yard)' (the handler peels the parenthetical when the outer name is a known place)", function (w) { return "x [PARTY_SPLIT:Kira|" + w + " (the yard)]"; }, function () { var k = findCompanionChar("Kira"); return "split record " + JSON.stringify(k.splitLoc || null) + " | edges " + JSON.stringify(memory.map.edges); });
pair("LAYOUT: a second room after ';' named by the word", function (w) { return "x [LAYOUT:hall|small|a bench|outside; " + w + "|small|a vat|hall]"; }, function () { return "layout on record: " + !!memory.map.nodes.Ashfen.layout; });
pair("LAYOUT: a door to a room that is not listed, named by the word", function (w) { return "x [LAYOUT:hall|small|a bench|" + w + "; yard|small|a vat|hall]"; }, function () { return "layout on record: " + !!memory.map.nodes.Ashfen.layout; });
pair("ITEM_DEF: the word as a field key", function (w) { return "x [ITEM_DEF:Lantern|" + w + "=gnomes|effect=gives light]"; }, function () { return "proposed entry " + JSON.stringify(worldState.pendingItemDefs && worldState.pendingItemDefs[0] && worldState.pendingItemDefs[0].entry); });
pair("ITEM_DEF: the word as the category", function (w) { return "x [ITEM_DEF:Lantern|category=" + w + "|effect=gives light]"; }, function () { return "proposed entry " + JSON.stringify(worldState.pendingItemDefs && worldState.pendingItemDefs[0] && worldState.pendingItemDefs[0].entry); });
pair("SOUNDSCAPE: the word as a field name", function (w) { return "x [SOUNDSCAPE:Ashfen|" + w + "=open;enclosure=open;setting=wilderness;biome=temperate;quiet=normal;allows=birds;forbid=none]"; }, function () { return typeof audioParseProfile === "function" ? "parse says: " + JSON.stringify(audioParseProfile("Ashfen|constructor=open;enclosure=open".replace("constructor", "constructor"))) : "audio parser not loaded in this harness"; });
// OLD, any word: a list-valued name in motivationChanges throws out of the whole extraction
(function () {
  ["Kira"].forEach(function (nm) {
    L.world("plain"); var thrown = ""; try { quiet(function () { applySummaryExtract({ chapterSummary: "A day passes.", npcUpdates: [{ name: "Bram", knowledgeGained: "shod the grey mare" }], motivationChanges: [{ name: [nm], now: "to find the bell" }] }, null); }); } catch (e) { thrown = e.message; }
    console.log("--- OLD (any word): motivationChanges with a list-valued name [\"" + nm + "\"]\n    " + (thrown ? "applySummaryExtract THROWS: " + thrown : "applied") + " | Bram knows " + JSON.stringify(memory.npcs.Bram.knowledge) + " | chapters filed " + memory.chapters.length);
  });
})();
