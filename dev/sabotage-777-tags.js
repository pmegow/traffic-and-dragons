// sabotage-777-tags.js — retained proof for audit 2026-11-19 (TODO #777), sections T and P: the tag parser, the clock's
// durations and schedule bounds, and the applyMuts boundary.
//   tag_table.js   T1 DOWNED_RESOLVED on a hero who is not down · T2/T11 a field cannot run past its bracket · T3 the tier
//                  range · T4 unreadable durations · T5 the last [TIME:] · T6 the near-miss tripwire · T7 schedule refusals
//                  said · T8 companion names without case · T9 the companion XP clamp · T10 gold, heal and 0-HP bounds ·
//                  P3 one rule for case · P4 the unclosed-opener pre-pass
//   clock.js       T4 parseDuration · T7 the schedule's bounds
//   helpers.js     T3 a tier on file is read inside the range
//   memory.js      T7 a refused event is kept as pending
//   api.js         P1/P4 the pre-pass at both doors · P5 a handler that threw is said, reported and recorded
//   game.js        P2 a model-written spell definition opens no tag and runs under the whitelist
// Each clause runs ONE named case of dev/tests-777-tags.js (the suite's own --only).
var sabotage = require("./sabotage.js");
var TAGS = ["node", ["dev/tests-777-tags.js"]], ONLY = "FAIL #777 ";
var failed = 0;
function prove(file, cases) { failed += sabotage.prove({ file: file, command: TAGS, only: ONLY, cases: cases }); }

var T1_DEAD = ONLY + "T1: [DOWNED_RESOLVED:dead] on a hero who is not down kills nobody and says why";
var T1_RESC = ONLY + "T1: [DOWNED_RESOLVED:rescued] on a hero who is not down files no Defining Moment";
var T2_SHORT = ONLY + "T2: a tag one field short does not swallow the tag after it";
var T2_SRC = ONLY + "T2: no tag handler in tag_table.js has a field that can run past its closing bracket";
var T3_OUT = ONLY + "T3: a spell definition with a tier outside the bible's range is refused";
var T3_IN = ONLY + "T3: a tier inside the range is defined as before, and the pool follows it";
var T4_DUR = ONLY + "T4: a duration is read whole";
var T4_ADV = ONLY + "T4: [TIME_ADVANCE:1.5h] advances ninety minutes";
var T4_SCH = ONLY + "T4: [SCHEDULE:";
var T5 = ONLY + "T5: after a rest that names dawn";
var T6 = ONLY + "T6: a common malformed tag is named to the player, not stripped in silence";
var T7 = ONLY + "T7: the schedule refuses a 65th pending entry";
var T7_KEPT = ONLY + "T7: a future event the schedule refuses is kept as a pending event, not dropped";
var T8 = ONLY + "T8: a companion's conditions and abilities compare names without case";
var T9 = ONLY + "T9: a companion's XP award is cut to ten times its level";
var T10 = ONLY + "T10: an absurd gold figure is refused";
var T11 = ONLY + "T11: a tag the tripwire calls dropped is not applied by a looser pattern beside it";
var P1 = ONLY + "P1: in a review call an unclosed allowed tag does not carry a forbidden tag past the whitelist";
var P2 = ONLY + "P2: a model-written companion spell definition cannot open another tag";
var P3 = ONLY + "P3: a tag written in lower case is not applied";
var P4 = ONLY + "P4: an unclosed tag does not remove the prose after it from the story";
var P4_CLOSED = ONLY + "P4: closed tags, bracketed prose and a tag cut off at the very end are untouched";
var P5 = ONLY + "P5: a tag handler that throws is said to the player, reported and recorded on the provenance ring";

