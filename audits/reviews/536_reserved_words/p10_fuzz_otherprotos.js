// REVIEW PROBE p10 (p02 with env switches: P02_DECOS="a;b" keeps those decorations, P02_CTL2=1 makes the control by changing the 2nd letter): differential census. Every tag shape x every operand x decorations of a reserved word, through the real
// applyMuts, compared with the SAME text carrying a one-letter-off control word. Anything the engine does differently for the
// reserved word (and that is not the #536 refusal) is contact with the object machinery.
// argv: <tree> [out.json] [words csv]
var L = require("./lib.js"), fs = require("fs");
var OUT = process.argv[3] || ("p02_results_" + L.TREE + ".json");
var WORDS = (process.argv[4] || "constructor,toString,__proto__").split(",");
// --- tag shapes: § is the operand under test. modes: p=plain r=refs c=combat v=village
var T = [];
function add(modes, list) { list.forEach(function (t) { T.push({ t: t, modes: modes }); }); }
add("pr", ["[CHECK:§|+2|12]", "[COMPANION_AGENDA:§|a want]", "[COMPANION_AGENDA:Kira|§]", "[COMPANION_AGENDA:Kira|a want|§]",
  "[COMPANION_GROWTH:§|reckless|careful now]", "[COMPANION_GROWTH:Kira|§|careful now]", "[COMPANION_GROWTH:Kira|reckless|§]", "[COMPANION_GROWTH:Kira|motivation|§]",
  "[COMPANION_AGENDA_DONE:§]", "[COMPANION_AGENDA_DONE:Kira|§]", "[COMPANION_INITIATIVE:§|does a thing]", "[COMPANION_INITIATIVE:Kira|§]", "[COMPANION_AGENDA_BEAT:§]",
  "[SUGGEST:§|b|c]", "[WHISPER:§]", "[LOCATION_HOURS:8-20|§]", "[LOCATION_HOURS:§]", "[SHOP_KEEPER:§]", "[DOWNED_RESOLVED:§]", "[DOWNED_RESOLVED:rescued|§]", "[GOLD:5 §]", "[HP:-1 §]",
  "[ITEM_GAINED:§]", "[ITEM_LOST:§]", "[ITEM_RENAMED:§|New name]", "[ITEM_RENAMED:Longsword|§]", "[ITEM_KEPT:§]",
  "[LOCATION:§]", "[SUBLOCATION:§]",
  "[SCENE_REF:§|Bram]", "[SCENE_REF:h1|§]", "[SCENE_NOT:§|Bram|explicit]", "[SCENE_NOT:h1|§|explicit]", "[SCENE_REVEAL:§|Bram]", "[SCENE_REVEAL:h1|§]", "[SCENE_DEATH:§]",
  "[TIME_CHECK:§]", "[TIME:§]", "[SOUNDSCAPE:§|enclosure=open;setting=wilderness;biome=temperate;quiet=normal;allows=birds;forbid=none]", "[SOUNDSCAPE:the yard|§=open;setting=wilderness;biome=temperate;quiet=normal;allows=birds;forbid=none]", "[SOUNDSCAPE:the yard|enclosure=§;setting=wilderness;biome=temperate;quiet=normal;allows=birds;forbid=none]", "[SOUNDSCAPE:the yard|enclosure=open;setting=wilderness;biome=temperate;quiet=normal;allows=birds,§;forbid=none]",
  "[WEATHER:§]", "[TIME_ADVANCE:§]", "[SCHEDULE:§|2h]", "[SCHEDULE:the duel|§]", "[SCHEDULE_RESOLVED:§]", "[SCHEDULE_CANCEL:§]",
  "[LOCATION_DESC:§]", "[LOCATION_SIZE:§|10]", "[LOCATION_SIZE:small|§]",
  "[LAYOUT:§|small|a bench|outside]", "[LAYOUT:hall|§|a bench|outside]", "[LAYOUT:hall|small|§|outside]", "[LAYOUT:hall|small|a bench|§]", "[LAYOUT:hall|small|a bench|outside; §|small|a vat|hall]", "[LAYOUT:hall|small|a bench|§; yard|small|a vat|hall]",
  "[EXIT:§|north]", "[EXIT:a door|§]",
  "[LOCATION_ITEM:§|placed]", "[LOCATION_ITEM:Rope|placed|§]", "[LOCATION_ITEM:Rope|placed|Ashfen|§]", "[LOCATION_ITEM:§|taken]",
  "[LOCATION_STATE:§]", "[LOCATION_STATE:burned out|§]",
  "[WARES:§|5 gp|fresh]", "[WARES:Ale|§|fresh]", "[WARES:Ale|5 gp|§]", "[WARES:Ale|5 gp|fresh]|§|5 gp|odd]", "[WARES:Ale|5 gp|fresh]|Bread|5 gp|§]",
  "[WANTED:§|5 gp|Bram]", "[WANTED:Rope|§|Bram]", "[WANTED:Rope|5 gp|§]",
  "[NPC_ALIAS:§|Other]", "[NPC_ALIAS:Bram|§]", "[NPC_ALIAS:Tess|§]", "[NPC_MERGE:§|Bram]", "[NPC_MERGE:Bram|§]",
  "[ALIAS:§|Bram|Other]", "[ALIAS:npc|§|Other]", "[ALIAS:npc|Bram|§]", "[ALIAS:location|§|Other]", "[ALIAS:location|Ashfen|§]", "[MERGE:npc|§|Bram]", "[MERGE:npc|Bram|§]", "[MERGE:location|§|Ashfen]", "[MERGE:location|Ashfen|§]",
  "[NPC:§|calm|ally]", "[NPC:Bram|§|ally]", "[NPC:Bram|calm|§]", "[NPC:§|dead|enemy]",
  "[LOCATION_RESIDENT:§]", "[LOCATION_RESIDENT:Bram|§]", "[NPC_DEATH_REPORTED:§|a rider]", "[NPC_DEATH_REPORTED:Bram|§]",
  "[NPC_DEATH_RETRACTED:§|a mistake|Ashfen]", "[NPC_DEATH_RETRACTED:Bram|§|Ashfen]", "[NPC_DEATH_RETRACTED:Bram|a mistake|§]",
  "[DICE:§|12|success]", "[DICE:Stealth|12|§]", "[XP:5 §]",
  "[QUEST:§|active|do it]", "[QUEST:Find the bell|§|do it]", "[QUEST:Find the bell|active|§]", "[QUEST:§|completed]", "[QUEST:§|offered]",
  "[QUEST_STEP:§|a step|true]", "[QUEST_STEP:Find the bell|§|true]", "[QUEST_STEP:Find the bell|a step|§]",
  "[COMBAT_START:§|10|12|3|1d6|steady]", "[COMBAT_START:Wolf|10|12|3|§|steady]", "[COMBAT_START:Wolf|10|12|3|1d6|§]",
  "[ABILITY_GAINED:§|You raise a wall.]", "[ABILITY_GAINED:Stonewall|§]", "[SPELL_USED:§]", "[COMPANION_SPELL_USED:§|Charm Person]", "[COMPANION_SPELL_USED:Kira|§]",
  "[MANA:+2|§]", "[COMPANION_MANA:§|+2]", "[COMPANION_MANA:Kira|+2|§]",
  "[SPELL_DEF:§|range=30 ft|effect=raises a wall]", "[SPELL_DEF:Stonewall|§=30 ft|effect=raises a wall]", "[SPELL_DEF:Stonewall|range=§|effect=raises a wall]", "[SPELL_DEF:Stonewall|range=30 ft|category=§]", "[SPELL_DEF:Stonewall|§:30 ft|effect=raises a wall]",
  "[ITEM_DEF:§|category=tool|effect=opens locks]", "[ITEM_DEF:Lantern|§=x|effect=gives light]", "[ITEM_DEF:Lantern|category=§|effect=gives light]", "[ITEM_DEF:Lantern|§|gives light]", "[ITEM_DEF:Lantern|tool|§]", "[ITEM_DEF:Lantern|§:x|effect=gives light]",
  "[REST:long §]", "[LORE:§]", "[DECISION:§]", "[FUTURE_EVENT:§|soon]", "[FUTURE_EVENT:the duel|§]", "[FUTURE_EVENT_RESOLVED:§]",
  "[NPC_NOTE:§|a fact]", "[NPC_NOTE:Bram|§]", "[NPC_FORGET:§|forge]", "[NPC_FORGET:Bram|§]", "[NPC_SUPERSEDE:§|old|new]", "[NPC_SUPERSEDE:Bram|§|new]", "[NPC_SUPERSEDE:Bram|keeps the forge|§]",
  "[NPC_PRONOUN:§|he/him]", "[NPC_PRONOUN:Bram|§]", "[NPC_LINK:§|Bram|kin]", "[NPC_LINK:Bram|§|kin]", "[NPC_LINK:Bram|Kira|§]",
  "[FACTION:§|a group]", "[FACTION:The Guild|§]", "[NPC_FACTION:§|The Guild|member]", "[NPC_FACTION:Bram|§|member]", "[NPC_FACTION:Bram|The Guild|§]",
  "[FACTION_REL:§|The Guild|rivals]", "[FACTION_REL:The Guild|§|rivals]", "[FACTION_REL:The Guild|The Watch|§]",
  "[PARTY_MEMBER:§|true]", "[PARTY_MEMBER:Bram|§]", "[SKILL_SUCCESS:§]", "[COMPANION_SKILL_SUCCESS:§|Stealth]", "[COMPANION_SKILL_SUCCESS:Kira|§]",
  "[CONDITION:§|2 turns|a blow]", "[CONDITION:Dazed|§|a blow]", "[CONDITION:Dazed|2 turns|§]", "[CONDITION_REMOVED:§]",
  "[RELATIONSHIP:§|ally]", "[RELATIONSHIP:Bram|§]", "[RELATIONSHIP_REMOVED:§]", "[RELATIONSHIP_BOND:§|sworn brother]", "[RELATIONSHIP_BOND:Bram|§]", "[RELATIONSHIP_BOND_REMOVED:§]",
  "[RELATIONSHIP_DYNAMIC:§|wary]", "[RELATIONSHIP_DYNAMIC:Bram|§]", "[RELATIONSHIP_DYNAMIC_REMOVED:§]", "[RELATIONSHIP_PAIR_REMOVED:§]",
  "[SAVE_MOD:§|poison|+2]", "[SAVE_MOD:Amulet|§|+2]", "[SAVE_MOD_REMOVED:§]", "[LANGUAGE:§|fluent]", "[LANGUAGE:Elvish|§]", "[STORY_BEAT:§]",
  "[CORE_MEMORY:§|a vow sworn]", "[CORE_MEMORY:Bram|§]", "[ARC_COMPLETE:§]", "[ARC_CONTINUE:§]", "[ARC_CONTINUE:The Toll|§]", "[ACT_COMPLETE:§]",
  "[PARTY_SPLIT:§|Ashfen]", "[PARTY_SPLIT:Kira|§]", "[PARTY_SPLIT:Kira|Ashfen|§]",
  "[COMPANION_HP:§|-1]", "[COMPANION_ITEM_GAINED:§|Rope]", "[COMPANION_ITEM_GAINED:Kira|§]", "[COMPANION_ITEM_LOST:§|Rope]", "[COMPANION_ITEM_LOST:Kira|§]",
  "[COMPANION_ITEM_RENAMED:§|Dagger|Knife]", "[COMPANION_ITEM_RENAMED:Kira|§|Knife]", "[COMPANION_ITEM_RENAMED:Kira|Dagger|§]",
  "[WORN:§|Dagger|on]", "[WORN:Kira|§|on]", "[WORN:Kira|Dagger|§]", "[OUTFIT:§|a grey cloak]", "[OUTFIT:Kira|§]", "[COMPANION_ITEM_KEPT:§|Rope]", "[COMPANION_ITEM_KEPT:Kira|§]", "[COMPANION_XP:§|5]",
  "[COMPANION_CONDITION:§|Dazed|2 turns]", "[COMPANION_CONDITION:Kira|§|2 turns]", "[COMPANION_CONDITION:Kira|Dazed|§]", "[COMPANION_CONDITION:Kira|Dazed|2 turns|§]", "[COMPANION_CONDITION_REMOVED:§|Dazed]", "[COMPANION_CONDITION_REMOVED:Kira|§]",
  "[COMPANION_RELATIONSHIP:§|Bram|ally]", "[COMPANION_RELATIONSHIP:Kira|§|ally]", "[COMPANION_RELATIONSHIP:Kira|Bram|§]", "[COMPANION_RELATIONSHIP_REMOVED:Kira|§]",
  "[COMPANION_RELATIONSHIP_BOND:§|Bram|sworn]", "[COMPANION_RELATIONSHIP_BOND:Kira|§|sworn]", "[COMPANION_RELATIONSHIP_BOND:Kira|Bram|§]", "[COMPANION_RELATIONSHIP_BOND_REMOVED:Kira|§]",
  "[COMPANION_RELATIONSHIP_DYNAMIC:§|Bram|wary]", "[COMPANION_RELATIONSHIP_DYNAMIC:Kira|§|wary]", "[COMPANION_RELATIONSHIP_DYNAMIC:Kira|Bram|§]", "[COMPANION_RELATIONSHIP_DYNAMIC_REMOVED:Kira|§]", "[COMPANION_RELATIONSHIP_PAIR_REMOVED:Kira|§]",
  "[COMPANION_ABILITY:§|Stonewall|raises a wall]", "[COMPANION_ABILITY:Kira|§|raises a wall]", "[COMPANION_ABILITY:Kira|Stonewall|§]", "[COMPANION_ALIGNMENT:§|law+1]",
  "[SAY:§]\"Hello there,\" he says.", "[SAY:Bram|§]\"Hello there,\" he says.", "[SCENE_CAST:§]", "[SCENE_CAST:Bram, §]", "[SCENE_CAST:Bram| §]", "[NO_CHANGE:§]", "[RETCON:§]", "[ACTIONS:§|b|c]",
  "[CANON_TXN_BEGIN:§|npc-death|Bram|h1|-][SCENE_DEATH:h1][XP:5][CANON_TXN_END:§]", "[CANON_TXN_BEGIN:c1|npc-death|§|h1|-][SCENE_DEATH:h1][XP:5][CANON_TXN_END:c1]", "[CANON_TXN_BEGIN:c1|npc-death|Bram|§|-][SCENE_DEATH:§][XP:5][CANON_TXN_END:c1]", "[CANON_TXN_BEGIN:c1|npc-death|Bram|h1|§][SCENE_DEATH:h1][XP:5][CANON_TXN_END:c1]",
  "[CANON_TXN_BEGIN:c1|§|Bram|h1|-][SCENE_DEATH:h1][XP:5][CANON_TXN_END:c1]", "[CANON_TXN_BEGIN:c1|quest-outcome|-|-|§][QUEST:§|completed][XP:5][CANON_TXN_END:c1]", "[CANON_TXN_BEGIN:c1|quest-outcome|-|-|Find the bell][QUEST:Find the bell|completed][ITEM_GAINED:§][CANON_TXN_END:c1]",
  "[SCENE_REF:h1|Bram][CANON_TXN_BEGIN:c1|npc-death|Bram|h1|-][SCENE_DEATH:h1][ITEM_GAINED:§][CANON_TXN_END:c1]"]);
