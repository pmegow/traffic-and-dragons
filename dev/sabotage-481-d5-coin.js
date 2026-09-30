// dev/sabotage-481-d5-coin.js — proves the #481 D5 guards are guarded: ONE coin parser (gp/sp/cp/pp, bundles) feeds the
// item values, the counter, pinning, the price band and the quest-reward parses; [GOLD:] refuses a non-gold unit and
// states what an overspend moved. Each mutation runs in a disposable clone.
//   node dev/sabotage-481-d5-coin.js
var sabotage = require("./sabotage.js"), code = 0;
var CMD = ["node", ["dev/run-tests.js", "#481 D5"]];
function prove(file, cases) { if (!code) code = sabotage.prove({ file: file, command: CMD, cases: cases }); }
prove("helpers.js", [
  { label: "silver and copper count as gold again",
    find: "gp=unit===\"sp\"?amount/10:unit===\"cp\"?amount/100:unit===\"pp\"?amount*10:amount;", replace: "gp=amount;",
    mustFail: "parseCoin reads gold, silver, copper" },
  { label: "a bundle prices each unit at the whole bundle",
    find: "per=pm?Math.max(1,parseInt(pm[1],10)):1;", replace: "per=1;",
    mustFail: "parseCoin reads gold, silver, copper" },
  { label: "itemValueGp reads gold only again",
    find: "function itemValueGp(entry){if(!entry||!entry.value)return null;var c=parseCoin(entry.value);return (c&&c.unit)?c.unitGp:null;}",
    replace: "function itemValueGp(entry){if(!entry||!entry.value)return null;var m=String(entry.value).replace(/,/g,\"\").match(/(\\d+(?:\\.\\d+)?)\\s*gp/i);return m?parseFloat(m[1]):null;}",
    mustFail: "itemValueGp prices ONE unit" },
  { label: "the purse converts a coin in any unit",
    find: "return {ok:!c.unit||c.unit===\"gp\",raw:raw,unit:c.unit,n:n};", replace: "return {ok:true,raw:raw,unit:c.unit,n:n};",
    mustFail: "[GOLD:] refuses a coin that is not gold" },
  { label: "the counter buys one arrow of a bundle at most",
    find: "var bq=Math.min(mb[k]|0,b.per||1);", replace: "var bq=Math.min(mb[k]|0,1);",
    mustFail: "the counter trades in silver and copper" },
  { label: "the bundle row offers one",
    find: "max:b.per||1,/* #481 D5 */", replace: "max:1,",
    mustFail: "the counter trades in silver and copper" },
  { label: "small sums read as fractions of gold again",
    find: "  var a=Math.abs(gp);if(a>0&&a<1){", replace: "  var a=Math.abs(gp);if(false){",
    mustFail: "the counter trades in silver and copper" },
  { label: "a silver reward reads as paid gold",
    find: "for(i=0;i<tags.length;i++){var g=goldTagParse(tags[i]);if(g.ok&&g.n>0)return g.n;}", replace: "for(i=0;i<tags.length;i++){var g=goldTagParse(tags[i]);if(g.n>0)return g.n;}",
    mustFail: "the quest reward parses read the same coin" }
]);
prove("tag_table.js", [
  { label: "the village lets the riders of a refused coin land (free bread)",
    find: "  if(_gbad.length&&typeof kindDef===\"function\"&&kindDef().tradeOnlyInShops){", replace: "  if(false){",
    mustFail: "in the village a coin in the wrong unit refuses the trade" },
  { label: "the receipt names the ask, not what moved",
    find: "    if(_gm!==0||dg===0)R.muts.push(_gm>0?\"+\"+_gm+\" gp\":_gm+\" gp\");", replace: "    R.muts.push(dg>0?\"+\"+dg+\" gp\":dg+\" gp\");",
    mustFail: "[GOLD:] refuses a coin that is not gold" },
  { label: "the overspend goes unsaid",
    find: "    if(dg<0&&_gm!==dg)R.muts.push(\"⚠ Overspend — \"", replace: "    if(false)R.muts.push(\"⚠ Overspend — \"",
    mustFail: "[GOLD:] refuses a coin that is not gold" },
  { label: "the band receipt shows canon as a fraction of gold",
    find: "rec+=\" (canon \"+((canon&&canon.value)?String(canon.value).trim():cg+\" gp\")+\")\";", replace: "rec+=\" (canon \"+cg+\" gp)\";",
    mustFail: "a pinned ware keeps canon's own words" }
]);
prove("memory.js", [
  { label: "a pinned ware reads as a fraction of gold",
    find: "var _pinTo=String(_pc.value).trim(),", replace: "var _pinTo=_pg+\" gp\",",
    mustFail: "a pinned ware keeps canon's own words" }
]);
prove("api.js", [
  { label: "the payout verifier sums a silver token into the gold group",
    find: "var _gt=goldTagParse(m[0]);if(_gt.ok){kind=\"gold\";", replace: "var _gt=goldTagParse(m[0]);if(true){kind=\"gold\";",
    mustFail: "the quest reward parses read the same coin" }
]);
process.exit(code);
