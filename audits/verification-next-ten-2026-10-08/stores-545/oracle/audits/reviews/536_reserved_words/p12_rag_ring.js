// REVIEW PROBE p12: two places that still see a refused tag.
//  (a) the transcript's entity index is built from the RAW reply (logTranscript -> ragEntitiesFromRaw), and retrieval scores
//      it through plain objects (w, gRoot, qws in _ragRetrieveScore): a refused name is indexed and then read as a key.
//  (b) the provenance ring lists tag names from the text AFTER the strip, and caps labels at ten.
// argv: <tree>
var L = require("./lib2.js");
console.log("tree: " + L.TREE);
function campaign(word, shape) {
  L.world("plain"); L.seed(9); worldState.ragMemory = true; worldState.turn = 1; sessionLog = [];
  var say = function (t, p) { return L.turn(t, { playerTxt: p || "I go on.", userMsg: p || "I go on." }); };
  say("The square is quiet. Bram hammers at the forge. [NPC:Bram|calm|ally]", "I look around the square.");
  say(shape(word), "I read the board.");
  say("You take the east road. [LOCATION:Greyford]", "I leave town.");
  var i; for (i = 0; i < 8; i++) say("The road runs on under grey cloud; a heron lifts from the reeds. [TIME_ADVANCE:10m]", "I walk on.");
  say("You ride on to the next town. [LOCATION:Harrow]", "I ride on."); say("Harrow is shuttered against the wind. [TIME_ADVANCE:10m]", "I look for an inn.");
  sessionLog = sessionLog.slice(-4);
  ragRetrieve._memo = null; ragRetrieve._cands = null; /* the memo key does not cover middle entries: a stale hit would lie here */
  var out = ""; try { out = quiet(function () { return ragRetrieve("I count my coins and check the saddle straps."); }).r; } catch (e) { out = "THROWS " + e.message; }
  var entry = worldState.transcript.filter(function (e) { return e.r === "gm"; })[1];
  var cands = (ragRetrieve._cands || []).map(function (c) { return "t" + c.t + ":" + (typeof c.sc === "number" ? Math.round(c.sc * 100) / 100 : JSON.stringify(c.sc)); });
  L.unseed();
  return { index: JSON.stringify(entry && entry.e), cands: cands.join(" "), served: /\[Turn 3/.test(out) ? "the turn-3 scene IS served as a past-scene excerpt" : (out ? "served, without turn 3" : "nothing served"), quests: JSON.stringify(worldState.questLog.map(function (q) { return q.title + ":" + q.status; })), poison: L.poison() };
}
console.log("--- (a) retrieval for an unrelated action, thirteen turns later, two towns on (nothing else on record at this place)");
[["a QUEST title", function (w) { return "A notice hangs on the board. [QUEST:" + w + "|offered|read it]"; }],
 ["an NPC name", function (w) { return "A mason passes. [NPC:" + w + "|calm|neutral]"; }]].forEach(function (s) {
  ["constructor", "construqtor"].forEach(function (w) {
    var r = campaign(w, s[1]);
    console.log("   " + s[0] + " = " + w + (w === "construqtor" ? " (control)" : "") + "\n      turn-3 entity index: " + r.index + " | quest log: " + r.quests + "\n      candidates (turn:score): " + (r.cands || "none") + "\n      -> " + r.served + (r.poison.length ? " | built-ins: " + r.poison.join(", ") : ""));
  });
});
console.log("--- (b) the provenance ring for a busy reply that carries one refused tag");
L.world("plain"); L.seed(9);
var busy = "A long day. [TIME_ADVANCE:10m] [GOLD:1] [GOLD:2] [GOLD:3] [GOLD:4] [GOLD:5] [ITEM_GAINED:Chalk] [ITEM_GAINED:Twine] [ITEM_GAINED:Nails] [LORE:The span was built by dwarves.] [NPC:Bram|calm|ally] [LOCATION_STATE:The forge is cold] [WEATHER:rain easing] [FACTION:constructor|the bridge guild]";
var r = L.turn(busy), ring = worldState.tagLog[worldState.tagLog.length - 1];
console.log("   reply tags (raw): " + (busy.match(/\[([A-Z_]+):/g) || []).map(function (x) { return x.slice(1, -1); }).filter(function (x, i, a) { return a.indexOf(x) === i; }).join(", "));
console.log("   ring entry: " + JSON.stringify(ring));
console.log("   FACTION in ring.tags: " + (ring.tags.indexOf("FACTION") >= 0) + " | a 'refused' label in ring.m: " + ring.m.some(function (m) { return /refused/.test(m); }) + " | ring.refused: " + JSON.stringify(ring.refused || null) + " | ring.stripped: " + JSON.stringify(ring.stripped || null));
L.unseed();
