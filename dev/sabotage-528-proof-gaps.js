// dev/sabotage-528-proof-gaps.js — #528: the proof gaps the 2026-10-01 reviewers found by mutating shipped code in memory while
// the suite stayed green. One clause per named gap, each anchored on the line the commit message claimed and no test pinned.
// The attribution word is the #528 section's title prefix; a clause caught by an OLDER test reads MISATTRIBUTED here, which
// says the gap was already closed elsewhere (recorded on the row), and a MISSED clause is a live gap.
//   node dev/sabotage-528-proof-gaps.js
var sabotage = require("./sabotage.js");
var CMD = ["node", ["dev/run-tests.js", "#528 proof"]];
var code = 0;
function prove(file, cases) { if (!code) code = sabotage.prove({ file: file, command: CMD, cases: cases }); }
var P = "#528 proof";
prove("tag_table.js", [
  { label: "c51d052 A4: the final fileSubLocation drops the world the arrival happened under (a sub named before a world move lands under the NEW world)",
    find: "      fileSubLocation(e.name,R.turn,e.world);\n", replace: "      fileSubLocation(e.name,R.turn);\n", mustFail: P },
  { label: "d42fd63 D2: a counted placement whose stash refused it puts back ONE unit (_lpn=1)",
    find: "_lpn=(typeof _qtyParse===\"function\")?_qtyParse(_lnm).n:1,", replace: "_lpn=1,", mustFail: P },
  { label: "2db7ac6 D3: the gain receipt prints the ASKED count, not the landed one",
    find: "R.muts.push(\"+\"+igq.base+(_igL>1?\" x\"+_igL:\"\")", replace: "R.muts.push(\"+\"+igq.base+(igq.n>1?\" x\"+igq.n:\"\")", mustFail: P },
  { label: "86698a8 D9/D1: the companion's auto-take writes no move record",
    find: "if(_cAt&&_cAt.taken)stashMoveRecord(R,{name:_cAt.name,units:_cAt.n||1,action:\"taken\",key:_cAt.key,by:cIgCs.name||cOwner,pack:{name:cIq.base,units:_cAt.n||1}});/* #481 D9/D1 */", replace: "", mustFail: P },
  { label: "86698a8 D9/D1: the companion's move record fixes units at 1",
    find: "stashMoveRecord(R,{name:_cAt.name,units:_cAt.n||1,action:\"taken\",key:_cAt.key,by:cIgCs.name||cOwner,pack:{name:cIq.base,units:_cAt.n||1}});", replace: "stashMoveRecord(R,{name:_cAt.name,units:1,action:\"taken\",key:_cAt.key,by:cIgCs.name||cOwner,pack:{name:cIq.base,units:1}});", mustFail: P },
  { label: "594cf54/6ef870e: the withheld sale no longer tells the GM (tradeRefusedPing dropped)",
    find: "worldState.tradeRefusedPing={turn:R.turn,reason:_sWhy.replace(\"the sheet\",\"the hero's sheet\"),items:true};R.goldIn=0;", replace: "R.goldIn=0;", mustFail: P },
  { label: "6ef870e: an empty purse writes a spend receipt again",
    find: "if(_gm!==0||dg===0)R.muts.push((_gm>0?\"+\":_gm<0?\"-\":\"\")+fmtCoin(Math.abs(_gm)));", replace: "R.muts.push((_gm>0?\"+\":_gm<0?\"-\":\"\")+fmtCoin(Math.abs(_gm)));", mustFail: P },
  { label: "91e50ea B4: a party member can be filed as a shop's keeper",
    find: "    else if(npc.partyMember)why=npc.name+\" travels with the party\";\n", replace: "", mustFail: P },
  { label: "91e50ea B4: the keeper is stored under the raw operand, not the roster name",
    find: "var prev=node.keeper;node.keeper=npc.name;", replace: "var prev=node.keeper;node.keeper=raw;", mustFail: P },
  { label: "5e9a116 #437: a want landing no longer toasts",
    find: "if(placed&&typeof showToast===\"function\")showToast((placed===\"active\"?", replace: "if(false)showToast((placed===\"active\"?", mustFail: P },
  { label: "5e9a116 #437: a settled purpose no longer toasts",
    find: "if(typeof showToast===\"function\")showToast(\"★ \"+gname+\" — purpose settled: \"+ms.how);continue;}", replace: "continue;}", mustFail: P },
  { label: "a2ddcec #490: the re-route receipt is gone (the ability lands on the companion in silence)",
    find: "R.muts.push(abWho+\": ability \"+abNm+\" (the tag named the hero; the description is theirs)\");}", replace: "}", mustFail: P }
]);
prove("identity.js", [
  { label: "313b621 B4: a frame at ANOTHER node counts as here (an observation there makes someone present at this node)",
    find: "var frameHere=!!(f&&f.node!=null&&locResolve(String(f.node))===here),last=null;", replace: "var frameHere=!!f,last=null;", mustFail: P }
]);
prove("state.js", [
  { label: "d42fd63 D2: the load no longer heals legacy stash rows",
    find: "if(typeof healStashRows===\"function\")healStashRows();", replace: "", mustFail: P }
]);
prove("api.js", [
  { label: "f1265cd C5: the outfit renders whatever its turn stamp (another campaign's clock)",
    find: "(typeof sceneTurnLive!==\"function\"||sceneTurnLive(cs.outfit.turn))?cs.outfit.text:\"\"", replace: "true?cs.outfit.text:\"\"", mustFail: P },
  { label: "d3d4f86 C4: the title note always advises ARC_COMPLETE, even for an act",
    find: "tag=continuing?\"ARC_CONTINUE\":q.kind===\"act\"?\"ACT_COMPLETE\":\"ARC_COMPLETE\";", replace: "tag=continuing?\"ARC_CONTINUE\":\"ARC_COMPLETE\";", mustFail: P },
  { label: "970a2bf B2: the cast ask loses its 'none means' sentence",
    find: " If the party is alone, emit [SCENE_CAST:none] — none means the whole party is here and no one else; a companion who is elsewhere is left out of a named cast.", replace: " If the party is alone, emit [SCENE_CAST:none].", mustFail: P },
  { label: "1bbf9f6 D8: the queue overflow is silent (no ⚠ line)",
    find: "if(q.length>=ITEM_DEF_QUEUE_CAP){if(R&&R.muts)R.muts.push(\"⚠ Too many new items at once — '\"+key+\"' will not be asked about (define it from the item sheet, or ask in Table Talk)\");", replace: "if(q.length>=ITEM_DEF_QUEUE_CAP){", mustFail: P }
]);
prove("admission.js", [
  { label: "f1265cd C5: the admission's scene step crosses nothing (an outfit from another campaign rides in)",
    find: "run:function(sheet){sceneFieldsCross(sheet);}},/* #481 C5", replace: "run:function(sheet){}},/* #481 C5", mustFail: P }
]);
prove("campaign_generator.js", [
  { label: "172a202 #459: the register gate no longer scans an arc's dnaHint",
    find: "chk(rn+\" dnaHint\",r.dnaHint);", replace: "", mustFail: P }
]);
prove("game.js", [
  { label: "86698a8 D1: the undo no longer refuses when the mover left the party (the actor filter)",
    find: "if(e.pack&&e.by&&e.by!==hero&&!(typeof findCompanionChar===\"function\"&&findCompanionChar(e.by)))return {ok:false,", replace: "if(false)return {ok:false,", mustFail: P },
  { label: "86698a8 D1: the undo no longer checks the mover still holds the pack half",
    find: "if(have<e.pack.units)return {ok:false,reason:e.pack.name+\" is no longer in \"", replace: "if(false)return {ok:false,reason:e.pack.name+\" is no longer in \"", mustFail: P },
  { label: "86698a8 D1: the undo no longer refuses from another place (the 'no longer where' refusal)",
    find: "if(e.key!==curKey&&(!node.parent||R2(node.parent)!==curWorld))return {ok:false,reason:\"you are no longer where \"+e.name+\" was moved\"};", replace: "", mustFail: P },
  { label: "605b557 B6: a resident at home is reported as somewhere 'this hour' (!wh.home dropped)",
    find: "if(wh&&!wh.home&&!(typeof scenePresentNow===\"function\"&&scenePresentNow(r.name)))return residentWhereText(r.name,wh)+\" this hour\";", replace: "if(wh&&!(typeof scenePresentNow===\"function\"&&scenePresentNow(r.name)))return residentWhereText(r.name,wh)+\" this hour\";", mustFail: P },
  { label: "605b557 B6: a resident standing in the scene is still reported elsewhere (the presence clause dropped)",
    find: "if(wh&&!wh.home&&!(typeof scenePresentNow===\"function\"&&scenePresentNow(r.name)))return residentWhereText(r.name,wh)+\" this hour\";", replace: "if(wh&&!wh.home)return residentWhereText(r.name,wh)+\" this hour\";", mustFail: P },
  { label: "36f6139 C11: the companion-sheet prompt's First met line is cut mid-word again",
    find: "known+=\"First met: \"+((typeof snippetAtSentence===\"function\")?snippetAtSentence(mem.firstEncounter):mem.firstEncounter)+\"\\n\";/* #481 C11 */", replace: "known+=\"First met: \"+mem.firstEncounter+\"\\n\";", mustFail: P },
  { label: "71a6e3d #469: the retold-memory gate never arms (the game.js gate was a source pin only)",
    find: "if(!_refusal&&typeof detectMomentRetelling===\"function\"){", replace: "if(false){", mustFail: P }
]);
process.exit(code);
