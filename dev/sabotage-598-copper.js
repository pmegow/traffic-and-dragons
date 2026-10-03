// dev/sabotage-598-copper.js — proves the #598 guards: the purse heals to copper on every road a sheet arrives by, a ware and a
// want carry their copper from the moment they are filed (parsed ONCE), a GOLD tag lands in the unit the GM wrote, and the
// one formatter shows copper as gold, silver and copper. Each mutation runs in a disposable clone (sabotage.js); the working
// tree is never mutated.
//   node dev/sabotage-598-copper.js
var sabotage = require("./sabotage.js"), code = 0;
function prove(file, cases) { if (!code) code = sabotage.prove({ file: file, command: ["node", ["dev/run-tests.js", "#598 the purse in copper"]], cases: cases }); }
prove("helpers.js", [
  { label: "the heal keeps the old gold field beside the new coin",
    find: "if(typeof sheet.coin!==\"number\"||isNaN(sheet.coin))sheet.coin=Math.round(sheet.gold*100);delete sheet.gold;ch=true;}", replace: "if(typeof sheet.coin!==\"number\"||isNaN(sheet.coin))sheet.coin=Math.round(sheet.gold*100);ch=true;}",
    mustFail: "#598 ① the purse heals" },
  { label: "the heal converts gold one-for-one (12 gp becomes 12 cp)",
    find: "sheet.coin=Math.round(sheet.gold*100);", replace: "sheet.coin=Math.round(sheet.gold);",
    mustFail: "#598 ① the purse heals" },
  { label: "a sheet carrying both fields loses its copper to the old gold",
    find: "  if(typeof sheet.gold===\"number\"&&!isNaN(sheet.gold)){if(typeof sheet.coin!==\"number\"||isNaN(sheet.coin))sheet.coin=Math.round(sheet.gold*100);", replace: "  if(typeof sheet.gold===\"number\"&&!isNaN(sheet.gold)){sheet.coin=Math.round(sheet.gold*100);",
    mustFail: "#598 ① the purse heals" },
  { label: "fmtCoin shows whole gold only (the small coins vanish from every display)",
    find: "if(g)p.push(g+\" gp\");if(s)p.push(s+\" sp\");if(c)p.push(c+\" cp\");", replace: "if(g)p.push(g+\" gp\");",
    mustFail: "#598 ③ the one formatter" },
  { label: "the old quest record's gold is read as copper (a 10 gp reward becomes 10 cp)",
    find: "return typeof p.gold===\"number\"?Math.round(p.gold*100):0;}", replace: "return typeof p.gold===\"number\"?Math.round(p.gold):0;}",
    mustFail: "#598 ④ an old quest record" }
]);
prove("identity.js", [
  { label: "a sheet entering through the adapter keeps its whole-gold purse",
    find: "  if(typeof coinHeal===\"function\"&&(\"gold\" in sheet||\"coin\" in sheet||\"hp\" in sheet))coinHeal(sheet);", replace: "",
    mustFail: "#598 ① the purse heals" }
]);
prove("game.js", [
  { label: "the boot heal skips the companions",
    find: "  for(i=0;i<ns.length;i++)if(ns[i]&&ns[i].charSheet&&coinHeal(ns[i].charSheet))n++;", replace: "",
    mustFail: "#598 ① the purse heals" },
  { label: "a model-written companion's gold is held as gold",
    find: "s.coin=Math.min(10000,Math.floor(raw.gold))*100;", replace: "s.coin=Math.min(10000,Math.floor(raw.gold));",
    mustFail: "#598 ① the purse heals" }
]);
prove("memory.js", [
  { label: "a ware is filed without its copper (the counter reads nothing)",
    find: "row.cp=(_wc&&_wc.unit)?_wc.cp:null;row.per=_wc?_wc.per:1;", replace: "row.cp=null;row.per=1;",
    mustFail: "#598 ② a ware and a want" },
  { label: "a want is filed without its copper",
    find: "cp:(_oc&&_oc.unit)?_oc.unitCp:null,", replace: "cp:null,",
    mustFail: "#598 ② a ware and a want" },
  { label: "a row filed before copper is parsed on every read (and never keeps it)",
    find: "if(w.cp===undefined){var c=(typeof parseCoin===\"function\")?parseCoin(w.price):null;w.cp=(c&&c.unit)?c.cp:null;w.per=c?c.per:1;}", replace: "{var c=(typeof parseCoin===\"function\")?parseCoin(w.price):null;}",
    mustFail: "#598 ② a ware and a want" }
]);
prove("tag_table.js", [
  { label: "the GOLD handler reads copper as gold again",
    find: "    var dg=_g.cp,_gb=Number(worldState.character.coin)||0,", replace: "    var dg=_g.cp*(_g.unit===\"cp\"?100:1),_gb=Number(worldState.character.coin)||0,",
    mustFail: "#598 ⑤ the GM writes the coin it narrated" },
  { label: "the quest record keeps paid gold in gold",
    find: "memory.quests[_pk[_pi]].paid={xp:_rx?parseInt(_rx[1]):0,coin:_rg||0};", replace: "memory.quests[_pk[_pi]].paid={xp:_rx?parseInt(_rx[1]):0,gold:Math.round((_rg||0)/100)};",
    mustFail: "#598 ④ an old quest record" }
]);
prove("api.js", [
  { label: "the prompt's sheet line shows the purse in bare copper",
    find: "| Gold: \"+fmtCoin(c.coin)+\" | Alignment: \"", replace: "| Gold: \"+c.coin+\" cp | Alignment: \"",
    mustFail: "#598 ③ the one formatter" }
]);
process.exit(code);
