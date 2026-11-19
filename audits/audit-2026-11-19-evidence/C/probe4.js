var L=require('C:/Projects/traffic-and-dragons/dev/load-engine.js');
L.loadEngine();try{L.makeTestWorld();}catch(e){}
var g=global;
console.log("sayMoodSteer constructor:",JSON.stringify(g.sayMoodSteer("constructor")),"| toString valueOf:",JSON.stringify(g.sayMoodSteer("toString valueOf")),"| plodding:",JSON.stringify(g.sayMoodSteer("plodding")));
console.log("sayMoodShape constructor:",JSON.stringify(g.sayMoodShape("constructor")));
console.log("voiceAgeLabel constructor:",String(g.voiceAgeLabel("constructor")).slice(0,40),"| __proto__:",String(g.voiceAgeLabel("__proto__")).slice(0,40));
console.log("voiceAccentOf en-__:",g.voiceAccentOf("en-__"));
// STT: a spoken 'constructor' is never corrected (STT_COMMON inherits) - harmless direction
console.log("STT_COMMON constructor truthy:",!!g.STT_COMMON["constructor"]);
// worldStateNpcRows with a null faction entry
try{console.log(JSON.stringify(g.worldStateNpcRows([{name:"Bram",met:1}],g.keyedDict(),{Bram:[null]})));}catch(e){console.log("worldStateNpcRows null faction entry THREW:",e.message);}
// agendaSheetHtml with since from a crafted sheet
console.log(g.agendaSheetHtml({agenda:{want:"w",kind:"k",since:"<img src=x onerror=alert(1)>"}}));
// tableTalkWelcome partial tag
console.log(JSON.stringify(g.tableTalkWelcome({name:"<img src=x onerror=alert(1)"})));
// parseCheckTag: modifier forms
["Attack|+5 vs DC 15","Stealth|DC 14","Attack|+5 to hit|DC 15","Attack|+5 (Str 3, prof 2)|DC 15","Save|Wis +2 DC 13","Attack|+1d4|DC 10","Attack|5/3|DC 10"].forEach(function(b){var c=g.parseCheckTag(b);console.log("parseCheckTag",JSON.stringify(b),"-> mod",c.mod,"dc",c.dc,"dmg",c.dmg&&c.dmg.text);});
var c=g.parseCheckTag("Stealth|DC 14");console.log("resolveCheck nat 1:",g.resolveCheck(c,1).diceTag);
process.exit(0);