add("c", ["[COMBAT_IMMUNE:§]", "[COMBAT_RESIST:fire, §]", "[COMBAT_VULN:§]", "[ENEMY_HP:§|-3]", "[ENEMY_SLAIN:§]", "[ENEMY_SURRENDERS:§]", "[COMBAT_END:§]", "[COMBAT_START:§|10|12|3|1d6|steady]", "[COMBAT_START:§|10|12|3|1d6|steady][ENEMY_SLAIN:§][COMBAT_END:victory]"]);
add("v", ["[WARES:§|5 gp|fresh]", "[WARES:Ale|5 gp|fresh]|§|5 gp|odd]", "[SHOP_KEEPER:§]", "[LOCATION_ITEM:§|placed]", "[LOCATION_ITEM:Rope|placed|§]", "[LOCATION_ITEM:§|taken]", "[SUBLOCATION:§]", "[ITEM_GAINED:§]", "[ITEM_LOST:§]", "[GOLD:-5][ITEM_GAINED:§]", "[WANTED:§|5 gp|Frizwick]", "[LOCATION_RESIDENT:§]", "[SCENE_CAST:Frizwick, §]", "[NPC:§|calm|neighbour]", "[LAYOUT:§|small|a bench|outside]"]);
// --- decorations of the word
var D = [
  ["exact", function (w) { return w; }],
  ["the+", function (w) { return "the " + w; }], ["The+", function (w) { return "The " + w; }], ["a+", function (w) { return "a " + w; }],
  ["+s", function (w) { return w + "s"; }], ["+'s", function (w) { return w + "'s"; }],
  ["+ x2", function (w) { return w + " x2"; }], ["+ x1", function (w) { return w + " x1"; }],
  ["+ (paren)", function (w) { return w + " (from Bram)"; }], ["(paren) +", function (w) { return "(old) " + w; }],
  ["+ em-dash clause", function (w) { return w + " — a mason's tool"; }], ["+ hyphen clause", function (w) { return w + " - old"; }],
  ["+.", function (w) { return w + "."; }], ["+!", function (w) { return w + "!"; }], ["+:", function (w) { return w + ":"; }], ["+;", function (w) { return w + ";"; }],
  ["\"+\"", function (w) { return "\"" + w + "\""; }], ["'+'", function (w) { return "'" + w + "'"; }],
  ["+/Bram", function (w) { return w + "/Bram"; }], ["Bram/+", function (w) { return "Bram/" + w; }], ["+; Bram", function (w) { return w + "; Bram"; }], ["Bram; +", function (w) { return "Bram; " + w; }],
  ["+ and Bram", function (w) { return w + " and Bram"; }], ["Bram and +", function (w) { return "Bram and " + w; }], ["Bram & +", function (w) { return "Bram & " + w; }],
  ["+=1", function (w) { return w + "=1"; }], ["k=+", function (w) { return "k=" + w; }], ["k:+", function (w) { return "k: " + w; }],
  ["Sir +", function (w) { return "Sir " + w; }], ["+ Vale", function (w) { return w + " Vale"; }],
  ["+_", function (w) { return w + "_"; }], ["-+", function (w) { return "-" + w; }],
  ["+ZWSP", function (w) { return w + "​"; }], ["ZWSP+", function (w) { return "​" + w; }], ["+NBSP", function (w) { return w + " "; }], ["BOM+", function (w) { return "﻿" + w; }],
  ["newline+", function (w) { return "\n" + w + "\n"; }], ["Arc 1: +", function (w) { return "Arc 1: " + w; }], ["Ashfen (+)", function (w) { return "Ashfen (" + w + ")"; }], ["+ (the yard)", function (w) { return w + " (the yard)"; }],
  ["UPPER", function (w) { return w.toUpperCase(); }], ["Capital", function (w) { return w.charAt(0).toUpperCase() + w.slice(1); }],
  ["hidden in outer bracket", null]
];
var MODES = { p: "plain", r: "refs", c: "combat", v: "village" };
if (process.env.P02_DECOS) { var _keep = process.env.P02_DECOS.split(";"); D = D.filter(function (d) { return _keep.indexOf(d[0]) >= 0; }); }
var CTL = process.env.P02_CTL2 ? function (w) { return w.charAt(0) + (w.charAt(1) === w.charAt(1).toUpperCase() && w.charAt(1) !== w.charAt(1).toLowerCase() ? "Q" : "q") + w.slice(2); } : L.controlOf;
function facets(r) { return { muts: r.muts.join(" || "), errors: r.errors.join(" || "), thrown: r.thrown, state: r.state, prompt: r.prompt, promptThrow: r.promptThrow, serThrow: r.serThrow }; }
function firstDiff(a, b) { var i = 0, n = Math.min(a.length, b.length); while (i < n && a.charAt(i) === b.charAt(i)) i++; return { at: i, a: a.slice(Math.max(0, i - 70), i + 110), b: b.slice(Math.max(0, i - 70), i + 110) }; }
var results = [], counts = {}, t0 = Date.now(), n = 0;
WORDS.forEach(function (w) {
  var c = CTL(w);
  T.forEach(function (tpl) {
    tpl.modes.split("").forEach(function (mk) {
      D.forEach(function (d) {
        var mk2 = MODES[mk], textW, textC;
        if (d[1]) { textW = "It happens. " + tpl.t.split("§").join(d[1](w)); textC = "It happens. " + tpl.t.split("§").join(d[1](c)); }
        else { textW = "It happens. [TIME:dusk " + tpl.t.split("§").join(w); textC = "It happens. [TIME:dusk " + tpl.t.split("§").join(c); }
        var rw = L.runCase(textW, mk2), rc = L.runCase(textC, mk2); n++;
        var fw = facets(rw), fc = facets(rc), diffs = [], k;
        for (k in fw) { var sw = process.env.P02_CTL2 ? fw[k] : L.subst(fw[k], w, c), sc = process.env.P02_CTL2 ? L.subst(fc[k], c, w) : fc[k]; if (sw !== sc) { var fd = firstDiff(sw, sc); diffs.push({ facet: k, at: fd.at, word: fd.a, control: fd.b }); } }
        var cls;
        if (rw.refused) cls = "REFUSED";
        else if (rw.poison.length || rw.poison2.length) cls = "POISON";
        else if (rw.thrown || rw.promptThrow || rw.serThrow) cls = "THROW";
        else if (rw.errors.length) cls = "HANDLER_ERROR";
        else if (rw.scan.length) cls = "STATE_KEY";
        else if (diffs.length) cls = "DIFF";
        else cls = "SAME";
        if (rc.poison.length || rc.poison2.length || rc.thrown || rc.errors.length) cls += "+CONTROL_ALSO";
        counts[w + " " + cls] = (counts[w + " " + cls] || 0) + 1;
        if (cls !== "SAME" && !(cls === "REFUSED") && results.length < 600) results.push({ word: w, tpl: tpl.t, mode: mk2, deco: d[0], cls: cls, text: textW, muts: rw.muts, errors: rw.errors, thrown: rw.thrown, poison: rw.poison.concat(rw.poison2), promptThrow: rw.promptThrow, serThrow: rw.serThrow, scan: rw.scan.slice(0, 6), diffs: diffs.map(function (x) { return { facet: x.facet, at: x.at, word: x.word.slice(0, 180), control: x.control.slice(0, 180) }; }), controlMuts: rc.muts, controlErr: rc.errors.concat(rc.thrown ? [rc.thrown] : []) });
        else if (cls === "REFUSED" && (rw.poison.length || rw.poison2.length || rw.errors.length || rw.thrown || rw.promptThrow)) results.push({ word: w, tpl: tpl.t, mode: mk2, deco: d[0], cls: "REFUSED_BUT_DAMAGE", text: textW, muts: rw.muts, errors: rw.errors, thrown: rw.thrown, poison: rw.poison.concat(rw.poison2), promptThrow: rw.promptThrow });
      });
    });
  });
});
fs.writeFileSync(OUT, JSON.stringify({ tree: L.TREE, runs: n, counts: counts, results: results }, null, 1));
console.log("tree " + L.TREE + ": " + n + " word/control pairs in " + Math.round((Date.now() - t0) / 1000) + "s; templates " + T.length + ", decorations " + D.length);
Object.keys(counts).sort().forEach(function (k) { console.log("  " + k + ": " + counts[k]); });
console.log("non-trivial results written to " + OUT + " (" + results.length + ")");
