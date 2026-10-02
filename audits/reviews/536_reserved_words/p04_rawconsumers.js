// REVIEW PROBE p04: what still reads the RAW reply after applyMuts has refused a tag (commitGmTurn: the transcript's entity
// index, the [SAY:] speaker map, the session log, the stay-behind and retelling watchers). argv: <tree>
var L = require("./lib2.js");
console.log("tree: " + L.TREE + " | TTS text prep present: " + !!(typeof TTS !== "undefined" && TTS._textPrep));
var WORDS = ["constructor", "__proto__", "toString", "hasOwnProperty"];
var SHAPES = [
  ["SAY speaker", function (w) { return "The smith looks up.\n\n[SAY:" + w + "]\"Mind the coals,\" he says. \"They bite.\""; }],
  ["SAY speaker with a mood", function (w) { return "The smith looks up.\n\n[SAY:" + w + "|gruff]\"Mind the coals,\" he says."; }],
  ["NPC + NPC_NOTE + PARTY_MEMBER (the transcript's entity index reads these raw)", function (w) { return "A shape in the door. [NPC:" + w + "|calm|ally] [NPC_NOTE:" + w + "|owes a debt] [PARTY_MEMBER:" + w + "|true]"; }],
  ["QUEST title (entity index)", function (w) { return "A notice on the board. [QUEST:" + w + "|offered|read it]"; }],
  ["SCENE_CAST", function (w) { return "The room is full. [SCENE_CAST:Bram, " + w + "]"; }],
  ["CONDITION (the commit-time snapshot keys by condition name)", function (w) { return "It stings. [CONDITION:" + w + "|2 turns|a nettle]"; }],
  ["RELATIONSHIP_BOND (the commit-time snapshot keys by entity)", function (w) { return "A vow. [RELATIONSHIP_BOND:" + w + "|sworn brother]"; }]
];
WORDS.forEach(function (w) {
  SHAPES.forEach(function (s) {
    L.world("refs"); L.seed(3);
    var text = s[1](w), r = L.turn(text), p = L.prompt(), tr = worldState.transcript[worldState.transcript.length - 1] || {};
    var flags = [];
    if (r.thrown) flags.push("THROWN out of commitGmTurn: " + r.thrown);
    if (r.poison.length) flags.push("wrote on built-ins: " + r.poison.join(", "));
    if (p.thrown) flags.push("next prompt THROWS: " + p.thrown);
    if (p.poison.length) flags.push("prompt build wrote on built-ins: " + p.poison.join(", "));
    var sc = L.scanState(); if (sc.length) flags.push("state: " + sc.slice(0, 3).join(" | "));
    var errs = r.warns.filter(function (x) { return /threw/i.test(x); }); if (errs.length) flags.push("handler threw: " + errs.join(" ; ").slice(0, 200));
    console.log((flags.length ? "!! " : "   ") + w + " :: " + s[0] + "\n      summary: " + JSON.stringify(r.tag && r.tag.m).slice(0, 230) + "\n      transcript entry: sp=" + JSON.stringify(tr.sp || null) + " e=" + JSON.stringify(tr.e || null) + (flags.length ? "\n      " + flags.join("\n      ") : ""));
    L.unseed();
  });
});