prove("tag_table.js", [
  { label: "T1: a hero who is not down is resolved dead anyway",
    find: "if(!_wasDown){if(typeof console!==\"undefined\")console.warn(\"[downed] [DOWNED_RESOLVED:\"", replace: "if(false){if(typeof console!==\"undefined\")console.warn(\"[downed] [DOWNED_RESOLVED:\"", mustFail: T1_DEAD },
  { label: "T1: a rescue of a hero who is not down files a Defining Moment",
    find: "if(!_wasDown){if(typeof console!==\"undefined\")console.warn(\"[downed] [DOWNED_RESOLVED:\"", replace: "if(!_wasDown&&_out===\"dead\"){if(typeof console!==\"undefined\")console.warn(\"[downed] [DOWNED_RESOLVED:\"", mustFail: T1_RESC },
  { label: "T2: LOCATION_SIZE's first field runs past its bracket again",
    find: "var lsize=text.match(/\\[LOCATION_SIZE:([^|\\]]+)\\|", replace: "var lsize=text.match(/\\[LOCATION_SIZE:([^|]+)\\|", mustFail: T2_SHORT },
  { label: "T2: SAVE_MOD's first field runs past its bracket again (the source scan)",
    find: "var saveTags=text.match(/\\[SAVE_MOD:([^|\\]]+)\\|", replace: "var saveTags=text.match(/\\[SAVE_MOD:([^|]+)\\|", mustFail: T2_SRC },
  { label: "T11: COMBAT_START's dice field runs past its bracket, so a tag called dropped opens a fight",
    find: "var cs2=csTags[csi].match(/\\[COMBAT_START:([^|\\]]+)\\|(\\d+)\\|(\\d+)\\|([+-]?\\d+)\\|([^|\\]]+)\\|([^\\]]+)\\]/);if(!cs2)continue;",
    replace: "var cs2=csTags[csi].match(/\\[COMBAT_START:([^|\\]]+)\\|(\\d+)\\|(\\d+)\\|([+-]?\\d+)\\|([^|]+)\\|([^\\]]+)\\]/);if(!cs2)continue;", mustFail: T2_SRC },
  { label: "T3: a tier outside the bible's range is filed",
    find: "if(sdEntry.tier<0||sdEntry.tier>capTierMax()){", replace: "if(false){", mustFail: T3_OUT },
  { label: "T3: a negative tier is filed",
    find: "if(sdEntry.tier<0||sdEntry.tier>capTierMax()){", replace: "if(sdEntry.tier>capTierMax()){", mustFail: T3_OUT },
  { label: "T4: an unreadable [TIME_ADVANCE:] is charged a minute in silence",
    find: "if(!durationReadable(m[1])){R.muts.push(\"⚠ [TIME_ADVANCE:\"", replace: "if(false){R.muts.push(\"⚠ [TIME_ADVANCE:\"", mustFail: T4_ADV },
  { label: "T4: a [SCHEDULE:] the clock cannot read is scheduled a minute out",
    find: "if(!durationReadable(m[2])){var _sfe=", replace: "if(false){var _sfe=", mustFail: T4_SCH },
  { label: "T5: the FIRST [TIME:] of a reply is read",
    find: "timeTag=_timeAll.length?_timeAll[_timeAll.length-1].match(", replace: "timeTag=_timeAll.length?_timeAll[0].match(", mustFail: T5 },
  { label: "T6: a bare [REST] or [COMBAT_END] is not looked at",
    find: "\"+name+(bareToo?\"(?::[^\\\\]]*)?\":\":[^\\\\]]*\")+\"", replace: "\"+name+(false?\"(?::[^\\\\]]*)?\":\":[^\\\\]]*\")+\"", mustFail: T6 },
  { label: "T6: [GOLD:a few coppers] is stripped in silence",
    find: "{t:\"GOLD\",apply:function(text,R){__tagNearMiss(text,R,\"GOLD\",", replace: "{t:\"GOLD\",apply:function(text,R){if(0)__tagNearMiss(text,R,\"GOLD\",", mustFail: T6 },
  { label: "T6: [NPC:Name] alone is stripped in silence",
    find: "__tagNearMiss(text,R,\"NPC\",\"^", replace: "if(0)__tagNearMiss(text,R,\"NPC\",\"^", mustFail: T6 },
  { label: "T6: [QUEST:title] without a status is stripped in silence",
    find: "{t:\"QUEST\",apply:function(text,R){__tagNearMiss(text,R,\"QUEST\",", replace: "{t:\"QUEST\",apply:function(text,R){if(0)__tagNearMiss(text,R,\"QUEST\",", mustFail: T6 },
  { label: "T6: [XP:-50] is stripped in silence",
    find: "{t:\"XP\",apply:function(text,R){__tagNearMiss(text,R,\"XP\",", replace: "{t:\"XP\",apply:function(text,R){if(0)__tagNearMiss(text,R,\"XP\",", mustFail: T6 },
  { label: "T6: [SUBLOCATION_LEAVE:x] is stripped in silence",
    find: "{t:\"SUBLOCATION_LEAVE\",apply:function(text,R){__tagNearMiss(", replace: "{t:\"SUBLOCATION_LEAVE\",apply:function(text,R){if(0)__tagNearMiss(", mustFail: T6 },
  { label: "T6: a bare [COMBAT_END] is stripped in silence",
    find: "  __tagNearMiss(text,R,\"COMBAT_END\",", replace: "  if(0)__tagNearMiss(text,R,\"COMBAT_END\",", mustFail: T6 },
  { label: "T7: a refused schedule entry is not said",
    find: "if(!ev&&scheduleAdd._lastRefusal){R.muts.push(\"⚠ Not scheduled: \"", replace: "if(false){R.muts.push(\"⚠ Not scheduled: \"", mustFail: T7 },
  { label: "T7: a cut label is not said",
    find: "if(ev&&scheduleAdd._lastCut)R.muts.push(", replace: "if(false)R.muts.push(", mustFail: T7 },
  { label: "T8: a companion's condition is matched by exact case",
    find: "if(String(cCondCs.conditions[cCondj].name||\"\").toLowerCase()===cCnm.toLowerCase()){", replace: "if(cCondCs.conditions[cCondj].name===cCnm){", mustFail: T8 },
  { label: "T8: a companion's cure is matched by exact case",
    find: "return String((x&&x.name)||\"\").toLowerCase()!==cCrp[2].trim().toLowerCase();", replace: "return x.name!==cCrp[2].trim();", mustFail: T8 },
  { label: "T8: a companion's ability is matched by exact case",
    find: "if(String(cAbCs.abilities[cAbj].nm||\"\").toLowerCase()===cAnm.toLowerCase()){cAalready=true;", replace: "if(cAbCs.abilities[cAbj].nm===cAnm){cAalready=true;", mustFail: T8 },
  { label: "T9: a companion's XP award is unbounded",
    find: "if(cXpGot>cXpCap){", replace: "if(false){", mustFail: T9 },
  { label: "T9: the clamp ignores the companion's level",
    find: "*Math.max(1,cXpCs.level||1);", replace: "*1000;", mustFail: T9 },
  { label: "T10: a gold figure of any size is applied",
    find: "if(!isFinite(_g.cp)||Math.abs(_g.cp)>GOLD_TAG_MAX_CP){", replace: "if(false){", mustFail: T10 },
  { label: "T10: a heal takes a foe above its maximum",
    find: "&&foe.hp>foe.maxHp)foe.hp=foe.maxHp;", replace: "&&false)foe.hp=foe.maxHp;", mustFail: T10 },
  { label: "T10: a foe is started at 0 HP",
    find: "if(!(parseInt(cs2[2])>=1)||", replace: "if(", mustFail: T10 },
  { label: "P3: REST is matched without regard to case",
    find: "\\b[^\\]]*\\]/.test(text)&&typeof restSpells===\"function\"){", replace: "\\b[^\\]]*\\]/i.test(text)&&typeof restSpells===\"function\"){", mustFail: P3 },
  { label: "P3: ALIGNMENT is matched without regard to case",
    find: "([+-]\\d+)\\]/g)||[];var ali;for(ali=0;ali<alms.length;ali++){var ap=alms[ali].match(/\\[ALIGNMENT:([Ll][Aa][Ww]|[Gg][Oo][Oo][Dd])([+-]\\d+)\\]/);",
    replace: "([+-]\\d+)\\]/gi)||[];var ali;for(ali=0;ali<alms.length;ali++){var ap=alms[ali].match(/\\[ALIGNMENT:([Ll][Aa][Ww]|[Gg][Oo][Oo][Dd])([+-]\\d+)\\]/i);", mustFail: P3 },
  { label: "P3: COMPANION_ALIGNMENT is matched without regard to case",
    find: "([+-]\\d+)\\]/g)||[];var cAli;for(cAli=0;cAli<cAlTags.length;cAli++){var cAlp=cAlTags[cAli].match(/\\[COMPANION_ALIGNMENT:([^|\\]]+)\\|([Ll][Aa][Ww]|[Gg][Oo][Oo][Dd])([+-]\\d+)\\]/);",
    replace: "([+-]\\d+)\\]/gi)||[];var cAli;for(cAli=0;cAli<cAlTags.length;cAli++){var cAlp=cAlTags[cAli].match(/\\[COMPANION_ALIGNMENT:([^|\\]]+)\\|([Ll][Aa][Ww]|[Gg][Oo][Oo][Dd])([+-]\\d+)\\]/i);", mustFail: P3 },
  { label: "P4: the unclosed rule drops a CLOSED tag that a bracket follows",
    find: "var TAG_UNCLOSED_RE=/\\[([A-Z][A-Z_]{1,}):(?=[^\\]\\[]*\\[([A-Z]", replace: "var TAG_UNCLOSED_RE=/\\[([A-Z][A-Z_]{1,}):(?=[^\\[]*\\[([A-Z]", mustFail: P4_CLOSED },
  { label: "P4: the unclosed rule records no names",
    find: "  tagDropUnclosed._last=names;\n", replace: "", mustFail: P4 }
]);
prove("clock.js", [
  { label: "T4: a decimal duration loses its whole part (1.5h is 5 hours)",
    find: "var DURATION_PART=/(\\d+(?:\\.\\d+)?|\\.\\d+)\\s*", replace: "var DURATION_PART=/(\\d+)\\s*", mustFail: T4_DUR },
  { label: "T4: any word that begins with a unit letter is that unit (10 months is ten minutes)",
    find: "|minutes?|mins?|m)(?![a-z])/g;", replace: "|minutes?|mins?|m)/g;", mustFail: T4_DUR },
  { label: "T4: weeks are not read",
    find: "u===\"w\"?v*7*MIN_PER_DAY : u===\"d\"?v*MIN_PER_DAY", replace: "u===\"w\"?0 : u===\"d\"?v*MIN_PER_DAY", mustFail: T4_DUR },
  { label: "T7: the schedule takes any number of entries",
    find: "if(c.schedule.length>=SCHEDULE_MAX){", replace: "if(false){", mustFail: T7 },
  { label: "T7: the schedule takes an entry any distance out",
    find: "if(mins>SCHEDULE_HORIZON_MIN){", replace: "if(false){", mustFail: T7 },
  { label: "T7: a label of any length is kept",
    find: "if(lbl.length>SCHEDULE_LABEL_MAX){", replace: "if(false){", mustFail: T7 }
]);
prove("helpers.js", [
  { label: "T3: a tier already on a save is read outside the range",
    find: "return Math.max(0,Math.min(capTierMax(),e.tier));", replace: "return e.tier;", mustFail: T3_IN }
]);
prove("memory.js", [
  { label: "T7: a future event the schedule refuses is filed nowhere",
    find: "return scheduled;}\n    /* audit 2026-11-19, T7:", replace: "return scheduled;}return null;\n    /* audit 2026-11-19, T7:", mustFail: T7_KEPT }
]);
prove("api.js", [
  { label: "P1: the unclosed rule does not run before the review whitelist",
    find: "  text=tagDropUnclosed(text);var _unclosed=tagDropUnclosed._last.slice();", replace: "  var _unclosed=[];", mustFail: P1 },
  { label: "P4: the strip removes the prose after an unclosed tag",
    find: "  t=tagDropUnclosed(t,true);", replace: "  ", mustFail: P4 },
  { label: "P4: an unclosed tag is not said",
    find: "for(_hEi=0;_hEi<_unclosed.length;_hEi++)R.muts.push(", replace: "for(_hEi=0;false;_hEi++)R.muts.push(", mustFail: P4 },
  { label: "P4: an unclosed tag is not on the provenance ring",
    find: "    if(_unclosed.length)_tlEntry.unclosed=_unclosed.slice(0,6);", replace: "    ", mustFail: P4 },
  { label: "P5: a handler that threw is not said",
    find: "for(_hEi=0;_hEi<_hErr.length;_hEi++)R.muts.push(", replace: "for(_hEi=0;false;_hEi++)R.muts.push(", mustFail: P5 },
  { label: "P5: a handler that threw is not reported",
    find: "if(_hErr.length&&typeof reportError===\"function\")reportError(\"tag-handler\"", replace: "if(false)reportError(\"tag-handler\"", mustFail: P5 },
  { label: "P5: a handler that threw is not on the provenance ring",
    find: "    if(_hErr.length)_tlEntry.errors=_hErr.slice(0,6);", replace: "    ", mustFail: P5 }
]);
prove("game.js", [
  { label: "P2: an opening bracket survives in a model-written spell definition",
    find: ".replace(/[\\[\\]]/g,\"\")+\"]\";/* strip stray brackets", replace: ".replace(/\\]/g,\"\")+\"]\";/* strip stray brackets", mustFail: P2 },
  { label: "P2: the model-written definitions run through the whole parser",
    find: "applyMuts(tags.join(\"\"),{allow:[\"SPELL_DEF\"]});", replace: "applyMuts(tags.join(\"\"));", mustFail: P2 }
]);

