// REVIEW PROBE p03: an item whose NORMALISED name is a reserved word (the pack's own normaliser strips a count suffix, a plural
// s, a provenance parenthetical and a dash clause, and lower-cases). Through real commitGmTurn. argv: <tree>
var L = require("./lib2.js");
function inv() { return JSON.stringify(worldState.character.inventory); }
function errs(r) { return r.warns.filter(function (w) { return /threw|refused|reserved/i.test(w); }).map(function (w) { return w.slice(0, 150); }); }
function show(label, text, ctl) {
  L.world("plain"); L.seed(1);
  var r = L.turn(text), p = L.prompt();
  console.log("--- " + label + "\n    reply : " + text + "\n    pack  : " + inv() + "\n    summary line (tagLog.m): " + JSON.stringify(r.tag && r.tag.m) + "\n    console: " + JSON.stringify(errs(r)) + (r.thrown ? "\n    THROWN out of commitGmTurn: " + r.thrown : "") + (r.poison.length ? "\n    wrote on built-ins: " + r.poison.join(", ") : "") + (p.thrown ? "\n    next prompt THROWS: " + p.thrown : "") + "\n    toasts: " + JSON.stringify(r.toasts));
  if (ctl) { L.world("plain"); L.seed(1); var rc = L.turn(ctl); console.log("    control reply : " + ctl + "\n    control pack  : " + inv() + "\n    control summary: " + JSON.stringify(rc.tag && rc.tag.m) + "\n    control toasts: " + JSON.stringify(rc.toasts)); }
  L.unseed();
}
console.log("tree: " + L.TREE);
show("exact word (what #536 covers)", "You find a crate. [ITEM_GAINED:Constructor] [ITEM_GAINED:Healing potion]", "You find a crate. [ITEM_GAINED:Construqtor] [ITEM_GAINED:Healing potion]");
show("plural s", "You find a crate. [ITEM_GAINED:Constructors] [ITEM_GAINED:Healing potion]", "You find a crate. [ITEM_GAINED:Construqtors] [ITEM_GAINED:Healing potion]");
show("count suffix", "You find a crate. [ITEM_GAINED:Constructor x2] [ITEM_GAINED:Healing potion]", "You find a crate. [ITEM_GAINED:Construqtor x2] [ITEM_GAINED:Healing potion]");
show("provenance parenthetical (the form the tag doc teaches)", "You find a crate. [ITEM_GAINED:Constructor (from the smith)] [ITEM_GAINED:Healing potion]", "You find a crate. [ITEM_GAINED:Construqtor (from the smith)] [ITEM_GAINED:Healing potion]");
show("dash clause", "You find a crate. [ITEM_GAINED:Constructor — a mason's level] [ITEM_GAINED:Healing potion]", "You find a crate. [ITEM_GAINED:Construqtor — a mason's level] [ITEM_GAINED:Healing potion]");
// a reward inside a canon claim: the handler error rolls the whole claim back
show("inside a quest-outcome claim", "The bell rings. [CANON_TXN_BEGIN:c1|quest-outcome|-|-|Find the bell][QUEST:Find the bell|completed][GOLD:20][ITEM_GAINED:Constructors][CANON_TXN_END:c1]", "The bell rings. [CANON_TXN_BEGIN:c1|quest-outcome|-|-|Find the bell][QUEST:Find the bell|completed][GOLD:20][ITEM_GAINED:Construqtors][CANON_TXN_END:c1]");
console.log("    (after the claim) quest log: " + JSON.stringify(worldState.questLog.map(function (q) { return q.title + ":" + q.status; })) + " | archived: " + JSON.stringify(Object.keys(memory.quests || {})) + " | gold " + worldState.character.gold + " | quarantined: " + JSON.stringify((worldState.canonQuarantine || []).map(function (q) { return q.reason || q; })).slice(0, 200));
// second turn: losing it again
L.world("plain"); L.seed(1);
var a = L.turn("You find a crate. [ITEM_GAINED:Constructors]");
var b = L.turn("You hand them over. [ITEM_LOST:Constructors] [ITEM_LOST:Travel ration]");
console.log("--- lose it again next turn\n    pack: " + inv() + "\n    summary: " + JSON.stringify(b.tag && b.tag.m) + "\n    console: " + JSON.stringify(errs(b)));
L.unseed();
