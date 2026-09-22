// dev/sabotage-429-inventory-drop.js — proves the #429 guards are guarded: the pure plan resolves by index AND name
// (never trusting a shifted index, never claiming one row twice), the apply splices highest-first, the toggle is
// pure, the button text pluralizes; on the sheet: the × marks instead of dropping, the commit prunes worn, saves,
// names stale marks and refuses loudly, the render marks through the resolved plan, paints red, labels the × as
// the un-mark, shows the button only while something is marked and at the foot of the list, both sheet hosts
// discard on close (loudly), and marks never cross a campaign switch. Each mutation runs in a disposable clone
// (sabotage.js proveScratch); nothing here touches the working tree.
//   node dev/sabotage-429-inventory-drop.js
var sabotage = require("./sabotage.js"), code = 0;
function prove(file, command, cases) { if (!code) code = sabotage.prove({ file: file, command: command, cases: cases }); }
var ENGINE = ["node", ["dev/run-tests.js", "#429 batch"]], SHEET = ["node", ["dev/tests-429-inventory-drop.js"]];
prove("helpers.js", ENGINE, [
  { label: "the plan trusts a marked index blindly (a GM splice would drop the row that slid in)",
    find: 'if(idx>=0&&idx<inv.length&&inv[idx]===name&&!seen[idx])at=idx;', replace: 'if(idx>=0&&idx<inv.length&&!seen[idx])at=idx;',
    mustFail: "invDropPlan" },
  { label: "the plan lets two marks claim one row",
    find: 'if(inv[i]===name&&!seen[i]){at=i;break;}', replace: 'if(inv[i]===name){at=i;break;}',
    mustFail: "invDropPlan" },
  { label: "the apply splices lowest index first (every later index is off by one)",
    find: 'for(i=plan.drop.length-1;i>=0;i--)inv.splice(plan.drop[i].idx,1);', replace: 'for(i=0;i<plan.drop.length;i++)inv.splice(plan.drop[i].idx,1);',
    mustFail: "invDropApply" },
  { label: "the toggle mutates its input",
    find: 'marks=marks||{};var k=invDropMarkKey(idx,name),out={},m;', replace: 'marks=marks||{};var k=invDropMarkKey(idx,name),out=marks,m;',
    mustFail: "invDropToggle" },
  { label: "the button text loses its plural",
    find: 'return "Drop "+n+" item"+(n===1?"":"s");', replace: 'return "Drop "+n+" item";',
    mustFail: "the button text" }
]);
prove("ui-sheets.js", SHEET, [
  { label: "the × drops at once again (the per-item thorn is back)",
    find: '_invDropMarks.by[owner]=invDropToggle(_invDropMarksFor(owner),idx,cs.inventory[idx]);', replace: 'cs.inventory.splice(idx,1);saveAll();',
    mustFail: "the × marks a row" },
  { label: "the commit forgets to prune worn (a dropped worn sword rides every prompt)",
    find: '  if(typeof wornPrune==="function")wornPrune(cs);/* audit E4/#388: nothing is worn that is not carried — a dropped worn sword otherwise rode attireLine into every prompt */\n', replace: '',
    mustFail: "worn pruned" },
  { label: "the commit forgets to save",
    find: '  saveAll();\n  if(typeof showToast==="function")showToast("Dropped "', replace: '  if(typeof showToast==="function")showToast("Dropped "',
    mustFail: "one save" },
  { label: "a commit that resolves nothing is silent",
    find: 'if(!plan.ok){if(typeof showToast==="function")showToast("Nothing to drop"+stale,5000);_invSheetRepaint(owner);return;}', replace: 'if(!plan.ok){_invSheetRepaint(owner);return;}',
    mustFail: "refused loudly" },
  { label: "a stale mark vanishes from the commit toast",
    find: '+invDropNamesText(names)+stale,6000)', replace: '+invDropNamesText(names),6000)',
    mustFail: "reported in the same toast" },
  { label: "the render marks rows by raw key instead of the resolved plan",
    find: 'var _mkPlan=_canDrop?invDropPlan(c.inventory,_invDropMarksFor(invOwner)):{drop:[],count:0},_mkAt={},_mi;for(_mi=0;_mi<_mkPlan.drop.length;_mi++)_mkAt[_mkPlan.drop[_mi].idx]=true;',
    replace: 'var _mkRaw=_canDrop?_invDropMarksFor(invOwner):{},_mkAt={},_mkPlan={count:0},_mk;for(_mk in _mkRaw){_mkAt[parseInt(_mk,10)]=true;_mkPlan.count++;}',
    mustFail: "shifted the array" },
  { label: "the button renders with nothing marked",
    find: 'if(_mkPlan.count)invRows+=\'<div class="cs-list-row inv-drop-bar"', replace: 'invRows+=\'<div class="cs-list-row inv-drop-bar"',
    mustFail: "no marks" },
  { label: "the button leaves the foot of the list",
    find: '    for(_gi=0;_gi<_grps.length;_gi++){\n      var _grp=_grps[_gi];',
    replace: '    if(_mkPlan.count)invRows+=\'<button id="inv-drop-btn">\'+invDropButtonText(_mkPlan.count)+\'</button>\';\n    for(_gi=0;_gi<_grps.length;_gi++){\n      var _grp=_grps[_gi];',
    mustFail: "foot of the list" },
  { label: "a marked row is not red",
    find: 'style="cursor:pointer;\'+(_marked?\'color:var(--dng);\':\'\')+\'">', replace: 'style="cursor:pointer;">',
    mustFail: "marked rows read red" },
  { label: "the × on a marked row no longer reads as the un-mark",
    find: 'title="\'+(_marked?\'Keep this item (un-mark)\':\'Mark this item to drop\')+\'"', replace: 'title="Mark this item to drop"',
    mustFail: "marked rows read red" },
  { label: "the hero sheet's close keeps the marks",
    find: 'closeId:"cs-x",outside:true,onClose:function(){var m=document.getElementById("cs-modal");if(m)m.remove();_invDropDiscard("");}}', replace: 'closeId:"cs-x",outside:true}',
    mustFail: "discard on close" },
  { label: "the companion sheet's close keeps the marks",
    find: 'closeId:"npc-x",outside:true,onClose:function(){var m=document.getElementById("npc-modal");if(m)m.remove();_invDropDiscard(name);}}', replace: 'closeId:"npc-x",outside:true}',
    mustFail: "discard on close" },
  { label: "the discard is silent",
    find: 'if(typeof showToast==="function")showToast(n+" mark"+(n===1?"":"s")+" cleared — nothing dropped",4000);', replace: 'void 0;',
    mustFail: "discards pending marks with a toast" },
  { label: "marks cross a campaign switch",
    find: 'if(_invDropMarks.camp!==camp){_invDropMarks.camp=camp;_invDropMarks.by={};}', replace: '',
    mustFail: "campaign switch" }
]);
process.exit(code);