// The independent review of this batch (commit 934e4d2b).
var RT1 = ONLY + "review T1: a heal in the same reply does not void the resolution";
var RP4 = ONLY + "review P4: a closed tag whose body holds a prose bracket still applies";
var RP1 = ONLY + "review P1: the unclosed rule and the whitelist run to a fixed point";
var RT7 = ONLY + "review T7: a future event the schedule refuses is said";
var RT4 = ONLY + "review T4: a when the clock reads in words is scheduled and said as scheduled";
var RT3 = ONLY + "review T3: a spell level on a sheet is read inside the bible's range";
var RT10 = ONLY + "review T10: the attribute tags of a foe that was refused bind to nobody";
var RDICE = ONLY + "review P4: the dice card reads no check from an unclosed tag";
prove("tag_table.js", [
  { label: "review T1: a hero who was down when the reply began is refused after a heal",
    find: "||!!R.wasDowned", replace: "", mustFail: RT1 },
  { label: "review T1: a hero dropped and healed in one reply is refused",
    find: "||!!R.downedThisReply", replace: "", mustFail: RT1 },
  { label: "review T1: a hero at 0 HP with no flag is refused",
    find: "||!(_dc.hp>0);if(!_wasDown)", replace: ";if(!_wasDown)", mustFail: RT1 },
  { label: "review P4: a bracketed aside in a body is not written as a parenthesis",
    find: "var names=[],out=tagProseAsides(text),prev", replace: "var names=[],out=text,prev", mustFail: RP4 },
  { label: "review P4: any bare upper-case marker in a body makes the tag unclosed",
    find: "if(sep!==\":\"&&!known[inner])return m;", replace: "if(false)return m;", mustFail: RP4 },
  { label: "review P4: an upper-case marker in a body is rewritten as an aside",
    find: "return /^[A-Z][A-Z_]*(?::|$)/.test(inner)?m:pre", replace: "return false?m:pre", mustFail: RP4 },
  { label: "review P1: the unclosed rule runs once",
    find: "}while(out!==prev&&++guard<50);", replace: "}while(false);", mustFail: RP1 },
  { label: "review T4: a when read in words is said as not scheduled",
    find: "if(_sfe&&typeof _sfe.dueMin===\"number\"){R.muts.push(\"Scheduled: \"", replace: "if(false){R.muts.push(\"Scheduled: \"", mustFail: RT4 },
  { label: "review T7: a refused future event is not said",
    find: "if(fileFutureEvent._lastRefusal)R.muts.push(", replace: "if(false)R.muts.push(", mustFail: RT7 },
  { label: "review T7: the line for an unreadable when carries the whole label",
    find: "R.muts.push(\"⚠ [SCHEDULE:\"+m[1].trim().slice(0,60)+\"] not put on the clock", replace: "R.muts.push(\"⚠ [SCHEDULE:\"+m[1].trim()+\"] not put on the clock", mustFail: RT7 },
  { label: "review T10: a refused foe's attribute tags go to another foe",
    find: "bound to nobody\");return null;}", replace: "bound to nobody\");}", mustFail: RT10 },
  { label: "review T10: a foe's HP has no upper bound",
    find: "||!(parseInt(cs2[2])<=COMBAT_HP_TAG_MAX)", replace: "", mustFail: RT10 }
]);
prove("clock.js", [
  { label: "review T4: a decimal comma is not a decimal point",
    find: ".replace(/(\\d),(\\d)/g,\"$1.$2\");/* #777 review", replace: ";/* #777 review", mustFail: RT4 },
  { label: "review T4: a leading point loses its point",
    find: "(\\d+(?:\\.\\d+)?|\\.\\d+)\\s*", replace: "(\\d+(?:\\.\\d+)?)\\s*", mustFail: RT4 }
]);
prove("memory.js", [
  { label: "review T7: a refused event keeps a when the clock can re-anchor",
    find: "\"the schedule refused it\";when=futureWhenOffClock(when);", replace: "\"the schedule refused it\";", mustFail: RT7 },
  { label: "review T7: a pending entry the sweep's schedule refuses is offered again every sweep",
    find: "else{promote[i].f.when=futureWhenOffClock(promote[i].f.when);", replace: "else{", mustFail: RT7 },
  { label: "review T7: the pending store takes a label of any length",
    find: "if(typeof SCHEDULE_LABEL_MAX===\"number\"&&what.length>SCHEDULE_LABEL_MAX)what=", replace: "if(false)what=", mustFail: RT7 }
]);
prove("helpers.js", [
  { label: "review T3: a sheet's own spell level is the cost, unbounded",
    find: "?Math.min(capTierMax(),sp.lvl):0;", replace: "?sp.lvl:0;", mustFail: RT3 }
]);
prove("api.js", [
  { label: "review P1: the whitelist strips once (a split name rebuilds a forbidden tag)",
    find: "}while(text!==_rvPrev&&++_rvGuard<20);", replace: "}while(false);", mustFail: RP1 },
  { label: "review P1: the unclosed rule is not asked again after the whitelist",
    find: "    text=tagDropUnclosed(text);_unclosed=_unclosed.concat(tagDropUnclosed._last);", replace: "    ", mustFail: RP1 },
  { label: "review P4: the dice card reads the raw reply",
    find: "if(typeof tagDropUnclosed===\"function\")t=tagDropUnclosed(String(t||\"\"),true);/* #777 review: this reader", replace: "/* #777 review: this reader", mustFail: RDICE }
]);

process.exit(failed ? 1 : 0);
