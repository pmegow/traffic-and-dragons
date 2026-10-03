// dev/sabotage-481-d5-coin.js — proves the #481 D5 guards are guarded: ONE coin parser (gp/sp/cp/pp, bundles) feeds the
// item values, the counter, pinning, the price band and the quest-reward parses; [GOLD:] refuses a non-gold unit and
// states what an overspend moved. Each mutation runs in a disposable clone.
//   node dev/sabotage-481-d5-coin.js
var sabotage = require("./sabotage.js"), code = 0;
var CMD = ["node", ["dev/run-tests.js", "#481 D5"]];
function prove(file, cases) { if (!code) code = sabotage.prove({ file: file, command: CMD, cases: cases }); }
prove("helpers.js", [
  { label: "silver and copper count as gold again (#598: every unit is copper)",
    find: "if(terms.length){for(i=0;i<terms.length;i++)cp+=Math.abs(parseFloat(terms[i][1]))*COIN_UNIT_CP[terms[i][2]];", replace: "if(terms.length){for(i=0;i<terms.length;i++)cp+=Math.abs(parseFloat(terms[i][1]))*100;",
    mustFail: "parseCoin reads gold, silver, copper" },
  { label: "a bundle prices each unit at the whole bundle",
    find: "  if(pm)per=pm[1]===\"dozen\"?12:Math.max(1,parseInt(pm[1],10));", replace: "  if(pm)per=1;",
    mustFail: "parseCoin reads gold, silver, copper" },
  { label: "mixed units no longer sum (1 gp 5 sp reads as 1 gp)",
    find: "while((m=re.exec(s))){if(!first)first=m;if(m[2])terms.push(m);}", replace: "while((m=re.exec(s))){if(!first)first=m;if(m[2]&&!terms.length)terms.push(m);}",
    mustFail: "parseCoin reads gold, silver, copper" },
  { label: "itemValueCp reads every value as gold",
    find: "_coinValueCache[v]=(c&&c.unit)?c.unitCp:null;", replace: "_coinValueCache[v]=c?Math.round(parseFloat(v)*100):null;",
    mustFail: "itemValueCp prices ONE unit" },
  { label: "the purse reads a GOLD tag in gold whatever its unit",
    find: "var lm=re.exec(s),lv=parseFloat(lm[1]),lcp=Math.round(lv*(lm[2]?COIN_UNIT_CP[lm[2]]:100));", replace: "var lm=re.exec(s),lv=parseFloat(lm[1]),lcp=Math.round(lv*100);",
    mustFail: "[GOLD:] lands the coin in the unit the GM wrote" },
  { label: "the counter buys one arrow of a bundle at most",
    find: "var bq=Math.min(mb[k]|0,b.per||1);", replace: "var bq=Math.min(mb[k]|0,1);",
    mustFail: "the counter trades in silver and copper" },
  { label: "the bundle row offers one",
    find: "max:b.per||1,/* #481 D5 */", replace: "max:1,",
    mustFail: "the counter trades in silver and copper" },
  { label: "a bundle line charges the whole bundle for any share",
    find: "var lc=Math.round(b.cp*bq/(b.per||1));", replace: "var lc=b.cp;",
    mustFail: "the counter trades in silver and copper" },
  { label: "small sums read as whole gold again (fmtCoin drops the small coins)",
    find: "if(g)p.push(g+\" gp\");if(s)p.push(s+\" sp\");if(c)p.push(c+\" cp\");", replace: "if(g)p.push(g+\" gp\");",
    mustFail: "the counter trades in silver and copper" },
  { label: "a reward in silver is lost (goldRewardIn reads gold only)",
    find: "for(i=0;i<tags.length;i++){var g=goldTagParse(tags[i]);if(g.ok&&g.cp>0)return g.cp;}", replace: "for(i=0;i<tags.length;i++){var g=goldTagParse(tags[i]);if(g.ok&&g.cp>=1000)return g.cp;}",
    mustFail: "the quest reward parses read the same coin" }
]);
prove("tag_table.js", [
  { label: "the receipt names the ask, not what moved",
    find: "    if(_gm!==0||dg===0)R.muts.push((_gm>0?\"+\":_gm<0?\"-\":\"\")+fmtCoin(Math.abs(_gm)));", replace: "    R.muts.push((dg>0?\"+\":dg<0?\"-\":\"\")+fmtCoin(Math.abs(dg)));",
    mustFail: "[GOLD:] lands the coin in the unit the GM wrote" },
  { label: "the overspend goes unsaid",
    find: "    if(dg<0&&_gm!==dg)R.muts.push(\"⚠ Overspend — \"", replace: "    if(false)R.muts.push(\"⚠ Overspend — \"",
    mustFail: "[GOLD:] lands the coin in the unit the GM wrote" },
  { label: "the band receipt shows canon as bare copper",
    find: "rec+=\" (canon \"+((canon&&canon.value)?String(canon.value).trim():fmtCoin(cg))+\")\";", replace: "rec+=\" (canon \"+cg+\" cp)\";",
    mustFail: "a pinned ware keeps canon's own words" }
]);
prove("memory.js", [
  { label: "a pinned ware reads as a fraction of gold",
    find: "var _pinTo=String(_pc.value).trim(),", replace: "var _pinTo=_pg+\" gp\",",
    mustFail: "a pinned ware keeps canon's own words" }
]);
prove("api.js", [
  { label: "the payout verifier counts a silver token as nothing (the sum loses the 50 sp)",
    find: "var _gt=goldTagParse(m[0]);if(_gt.ok){kind=\"gold\";key=\"gold\";expect=_gt.cp;}}", replace: "var _gt=goldTagParse(m[0]);if(_gt.ok){kind=\"gold\";key=\"gold\";expect=_gt.unit&&_gt.unit!==\"gp\"?0:_gt.cp;}}",
    mustFail: "the quest reward parses read the same coin" }
]);
process.exit(code);
