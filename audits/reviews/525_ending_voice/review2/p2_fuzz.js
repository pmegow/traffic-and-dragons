// Probe 2: fuzz endingMomentText / healEndingMoments / migrateWorldState idempotency with random Unicode.
require("./h.js");

function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
var rnd = mulberry32(0x5eed1234);
function ri(n) { return Math.floor(rnd() * n); }
// alphabet pools: chosen to hit every branch of wordCh / trim / split
var POOLS = [
  "abcdefghijklmnopqrstuvwxyz", "ABCDEFGHIJKLMNOPQRSTUVWXYZ", "0123456789",
  " \t\n\r\u00a0\u2028\u2029\u3000\uFEFF\u200b\u200d\u1680\u2003\u202f\u205f\u180e\u0085",
  "'\u2019\u2018\"\u201c\u201d`.,;:!?-\u2014\u2013()[]{}*_#>|\\/$^+",
  "\u00e9\u00eb\u00df\u0130\u0131\u01c5\uFB01\u1E9E\u0149\u01F0\u0390\u1F80\u2126\u212A\u017F",
  "\u0301\u0308\u0345\u0327\u20DD\u0338",
  "\u0418\u0432\u0430\u043d\u0416\u0436\u0391\u03b1\u03c2\u03a3",
  "\u592a\u90ce\u3042\u30a2\u05d3\u05d5\u0645\u062d\u0e2a\u0930\uac00",
  "\uD83D\uDD25\uD83D\uDE00\uD801\uDC00\uD801\uDC28\uD835\uDC00\uD800\uDFFF\uDC00\uDBFF",  // surrogate halves, incl. cased astral (Deseret) and lone ones
];
var WORDS = ["the", "The", "THE", "a", "A", "an", "of", "Mr", "Mr.", "mr", "Dr.", "St.", "Sir", "sir", "Lady", "King", "Captain", "Princess", "'s", "ending", "ending:", "'s ending:", "'s ending: "];
function rstr(maxLen) {
  var n = ri(maxLen + 1), s = "", i;
  for (i = 0; i < n; i++) {
    var r = rnd();
    if (r < 0.12) { s += WORDS[ri(WORDS.length)]; continue; }
    var p = POOLS[r < 0.5 ? ri(3) : ri(POOLS.length)];
    s += p.charAt(ri(p.length));
  }
  return s;
}
var N = 400000, bad = 0, i, shown = 0;
for (i = 0; i < N; i++) {
  var who = rstr(1 + ri(14)), text = (rnd() < 0.3) ? (who + rstr(8)) : rstr(1 + ri(30));
  var a = endingMomentText(who, text), b = endingMomentText(who, a);
  if (a !== b) { bad++; if (shown++ < 15) console.log("NOT IDEMPOTENT who=" + JSON.stringify(who) + " text=" + JSON.stringify(text) + "\n  1: " + JSON.stringify(a) + "\n  2: " + JSON.stringify(b)); }
  // invariant claimed by the comment: "The result always names the hero"
  var w = String(who || "").trim(), t = String(text == null ? "" : text).trim();
  if (w && t && !textNamesPerson(a, w)) { bad++; if (shown++ < 15) console.log("RESULT DOES NOT NAME who=" + JSON.stringify(who) + " text=" + JSON.stringify(text) + " -> " + JSON.stringify(a)); }
}
console.log("endingMomentText fuzz: " + N + " cases, failures: " + bad);

// The real load path: migrateWorldState, several times, with JSON round trips between (a save + load).
var bad2 = 0, M = 3000;
for (i = 0; i < M; i++) {
  makeWorld();
  var hero = rstr(1 + ri(12)), who2 = (rnd() < 0.7) ? hero : rstr(1 + ri(12));
  worldState.character.name = hero || "X";
  var txt = rstr(1 + ri(30)) || "x";
  worldState.character.coreMemories = [{ kind: "ending", who: who2, text: txt, turn: 5, camp: "Old" }, { kind: "death", who: who2, text: txt, turn: 4, camp: "Old" }];
  var cs = addComp("Comp" + i, [], { coreMemories: [{ kind: "ending", who: who2, text: txt, turn: 5, camp: "Old" }] });
  var q = quiet(function () { migrateWorldState(); });
  var s1 = JSON.stringify([worldState.character.coreMemories, cs.coreMemories]);
  worldState = JSON.parse(JSON.stringify(worldState));
  quiet(function () { migrateWorldState(); });
  var s2 = JSON.stringify([worldState.character.coreMemories, worldState.npcs[worldState.npcs.length - 1].charSheet.coreMemories]);
  worldState = JSON.parse(JSON.stringify(worldState));
  quiet(function () { migrateWorldState(); });
  var s3 = JSON.stringify([worldState.character.coreMemories, worldState.npcs[worldState.npcs.length - 1].charSheet.coreMemories]);
  if (s1 !== s2 || s2 !== s3) { bad2++; if (bad2 < 10) console.log("LOAD NOT IDEMPOTENT hero=" + JSON.stringify(hero) + " who=" + JSON.stringify(who2) + " text=" + JSON.stringify(txt) + "\n 1 " + s1 + "\n 2 " + s2 + "\n 3 " + s3); }
  // the non-ending moment must never change
  if (worldState.character.coreMemories[1].text !== txt) { bad2++; console.log("NON-ENDING MOMENT CHANGED"); }
}
console.log("migrateWorldState x3 fuzz: " + M + " worlds, failures: " + bad2);
